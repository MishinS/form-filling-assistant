import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isGuest } from "@/lib/auth/guard";
import { getUserByEmail, updateUserName } from "@/lib/db/users";

export const runtime = "nodejs"; // DB access

export async function PATCH(req: Request) {
  const session = await auth();
  if (isGuest(session)) return NextResponse.json({ error: "Недоступно в гостевом режиме" }, { status: 403 });
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* bad body → invalid */ }
  const name = (typeof body.name === "string" ? body.name : "").trim();
  if (!name) return NextResponse.json({ error: "name" }, { status: 400 });

  try {
    // Env-only owner accounts have no DB row — they can't be edited here.
    const existing = await getUserByEmail(email);
    if (!existing) return NextResponse.json({ error: "env_account" }, { status: 409 });
    await updateUserName(email, name);
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, name });
}
