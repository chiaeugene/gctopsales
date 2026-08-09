/**
 * Wipe the conversation history so a tester starts from a clean slate.
 *
 * DELETES: orders, conversations, messages, learning cases, inbound
 * attachments, and the error log. These are all traces of past chats.
 *
 * KEEPS: users, profiles and their settings/brains, products and photos,
 * testimonials, the media library, discovery menus, share links, templates,
 * channel connections, and training examples. Those took real work to build and
 * are what makes GC able to sell — deleting them would leave a working account
 * that has nothing to say.
 *
 * Run with CONFIRM=yes to actually delete; without it, it only counts.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DB_URL! } } });

async function main() {
  const dry = process.env.CONFIRM !== "yes";
  const before = {
    orders: await prisma.order.count(),
    conversations: await prisma.conversation.count(),
    messages: await prisma.message.count(),
    learningCases: await prisma.learningCase.count(),
    inboundAttachments: await prisma.inboundAttachment.count(),
    errors: await prisma.errorLog.count(),
  };
  const kept = {
    users: await prisma.user.count(),
    products: await prisma.product.count(),
    productPhotos: await prisma.productImage.count(),
    testimonials: await prisma.testimonial.count(),
    library: await prisma.mediaAsset.count(),
    menus: await prisma.discoveryMenu.count(),
    links: await prisma.shareLink.count(),
    templates: await prisma.messageTemplate.count(),
    trainingExamples: await prisma.trainingExample.count(),
    channels: await prisma.channelConnection.count(),
  };

  console.log("TO DELETE");
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(20)} ${v}`);
  console.log("TO KEEP");
  for (const [k, v] of Object.entries(kept)) console.log(`  ${k.padEnd(20)} ${v}`);

  if (dry) {
    console.log("\nDRY RUN — nothing deleted. Re-run with CONFIRM=yes.");
    return;
  }

  // Children first: Message and Conversation cascade off Order in the schema,
  // but deleting explicitly in order means a partial run cannot leave orphans.
  console.log("\ndeleting…");
  console.log(`  messages           ${(await prisma.message.deleteMany({})).count}`);
  console.log(`  conversations      ${(await prisma.conversation.deleteMany({})).count}`);
  console.log(`  orders             ${(await prisma.order.deleteMany({})).count}`);
  console.log(`  learningCases      ${(await prisma.learningCase.deleteMany({})).count}`);
  console.log(`  inboundAttachments ${(await prisma.inboundAttachment.deleteMany({})).count}`);
  console.log(`  errors             ${(await prisma.errorLog.deleteMany({})).count}`);

  // Sanity: the things that must still be there.
  const after = {
    users: await prisma.user.count(),
    products: await prisma.product.count(),
    testimonials: await prisma.testimonial.count(),
    library: await prisma.mediaAsset.count(),
    orders: await prisma.order.count(),
    messages: await prisma.message.count(),
  };
  console.log("\nafter:", after);
  if (after.users !== kept.users || after.products !== kept.products || after.library !== kept.library) {
    console.log("WARNING: something that should have been kept was removed");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
