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

    // Conversation counts come from the CONVERSATIONS THEMSELVES, not the event
    // log. "Where did they get to" has to be true for everything that happened
    // before logging existed, and a reply that exists in the database is better
    // evidence than a log line about it anyway.
    const [events, conversations, connectFails] = await Promise.all([
      prisma.activityEvent.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
      prisma.conversation.findMany({
        select: {
          profileId: true,
          kind: true,
          updatedAt: true,
          _count: { select: { messages: { where: { role: "GC" } } } },
        },
      }),
      prisma.activityEvent.groupBy({ by: ["profileId"], where: { type: "connect_failed" }, _count: true }),
    ]);

    // Practice and real, per profile, plus when their bot last actually worked.
    const tally = new Map<string, { live: number; practice: number; lastReplyAt: Date | null }>();
    for (const c of conversations) {
      const row = tally.get(c.profileId) ?? { live: 0, practice: 0, lastReplyAt: null };
      const replies = c._count.messages;
      if (c.kind === "PLAYGROUND") row.practice += replies;
      else row.live += replies;
      if (replies > 0 && (!row.lastReplyAt || c.updatedAt > row.lastReplyAt)) row.lastReplyAt = c.updatedAt;
      tally.set(c.profileId, row);
    }

    const failMap = new Map(
      connectFails.filter((r) => r.profileId).map((r) => [r.profileId as string, r._count as unknown as number])
    );

    const funnel = profiles.map((p) => {
      const f = parseJson<Record<string, string>>(p.fulfillmentBrain, {});
      const paid = Boolean(
        f.paymentBank?.trim() && f.paymentAccountName?.trim() && f.paymentAccountNumber?.trim()
      );
      const t = tally.get(p.id) ?? { live: 0, practice: 0, lastReplyAt: null };
      // Signing in leaves traces beyond the login log: the tour counter only
      // increments from inside the app, and so does everything else here. Any of
      // them proves they got in, whenever that was.
      const everSignedIn =
        Boolean(p.lastSeenAt) ||
        p.tourSeenCount > 0 ||
        p.onboardingStatus !== "NOT_STARTED" ||
        p._count.trainingExamples > 0 ||
        p._count.channels > 0 ||
        t.practice + t.live > 0;
      return {
        profileId: p.id,
        name: p.agentName ?? p.user.email,
        email: p.user.email,
        leaderName: p.leaderName,
        isAdmin: p.user.role === "ADMIN",
        enrolledAt: p.user.createdAt,
        lastSeen: p.lastSeenAt,
        everSignedIn,
        setupStarted: p.onboardingStatus !== "NOT_STARTED",
        setupDone: p.onboardingStatus === "COMPLETED",
        trainingCount: p._count.trainingExamples,
        paymentReady: paid,
        whatsappConnected: p._count.channels > 0,
        connectFailures: failMap.get(p.id) ?? 0,
        practiceReplies: t.practice,
        liveReplies: t.live,
        lastReplyAt: t.lastReplyAt,
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
