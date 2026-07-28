import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

// Admin-only: pull agent rows (name / email / phone) out of a link-shared
// Google Sheet so the Admin page can prefill + batch-register accounts.
// The sheet is the admin's backup roster — we read it via Google's public
// CSV export, which works for any sheet shared "Anyone with the link: Viewer".
// No Google credentials are stored or needed.

const PostSchema = z.object({ sheetUrl: z.string().url() });

// Only Google Sheets URLs are ever fetched (admin-only route, but still no
// reason to let this become a generic URL fetcher).
function toCsvExportUrl(sheetUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(sheetUrl);
  } catch {
    return null;
  }
  if (u.hostname !== "docs.google.com") return null;
  const m = u.pathname.match(/^\/spreadsheets\/(?:u\/\d+\/)?d\/(?:e\/)?([\w-]+)/);
  if (!m) return null;
  const gid = u.searchParams.get("gid") || u.hash.match(/gid=(\d+)/)?.[1] || "0";
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
}

// Minimal CSV parser (quotes, embedded commas/newlines). Google's export is
// well-formed, so this doesn't need to handle pathological CSV.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function findColumn(header: string[], candidates: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const idx = lower.findIndex((h) => h === c || h.includes(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

function passcodeFromPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 6 ? digits.slice(-6) : null;
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = PostSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid sheet URL");

    const csvUrl = toCsvExportUrl(body.data.sheetUrl);
    if (!csvUrl) throw new ApiError(400, "That doesn't look like a Google Sheets link");

    let res: Response;
    try {
      res = await fetch(csvUrl, { redirect: "follow" });
    } catch {
      throw new ApiError(502, "Could not reach Google Sheets");
    }
    if (!res.ok) {
      throw new ApiError(
        400,
        "Google refused the request — make sure the sheet is shared as 'Anyone with the link: Viewer'"
      );
    }
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      throw new ApiError(
        400,
        "The sheet isn't link-viewable — set Share to 'Anyone with the link: Viewer' and try again"
      );
    }
    const text = await res.text();
    if (text.length > 1_000_000) throw new ApiError(400, "Sheet is too large");

    const rows = parseCsv(text);
    if (rows.length < 2) throw new ApiError(400, "Sheet needs a header row plus at least one agent row");

    const header = rows[0];
    const nameCol = findColumn(header, ["name", "agent"]);
    const emailCol = findColumn(header, ["email", "e-mail", "mail"]);
    const phoneCol = findColumn(header, ["phone", "contact", "whatsapp", "hp", "tel", "number"]);
    if (emailCol === -1) throw new ApiError(400, "Couldn't find an Email column in the header row");
    if (phoneCol === -1) throw new ApiError(400, "Couldn't find a Phone column in the header row");

    const agents = rows
      .slice(1)
      .map((r) => {
        const email = (r[emailCol] || "").trim().toLowerCase();
        const phone = (r[phoneCol] || "").trim();
        const name = nameCol !== -1 ? (r[nameCol] || "").trim() : "";
        return { name: name || email.split("@")[0], email, phone, passcode: passcodeFromPhone(phone) };
      })
      .filter((a) => a.email.includes("@"));

    if (agents.length === 0) throw new ApiError(400, "No rows with a valid email found");

    // Flag which emails already have accounts so the UI can skip them.
    const existing = await prisma.user.findMany({
      where: { email: { in: agents.map((a) => a.email) } },
      select: { email: true },
    });
    const existingSet = new Set(existing.map((u) => u.email));

    return {
      agents: agents.map((a) => ({ ...a, exists: existingSet.has(a.email) })),
    };
  });
}
