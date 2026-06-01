import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { MIME } from "@/lib/parse/types";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — matches the drop_hint UI string

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [MIME.pdf, MIME.xlsx, MIME.docx],
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // No-op this slice: parsing is triggered by the client via /api/parse.
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
