import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PUBLIC sign-up. Anyone on the internet can post here, so it creates a request,
 * never an account: an admin approves each one, exactly as they would have done
 * reading a Google Form response.
 *
 * The replies are deliberately identical whether or not the email is already
 * known. Telling a stranger "that address is already registered" turns this into
 * a way to test who works here.
 */
const Schema = z.object({
  name: z.string().trim().min(2).max(120),
  leaderName: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(30),
});

const OK = { ok: true, message: "Thanks. We will approve your application as fast as we can." };

export async function POST(req: Request) {
  try {
    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Please fill in your name, email and phone number." }, { status: 400 });
    }
    const { name, leaderName, email: rawEmail, phone } = parsed.data;
    const email = rawEmail.toLowerCase();

    // A phone with too few digits cannot produce a passcode, and a passcode that
    // does not match the convention is a support call on day one.
    if (phone.replace(/\D/g, "").length < 7) {
      return NextResponse.json({ error: "That phone number looks too short." }, { status: 400 });
    }

    // Already an agent? Say the same friendly thing and do nothing.
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) return NextResponse.json(OK);

    // A crude ceiling so a script cannot fill the table overnight. Real volume is
    // a few dozen; anything past this is not a roster.
    const pending = await prisma.agentSignup.count({ where: { status: "PENDING" } });
    if (pending > 500) {
      return NextResponse.json({ error: "Sign-ups are paused. Please contact your leader." }, { status: 429 });
    }

    // Re-submitting updates the details rather than erroring, because somebody
    // fixing their own typo should not need help.
    await prisma.agentSignup.upsert({
      where: { email },
      update: { name, leaderName: leaderName || null, phone, status: "PENDING" },
      create: { name, leaderName: leaderName || null, email, phone },
    });

    return NextResponse.json(OK);
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
