import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { parseJson, toJson } from "@/lib/json";
import { DISCOVERY_MENU_SEEDS } from "@/lib/data/discovery-menus";

// Discovery menus: the seller-authored "which of these is you?" questions GC
// opens with. Tenant-scoped on every operation.

export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    const menus = await prisma.discoveryMenu.findMany({
      where: { profileId: profile.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return {
      allowLists: profile.allowLists,
      useDiscoveryMenus: profile.useDiscoveryMenus,
      menus: menus.map((m) => ({
        id: m.id,
        topic: m.topic,
        question: m.question,
        options: parseJson<string[]>(m.options, []),
        followUpNote: m.followUpNote,
        isActive: m.isActive,
      })),
    };
  });
}

const UpsertSchema = z.object({
  id: z.string().optional(), // present = update
  topic: z.string().min(1).max(80),
  question: z.string().min(3).max(400),
  options: z.array(z.string().min(1).max(120)).min(2).max(5),
  followUpNote: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = UpsertSchema.safeParse(await req.json());
    if (!body.success) {
      throw new ApiError(400, "A menu needs a topic, a question and 2 to 5 options");
    }
    const d = body.data;
    const data = {
      topic: d.topic.trim(),
      question: d.question.trim(),
      options: toJson(d.options.map((o) => o.trim()).filter(Boolean)),
      followUpNote: d.followUpNote?.trim() || null,
      isActive: d.isActive ?? true,
    };

    if (d.id) {
      // Scoped update — a menu id from another tenant matches nothing.
      const { count } = await prisma.discoveryMenu.updateMany({
        where: { id: d.id, profileId: profile.id },
        data,
      });
      if (!count) throw new ApiError(404, "Menu not found");
      return { ok: true, id: d.id };
    }

    const count = await prisma.discoveryMenu.count({ where: { profileId: profile.id } });
    const created = await prisma.discoveryMenu.create({
      data: { ...data, profileId: profile.id, sortOrder: count },
    });
    logActivity({ profileId: profile.id, actor: profile.agentName ?? profile.id, type: "edit", summary: `Added a discovery menu: ${created.topic}` });
    return { ok: true, id: created.id };
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = z.object({ id: z.string() }).safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Missing id");
    await prisma.discoveryMenu.deleteMany({ where: { id: body.data.id, profileId: profile.id } });
    return { ok: true };
  });
}

// PUT: load the MAE starter set. Idempotent by topic — a topic the agent
// already has is skipped, so their own wording is never overwritten.
export async function PUT() {
  return handle(async () => {
    const profile = await requireProfile();
    const existing = await prisma.discoveryMenu.findMany({
      where: { profileId: profile.id },
      select: { topic: true },
    });
    const have = new Set(existing.map((m) => m.topic.toLowerCase()));

    let sort = existing.length;
    let created = 0;
    for (const seed of DISCOVERY_MENU_SEEDS) {
      if (have.has(seed.topic.toLowerCase())) continue;
      await prisma.discoveryMenu.create({
        data: {
          profileId: profile.id,
          topic: seed.topic,
          question: seed.question,
          options: toJson(seed.options),
          followUpNote: seed.followUpNote,
          isActive: true,
          sortOrder: sort++,
        },
      });
      created++;
    }
    return { ok: true, created, skipped: DISCOVERY_MENU_SEEDS.length - created };
  });
}
