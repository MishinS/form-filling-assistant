import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorized, isGuest } from "@/lib/auth/guard";
import { parseFieldList } from "@/lib/templates/validate";
import { getMapping, saveMapping, deleteMapping } from "@/lib/db/mappings";
import { getTemplate, isTemplateAccessible } from "@/lib/db/templates";

export const runtime = "nodejs";

const MAX_FIELDS = 100;

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (isGuest(session)) return NextResponse.json({ error: "Недоступно в гостевом режиме" }, { status: 403 });
  if (!session?.user?.email) return unauthorized();
  const templateId = new URL(req.url).searchParams.get("templateId") ?? "pt";

  try {
    const saved = await getMapping(session.user.email, templateId);
    if (saved) return NextResponse.json({ fields: saved });
    if (templateId === "pt") return NextResponse.json({ fields: null }); // client uses PT_FIELDS
    const tpl = await getTemplate(templateId);
    if (!isTemplateAccessible(tpl, session.user.email)) {
      return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });
    }
    return NextResponse.json({ fields: tpl!.defaultFields ?? [] });
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить карту полей" }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (isGuest(session)) return NextResponse.json({ error: "Недоступно в гостевом режиме" }, { status: 403 });
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
  let allowedSheets: string[] | undefined;
  if (body.templateId !== "pt") {
    let tpl;
    try {
      tpl = await getTemplate(body.templateId);
    } catch {
      return NextResponse.json({ error: "Не удалось проверить шаблон" }, { status: 500 });
    }
    if (!isTemplateAccessible(tpl, session.user.email)) {
      return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });
    }
    allowedSheets = tpl!.sheets;
  }
  const fields = parseFieldList(body.fields, allowedSheets);
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
  if (isGuest(session)) return NextResponse.json({ error: "Недоступно в гостевом режиме" }, { status: 403 });
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
