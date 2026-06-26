import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isGuest, unauthorized } from "@/lib/auth/guard";
import { extractFields } from "@/lib/extract/extract";
import { parseFieldList } from "@/lib/templates/validate";
import { PT_FIELDS } from "@/lib/extract/fields";
import { DEFAULT_MODEL } from "@/lib/extract/llm/catalog";
import type { OnAttempt, ExtractionModel } from "@/lib/extract/llm/types";
import type { ParsedDoc } from "@/lib/parse/types";
import type { ExtractField } from "@/lib/extract/fields";
import { getModelById } from "@/lib/db/user-models";
import { decryptSecret } from "@/lib/crypto/secrets";
import { openaiCompatModel } from "@/lib/extract/llm/openai-compat";
import { assertSafeBaseUrl } from "@/lib/extract/llm/providers";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { templateId?: string; model: string; docs: ParsedDoc[]; fields?: unknown };

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) return unauthorized();
  const guest = isGuest(session);
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
  const effModel = guest ? DEFAULT_MODEL : body.model;
  const effFields = guest ? PT_FIELDS : (fields ?? undefined);

  let modelOverride: ExtractionModel | undefined;
  if (!guest && body.model.startsWith("custom:")) {
    const id = body.model.slice("custom:".length);
    const row = await getModelById((session.user.email ?? "").toLowerCase(), id);
    if (!row) return NextResponse.json({ error: "Модель не найдена" }, { status: 404 });
    // SSRF: a user-entered base URL is validated at add-time, but DNS can be re-pointed
    // afterwards — re-check it on every use. Preset hosts are fixed and trusted, so skip them.
    if (row.provider === "custom") {
      try { await assertSafeBaseUrl(row.baseUrl); }
      catch { return NextResponse.json({ error: "Недопустимый адрес", code: "bad_endpoint" }, { status: 400 }); }
    }
    let apiKey: string;
    try { apiKey = decryptSecret(row.keyCipher); }
    catch { return NextResponse.json({ error: "Ошибка конфигурации модели", code: "provider_error" }, { status: 500 }); }
    modelOverride = openaiCompatModel({ baseUrl: row.baseUrl, apiKey, modelSlug: row.modelSlug });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      const onAttempt: OnAttempt = (ev) => {
        if (ev.phase === "start") write({ type: "attempt", model: ev.model, total: ev.total });
        else if (ev.phase === "win") write({ type: "attempt-win", model: ev.model });
        else write({ type: "attempt-fail", model: ev.model, reason: ev.reason });
      };
      try {
        const { values, warnings, llmFailed, usedModel } =
          await extractFields(body.docs, effModel, effFields, onAttempt, { freeOnly: guest, modelOverride });
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
