import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";

/**
 * Two views of the rollout, because they answer different questions.
 *
 * The FUNNEL answers "where is everybody stuck?" — one row per agent through the
 * steps that actually gate selling: signed in, set up, payment details, WhatsApp
 * connected, real customer answered. Derived from live data rather than the event
 * log, so it stays true even for things that happened before logging existed.
 *
 * The FEED answers "what just happened?" — the raw event stream, newest first.
 */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 120), 400);

    const profiles = await prisma.storeProfile.findMany({
      include: {
        user: { select: { email: true, role: true, createdAt: true } },
        _count: { select: { trainingExamples: true, channels: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const [events, lastLogins, liveReplies, practiceReplies, connectFails] = await Promise.all([
      prisma.activityEvent.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
      prisma.activityEvent.groupBy({
        by: ["profileId"],
        where: { type: "login", ok: true },
        _max: { createdAt: true },
      }),
      prisma.activityEvent.groupBy({ by: ["profileId"], where: { type: "live_reply" }, _count: true }),
      prisma.activityEvent.groupBy({ by: ["profileId"], where: { type: "practice_reply" }, _count: true }),
      prisma.activityEvent.groupBy({ by: ["profileId"], where: { type: "connect_failed" }, _count: true }),
    ]);

    const by = <T extends { profileId: string | null }>(rows: T[]) =>
      new Map(rows.filter((r) => r.profileId).map((r) => [r.profileId as string, r]));
    const loginMap = by(lastLogins);
    const liveMap = by(liveReplies);
    const practiceMap = by(practiceReplies);
    const failMap = by(connectFails);

    const funnel = profiles.map((p) => {
      const f = parseJson<Record<string, string>>(p.fulfillmentBrain, {});
      const paid = Boolean(
        f.paymentBank?.trim() && f.paymentAccountName?.trim() && f.paymentAccountNumber?.trim()
      );
      return {
        profileId: p.id,
        name: p.agentName ?? p.user.email,
        email: p.user.email,
        leaderName: p.leaderName,
        isAdmin: p.user.role === "ADMIN",
        enrolledAt: p.user.createdAt,
        lastLogin: loginMap.get(p.id)?._max?.createdAt ?? null,
        // Talking to the setup interview at all is the signal, not finishing it.
        setupStarted: p.onboardingStatus !== "NOT_STARTED",
        trainingCount: p._count.trainingExamples,
        paymentReady: paid,
        whatsappConnected: p._count.channels > 0,
        connectFailures: (failMap.get(p.id) as { _count?: number } | undefined)?._count ?? 0,
        practiceReplies: (practiceMap.get(p.id) as { _count?: number } | undefined)?._count ?? 0,
        liveReplies: (liveMap.get(p.id) as { _count?: number } | undefined)?._count ?? 0,
      };
    });

    const names = new Map(funnel.map((f) => [f.profileId, f.name]));
    return {
      funnel,
      events: events.map((e) => ({
        id: e.id,
        at: e.createdAt,
        type: e.type,
        summary: e.summary,
        ok: e.ok,
        who: (e.profileId && names.get(e.profileId)) || e.actor,
      })),
    };
  });
}
