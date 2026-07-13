import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { parseJson, toJson } from "@/lib/json";
import { SalesBrainSchema } from "@/lib/ai/schemas";

// Appends gym coaching to the Sales Brain's objectionStyle so GC actually
// improves on its weak spots on the next conversation. Additive — never
// clobbers existing guidance.
const Schema = z.object({ coaching: z.string().min(3).max(3000) });

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = Schema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid payload");

    const sales = SalesBrainSchema.parse(parseJson(profile.salesBrain, {}));
    const stamp = new Date().toISOString().slice(0, 10);
    const addition = `\n\n[Gym coaching ${stamp}]\n${body.data.coaching.trim()}`;
    const merged = { ...sales, objectionStyle: `${sales.objectionStyle || ""}${addition}`.trim() };

    await prisma.storeProfile.update({ where: { id: profile.id }, data: { salesBrain: toJson(merged) } });
    return { ok: true };
  });
}
