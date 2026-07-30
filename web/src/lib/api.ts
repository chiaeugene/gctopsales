import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/tenant";
import { LlmNotConfiguredError, DailyReplyCapError } from "@/lib/ai/engine";
import { prisma } from "@/lib/prisma";

// Uniform error handling for route handlers. Unexpected (500) errors are
// additionally recorded to ErrorLog so the admin can see production failures
// without SSH-ing into Render logs — recording is best-effort and must never
// break the response.
export async function handle<T>(fn: () => Promise<T>, routeName?: string): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data ?? { ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof LlmNotConfiguredError) {
      return NextResponse.json(
        {
          error:
            "No AI provider configured. Add ANTHROPIC_API_KEY (or OPENAI_API_KEY with LLM_PROVIDER=openai) to web/.env and restart.",
        },
        { status: 503 }
      );
    }
    if (err instanceof DailyReplyCapError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    recordError(routeName ?? "unknown", err).catch(() => {});
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// Exported so the webhook paths — which deliberately swallow errors to keep
// Meta's required fast 200 — can still leave a trace. A silent failure there
// means a customer got no reply at all, which is the worst outcome in the system.
export async function logBackgroundError(route: string, err: unknown) {
  try {
    await recordError(route, err);
  } catch {
    // Never let logging break the caller.
  }
}

async function recordError(route: string, err: unknown) {
  const message = (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).slice(0, 500);
  await prisma.errorLog.create({ data: { route, message } });
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}
