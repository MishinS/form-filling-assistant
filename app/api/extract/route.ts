import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorized } from "@/lib/auth/guard";
import { extractFields } from "@/lib/extract/extract";
import { parseFieldList } from "@/lib/templates/validate";
import type { ParsedDoc } from "@/lib/parse/types";

export const maxDuration = 60;

type Body = { templateId?: string; model: string; docs: ParsedDoc[]; fields?: unknown };

export async function POST(req: Request): Promise<Response> {
  if (!(await auth())) return unauthorized();
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }
  if (!body || typeof body.model !== "string" || !Array.isArray(body.docs)) {
    return NextResponse.json({ error: "Ожидаются поля model: string и docs: []" }, { status: 400 });
  }
  let fields;
  if (body.fields !== undefined) {
    fields = parseFieldList(body.fields);
    if (!fields) return NextResponse.json({ error: "Некорректный список полей" }, { status: 400 });
  }
  const { values, warnings } = await extractFields(body.docs, body.model, fields);
  return NextResponse.json({ values, warnings });
}
