import { prisma } from "@/lib/prisma";

// Meta redelivers a webhook whenever it does not get a fast 200 — on a slow
// reply, a deploy, a timeout. Message.externalId is unique so a redelivery
// cannot create a duplicate ROW, but that constraint fires at the very END of
// processing: by then the LLM has already run and the reply has already been
// sent, so the customer receives the same message twice and the agent pays
// twice. The unique index turned a redelivery into an error instead of a no-op.
//
// So the check has to happen BEFORE any work. Returns true if this exact
// message has already been handled.
export async function alreadyHandled(externalMessageId: string | null | undefined): Promise<boolean> {
  if (!externalMessageId) return false;
  const seen = await prisma.message.findUnique({
    where: { externalId: externalMessageId },
    select: { id: true },
  });
  return Boolean(seen);
}
