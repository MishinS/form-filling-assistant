import { NextResponse } from "next/server";
import { parseDocument } from "@/lib/parse";
import type { ParsedDoc } from "@/lib/parse/types";

export const maxDuration = 60;

type Source = { fileId: string; url: string; name: string; mime: string };

export async function POST(req: Request): Promise<Response> {
  const { sources } = (await req.json()) as { sources: Source[] };

  const docs: ParsedDoc[] = await Promise.all(
    sources.map(async (s) => {
      try {
        const res = await fetch(s.url);
        const buf = Buffer.from(await res.arrayBuffer());
        return await parseDocument(buf, s.mime, { fileId: s.fileId, name: s.name });
      } catch (e) {
        return {
          fileId: s.fileId,
          name: s.name,
          mime: s.mime,
          pages: 0,
          blocks: [],
          scannedPages: [],
          warnings: [`Не удалось обработать файл: ${(e as Error).message}`],
        };
      }
    }),
  );

  return NextResponse.json({ docs });
}
