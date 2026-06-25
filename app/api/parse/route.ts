import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isGuest, unauthorized } from "@/lib/auth/guard";
import { del } from "@vercel/blob";
import { parseDocument } from "@/lib/parse";
import type { ParsedDoc } from "@/lib/parse/types";

export const maxDuration = 60;

type Source = { fileId: string; url: string; name: string; mime: string };

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) return unauthorized();
  const guest = isGuest(session);
  let sources: Source[];
  try {
    ({ sources } = (await req.json()) as { sources: Source[] });
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }
  if (!Array.isArray(sources)) {
    return NextResponse.json({ error: "Ожидается поле sources: []" }, { status: 400 });
  }

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
          warnings: [`Не удалось обработать файл: ${e instanceof Error ? e.message : String(e)}`],
        };
      }
    }),
  );

  if (guest) {
    // Гость: исходник не храним — удаляем сразу после чтения. Best-effort.
    await Promise.all(sources.map((s) => del(s.url).catch(() => {})));
  }

  return NextResponse.json({ docs });
}
