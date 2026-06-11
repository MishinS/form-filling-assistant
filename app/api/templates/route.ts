import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isOwnBlobUrl } from "@/lib/upload/avatar";
import { createTemplate } from "@/lib/db/templates";
import { saveMapping } from "@/lib/db/mappings";
import { workbookSheets, sheetTexts } from "@/lib/templates/xlsx-scan";
import { proposeFields, type ScanResult } from "@/lib/templates/scan";
import type { OnAttempt } from "@/lib/extract/llm/types";

export const runtime = "nodejs"; // DB access
export const maxDuration = 60; // LLM chain can run long (mirrors /api/extract)

const MAX_NAME = 80;
const MAX_DESC = 200;

// NDJSON progress stream. Guards reply with plain JSON BEFORE the stream opens
// (the client tells them apart by Content-Type). Terminal events: result | error.
// On an empty scan the template is NOT created; the blob stays for a retry.
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // The client may abort mid-stream → dead controller; a write must never crash the route.
      const write = (obj: unknown) => {
        try { controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n")); } catch { /* client gone */ }
      };
      const fail = (code: "file" | "xlsx" | "llm" | "nofields" | "server") => write({ type: "error", code });
      const onAttempt: OnAttempt = (ev) => {
        write(ev.phase === "start"
          ? { type: "attempt", model: ev.model, index: ev.index, total: ev.total }
          : { type: "attempt-fail", model: ev.model, reason: ev.reason });
      };

      const run = async () => {
        let bytes: Uint8Array;
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error("blob fetch");
          bytes = new Uint8Array(await r.arrayBuffer());
        } catch { fail("file"); return; }

        write({ type: "stage", stage: "sheets" });
        let sheets: string[];
        let texts: ReturnType<typeof sheetTexts>;
        try {
          sheets = workbookSheets(bytes).map(s => s.name);
          texts = sheetTexts(bytes);
        } catch { fail("xlsx"); return; }

        let scan: ScanResult;
        try { scan = await proposeFields(texts, onAttempt); }
        catch { scan = { fields: [], failure: "llm" }; } // contract says it never throws; belt and braces
        if (scan.failure || scan.fields.length === 0) { fail(scan.failure ?? "llm"); return; }

        write({ type: "stage", stage: "save" });
        const id = `tpl-${crypto.randomUUID().slice(0, 8)}`;
        try {
          await createTemplate({ id, code: id.toUpperCase(), name, desc, fileKey: url, sheets, userId: email, defaultFields: scan.fields });
        } catch { fail("server"); return; }
        // The initial mapping is recoverable (GET /api/mappings falls back to the
        // template's defaultFields), so its failure must not fail the creation —
        // otherwise a transient DB hiccup answers "error" for a template that DOES
        // exist, and a retry mints a duplicate (seen in UAT on a Neon cold start).
        try { await saveMapping(email, id, scan.fields); } catch { /* recoverable */ }
        write({ type: "result", id, fields: scan.fields.length });
      };

      await run();
      try { controller.close(); } catch { /* already closed/errored */ }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}
