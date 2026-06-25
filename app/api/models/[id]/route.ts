import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isGuest, unauthorized } from "@/lib/auth/guard";
import { deleteModel } from "@/lib/db/user-models";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const session = await auth();
  if (!session?.user) return unauthorized();
  if (isGuest(session)) return NextResponse.json({ error: "Недоступно в гостевом режиме" }, { status: 403 });
  const email = (session.user.email ?? "").toLowerCase();
  const affected = await deleteModel(email, params.id);
  if (affected === 0) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
