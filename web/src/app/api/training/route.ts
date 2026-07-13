import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { roleplayCustomerTurn, synthesizeStyleProfile } from "@/lib/training/roleplay";
import { SCENARIOS, getScenario } from "@/lib/training/scenarios";
import type { ChatMessage } from "@/lib/ai/llm";

// One TRAINING conversation per scenario per tenant. The agent's messages are
// stored as role AGENT; GC (playing the customer) as CUSTOMER.
async function getConvo(profileId: string, scenarioKey: string) {
  // We tag scenario in the first SYSTEM message; simpler: one convo per
  // (profile, scenario) found by scanning kind TRAINING + a marker.
  const convos = await prisma.conversation.findMany({
    where: { profileId, kind: "TRAINING" },
    include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
  });
  const found = convos.find((c) => c.messages[0]?.content === `#scenario:${scenarioKey}`);
  if (found) return found;
  return prisma.conversation.create({
    data: {
      profileId,
      kind: "TRAINING",
      messages: { create: { role: "SYSTEM", content: `#scenario:${scenarioKey}` } },
    },
    include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
  });
}

export async function GET() {
  return handle(async () => {
    await requireProfile();
    return { scenarios: SCENARIOS };
  });
}

const PostSchema = z.object({
  action: z.enum(["message", "synthesize"]),
  scenarioKey: z.string().optional(),
  message: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = PostSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid payload");

    if (body.data.action === "synthesize") {
      const styleProfile = await synthesizeStyleProfile(profile);
      return { styleProfile: styleProfile ?? null };
    }

    // message
    if (!body.data.scenarioKey || !getScenario(body.data.scenarioKey)) throw new ApiError(400, "Unknown scenario");
    const convo = await getConvo(profile.id, body.data.scenarioKey);

    // Build history for the customer-model (skip the #scenario marker).
    const priorMessages = convo.messages.filter((m) => m.role !== "SYSTEM");
    const history: ChatMessage[] = priorMessages.map((m) => ({
      role: m.role === "AGENT" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

    // Record the agent's message (if any).
    if (body.data.message?.trim()) {
      await prisma.message.create({
        data: { conversationId: convo.id, role: "AGENT", content: body.data.message.trim() },
      });
    }

    const customerReply = await roleplayCustomerTurn({
      profile,
      scenarioKey: body.data.scenarioKey,
      history,
      agentMessage: body.data.message?.trim() ?? null,
    });

    await prisma.message.create({
      data: { conversationId: convo.id, role: "CUSTOMER", content: customerReply },
    });

    return { customerReply };
  });
}
