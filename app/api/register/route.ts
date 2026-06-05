import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { validateRegistration } from "@/lib/auth/register";
import { parseUsers } from "@/lib/auth/users";
import { getUserByEmail, createUser } from "@/lib/db/users";

export const runtime = "nodejs"; // bcrypt + DB

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty/bad body → invalid */ }

  const password = typeof body.password === "string" ? body.password : "";
  const v = validateRegistration(
    {
      email: typeof body.email === "string" ? body.email : "",
      name: typeof body.name === "string" ? body.name : "",
      password,
      inviteCode: typeof body.inviteCode === "string" ? body.inviteCode : "",
    },
    process.env.INVITE_CODE,
  );
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  // Email must not already be an env user nor a DB user.
  const envTaken = parseUsers(process.env.AUTH_USERS).some((u) => u.email.toLowerCase() === v.email);
  if (envTaken) return NextResponse.json({ error: "email_taken" }, { status: 409 });
  if (await getUserByEmail(v.email)) return NextResponse.json({ error: "email_taken" }, { status: 409 });

  const passwordHash = bcrypt.hashSync(password, 10);
  try {
    await createUser({ email: v.email, name: v.name, passwordHash });
  } catch {
    return NextResponse.json({ error: "email_taken" }, { status: 409 }); // PK race
  }
  return NextResponse.json({ ok: true });
}
