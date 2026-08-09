/**
 * Pre-launch audit. Read-only: reports, never writes.
 *
 * Checks the things that silently break a launch — a profile with no catalogue,
 * an agent who cannot take payment, an image format WhatsApp refuses, a dangling
 * foreign key, a seeded admin account nobody remembered to remove.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DB_URL! } } });

const problems: string[] = [];
const warnings: string[] = [];
const ok: string[] = [];

function P(s: string) {
  problems.push(s);
}
function W(s: string) {
  warnings.push(s);
}
function OK(s: string) {
  ok.push(s);
}

async function main() {
  // ---------------------------------------------------------------- users ----
  const users = await prisma.user.findMany({ include: { profile: { select: { id: true } } } });
  console.log(`users: ${users.length}`);
  for (const u of users) {
    if (!u.profile) P(`user ${u.email} has NO profile — every page will fail for them`);
    if (/admin@|test@|example\.|@gctopsales\.local/i.test(u.email)) {
      P(`seeded/placeholder account still exists: ${u.email} (${u.role}) — remove before launch`);
    }
  }
  const admins = users.filter((u) => u.role === "ADMIN");
  if (admins.length === 0) P("no ADMIN user — nobody can reach Admin tools");
  else OK(`${admins.length} admin(s), ${users.length - admins.length} agent(s)`);

  // ------------------------------------------------------------- profiles ----
  const profiles = await prisma.storeProfile.findMany({ include: { user: { select: { email: true } } } });
  for (const p of profiles) {
    const who = p.user.email;
    const brains = { identityBrain: p.identityBrain, salesBrain: p.salesBrain, fulfillmentBrain: p.fulfillmentBrain, catalogRules: p.catalogRules };
    for (const [k, v] of Object.entries(brains)) {
      let empty = true;
      try {
        empty = Object.keys(JSON.parse(v || "{}")).length === 0;
      } catch {
        P(`${who}: ${k} is not valid JSON`);
        continue;
      }
      if (empty) P(`${who}: ${k} is EMPTY — GC has no instructions for that area`);
    }

    const f = safeJson(p.fulfillmentBrain);
    const pm = String(f.paymentMethods ?? "");
    if (!pm) P(`${who}: no payment method at all — a ready buyer cannot pay`);
    else if (/CONFIGURE ME|UPDATE ME/i.test(pm)) P(`${who}: payment details are still the PLACEHOLDER — a ready buyer cannot pay`);
    else OK(`${who}: payment details set`);

    const [products, active, sgd, assets, activeAssets, menus, links, tests, testPhotos, channels] = await Promise.all([
      prisma.product.count({ where: { profileId: p.id } }),
      prisma.product.count({ where: { profileId: p.id, isActive: true } }),
      prisma.product.count({ where: { profileId: p.id, NOT: { priceMemberSgd: null } } }),
      prisma.mediaAsset.count({ where: { profileId: p.id } }),
      prisma.mediaAsset.count({ where: { profileId: p.id, isActive: true } }),
      prisma.discoveryMenu.count({ where: { profileId: p.id, isActive: true } }),
      prisma.shareLink.count({ where: { profileId: p.id, isActive: true } }),
      prisma.testimonial.count({ where: { profileId: p.id, isActive: true } }),
      prisma.testimonial.count({ where: { profileId: p.id, NOT: { photoMimeType: null } } }),
      prisma.channelConnection.count({ where: { profileId: p.id, isActive: true } }),
    ]);
    const noPhoto = await prisma.product.count({ where: { profileId: p.id, isActive: true, attachments: { none: {} } } });

    console.log(
      `\n${who}\n  products ${active}/${products} active, ${noPhoto} with NO photo, ${sgd} priced in SGD\n` +
        `  library ${activeAssets}/${assets} active · results ${tests} (${testPhotos} photos) · menus ${menus} · links ${links} · channels ${channels}`
    );

    if (products === 0) P(`${who}: NO products — GC cannot sell anything`);
    if (noPhoto > 0) W(`${who}: ${noPhoto} active product(s) with no photo — price will be quoted with no visual`);
    const marketsServed = safeJson(`{"m":${p.marketsServed}}`).m as string[] | undefined;
    if (Array.isArray(marketsServed) && marketsServed.includes("SG") && sgd === 0) {
      P(`${who}: serves SG but no product has an SGD price`);
    }
    if (tests === 0) W(`${who}: no customer results — GC has no proof to close with`);
    if (links === 0) W(`${who}: no links — GC cannot show an official page or certificate`);
    if (channels === 0) W(`${who}: no channel connected — GC cannot receive real customer messages`);
  }

  // ------------------------------------------------- formats and orphans ----
  const webp =
    (await prisma.productImage.count({ where: { mimeType: "image/webp" } })) +
    (await prisma.mediaAsset.count({ where: { mimeType: "image/webp" } })) +
    (await prisma.testimonial.count({ where: { photoMimeType: "image/webp" } }));
  if (webp > 0) P(`${webp} image(s) still WEBP — WhatsApp refuses these, they will never send`);
  else OK("no WEBP images anywhere (WhatsApp-safe)");

  const badMime = await prisma.mediaAsset.count({
    where: { NOT: { mimeType: { in: ["image/jpeg", "image/png", "application/pdf"] } } },
  });
  if (badMime > 0) P(`${badMime} library asset(s) in a format WhatsApp will not send`);

  // Dangling productId references (the column is a plain string, not a FK).
  const productIds = new Set((await prisma.product.findMany({ select: { id: true } })).map((x) => x.id));
  const assetsWithProduct = await prisma.mediaAsset.findMany({
    where: { NOT: { productId: null } },
    select: { id: true, productId: true, label: true },
  });
  const dangling = assetsWithProduct.filter((a) => a.productId && !productIds.has(a.productId));
  if (dangling.length) P(`${dangling.length} library asset(s) point at a product that no longer exists`);
  else OK("no dangling product references in the library");

  const noteless = await prisma.mediaAsset.count({ where: { note: null, isActive: true } });
  if (noteless > 0) W(`${noteless} active library asset(s) have no "when to send" note — GC has to guess`);

  // --------------------------------------------------------------- errors ----
  const errs = await prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
  if (errs.length) {
    console.log(`\nrecent errors (${await prisma.errorLog.count()} total):`);
    for (const e of errs) console.log(`  ${e.createdAt.toISOString().slice(0, 16)} [${e.route}] ${(e.message ?? "").slice(0, 110)}`);
  }

  // ------------------------------------------------------------- summary ----
  console.log("\n" + "=".repeat(64));
  console.log(`BLOCKERS ${problems.length}`);
  for (const p of problems) console.log(`  X  ${p}`);
  console.log(`\nWARNINGS ${warnings.length}`);
  for (const w of warnings) console.log(`  !  ${w}`);
  console.log(`\nPASSED ${ok.length}`);
  for (const o of ok) console.log(`  +  ${o}`);
}

function safeJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
