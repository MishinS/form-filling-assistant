import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isGuest } from "@/lib/auth/guard";
import { setAccent } from "@/lib/db/accents";
import { isAccentId } from "@/lib/accent-core";

export const runtime = "nodejs"; // DB access

export async function POST(req: Request) {
  const session = await auth();
  if (isGuest(session)) return NextResponse.json({ error: "Недоступно в гостевом режиме" }, { status: 403 });
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* bad body → invalid id below */ }
  if (!isAccentId(body.accent)) return NextResponse.json({ error: "accent" }, { status: 400 });

  try {
    await setAccent(email, body.accent);
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, accent: body.accent });
}
