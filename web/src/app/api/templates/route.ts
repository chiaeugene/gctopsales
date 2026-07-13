import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    const templates = await prisma.messageTemplate.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
    });
    return {
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        language: t.language,
        category: t.category,
        bodyText: t.bodyText,
        variableHint: t.variableHint,
        status: t.status,
        varCount: countVars(t.bodyText),
      })),
    };
  });
}

const UpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200).regex(/^[a-z0-9_]+$/, "lowercase letters, numbers, underscores only (match Meta)"),
  language: z.string().min(2).max(10),
  category: z.enum(["MARKETING", "UTILITY"]),
  bodyText: z.string().min(3).max(2000),
  variableHint: z.string().max(500).nullable().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = UpsertSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, body.error.issues[0]?.message || "Invalid template");
    const d = body.data;
    const data = {
      name: d.name,
      language: d.language,
      category: d.category,
      bodyText: d.bodyText,
      variableHint: d.variableHint ?? null,
      status: d.status ?? "PENDING",
    };
    if (d.id) {
      const existing = await prisma.messageTemplate.findFirst({ where: { id: d.id, profileId: profile.id } });
      if (!existing) throw new ApiError(404, "Template not found");
      await prisma.messageTemplate.update({ where: { id: existing.id }, data });
      return { id: existing.id };
    }
    const dup = await prisma.messageTemplate.findFirst({
      where: { profileId: profile.id, name: d.name, language: d.language },
    });
    if (dup) throw new ApiError(409, "A template with this name + language already exists");
    const created = await prisma.messageTemplate.create({ data: { ...data, profileId: profile.id } });
    return { id: created.id };
  });
}

const DeleteSchema = z.object({ id: z.string() });

export async function DELETE(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = DeleteSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid payload");
    const existing = await prisma.messageTemplate.findFirst({ where: { id: body.data.id, profileId: profile.id } });
    if (!existing) throw new ApiError(404, "Template not found");
    await prisma.messageTemplate.delete({ where: { id: existing.id } });
    return { ok: true };
  });
}

function countVars(body: string): number {
  const matches = body.match(/\{\{\s*\d+\s*\}\}/g);
  if (!matches) return 0;
  const nums = new Set(matches.map((m) => m.replace(/[^\d]/g, "")));
  return nums.size;
}
