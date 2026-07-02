import { uploadToBlob, inferMime } from "@/lib/upload/client";
import { runLocalExtract } from "@/lib/extract/llm/run-local-extract";
import { isTauri } from "@/lib/desktop/tauri";
import type { ExtractField } from "@/lib/extract/fields";
import type { ParsedDoc } from "@/lib/parse/types";
import { parseExtractResult } from "./extract-result";
import type { RunOne } from "./run-batch";

/** Build the per-file pipeline used by runBatch: upload → parse → extract → fill → bytes. */
export function makeRunOne(opts: { templateId: string; fields: ExtractField[]; model: string }): RunOne {
  const { templateId, fields, model } = opts;

  return async (file: File, fileId: string): Promise<Uint8Array> => {
    // 1. Upload to blob (parse reads it server-side).
    const { url } = await uploadToBlob(file, () => {});

    // 2. Parse.
    const pRes = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sources: [{ fileId, url, name: file.name, mime: inferMime(file) }] }),
    });
    if (!pRes.ok) throw new Error(`Не удалось обработать файл (${pRes.status})`);
    const { docs } = (await pRes.json()) as { docs: ParsedDoc[] };
    if (docs.length === 0 || docs.every((d) => d.blocks.length === 0)) {
      throw new Error("Не удалось извлечь текст из файла");
    }

    // 3. Extract — same branch the wizard takes (desktop-local vs cloud).
    let ndjson = "";
    if (isTauri() && model.startsWith("local:")) {
      await runLocalExtract(docs, model, fields, (line) => { ndjson += line + "\n"; });
    } else {
      const eRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, model, docs, fields }),
      });
      if (!eRes.ok || !eRes.body) throw new Error(`Извлечение не удалось (${eRes.status})`);
      ndjson = await eRes.text();
    }
    const result = parseExtractResult(ndjson);
    if (!result) throw new Error("Пустой ответ извлечения");
    if (result.llmFailed) throw new Error("Модель не смогла извлечь данные");

    // 4. Fill → xlsx bytes. (Ephemeral: no /api/fills call.)
    const fRes = await fetch("/api/fill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, values: result.values, fields }),
    });
    if (!fRes.ok) throw new Error(await fRes.text());
    return new Uint8Array(await fRes.arrayBuffer());
  };
}
