import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireFullUser } from "@/lib/auth/guard";
import { MIME } from "@/lib/parse/types";
import { del } from "@vercel/blob";
import { isOwnBlobUrl } from "@/lib/upload/avatar";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request): Promise<Response> {
  const denied = await requireFullUser();
  if (denied) return denied;
  try {
    const body = (await request.json()) as HandleUploadBody;
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [MIME.xlsx],
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // No-op: the client registers the template via POST /api/templates.
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

// Best-effort cleanup of an uploaded-but-unclaimed template blob (modal cancel /
// file replace). A failed del never fails the request — worst case an orphan stays.
export async function DELETE(req: Request): Promise<Response> {
  const denied = await requireFullUser();
  if (denied) return denied;
  let url = "";
  try {
    const b = (await req.json()) as { url?: unknown };
    url = typeof b.url === "string" ? b.url : "";
  } catch {
    /* bad body → invalid url below */
  }
  if (!isOwnBlobUrl(url)) return NextResponse.json({ error: "url" }, { status: 400 });
  try { await del(url); } catch { /* orphan stays; acceptable */ }
  return NextResponse.json({ ok: true });
}
