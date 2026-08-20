import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { logActivity } from "@/lib/activity";

/**
 * "Which part of the app is this person actually using?"
 *
 * The client posts a page ONCE per browser session per page, so a rollout of
 * fifty people produces tens of rows a day rather than thousands. Enough to see
 * that somebody spent their evening in Train GC and never opened Connect, which
 * is the shape of question this whole page exists to answer.
 */
const PAGES: Record<string, string> = {
  "/": "Dashboard",
  "/orders": "Orders",
  "/products": "Products",
  "/playground": "Workspace",
  "/testimonials": "Results",
  "/library": "Library",
  "/setup": "Set up GC",
  "/train": "Train GC",
  "/discovery": "Discovery",
  "/connect": "Connect",
  "/settings": "Settings",
};

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = z.object({ path: z.string().max(100) }).safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid path");

    // Allowlisted names only: never write a raw path, which could carry an id or
    // anything else from a query string into a log an admin reads.
    const name = PAGES[body.data.path];
    if (!name) return { ok: true };

    logActivity({
      profileId: profile.id,
      actor: profile.agentName ?? profile.id,
      type: "page",
      summary: `Opened ${name}`,
    });
    return { ok: true };
  });
}
