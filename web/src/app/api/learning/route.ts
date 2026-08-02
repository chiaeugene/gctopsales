import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { summarisePatterns } from "@/lib/learning";

// An agent sees their OWN cases plus anything the admin has shared with the
// team. Shared cases are already anonymised at build time, so no customer name
// or number crosses between agents.
export async function GET(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const url = new URL(req.url);
    const outcome = url.searchParams.get("outcome");

    const where = {
      OR: [{ profileId: profile.id }, { isShared: true }],
      ...(outcome === "WON" || outcome === "LOST" ? { outcome } : {}),
    };

    const cases = await prisma.learningCase.findMany({
      where,
      orderBy: [{ outcome: "asc" }, { createdAt: "desc" }],
      take: 60,
      include: { profile: { select: { agentName: true, storeName: true } } },
    });

    return {
      cases: cases.map((c) => ({
        id: c.id,
        outcome: c.outcome,
        headline: c.headline,
        whatWorked: c.whatWorked,
        whatToAvoid: c.whatToAvoid,
        keyQuote: c.keyQuote,
        turningPoint: c.turningPoint,
        transcript: c.transcript,
        productLine: c.productLine,
        market: c.market,
        valueMyr: c.valueMyr,
        score: c.score,
        isShared: c.isShared,
        isMine: c.profileId === profile.id,
        // Whose sale it was — useful for the team, and no customer data.
        agent: c.profile.agentName ?? c.profile.storeName ?? "an agent",
        createdAt: c.createdAt,
      })),
    };
  });
}

// Patterns across cases — the thing a single conversation grade cannot tell you.
export async function POST() {
  return handle(async () => {
    const profile = await requireProfile();
    const shared = await prisma.learningCase.findMany({
      where: { isShared: true },
      select: { profileId: true },
      distinct: ["profileId"],
    });
    const ids = [...new Set([profile.id, ...shared.map((s) => s.profileId)])];
    const patterns = await summarisePatterns(prisma, ids);
    if (!patterns) throw new ApiError(400, "Need at least 3 cases before patterns mean anything");
    return patterns;
  });
}

// Admin publishes a case to the whole team.
export async function PATCH(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = z.object({ id: z.string(), isShared: z.boolean() }).safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid request");
    // Only the owner may share their own case.
    const { count } = await prisma.learningCase.updateMany({
      where: { id: body.data.id, profileId: profile.id },
      data: { isShared: body.data.isShared },
    });
    if (!count) throw new ApiError(404, "Case not found");
    return { ok: true };
  });
}
