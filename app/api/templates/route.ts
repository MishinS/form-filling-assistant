import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isOwnBlobUrl } from "@/lib/upload/avatar";
import { createTemplate } from "@/lib/db/templates";
import { saveMapping } from "@/lib/db/mappings";
import { workbookSheets, sheetTexts } from "@/lib/templates/xlsx-scan";
import { proposeFields } from "@/lib/templates/scan";
import type { ExtractField } from "@/lib/extract/fields";

export const runtime = "nodejs"; // DB access

const MAX_NAME = 80;
const MAX_DESC = 200;

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* invalid below */ }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME) : "";
  const desc = typeof body.desc === "string" ? body.desc.trim().slice(0, MAX_DESC) : "";
  const url = typeof body.url === "string" ? body.url : "";
  if (!name) return NextResponse.json({ error: "name" }, { status: 400 });
  if (!isOwnBlobUrl(url)) return NextResponse.json({ error: "url" }, { status: 400 });

  let bytes: Uint8Array;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("blob fetch");
    bytes = new Uint8Array(await r.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "file" }, { status: 400 });
  }

  let sheets: string[];
  try {
    sheets = workbookSheets(bytes).map(s => s.name);
  } catch {
    return NextResponse.json({ error: "xlsx" }, { status: 400 });
  }

  let fields: ExtractField[] = [];
  try { fields = await proposeFields(sheetTexts(bytes)); } catch { fields = []; }

  const id = `tpl-${crypto.randomUUID().slice(0, 8)}`;
  try {
    await createTemplate({ id, code: id.toUpperCase(), name, desc, fileKey: url, sheets, userId: email, defaultFields: fields });
    if (fields.length > 0) await saveMapping(email, id, fields);
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id, fields: fields.length });
}
