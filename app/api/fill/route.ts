import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ExtractedValue } from "@/lib/types";
import { fillPtXlsx } from "@/lib/fill/xlsx";

export const runtime = "nodejs";

const sanitize = (s: string) =>
  s.replace(/[\/\\:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 60);

export async function POST(req: Request): Promise<Response> {
  let body: { templateId?: string; values?: ExtractedValue[] };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  if (body.templateId !== "pt" || !Array.isArray(body.values)) {
    return new Response("Bad request", { status: 400 });
  }

  let bytes: Uint8Array;
  try {
    const tpl = await readFile(path.join(process.cwd(), "lib/fill/templates/pt.xlsx"));
    bytes = fillPtXlsx(new Uint8Array(tpl), body.values);
  } catch (e) {
    return new Response(`Fill failed: ${(e as Error).message}`, { status: 500 });
  }

  const counter = sanitize(body.values.find(v => v.fieldId === "f1")?.value ?? "");
  const name = `ПТ_${counter ? counter + "_" : ""}Ф15.xlsx`;
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
