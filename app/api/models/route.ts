import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { isGuest, unauthorized } from "@/lib/auth/guard";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secrets";
import { resolveBaseUrl, type ProviderId } from "@/lib/extract/llm/providers";
import { probeModel } from "@/lib/extract/llm/probe";
import { listModels, insertModel, toDTO } from "@/lib/db/user-models";
import { getUserByEmail, acceptTos } from "@/lib/db/users";
import { TOS_VERSION } from "@/lib/auth/tos";

export const runtime = "nodejs";

const PROVIDERS: ProviderId[] = ["openrouter", "openai", "anthropic", "google", "custom"];

async function sessionEmail(): Promise<{ email: string } | Response> {
  const session = await auth();
  if (!session?.user) return unauthorized();
  if (isGuest(session)) return NextResponse.json({ error: "Недоступно в гостевом режиме" }, { status: 403 });
  return { email: (session.user.email ?? "").toLowerCase() };
}

export async function GET(): Promise<Response> {
  const s = await sessionEmail();
  if (s instanceof Response) return s;
  const rows = await listModels(s.email);
  const models = rows.map((r) => toDTO(r, decryptSecret(r.keyCipher)));
  return NextResponse.json({ models });
}

export async function POST(reqObj: Request): Promise<Response> {
  const s = await sessionEmail();
  if (s instanceof Response) return s;

  let body: Record<string, unknown> = {};
  try { body = (await reqObj.json()) as Record<string, unknown>; } catch { /* invalid below */ }
  const provider = body.provider as ProviderId;
  const modelSlug = typeof body.modelSlug === "string" ? body.modelSlug.trim() : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : modelSlug;
  const customUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : undefined;
  const acceptTosFlag = body.acceptTos === true;

  if (!PROVIDERS.includes(provider) || !modelSlug || !apiKey) {
    return NextResponse.json({ error: "Заполните провайдера, модель и ключ", code: "bad_request" }, { status: 400 });
  }
  if (provider === "custom" && !customUrl) {
    return NextResponse.json({ error: "Укажите base URL", code: "bad_request" }, { status: 400 });
  }

  // Consent gate.
  const user = await getUserByEmail(s.email);
  if (!user?.tosAcceptedAt) {
    if (!acceptTosFlag) return NextResponse.json({ error: "Требуется согласие", code: "consent_required" }, { status: 403 });
    await acceptTos(s.email, TOS_VERSION);
  }

  const baseUrl = resolveBaseUrl(provider, customUrl);
  const probe = await probeModel({ baseUrl, apiKey, modelSlug });
  if (!probe.ok) return NextResponse.json({ error: "Проверка не пройдена", code: probe.code }, { status: 400 });

  const now = new Date();
  const row = {
    id: randomUUID(), email: s.email, label, provider, baseUrl, modelSlug,
    keyCipher: encryptSecret(apiKey), createdAt: now, updatedAt: now, lastOkAt: now,
  };
  await insertModel(row);
  return NextResponse.json({ model: toDTO(row, apiKey) }, { status: 201 });
}
