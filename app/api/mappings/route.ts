import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorized } from "@/lib/auth/guard";
import { parseFieldList } from "@/lib/templates/validate";
import { saveMapping, deleteMapping } from "@/lib/db/mappings";

export const runtime = "nodejs";

const MAX_FIELDS = 100;

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.email) return unauthorized();

  let body: { templateId?: unknown; fields?: unknown };
  try {
    body = (await req.json()) as { templateId?: unknown; fields?: unknown };
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }
  if (typeof body.templateId !== "string") {
    return NextResponse.json({ error: "Ожидается templateId" }, { status: 400 });
  }
  if (Array.isArray(body.fields) && body.fields.length > MAX_FIELDS) {
    return NextResponse.json({ error: "Слишком много полей" }, { status: 400 });
  }
  const fields = parseFieldList(body.fields);
  if (!fields) {
    return NextResponse.json({ error: "Некорректная карта полей" }, { status: 400 });
  }

  try {
    await saveMapping(session.user.email, body.templateId, fields);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить карту полей" }, { status: 500 });
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.email) return unauthorized();

  let body: { templateId?: unknown };
  try {
    body = (await req.json()) as { templateId?: unknown };
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }
  if (typeof body.templateId !== "string") {
    return NextResponse.json({ error: "Ожидается templateId" }, { status: 400 });
  }

  try {
    await deleteMapping(session.user.email, body.templateId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Не удалось сбросить карту полей" }, { status: 500 });
  }
}
