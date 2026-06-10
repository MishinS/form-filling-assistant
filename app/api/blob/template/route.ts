import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { MIME } from "@/lib/parse/types";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request): Promise<Response> {
  const denied = await requireUser();
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
