import { handle } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { runGym } from "@/lib/gym/run";

// Runs the full Sales Gym stress-test for this tenant's GC configuration and
// returns the scorecard. Pure evaluation — writes nothing to the DB. Can take
// ~30-60s (many parallel model calls), so this is a deliberate manual action.
export const maxDuration = 300;

export async function POST() {
  return handle(async () => {
    const profile = await requireProfile();
    const report = await runGym(profile);
    return { report };
  });
}
