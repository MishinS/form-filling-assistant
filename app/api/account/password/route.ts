import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { isGuest } from "@/lib/auth/guard";
import { getUserByEmail, updateUserPassword } from "@/lib/db/users";
import { isValidPassword } from "@/lib/auth/register";

export const runtime = "nodejs"; // bcrypt + DB

export async function POST(req: Request) {
  const session = await auth();
  if (isGuest(session)) return NextResponse.json({ error: "Недоступно в гостевом режиме" }, { status: 403 });
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* bad body → invalid */ }
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!isValidPassword(newPassword)) return NextResponse.json({ error: "password" }, { status: 400 });

  try {
    const existing = await getUserByEmail(email);
    if (!existing) return NextResponse.json({ error: "env_account" }, { status: 409 });
    if (!(await bcrypt.compare(currentPassword, existing.passwordHash)))
      return NextResponse.json({ error: "wrong_password" }, { status: 400 });
    await updateUserPassword(email, bcrypt.hashSync(newPassword, 10));
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
