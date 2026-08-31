import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";
import { milestonesFor, latestMilestone } from "@/lib/milestones";

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
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);
    // Optional: narrow the feed to one person, for "what has SHE been doing".
    const only = url.searchParams.get("profileId") || undefined;

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
    const [events, conversations, connectFails, paidOrders, recentPerProfile] = await Promise.all([
      prisma.activityEvent.findMany({
        where: only ? { profileId: only } : undefined,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.conversation.findMany({
        select: {
          profileId: true,
          kind: true,
          updatedAt: true,
          _count: { select: { messages: { where: { role: "GC" } } } },
        },
      }),
      prisma.activityEvent.groupBy({ by: ["profileId"], where: { type: "connect_failed" }, _count: true }),
      // Paid orders per agent, for the milestone that actually means money.
      prisma.order.groupBy({
        by: ["profileId"],
        where: { paymentStatus: "CONFIRMED" },
        _count: true,
      }),
      // The single most recent thing each person did, for the funnel's last column.
      prisma.activityEvent.findMany({
        where: { profileId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 2000,
        select: { profileId: true, summary: true, createdAt: true, ok: true },
      }),
    ]);

    // First row wins per profile, since the query is already newest-first.
    const lastAction = new Map<string, { summary: string; at: Date; ok: boolean }>();
    for (const e of recentPerProfile) {
      if (!e.profileId || lastAction.has(e.profileId)) continue;
      lastAction.set(e.profileId, { summary: e.summary, at: e.createdAt, ok: e.ok });
    }

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

    const paidMap = new Map(paidOrders.map((r) => [r.profileId, r._count as unknown as number]));
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
        lastAction: lastAction.get(p.id) ?? null,
        paidOrders: paidMap.get(p.id) ?? 0,
      };
    });

    // Milestones are computed from the same numbers, so they can never disagree
    // with the funnel the admin is looking at.
    const withMilestones = funnel.map((f) => {
      const input = {
        name: f.name,
        trainingCount: f.trainingCount,
        practiceReplies: f.practiceReplies,
        paymentReady: f.paymentReady,
        whatsappConnected: f.whatsappConnected,
        liveReplies: f.liveReplies,
        paidOrders: f.paidOrders,
      };
      return {
        ...f,
        milestones: milestonesFor(input).filter((m) => m.reached).map((m) => m.key),
        latestMilestone: latestMilestone(input)?.adminLine ?? null,
      };
    });

    const names = new Map(funnel.map((f) => [f.profileId, f.name]));
    // Rollup for the team-update draft: totals only, so the message can be
    // regenerated the same way every time instead of hand-counted from the table.
    const nonAdmin = withMilestones.filter((f) => !f.isAdmin);
    const summary = {
      enrolled: nonAdmin.length,
      signedIn: nonAdmin.filter((f) => f.everSignedIn).length,
      trained: nonAdmin.filter((f) => f.trainingCount > 0).length,
      whatsappConnected: nonAdmin.filter((f) => f.whatsappConnected).length,
      answeringCustomers: nonAdmin.filter((f) => f.liveReplies > 0).length,
      totalLiveReplies: nonAdmin.reduce((n, f) => n + f.liveReplies, 0),
      totalPracticeReplies: nonAdmin.reduce((n, f) => n + f.practiceReplies, 0),
      totalPaidOrders: nonAdmin.reduce((n, f) => n + f.paidOrders, 0),
    };

    return {
      funnel: withMilestones,
      summary,
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
