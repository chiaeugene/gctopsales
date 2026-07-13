import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { runInterviewTurn } from "@/lib/onboarding/interview";
import type { ChatMessage } from "@/lib/ai/llm";

// A single ONBOARDING conversation per tenant holds the interview transcript.
async function getOrCreateInterview(profileId: string) {
  let convo = await prisma.conversation.findFirst({
    where: { profileId, kind: "ONBOARDING" },
    include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
  });
  if (!convo) {
    convo = await prisma.conversation.create({
      data: { profileId, kind: "ONBOARDING" },
      include: { messages: true },
    });
  }
  return convo;
}

export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    const convo = await getOrCreateInterview(profile.id);
    return {
      onboardingStatus: profile.onboardingStatus,
      messages: convo.messages.map((m) => ({ role: m.role, content: m.content })),
    };
  });
}

const PostSchema = z.object({ message: z.string().max(4000).nullable() });

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = PostSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid payload");

    const convo = await getOrCreateInterview(profile.id);
    const history: ChatMessage[] = convo.messages.map((m) => ({
      role: m.role === "CUSTOMER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

    const { output, profile: updated } = await runInterviewTurn({
      profile,
      history,
      agentMessage: body.data.message,
    });

    // Persist the turn (agent message as CUSTOMER role, GC as GC role).
    if (body.data.message) {
      await prisma.message.create({
        data: { conversationId: convo.id, role: "CUSTOMER", content: body.data.message },
      });
    }
    await prisma.message.create({
      data: { conversationId: convo.id, role: "GC", content: output.reply },
    });

    return { reply: output.reply, readyToWrapUp: output.readyToWrapUp, onboardingStatus: updated.onboardingStatus };
  });
}
