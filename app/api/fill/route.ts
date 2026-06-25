import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { isGuest, unauthorized } from "@/lib/auth/guard";
import type { ExtractedValue } from "@/lib/types";
import { fillPtXlsx, fillCustomXlsx } from "@/lib/fill/xlsx";
import { parseFieldList } from "@/lib/templates/validate";
import { getTemplate } from "@/lib/db/templates";
import { PT_FIELDS } from "@/lib/extract/fields";

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
  if (typeof body.templateId !== "string" || !Array.isArray(body.values)) {
    return new Response("Bad request", { status: 400 });
  }
  if (guest && body.templateId !== "pt") {
    return new Response("Forbidden", { status: 403 });
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
  const fields = parseFieldList(body.fields, tpl.sheets);
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
