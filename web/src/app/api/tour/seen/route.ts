import { handle } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

// The tour auto-opened for this agent — count it. Agents get two auto-openings;
// the count lives server-side so clearing the browser or switching devices does
// not restart the clock. Deliberate replays (?tour=1) never call this.
export async function POST() {
  return handle(async () => {
    const profile = await requireProfile();
    await prisma.storeProfile.update({
      where: { id: profile.id },
      data: { tourSeenCount: { increment: 1 } },
    });
    return { ok: true };
  });
}
