import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { validateRegistration } from "@/lib/auth/register";
import { parseUsers } from "@/lib/auth/users";
import { getUserByEmail, createUser } from "@/lib/db/users";
import { TOS_VERSION } from "@/lib/auth/tos";

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

  if (body.acceptTos !== true) return NextResponse.json({ error: "consent" }, { status: 400 });

  // Email must not already be an env user (pure check, no DB).
  const envTaken = parseUsers(process.env.AUTH_USERS).some((u) => u.email.toLowerCase() === v.email);
  if (envTaken) return NextResponse.json({ error: "email_taken" }, { status: 409 });

  try {
    if (await getUserByEmail(v.email)) return NextResponse.json({ error: "email_taken" }, { status: 409 });
    const passwordHash = bcrypt.hashSync(password, 10);
    await createUser({ email: v.email, name: v.name, passwordHash, tosAcceptedAt: new Date(), tosVersion: TOS_VERSION });
  } catch (e) {
    // A unique-violation = race where the email was registered between our check and insert.
    if ((e as { code?: string })?.code === "23505") {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }
    // Any other DB error (e.g. connectivity) surfaces honestly — never masquerade as "taken".
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
