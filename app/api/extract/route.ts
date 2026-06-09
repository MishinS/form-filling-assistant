import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { extractFields } from "@/lib/extract/extract";
import { parseFieldList } from "@/lib/templates/validate";
import type { OnAttempt } from "@/lib/extract/llm/types";
import type { ParsedDoc } from "@/lib/parse/types";
import type { ExtractField } from "@/lib/extract/fields";

export const maxDuration = 60;

type Body = { templateId?: string; model: string; docs: ParsedDoc[]; fields?: unknown };

export async function POST(req: Request): Promise<Response> {
  const denied = await requireUser();
  if (denied) return denied;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }
  if (!body || typeof body.model !== "string" || !Array.isArray(body.docs)) {
    return NextResponse.json({ error: "Ожидаются поля model: string и docs: []" }, { status: 400 });
  }
  let fields: ExtractField[] | null | undefined;
  if (body.fields !== undefined) {
    fields = parseFieldList(body.fields);
    if (!fields) return NextResponse.json({ error: "Некорректный список полей" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      const onAttempt: OnAttempt = (ev) => {
        write(ev.phase === "start"
          ? { type: "attempt", model: ev.model, index: ev.index, total: ev.total }
          : { type: "attempt-fail", model: ev.model, reason: ev.reason });
      };
      try {
        const { values, warnings, llmFailed, usedModel } =
          await extractFields(body.docs, body.model, fields ?? undefined, onAttempt);
        write({ type: "result", values, warnings, llmFailed, usedModel });
      } catch (e) {
        // extractFields degrades internally and shouldn't throw for LLM failure, but guard the stream.
        // Wrapped: if the client already aborted, the controller is dead and write() would throw.
        try {
          write({ type: "result", values: [], warnings: [String(e instanceof Error ? e.message : e)], llmFailed: true, usedModel: null });
        } catch { /* client gone — nothing to flush */ }
      }
      try { controller.close(); } catch { /* already closed/errored */ }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}
