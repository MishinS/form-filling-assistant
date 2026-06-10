import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setAvatar, deleteAvatar } from "@/lib/db/avatars";
import { isOwnBlobUrl } from "@/lib/upload/avatar";

export const runtime = "nodejs"; // DB access

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* bad body → invalid url below */ }
  const url = typeof body.url === "string" ? body.url : "";
  if (!isOwnBlobUrl(url)) return NextResponse.json({ error: "url" }, { status: 400 });

  try {
    await setAvatar(email, url);
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url });
}

export async function DELETE() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await deleteAvatar(email);
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
