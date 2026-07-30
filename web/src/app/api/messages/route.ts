import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

// Removes a message from a conversation's history. This matters beyond tidiness:
// GC re-reads recent history before every reply, so a bad exchange (wrong
// language, wrong product) keeps influencing the next answers until it's gone.
//
// NOTE: this only clears OUR record. A message already delivered on WhatsApp
// stays in the customer's phone — the UI says so before confirming.
const DeleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = DeleteSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid payload");

    // Ownership: the message's conversation must belong to this tenant.
    const message = await prisma.message.findFirst({
      where: { id: body.data.id, conversation: { profileId: profile.id } },
      select: { id: true },
    });
    if (!message) throw new ApiError(404, "Message not found");

    await prisma.message.delete({ where: { id: message.id } });
    return { ok: true };
  }, "messages");
}
