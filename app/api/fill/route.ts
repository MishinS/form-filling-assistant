import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { isGuest, unauthorized } from "@/lib/auth/guard";
import type { ExtractedValue } from "@/lib/types";
import { fillPtXlsx, fillCustomXlsx } from "@/lib/fill/xlsx";
import { parseFieldList, validateChoiceValues, isValueList } from "@/lib/templates/validate";
import { getTemplate } from "@/lib/db/templates";
import { PT_FIELDS } from "@/lib/extract/fields";
import { renderHtml } from "@/lib/render/html";
import { effectiveEd } from "@/lib/templates/ed-server";
import { validateEd } from "@/lib/templates/ed-custom";
import { STR } from "@/lib/seed/pt";

/** Встроенные шаблоны: лежат в репозитории, доступны всем, включая гостей. */
const BUILTIN_IDS = ["pt", "ed"];

export const runtime = "nodejs";

const sanitize = (s: string) =>
  s.replace(/[\/\\:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 60);

const xlsxResponse = (bytes: Uint8Array, name: string) =>
  new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) return unauthorized();
  const guest = isGuest(session);
  let body: { templateId?: string; values?: ExtractedValue[]; fields?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  if (typeof body.templateId !== "string" || !isValueList(body.values)) {
    return new Response("Bad request", { status: 400 });
  }
  if (guest && !BUILTIN_IDS.includes(body.templateId)) {
    return new Response("Forbidden", { status: 403 });
  }

  // «Паспорт Заказа и договора»: разметка и каталог берутся с сервера — из
  // репозитория или из сохранённой версии пользователя, проверенной при
  // сохранении, — но не из тела запроса. Клиент присылает только значения.
  if (body.templateId === "ed") {
    let ed;
    try {
      ed = await effectiveEd(guest ? null : (session.user.email ?? null));
    } catch (e) {
      return new Response(`Fill failed: ${(e as Error).message}`, { status: 500 });
    }
    if (!validateChoiceValues(ed.fields, body.values)) {
      return new Response("Bad values", { status: 400 });
    }
    // Сохранённая версия могла устареть (например, сузилось подмножество
    // редактора) — документ, который navi перепишет, не отдаём.
    if (!validateEd(ed).ok) {
      return Response.json(
        { error: STR.done_html_tpl_invalid.ru },
        { status: 422 },
      );
    }
    const rendered = renderHtml(ed.skeleton, ed.fields, body.values);
    if (!rendered.ok) {
      return new Response(`Fill failed: ${rendered.error.code}`, { status: 500 });
    }
    return Response.json({ html: rendered.html });
  }

  // Built-in ПТ: repo file + schedule logic (unchanged).
  if (body.templateId === "pt") {
    let fields;
    if (guest) {
      fields = PT_FIELDS; // гость не управляет полями
    } else if (body.fields !== undefined) {
      fields = parseFieldList(body.fields);
      if (!fields) return new Response("Bad fields", { status: 400 });
    }
    let bytes: Uint8Array;
    try {
      const tpl = await readFile(path.join(process.cwd(), "lib/fill/templates/pt.xlsx"));
      bytes = fillPtXlsx(new Uint8Array(tpl), body.values, fields);
    } catch (e) {
      return new Response(`Fill failed: ${(e as Error).message}`, { status: 500 });
    }
    const counter = sanitize(body.values.find(v => v.fieldId === "f1")?.value ?? "");
    return xlsxResponse(bytes, `ПТ_${counter ? counter + "_" : ""}Ф15.xlsx`);
  }

  // User template: blob file + generic fill.
  let tpl;
  try {
    tpl = await getTemplate(body.templateId);
  } catch {
    return new Response("Fill failed: db", { status: 500 });
  }
  if (!session.user.email) return unauthorized();
  const email = session.user.email.toLowerCase();
  if (!tpl || tpl.deletedAt || tpl.userId !== email || !tpl.fileKey) {
    return new Response("Bad request", { status: 400 });
  }
  const fields = parseFieldList(body.fields, { allowedSheets: tpl.sheets });
  if (!fields) return new Response("Bad fields", { status: 400 });

  let bytes: Uint8Array;
  try {
    const r = await fetch(tpl.fileKey);
    if (!r.ok) throw new Error("template fetch");
    bytes = fillCustomXlsx(new Uint8Array(await r.arrayBuffer()), body.values, fields);
  } catch (e) {
    return new Response(`Fill failed: ${(e as Error).message}`, { status: 500 });
  }
  return xlsxResponse(bytes, `${sanitize(tpl.nameRu) || "template"}.xlsx`);
}
