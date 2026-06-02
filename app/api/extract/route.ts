import { NextResponse } from "next/server";
import { extractFields } from "@/lib/extract/extract";
import type { ParsedDoc } from "@/lib/parse/types";

export const maxDuration = 60;

type Body = { templateId?: string; model: string; docs: ParsedDoc[] };

export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }
  if (!body || typeof body.model !== "string" || !Array.isArray(body.docs)) {
    return NextResponse.json({ error: "Ожидаются поля model: string и docs: []" }, { status: 400 });
  }
  const { values, warnings } = await extractFields(body.docs, body.model);
  return NextResponse.json({ values, warnings });
}
