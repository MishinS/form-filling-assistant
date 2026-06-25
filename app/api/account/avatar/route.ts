import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { auth } from "@/auth";
import { isGuest } from "@/lib/auth/guard";
import { getAvatar, setAvatar, deleteAvatar } from "@/lib/db/avatars";
import { isOwnBlobUrl } from "@/lib/upload/avatar";

export const runtime = "nodejs"; // DB access

// Best-effort: a failed blob deletion must never fail the request (worst case
// an orphaned blob remains, same as before cleanup existed).
async function tryDelBlob(url: string | null): Promise<void> {
  if (!url) return;
  try { await del(url); } catch { /* orphan stays; acceptable */ }
}

export async function POST(req: Request) {
  const session = await auth();
  if (isGuest(session)) return NextResponse.json({ error: "Недоступно в гостевом режиме" }, { status: 403 });
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* bad body → invalid url below */ }
  const url = typeof body.url === "string" ? body.url : "";
  if (!isOwnBlobUrl(url)) return NextResponse.json({ error: "url" }, { status: 400 });

  let old: string | null = null;
  try {
    old = await getAvatar(email).catch(() => null);
    await setAvatar(email, url);
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  if (old !== url) await tryDelBlob(old);
  return NextResponse.json({ ok: true, url });
}

export async function DELETE() {
  const session = await auth();
  if (isGuest(session)) return NextResponse.json({ error: "Недоступно в гостевом режиме" }, { status: 403 });
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let old: string | null = null;
  try {
    old = await getAvatar(email).catch(() => null);
    await deleteAvatar(email);
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  await tryDelBlob(old);
  return NextResponse.json({ ok: true });
}
