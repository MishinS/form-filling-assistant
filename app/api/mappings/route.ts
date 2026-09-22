import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorized, isGuest } from "@/lib/auth/guard";
import { parseFieldList } from "@/lib/templates/validate";
import { getMapping, saveMapping, deleteMapping, getTemplateLayers, saveTemplateLayers } from "@/lib/db/mappings";
import { getTemplate, isTemplateAccessible } from "@/lib/db/templates";
import { ED_GROUPS, ED_TEMPLATE_ID } from "@/lib/render/ed";
import { resolveEd, validateEd } from "@/lib/templates/ed-custom";
import { edDefaults, edErrorMessage, edErrorName } from "@/lib/templates/ed-server";

export const runtime = "nodejs";

const MAX_FIELDS = 100;

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (isGuest(session)) return NextResponse.json({ error: "Недоступно в гостевом режиме" }, { status: 403 });
  if (!session?.user?.email) return unauthorized();
  const templateId = new URL(req.url).searchParams.get("templateId") ?? "pt";

  if (templateId === ED_TEMPLATE_ID) {
    try {
      const defaults = await edDefaults();
      const eff = resolveEd(await getTemplateLayers(session.user.email, templateId), defaults);
      return NextResponse.json({ ...eff, defaults });
    } catch {
      return NextResponse.json({ error: "Не удалось загрузить шаблон" }, { status: 500 });
    }
  }

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

  let body: { templateId?: unknown; fields?: unknown; instruction?: unknown; skeleton?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }
  if (typeof body.templateId !== "string") {
    return NextResponse.json({ error: "Ожидается templateId" }, { status: 400 });
  }
  if (Array.isArray(body.fields) && body.fields.length > MAX_FIELDS) {
    return NextResponse.json({ error: "Слишком много полей" }, { status: 400 });
  }
  if (body.templateId === ED_TEMPLATE_ID) return saveEd(session.user.email, body);

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
  const fields = parseFieldList(body.fields, { allowedSheets });
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

const ED_GROUP_IDS = ED_GROUPS.map(g => g.id);
const SLOT_TOKEN_NAME = /^[A-Za-z0-9_-]{1,64}$/;

/** Три слоя «Паспорта» сохраняются вместе и проверяются как один шаблон: слой,
 *  которого нет в теле (null), — репозиторный, и проверяется именно с ним. */
async function saveEd(email: string, body: { fields?: unknown; instruction?: unknown; skeleton?: unknown }): Promise<Response> {
  const bad = () => NextResponse.json({ error: "Некорректный шаблон" }, { status: 400 });
  const instruction = body.instruction ?? null;
  const skeleton = body.skeleton ?? null;
  if (instruction !== null && typeof instruction !== "string") return bad();
  if (skeleton !== null && typeof skeleton !== "string") return bad();
  if (body.fields != null && !Array.isArray(body.fields)) return bad();

  let defaults;
  try {
    defaults = await edDefaults();
  } catch {
    return NextResponse.json({ error: "Не удалось проверить шаблон" }, { status: 500 });
  }

  let fields = null;
  if (body.fields != null) {
    // Здесь проверяется только форма: любой синтаксически годный слот пропускаем,
    // а связь полей с каркасом проверяет validateEd — и называет виноватое поле.
    const slots = (body.fields as Array<{ cell?: unknown }>)
      .map(f => (f && typeof f.cell === "string" ? f.cell.trim() : ""))
      .filter(c => SLOT_TOKEN_NAME.test(c));
    fields = parseFieldList(body.fields, { format: "html", allowedSlots: slots, allowedGroups: ED_GROUP_IDS });
    if (!fields) return NextResponse.json({ error: "Некорректная карта полей" }, { status: 400 });
  }

  const layers = { fields, instruction, skeleton };
  const checked = validateEd(resolveEd(layers, defaults));
  if (!checked.ok) {
    return NextResponse.json(
      { error: edErrorMessage(checked.error), code: checked.error.code, name: edErrorName(checked.error) },
      { status: 400 },
    );
  }

  try {
    await saveTemplateLayers(email, ED_TEMPLATE_ID, layers);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить шаблон" }, { status: 500 });
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
