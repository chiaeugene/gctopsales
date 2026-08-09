import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

/**
 * Admin-only: wipe every conversation so a tester starts from a clean slate.
 *
 * DELETES chat history only — orders, conversations, messages, learning cases,
 * inbound attachments, and the error log.
 *
 * KEEPS everything that took work to build and that GC needs in order to sell:
 * users, profiles and their brains/settings, products and photos, testimonials,
 * the media library, discovery menus, share links, templates, channel
 * connections, and training examples. Wiping those would leave a working login
 * with nothing to say.
 *
 * Guarded two ways because it cannot be undone: admin session, and an exact
 * typed confirmation string. GET returns the counts so the UI can show what is
 * about to go.
 */
const CONFIRM = "DELETE ALL CHATS";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return {
      willDelete: {
        orders: await prisma.order.count(),
        conversations: await prisma.conversation.count(),
        messages: await prisma.message.count(),
        learningCases: await prisma.learningCase.count(),
        inboundAttachments: await prisma.inboundAttachment.count(),
        errors: await prisma.errorLog.count(),
      },
      willKeep: {
        agents: await prisma.user.count(),
        products: await prisma.product.count(),
        results: await prisma.testimonial.count(),
        library: await prisma.mediaAsset.count(),
        menus: await prisma.discoveryMenu.count(),
        trainingExamples: await prisma.trainingExample.count(),
      },
      confirmPhrase: CONFIRM,
    };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = z.object({ confirm: z.string() }).safeParse(await req.json());
    if (!body.success || body.data.confirm !== CONFIRM) {
      throw new ApiError(400, `Type "${CONFIRM}" exactly to confirm`);
    }

    // Children before parents. Message and Conversation cascade off Order, but
    // being explicit means a run that dies halfway cannot leave orphan rows.
    const deleted = {
      messages: (await prisma.message.deleteMany({})).count,
      conversations: (await prisma.conversation.deleteMany({})).count,
      orders: (await prisma.order.deleteMany({})).count,
      learningCases: (await prisma.learningCase.deleteMany({})).count,
      inboundAttachments: (await prisma.inboundAttachment.deleteMany({})).count,
      errors: (await prisma.errorLog.deleteMany({})).count,
    };
    return { deleted };
  });
}
