import { handle } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { runHealthChecks } from "@/lib/health";
import { logActivity } from "@/lib/activity";

/**
 * "Will the bot reply?" answered on demand, for the signed-in agent's own account.
 *
 * GET is the cheap version with no AI call, for a badge that loads on every visit.
 * POST runs the full check including a real round trip to the model, which is the
 * only way to prove the key works and the billing balance is not empty. That costs
 * a fraction of a sen, so it is a button rather than a page load.
 */
export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    return runHealthChecks(profile);
  });
}

export async function POST() {
  return handle(async () => {
    const profile = await requireProfile();
    const result = await runHealthChecks(profile, { pingLlm: true });
    const failed = result.checks.filter((c) => c.status === "fail");
    logActivity({
      profileId: profile.id,
      actor: profile.agentName ?? profile.id,
      type: "health_check",
      summary: failed.length ? `Check failed: ${failed.map((c) => c.label).join(", ")}` : "Full check all green",
      ok: failed.length === 0,
    });
    return result;
  });
}
