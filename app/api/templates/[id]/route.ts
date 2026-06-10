import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { auth } from "@/auth";
import { renameTemplate, softDeleteTemplate } from "@/lib/db/templates";

export const runtime = "nodejs"; // DB access

const MAX_NAME = 80;
const MAX_DESC = 200;

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* fall through */ }
  const patch: { name?: string; desc?: string } = {};
  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, MAX_NAME);
    if (!name) return NextResponse.json({ error: "name" }, { status: 400 });
    patch.name = name;
  }
  if (typeof body.desc === "string") patch.desc = body.desc.trim().slice(0, MAX_DESC);
  // An empty patch would skip the DB ownership check (renameTemplate no-ops) — reject it.
  if (patch.name === undefined && patch.desc === undefined) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  try {
    const ok = await renameTemplate(params.id, email, patch);
    if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let fileKey: string | null = null;
  try {
    const res = await softDeleteTemplate(params.id, email);
    if (!res.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    fileKey = res.fileKey;
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  if (fileKey) {
    try { await del(fileKey); } catch { /* orphan blob acceptable */ }
  }
  return NextResponse.json({ ok: true });
}
