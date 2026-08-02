import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildLearningCases } from "@/lib/learning";

// Keeps the Learning Hub studying on its own. Schedule this daily with the
// CRON_SECRET; it turns yesterday's closed and lost orders into teaching cases
// so the hub fills up without anyone remembering to press a button.
//
// Same auth shape as the follow-ups cron.
export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}

async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const report = await buildLearningCases(prisma, { limit: 25 });
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    console.error("[cron:learning] failed", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
