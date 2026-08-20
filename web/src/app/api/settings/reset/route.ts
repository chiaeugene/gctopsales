import { handle, ApiError } from "@/lib/api";
import { requireProfile, PLATFORM_OWNER } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { parseJson, toJson } from "@/lib/json";

/**
 * Put GC back on the team defaults — the undo for setup and training gone wrong.
 *
 * Setup and training write into the profile's brains, which is the whole point,
 * but it also means an agent can talk GC into a corner and have no way back.
 * This copies the CURRENT master (platform owner) brains over theirs and deletes
 * their training examples, so GC behaves exactly like a fresh account again.
 *
 * What it deliberately KEEPS, because losing these would break things that have
 * nothing to do with GC's behaviour: their name and store, their payment details
 * (fulfillmentBrain), their products and photos, their WhatsApp connection, and
 * all their conversations. Reset changes how GC TALKS, not who the agent is.
 */
export async function POST() {
  return handle(async () => {
    const profile = await requireProfile();

    const owner = await prisma.user.findUnique({
      where: { email: PLATFORM_OWNER },
      include: { profile: true },
    });
    if (!owner?.profile) throw new ApiError(500, "The master account has no profile to copy from.");
    if (owner.profile.id === profile.id) {
      throw new ApiError(400, "This is the master account — its settings ARE the defaults.");
    }
    const master = owner.profile;

    // The master's salesBrain carries HER personal voice (styleProfile). A reset
    // should hand back neutral defaults, not somebody else's voice.
    const masterSales = parseJson<Record<string, unknown>>(master.salesBrain, {});
    delete masterSales.styleProfile;

    await prisma.$transaction([
      prisma.storeProfile.update({
        where: { id: profile.id },
        data: {
          identityBrain: master.identityBrain,
          salesBrain: toJson(masterSales),
          catalogRules: master.catalogRules,
          tone: master.tone,
          allowLists: master.allowLists,
          emojiStyle: master.emojiStyle,
          // fulfillmentBrain untouched: bank details are theirs.
        },
      }),
      // Training shaped the old behaviour; a reset that keeps it isn't a reset.
      prisma.trainingExample.deleteMany({ where: { profileId: profile.id } }),
    ]);

    logActivity({ profileId: profile.id, actor: profile.agentName ?? profile.id, type: "reset", summary: "Reset GC back to the team defaults" });
    return { ok: true };
  });
}
