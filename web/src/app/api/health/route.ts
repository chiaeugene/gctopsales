import { handle } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { runHealthChecks } from "@/lib/health";

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
    return runHealthChecks(profile, { pingLlm: true });
  });
}
