import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorized } from "@/lib/auth/guard";
import { createFill } from "@/lib/db/fills";
import type { FillPayload } from "@/lib/db/map";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  // This route needs the user's identity (not just a gate), so read the session directly.
  const session = await auth();
  if (!session?.user?.email) return unauthorized();

  let body: Partial<FillPayload>;
  try {
    body = (await req.json()) as Partial<FillPayload>;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }
  if (!body || typeof body.templateId !== "string" || !Array.isArray(body.values) || !Array.isArray(body.sources)) {
    return NextResponse.json({ error: "Ожидаются поля templateId, values[], sources[]" }, { status: 400 });
  }

  try {
    const id = await createFill(session.user.email, body as FillPayload);
    return NextResponse.json({ id });
  } catch {
    // Best-effort persistence: never block the user. The client ignores this anyway.
    return NextResponse.json({ error: "Не удалось сохранить в историю" }, { status: 500 });
  }
}
