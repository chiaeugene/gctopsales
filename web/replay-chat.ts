/**
 * Replays Eugene's live WhatsApp chat: "pm skincare" as the FIRST message of a
 * fresh conversation. Checks the three things that went wrong.
 */
import { PrismaClient } from "@prisma/client";
import { generateGcReply } from "./src/lib/ai/engine";
import { splitIntoBubbles } from "./src/lib/ai/humanize";

const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DB_URL! } } });

const TURNS = ["pm skincare", "How can it helps me", "Too expensive"];

async function main() {
  const profile = await prisma.storeProfile.findFirstOrThrow({
    where: { user: { email: process.env.AS_AGENT ?? undefined } },
    orderBy: { createdAt: "asc" },
  });
  console.log(`as: ${profile.agentName} (emojiStyle=${profile.emojiStyle}, allowLists=${profile.allowLists})\n`);

  const order = await prisma.order.create({
    data: {
      profileId: profile.id,
      source: "PLAYGROUND",
      customerName: "shape test",
      conversation: { create: { profileId: profile.id, kind: "PLAYGROUND" } },
    },
    include: { conversation: true },
  });
  const conversationId = order.conversation!.id;

  let current = order;
  const bubbleCounts: number[] = [];
  for (const [i, text] of TURNS.entries()) {
    const { output, order: next, attachmentIds } = await generateGcReply({
      profile,
      order: current,
      conversationId,
      customerMessage: text,
    });
    // generateGcReply returns a bare Order; the engine wants the conversation on it.
    current = { ...next, conversation: order.conversation };
    await prisma.message.create({ data: { conversationId, role: "CUSTOMER", content: text } });
    await prisma.message.create({
      data: { conversationId, role: "GC", content: output.reply, attachmentIds: JSON.stringify(attachmentIds) },
    });

    const bubbles = splitIntoBubbles(output.reply);
    bubbleCounts.push(bubbles.length);
    const emoji = (output.reply.match(/\p{Extended_Pictographic}/gu) ?? []).join(" ");
    console.log(`--- turn ${i + 1}: "${text}"`);
    bubbles.forEach((b, j) => console.log(`  [${j + 1}] ${b.replace(/\n/g, "\n      ")}`));
    console.log(`  bubbles=${bubbles.length}  emoji=${emoji || "none"}  images=${attachmentIds.length}`);

    if (i === 0) {
      const price = /\b(RM|MYR|S\$|SGD)\s?\d{2,}/i.test(output.reply);
      const assumed = /\bacne\b|\bjerawat\b|\beczema\b|\bmelasma\b/i.test(output.reply);
      console.log(`  PRICE ON FIRST REPLY: ${price ? "FAIL" : "pass"}`);
      console.log(`  ASSUMED A CONDITION: ${assumed ? "FAIL" : "pass"}`);
    }
    console.log();
  }

  const allThree = bubbleCounts.every((c) => c === 3);
  console.log(`bubble counts: ${bubbleCounts.join(", ")}  ${allThree ? "FAIL (still always 3)" : "pass (varied)"}`);

  await prisma.order.delete({ where: { id: current.id } });
  console.log("(test conversation deleted)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
