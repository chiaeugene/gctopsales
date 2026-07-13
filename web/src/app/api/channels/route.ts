import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { CHANNELS } from "@/lib/constants";

// Manual-credentials phase of "connect your Meta": the agent pastes their own
// WhatsApp phone_number_id + token (or page id + page token for
// Messenger/Instagram). The future Embedded Signup OAuth flow writes into the
// same ChannelConnection rows, so nothing downstream changes.

const PostSchema = z.object({
  channel: z.enum(CHANNELS),
  externalId: z.string().min(3).max(100), // phone_number_id / page_id / ig_business_account_id
  accessToken: z.string().min(10),
  displayName: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = PostSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid channel payload");

    // A channel identity can belong to exactly one tenant.
    const existing = await prisma.channelConnection.findUnique({
      where: { channel_externalId: { channel: body.data.channel, externalId: body.data.externalId } },
    });
    if (existing && existing.profileId !== profile.id) {
      throw new ApiError(409, "This channel identity is already connected to another account.");
    }

    const connection = existing
      ? await prisma.channelConnection.update({
          where: { id: existing.id },
          data: {
            accessToken: body.data.accessToken,
            displayName: body.data.displayName ?? existing.displayName,
            isActive: true,
          },
        })
      : await prisma.channelConnection.create({
          data: {
            profileId: profile.id,
            channel: body.data.channel,
            externalId: body.data.externalId,
            accessToken: body.data.accessToken,
            displayName: body.data.displayName,
          },
        });

    // Token never leaves the server.
    return { id: connection.id, channel: connection.channel, externalId: connection.externalId };
  });
}

const DeleteSchema = z.object({ id: z.string() });

export async function DELETE(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = DeleteSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid payload");

    const connection = await prisma.channelConnection.findFirst({
      where: { id: body.data.id, profileId: profile.id },
    });
    if (!connection) throw new ApiError(404, "Connection not found");

    await prisma.channelConnection.delete({ where: { id: connection.id } });
    return { ok: true };
  });
}
