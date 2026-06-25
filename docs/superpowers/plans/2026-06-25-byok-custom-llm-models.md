# BYO-Key Custom LLM Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a registered user add their own LLM model via API key in Settings → LLM; on successful validation it appears in the extraction-model picker and runs standalone with their key.

**Architecture:** One generalized OpenAI-compatible adapter (`openaiCompatModel`) with provider presets resolves any provider through a single code path. Custom models are persisted per user (email) with AES-256-GCM-encrypted, write-only keys; the extract route detects a `custom:<id>` model id, loads the row, decrypts the key, and injects a standalone `ExtractionModel` into `extractFields` (no free-pool fallback). A registration consent disclaimer records acceptance.

**Tech Stack:** Next.js 14 App Router, TypeScript, Drizzle ORM (Neon HTTP), `node:crypto`, vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-25-byok-custom-llm-models-design.md`.
- Registered users only on all `/api/models` routes and for custom-model extraction; guests rejected (`isGuest`).
- Keys are **write-only**: never returned to the client; masked as first 2 + last 4 chars, rest asterisks (`sk••••••ab12`); keys ≤ 6 chars fully masked.
- Custom model runs **standalone** — no fallback to the free pool; `freeOnly` does not apply.
- Custom model id wire format: **`custom:<uuid>`**.
- Encryption master key from env **`BYOK_ENCRYPTION_KEY`** (32 bytes, base64); missing/invalid → fail closed (throw), never store/return plaintext.
- Crypto + DB routes must set `export const runtime = "nodejs"`.
- New i18n keys go in `lib/seed/pt.ts` (`STR` map), both `ru` and `en`.
- Verify per task: `npx vitest run <file>`; full gate at the end: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`, `npx next build`.

---

### Task 1: Crypto module (encrypt / decrypt / mask)

**Files:**
- Create: `lib/crypto/secrets.ts`
- Test: `lib/crypto/secrets.test.ts`

**Interfaces:**
- Produces: `encryptSecret(plain: string): string` (base64 `iv|tag|ct`), `decryptSecret(blob: string): string`, `maskKey(plain: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/crypto/secrets.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encryptSecret, decryptSecret, maskKey } from "./secrets";

const KEY_B64 = Buffer.alloc(32, 7).toString("base64"); // deterministic 32-byte key

beforeEach(() => vi.stubEnv("BYOK_ENCRYPTION_KEY", KEY_B64));
afterEach(() => vi.unstubAllEnvs());

describe("secrets", () => {
  it("round-trips encrypt → decrypt", () => {
    const plain = "sk-or-v1-abcdef0123456789";
    const blob = encryptSecret(plain);
    expect(blob).not.toContain(plain);
    expect(decryptSecret(blob)).toBe(plain);
  });

  it("produces a different ciphertext each call (random IV)", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects a tampered blob", () => {
    const blob = encryptSecret("hello");
    const bytes = Buffer.from(blob, "base64");
    bytes[bytes.length - 1] ^= 0xff; // flip a ciphertext byte → GCM tag fails
    expect(() => decryptSecret(bytes.toString("base64"))).toThrow();
  });

  it("throws when the master key is missing", () => {
    vi.stubEnv("BYOK_ENCRYPTION_KEY", "");
    expect(() => encryptSecret("x")).toThrow(/BYOK_ENCRYPTION_KEY/);
  });

  it("masks first 2 + last 4, rest stars", () => {
    expect(maskKey("sk-or-v1-abcdab12")).toBe("sk" + "•".repeat(11) + "ab12");
  });

  it("fully masks short keys (≤ 6 chars)", () => {
    expect(maskKey("abc123")).toBe("••••••");
    expect(maskKey("")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/crypto/secrets.test.ts`
Expected: FAIL — `Cannot find module './secrets'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/crypto/secrets.ts
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function masterKey(): Buffer {
  const b64 = process.env.BYOK_ENCRYPTION_KEY;
  if (!b64) throw new Error("BYOK_ENCRYPTION_KEY is not set");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("BYOK_ENCRYPTION_KEY must be 32 bytes (base64)");
  return key;
}

/** AES-256-GCM → base64(iv | tag | ciphertext). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, masterKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Display-only mask: first 2 + last 4 visible, rest stars; ≤ 6 chars fully masked. */
export function maskKey(plain: string): string {
  if (plain.length <= 6) return "•".repeat(plain.length);
  return plain.slice(0, 2) + "•".repeat(plain.length - 6) + plain.slice(-4);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/crypto/secrets.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/crypto/secrets.ts lib/crypto/secrets.test.ts
git commit -m "feat(crypto): AES-256-GCM secret encryption + key masking"
```

---

### Task 2: Provider presets + SSRF guard

**Files:**
- Create: `lib/extract/llm/providers.ts`
- Test: `lib/extract/llm/providers.test.ts`

**Interfaces:**
- Produces:
  - `type ProviderId = "openrouter" | "openai" | "anthropic" | "google" | "custom"`
  - `PROVIDER_PRESETS: Record<Exclude<ProviderId,"custom">, { label: string; baseUrl: string }>`
  - `resolveBaseUrl(provider: ProviderId, customUrl?: string): string` — preset URL, or the custom URL for `"custom"`.
  - `isBlockedIp(ip: string): boolean` — pure literal-IP check.
  - `assertSafeBaseUrl(url: string, lookup?: (h: string) => Promise<{ address: string }[]>): Promise<void>` — throws `BadEndpointError` on https violation / private / loopback / link-local / metadata.
  - `class BadEndpointError extends Error`

- [ ] **Step 1: Write the failing test**

```ts
// lib/extract/llm/providers.test.ts
import { describe, it, expect } from "vitest";
import { resolveBaseUrl, isBlockedIp, assertSafeBaseUrl, BadEndpointError, PROVIDER_PRESETS } from "./providers";

describe("providers", () => {
  it("resolves preset base URLs", () => {
    expect(resolveBaseUrl("openrouter")).toBe(PROVIDER_PRESETS.openrouter.baseUrl);
    expect(resolveBaseUrl("openai")).toBe("https://api.openai.com/v1");
  });

  it("uses the custom URL for provider=custom", () => {
    expect(resolveBaseUrl("custom", "https://api.example.com/v1")).toBe("https://api.example.com/v1");
  });

  it("flags private / loopback / link-local / metadata IPs", () => {
    for (const ip of ["10.0.0.5", "192.168.1.1", "172.16.0.1", "127.0.0.1", "169.254.169.254", "::1"]) {
      expect(isBlockedIp(ip)).toBe(true);
    }
    expect(isBlockedIp("1.1.1.1")).toBe(false);
  });

  it("rejects non-https URLs", async () => {
    await expect(assertSafeBaseUrl("http://api.example.com/v1")).rejects.toBeInstanceOf(BadEndpointError);
  });

  it("rejects a host that resolves to a private IP", async () => {
    const lookup = async () => [{ address: "10.1.2.3" }];
    await expect(assertSafeBaseUrl("https://evil.example.com/v1", lookup)).rejects.toBeInstanceOf(BadEndpointError);
  });

  it("allows a host that resolves to a public IP", async () => {
    const lookup = async () => [{ address: "1.1.1.1" }];
    await expect(assertSafeBaseUrl("https://api.example.com/v1", lookup)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/extract/llm/providers.test.ts`
Expected: FAIL — `Cannot find module './providers'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/extract/llm/providers.ts
import { lookup as dnsLookup } from "node:dns/promises";

export type ProviderId = "openrouter" | "openai" | "anthropic" | "google" | "custom";

export const PROVIDER_PRESETS: Record<Exclude<ProviderId, "custom">, { label: string; baseUrl: string }> = {
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  openai:     { label: "OpenAI",     baseUrl: "https://api.openai.com/v1" },
  anthropic:  { label: "Anthropic",  baseUrl: "https://api.anthropic.com/v1" },
  google:     { label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
};

export function resolveBaseUrl(provider: ProviderId, customUrl?: string): string {
  if (provider === "custom") return (customUrl ?? "").trim();
  return PROVIDER_PRESETS[provider].baseUrl;
}

export class BadEndpointError extends Error {
  constructor(msg = "Недопустимый адрес") { super(msg); this.name = "BadEndpointError"; }
}

/** Literal-IP block: private v4, loopback, link-local, unique-local v6, IPv6 loopback. */
export function isBlockedIp(ip: string): boolean {
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;          // link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  return false;
}

export async function assertSafeBaseUrl(
  url: string,
  lookup: (h: string) => Promise<{ address: string }[]> = (h) => dnsLookup(h, { all: true }),
): Promise<void> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new BadEndpointError(); }
  if (parsed.protocol !== "https:") throw new BadEndpointError();
  const host = parsed.hostname;
  if (isBlockedIp(host)) throw new BadEndpointError(); // literal-IP host
  let resolved: { address: string }[];
  try { resolved = await lookup(host); } catch { throw new BadEndpointError(); }
  if (resolved.some((r) => isBlockedIp(r.address))) throw new BadEndpointError();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/extract/llm/providers.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/extract/llm/providers.ts lib/extract/llm/providers.test.ts
git commit -m "feat(llm): provider presets + SSRF base-URL guard"
```

---

### Task 3: OpenAI-compatible standalone adapter + error classifier

**Files:**
- Create: `lib/extract/llm/openai-compat.ts`
- Test: `lib/extract/llm/openai-compat.test.ts`

**Interfaces:**
- Consumes: `buildExtractionPrompt` (from `./prompt`), `ExtractionModel`/`LlmFieldResult`/`OnAttempt` (from `./types`), `ExtractField` (from `../fields`).
- Produces:
  - `type ProbeCode = "auth" | "model_not_found" | "rate_limited" | "unreachable" | "bad_response" | "bad_endpoint" | "provider_error"`
  - `class LlmRequestError extends Error { code: ProbeCode }`
  - `classifyStatus(status: number): ProbeCode`
  - `openaiCompatModel(cfg: { baseUrl: string; apiKey: string; modelSlug: string }): ExtractionModel`
  - `chatComplete(cfg, messages, signal): Promise<string>` — single call; throws `LlmRequestError`; returns assistant text. (Reused by the probe in Task 5.)

- [ ] **Step 1: Write the failing test**

```ts
// lib/extract/llm/openai-compat.test.ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { openaiCompatModel, classifyStatus, LlmRequestError } from "./openai-compat";
import { PT_FIELDS } from "../fields";

const cfg = { baseUrl: "https://api.example.com/v1", apiKey: "sk-test", modelSlug: "gpt-x" };
const okBody = (fields: unknown[]) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ fields }) } }] }));

afterEach(() => vi.restoreAllMocks());

describe("openaiCompatModel", () => {
  it("returns parsed fields on success", async () => {
    const payload = [{ fieldId: "f1", value: "ООО «Ромашка»", confidence: "high" }];
    global.fetch = vi.fn(async () => okBody(payload)) as unknown as typeof fetch;
    const out = await openaiCompatModel(cfg).extract(PT_FIELDS, "текст");
    expect(out).toEqual(payload);
  });

  it("posts to <baseUrl>/chat/completions with the model and bearer key", async () => {
    const spy = vi.fn(async () => okBody([]));
    global.fetch = spy as unknown as typeof fetch;
    await openaiCompatModel(cfg).extract(PT_FIELDS, "текст");
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    expect(JSON.parse(init.body as string).model).toBe("gpt-x");
  });

  it("classifies HTTP statuses", () => {
    expect(classifyStatus(401)).toBe("auth");
    expect(classifyStatus(403)).toBe("auth");
    expect(classifyStatus(404)).toBe("model_not_found");
    expect(classifyStatus(429)).toBe("rate_limited");
    expect(classifyStatus(503)).toBe("provider_error");
  });

  it("throws a typed LlmRequestError on 401", async () => {
    global.fetch = vi.fn(async () => new Response("nope", { status: 401 })) as unknown as typeof fetch;
    await expect(openaiCompatModel(cfg).extract(PT_FIELDS, "текст"))
      .rejects.toMatchObject({ code: "auth" });
  });

  it("throws bad_response on non-JSON model output", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }))) as unknown as typeof fetch;
    await expect(openaiCompatModel(cfg).extract(PT_FIELDS, "текст"))
      .rejects.toMatchObject({ code: "bad_response" });
    expect(LlmRequestError).toBeDefined();
  });

  it("throws unreachable on network failure", async () => {
    global.fetch = vi.fn(async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    await expect(openaiCompatModel(cfg).extract(PT_FIELDS, "текст"))
      .rejects.toMatchObject({ code: "unreachable" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/extract/llm/openai-compat.test.ts`
Expected: FAIL — `Cannot find module './openai-compat'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/extract/llm/openai-compat.ts
import type { ExtractionModel, LlmFieldResult, OnAttempt } from "./types";
import type { ExtractField } from "../fields";
import { buildExtractionPrompt } from "./prompt";

export const STANDALONE_TIMEOUT_MS = 30_000;

export type ProbeCode =
  | "auth" | "model_not_found" | "rate_limited"
  | "unreachable" | "bad_response" | "bad_endpoint" | "provider_error";

export class LlmRequestError extends Error {
  code: ProbeCode;
  constructor(code: ProbeCode, message: string) { super(message); this.name = "LlmRequestError"; this.code = code; }
}

export function classifyStatus(status: number): ProbeCode {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  return "provider_error";
}

export interface CompatConfig { baseUrl: string; apiKey: string; modelSlug: string; }

/** Single OpenAI-compatible chat call. Throws LlmRequestError. Returns assistant text. */
export async function chatComplete(cfg: CompatConfig, prompt: string, signal?: AbortSignal): Promise<string> {
  const endpoint = cfg.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST", signal,
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://form-filling-assistant.local",
        "X-Title": "Form-Filling Assistant",
      },
      body: JSON.stringify({
        model: cfg.modelSlug,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new LlmRequestError("unreachable", "Провайдер недоступен");
  }
  if (!res.ok) throw new LlmRequestError(classifyStatus(res.status), `HTTP ${res.status}`);
  const data = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  const txt = data?.choices?.[0]?.message?.content;
  if (!txt) throw new LlmRequestError("bad_response", "Пустой ответ модели");
  return txt;
}

function parseFields(txt: string): LlmFieldResult[] {
  const cleaned = txt.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as { fields?: LlmFieldResult[] };
  return parsed.fields ?? [];
}

/** Standalone model — the user's key, single call, no race / no fallback. */
export function openaiCompatModel(cfg: CompatConfig): ExtractionModel {
  return {
    id: cfg.modelSlug,
    async extract(fields: ExtractField[], text: string, onAttempt?: OnAttempt): Promise<LlmFieldResult[]> {
      const prompt = buildExtractionPrompt(
        fields, text,
        'Ответь СТРОГО валидным JSON вида {"fields":[{"fieldId":"f1","value":"...","confidence":"high|med|low","sourceHint":"..."}]} без markdown и пояснений.',
      );
      onAttempt?.({ phase: "start", model: cfg.modelSlug, total: 1 });
      const txt = await chatComplete(cfg, prompt);
      let out: LlmFieldResult[];
      try { out = parseFields(txt); }
      catch { throw new LlmRequestError("bad_response", "Некорректный JSON модели"); }
      onAttempt?.({ phase: "win", model: cfg.modelSlug });
      return out;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/extract/llm/openai-compat.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/extract/llm/openai-compat.ts lib/extract/llm/openai-compat.test.ts
git commit -m "feat(llm): standalone OpenAI-compatible adapter + error classifier"
```

---

### Task 4: DB schema, consent columns, and queries

**Files:**
- Modify: `lib/db/schema.ts` (add `userModels` table + `users.tosAcceptedAt`/`tosVersion`)
- Create: `lib/db/user-models.ts` (queries + pure masking DTO)
- Modify: `lib/db/users.ts` (add `acceptTos`, extend `DbUser`/`createUser`)
- Test: `lib/db/user-models.test.ts` (pure DTO only — query funcs are thin, untested, matching `users.ts`)

**Interfaces:**
- Produces:
  - schema: `userModels` with columns `id, email, label, provider, baseUrl, modelSlug, keyCipher, createdAt, updatedAt, lastOkAt`.
  - `lib/db/user-models.ts`: `interface CustomModelRow {...}`, `interface CustomModelDTO { id; label; provider; modelSlug; maskedKey; lastOkAt }`, `toDTO(row, plainKey): CustomModelDTO` (pure), `listModels(email): Promise<CustomModelRow[]>`, `insertModel(row): Promise<void>`, `getModelById(email, id): Promise<CustomModelRow | null>`, `deleteModel(email, id): Promise<number>` (rows affected).
  - `lib/db/users.ts`: `acceptTos(email, version): Promise<void>`; `DbUser` unchanged for callers, `getUserByEmail` also returns `tosAcceptedAt`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/db/user-models.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { toDTO } from "./user-models";

beforeEach(() => vi.stubEnv("BYOK_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64")));
afterEach(() => vi.unstubAllEnvs());

describe("toDTO", () => {
  it("masks the plaintext key and drops the cipher", () => {
    const row = {
      id: "u1", email: "a@b.co", label: "My GPT", provider: "openai",
      baseUrl: "https://api.openai.com/v1", modelSlug: "gpt-4o",
      keyCipher: "ignored", createdAt: new Date(), updatedAt: new Date(), lastOkAt: null,
    };
    const dto = toDTO(row, "sk-test-abcdef1234");
    expect(dto).toEqual({
      id: "u1", label: "My GPT", provider: "openai", modelSlug: "gpt-4o",
      maskedKey: "sk" + "•".repeat("sk-test-abcdef1234".length - 6) + "1234", lastOkAt: null,
    });
    expect(JSON.stringify(dto)).not.toContain("ignored");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/user-models.test.ts`
Expected: FAIL — `Cannot find module './user-models'`.

- [ ] **Step 3a: Extend the schema**

Append to `lib/db/schema.ts` (after `userAvatars`):

```ts
export const userModels = pgTable("user_models", {
  id: text("id").primaryKey(),                 // uuid; surfaced as custom:<id>
  email: text("email").notNull(),              // owner, lowercased
  label: text("label").notNull(),
  provider: text("provider").notNull(),        // openrouter|openai|anthropic|google|custom
  baseUrl: text("base_url").notNull(),
  modelSlug: text("model_slug").notNull(),
  keyCipher: text("key_cipher").notNull(),     // AES-256-GCM, base64
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastOkAt: timestamp("last_ok_at"),
});
```

In the existing `users` table definition add two nullable columns:

```ts
  tosAcceptedAt: timestamp("tos_accepted_at"),
  tosVersion: text("tos_version"),
```

- [ ] **Step 3b: Write the queries module**

```ts
// lib/db/user-models.ts
import { and, eq } from "drizzle-orm";
import { getDb } from "./client";
import { userModels } from "./schema";
import { maskKey } from "@/lib/crypto/secrets";

export interface CustomModelRow {
  id: string; email: string; label: string; provider: string;
  baseUrl: string; modelSlug: string; keyCipher: string;
  createdAt: Date; updatedAt: Date; lastOkAt: Date | null;
}
export interface CustomModelDTO {
  id: string; label: string; provider: string; modelSlug: string;
  maskedKey: string; lastOkAt: Date | null;
}

/** Pure: row + decrypted key → client-safe DTO (key masked, cipher dropped). */
export function toDTO(row: CustomModelRow, plainKey: string): CustomModelDTO {
  return {
    id: row.id, label: row.label, provider: row.provider, modelSlug: row.modelSlug,
    maskedKey: maskKey(plainKey), lastOkAt: row.lastOkAt,
  };
}

export async function listModels(email: string): Promise<CustomModelRow[]> {
  return getDb().select().from(userModels).where(eq(userModels.email, email.toLowerCase())) as Promise<CustomModelRow[]>;
}

export async function getModelById(email: string, id: string): Promise<CustomModelRow | null> {
  const rows = await getDb().select().from(userModels)
    .where(and(eq(userModels.email, email.toLowerCase()), eq(userModels.id, id))).limit(1);
  return (rows[0] as CustomModelRow) ?? null;
}

export async function insertModel(row: CustomModelRow): Promise<void> {
  await getDb().insert(userModels).values({ ...row, email: row.email.toLowerCase() });
}

export async function deleteModel(email: string, id: string): Promise<number> {
  const res = await getDb().delete(userModels)
    .where(and(eq(userModels.email, email.toLowerCase()), eq(userModels.id, id)));
  return (res as { rowCount?: number }).rowCount ?? 0;
}
```

- [ ] **Step 3c: Add consent helpers to `lib/db/users.ts`**

Extend `DbUser` is NOT needed for createUser callers; add a separate consent updater and surface `tosAcceptedAt` in `getUserByEmail`:

```ts
// in lib/db/users.ts — add `tosAcceptedAt` to the select and a new helper
export async function acceptTos(email: string, version: string): Promise<void> {
  const db = getDb();
  await db.update(users).set({ tosAcceptedAt: new Date(), tosVersion: version })
    .where(eq(users.email, email.toLowerCase()));
}
```

Also add `tosAcceptedAt: users.tosAcceptedAt` to the `getUserByEmail` select projection and to the `DbUser` interface as `tosAcceptedAt?: Date | null`.

- [ ] **Step 4: Run test + push schema**

Run: `npx vitest run lib/db/user-models.test.ts`
Expected: PASS (1 test).
Then apply schema to the dev DB (requires `DATABASE_URL`):
Run: `npx drizzle-kit push`
Expected: creates `user_models`, adds `tos_accepted_at`/`tos_version` to `users`.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts lib/db/user-models.ts lib/db/user-models.test.ts lib/db/users.ts
git commit -m "feat(db): user_models table, consent columns, queries + masked DTO"
```

---

### Task 5: Validation probe

**Files:**
- Create: `lib/extract/llm/probe.ts`
- Test: `lib/extract/llm/probe.test.ts`

**Interfaces:**
- Consumes: `chatComplete`, `LlmRequestError`, `ProbeCode` (from `./openai-compat`); `assertSafeBaseUrl`, `BadEndpointError` (from `./providers`).
- Produces: `type ProbeResult = { ok: true } | { ok: false; code: ProbeCode }`; `probeModel(cfg: { baseUrl; apiKey; modelSlug }): Promise<ProbeResult>`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/extract/llm/probe.test.ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { probeModel } from "./probe";

const cfg = { baseUrl: "https://api.example.com/v1", apiKey: "sk-test", modelSlug: "gpt-x" };
afterEach(() => vi.restoreAllMocks());

describe("probeModel", () => {
  it("returns ok on a 200 chat response", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }))) as unknown as typeof fetch;
    expect(await probeModel(cfg)).toEqual({ ok: true });
  });

  it("returns code=auth on 401", async () => {
    global.fetch = vi.fn(async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
    expect(await probeModel(cfg)).toEqual({ ok: false, code: "auth" });
  });

  it("returns code=model_not_found on 404", async () => {
    global.fetch = vi.fn(async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
    expect(await probeModel(cfg)).toEqual({ ok: false, code: "model_not_found" });
  });

  it("returns code=bad_endpoint for a blocked base URL (no fetch)", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    expect(await probeModel({ ...cfg, baseUrl: "http://localhost/v1" })).toEqual({ ok: false, code: "bad_endpoint" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/extract/llm/probe.test.ts`
Expected: FAIL — `Cannot find module './probe'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/extract/llm/probe.ts
import { chatComplete, LlmRequestError, type ProbeCode } from "./openai-compat";
import { assertSafeBaseUrl } from "./providers";

export type ProbeResult = { ok: true } | { ok: false; code: ProbeCode };

const PROBE_PROMPT = 'Reply with the JSON object {"ok":true} and nothing else.';

/** Live validation: SSRF-check the URL, then one short chat call. Maps failures to a code. */
export async function probeModel(cfg: { baseUrl: string; apiKey: string; modelSlug: string }): Promise<ProbeResult> {
  try {
    await assertSafeBaseUrl(cfg.baseUrl);
  } catch {
    return { ok: false, code: "bad_endpoint" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    await chatComplete(cfg, PROBE_PROMPT, controller.signal);
    return { ok: true };
  } catch (e) {
    if (e instanceof LlmRequestError) return { ok: false, code: e.code };
    return { ok: false, code: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/extract/llm/probe.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/extract/llm/probe.ts lib/extract/llm/probe.test.ts
git commit -m "feat(llm): live model validation probe with typed error codes"
```

---

### Task 6: API routes (`/api/models`, `/api/models/[id]`)

**Files:**
- Create: `app/api/models/route.ts` (GET, POST)
- Create: `app/api/models/[id]/route.ts` (DELETE)
- Create: `lib/llm/custom-error-text.ts` (ProbeCode → RU message; shared with UI in Task 8 via i18n keys, but the API returns the `code`)
- Test: `app/api/models/route.test.ts`

**Interfaces:**
- Consumes: `auth` (`@/auth`), `isGuest`/`unauthorized` (`@/lib/auth/guard`), `encryptSecret`/`decryptSecret` (`@/lib/crypto/secrets`), `resolveBaseUrl`/`ProviderId` (`./providers`), `probeModel`, `listModels`/`insertModel`/`getModelById`/`deleteModel`/`toDTO` (`@/lib/db/user-models`), `getUserByEmail`/`acceptTos` (`@/lib/db/users`), `randomUUID` (`node:crypto`).
- Produces: `GET` → `{ models: CustomModelDTO[] }`; `POST` → `201 { model: CustomModelDTO }` or `{ error, code }`; `DELETE` → `{ ok: true }` / 404.
- Consent version constant: `export const TOS_VERSION = "2026-06-25"` (in `lib/auth/tos.ts`, see Task 8).

- [ ] **Step 1: Write the failing test**

```ts
// app/api/models/route.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/user-models", () => ({
  listModels: vi.fn(), insertModel: vi.fn(), getModelById: vi.fn(), deleteModel: vi.fn(),
  toDTO: (row: { id: string }, _k: string) => ({ id: row.id, masked: true }),
}));
vi.mock("@/lib/db/users", () => ({ getUserByEmail: vi.fn(), acceptTos: vi.fn() }));
vi.mock("@/lib/extract/llm/probe", () => ({ probeModel: vi.fn() }));

import { auth } from "@/auth";
import * as db from "@/lib/db/user-models";
import * as users from "@/lib/db/users";
import { probeModel } from "@/lib/extract/llm/probe";
import { GET, POST } from "./route";

const asMock = <T,>(f: T) => f as unknown as ReturnType<typeof vi.fn>;
beforeEach(() => vi.stubEnv("BYOK_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64")));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

const req = (body: unknown) => new Request("http://x/api/models", { method: "POST", body: JSON.stringify(body) });
const full = { user: { email: "a@b.co", role: "user" } };

describe("/api/models", () => {
  it("GET rejects a guest with 403", async () => {
    asMock(auth).mockResolvedValue({ user: { email: "g", role: "guest" } });
    expect((await GET()).status).toBe(403);
  });

  it("GET 401 when unauthenticated", async () => {
    asMock(auth).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("POST requires consent when tosAcceptedAt is null and acceptTos not set", async () => {
    asMock(auth).mockResolvedValue(full);
    asMock(users.getUserByEmail).mockResolvedValue({ email: "a@b.co", tosAcceptedAt: null });
    const res = await POST(req({ provider: "openai", modelSlug: "gpt-4o", apiKey: "sk-x", label: "L" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("consent_required");
  });

  it("POST validates, encrypts, inserts, returns masked DTO on success", async () => {
    asMock(auth).mockResolvedValue(full);
    asMock(users.getUserByEmail).mockResolvedValue({ email: "a@b.co", tosAcceptedAt: new Date() });
    asMock(probeModel).mockResolvedValue({ ok: true });
    const res = await POST(req({ provider: "openai", modelSlug: "gpt-4o", apiKey: "sk-x", label: "L" }));
    expect(res.status).toBe(201);
    expect(asMock(db.insertModel)).toHaveBeenCalledTimes(1);
    const inserted = asMock(db.insertModel).mock.calls[0][0];
    expect(inserted.keyCipher).not.toContain("sk-x"); // encrypted at rest
  });

  it("POST returns the probe error code on failure and inserts nothing", async () => {
    asMock(auth).mockResolvedValue(full);
    asMock(users.getUserByEmail).mockResolvedValue({ email: "a@b.co", tosAcceptedAt: new Date() });
    asMock(probeModel).mockResolvedValue({ ok: false, code: "auth" });
    const res = await POST(req({ provider: "openai", modelSlug: "gpt-4o", apiKey: "bad", label: "L" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("auth");
    expect(asMock(db.insertModel)).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/models/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/api/models/route.ts
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
```

```ts
// app/api/models/[id]/route.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/models/route.test.ts`
Expected: PASS (5 tests). (Depends on `lib/auth/tos.ts` from Task 8 — if running tasks out of order, create it first with `export const TOS_VERSION = "2026-06-25";`.)

- [ ] **Step 5: Commit**

```bash
git add app/api/models lib/auth/tos.ts
git commit -m "feat(api): /api/models CRUD — validate, encrypt, mask, consent gate, guest-blocked"
```

---

### Task 7: Wire custom models into extraction

**Files:**
- Modify: `lib/extract/extract.ts` (accept an injected `ExtractionModel`)
- Modify: `app/api/extract/route.ts` (resolve `custom:` → load row → build standalone adapter)
- Test: `lib/extract/extract.test.ts` (add an injected-model case); `app/api/extract/route.test.ts` (add custom-model case)

**Interfaces:**
- Consumes: `openaiCompatModel` (`./llm/openai-compat`), `decryptSecret`, `getModelById`.
- Produces: `extractFields(..., opts?: { freeOnly?: boolean; modelOverride?: ExtractionModel })` — when `modelOverride` is set it is used instead of `getModel(modelId)`.

- [ ] **Step 1: Write the failing test**

```ts
// add to lib/extract/extract.test.ts
import { openaiCompatModel } from "./llm/openai-compat"; // for type only in a real override
it("uses an injected modelOverride instead of the registry", async () => {
  const override = {
    id: "custom:1",
    extract: vi.fn(async () => [{ fieldId: "pt_supplier", value: "ООО Икс", confidence: "high" as const }]),
  };
  const docs = [{ fileId: "f", pages: 1, scannedPages: [], blocks: [{ text: "поставщик ООО Икс", locator: "p1" }] }];
  const res = await extractFields(docs as never, "custom:1", undefined, undefined, { modelOverride: override });
  expect(override.extract).toHaveBeenCalledTimes(1);
  expect(res.values.some((v) => v.value === "ООО Икс")).toBe(true);
});
```

(If `lib/extract/extract.test.ts` does not yet exist, create it importing `{ describe, it, expect, vi } from "vitest"` and `{ extractFields } from "./extract"`. Use a field id that exists in `PT_FIELDS` with `strategy:"llm"` — confirm one via `grep "strategy: \"llm\"" lib/extract/fields.ts` and substitute.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/extract/extract.test.ts`
Expected: FAIL — `modelOverride` ignored / `getModel` throws for `custom:1`.

- [ ] **Step 3: Implement the override in `extract.ts`**

Change the signature and the model resolution line:

```ts
// signature
  opts?: { freeOnly?: boolean; modelOverride?: import("./llm/types").ExtractionModel },
// ...
// in the llm pass, replace `const model = getModel(modelId, opts);` with:
      const model = opts?.modelOverride ?? getModel(modelId, opts);
```

- [ ] **Step 4: Wire the extract route**

In `app/api/extract/route.ts`, before building the stream, resolve a custom model for non-guests:

```ts
import { getModelById } from "@/lib/db/user-models";
import { decryptSecret } from "@/lib/crypto/secrets";
import { openaiCompatModel } from "@/lib/extract/llm/openai-compat";
import type { ExtractionModel } from "@/lib/extract/llm/types";

export const runtime = "nodejs"; // ensure node runtime for crypto/db

// ... after `const guest = isGuest(session);` and body parse:
let modelOverride: ExtractionModel | undefined;
if (!guest && body.model.startsWith("custom:")) {
  const id = body.model.slice("custom:".length);
  const row = await getModelById((session.user.email ?? "").toLowerCase(), id);
  if (!row) return NextResponse.json({ error: "Модель не найдена" }, { status: 404 });
  modelOverride = openaiCompatModel({ baseUrl: row.baseUrl, apiKey: decryptSecret(row.keyCipher), modelSlug: row.modelSlug });
}
// pass override (standalone — freeOnly irrelevant when override is set):
const { values, warnings, llmFailed, usedModel } =
  await extractFields(body.docs, effModel, effFields, onAttempt, { freeOnly: guest, modelOverride });
```

Note: keep `effModel = guest ? DEFAULT_MODEL : body.model;` — for a custom id the override takes precedence, so `effModel` is only a label.

- [ ] **Step 5: Run tests, then commit**

Run: `npx vitest run lib/extract/extract.test.ts app/api/extract/route.test.ts`
Expected: PASS.

```bash
git add lib/extract/extract.ts app/api/extract/route.ts lib/extract/extract.test.ts app/api/extract/route.test.ts
git commit -m "feat(extract): inject standalone custom model for custom:<id>"
```

---

### Task 8: i18n keys + consent text + error-code labels

**Files:**
- Modify: `lib/seed/pt.ts` (`STR` map — add keys below)
- Create: `lib/auth/tos.ts` (`TOS_VERSION` + disclaimer text keys reference)
- Test: `lib/db/pt-keys.test.ts` (presence of new keys in both languages)

**Interfaces:**
- Produces: i18n keys (ru/en) — `cm_section`, `cm_add`, `cm_provider`, `cm_base_url`, `cm_model_id`, `cm_api_key`, `cm_label`, `cm_testing`, `cm_added`, `cm_delete`, `cm_your_key`, `cm_empty`, `cm_consent_ack`, error labels `cm_err_auth`, `cm_err_model_not_found`, `cm_err_rate_limited`, `cm_err_unreachable`, `cm_err_bad_response`, `cm_err_bad_endpoint`, `cm_err_provider_error`, registration `reg_tos_label`, `reg_tos_text`, `register_err_consent`; and `lib/auth/tos.ts`: `export const TOS_VERSION = "2026-06-25"`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/db/pt-keys.test.ts
import { describe, it, expect } from "vitest";
import { STR } from "@/lib/seed/pt";

const KEYS = [
  "cm_section","cm_add","cm_provider","cm_base_url","cm_model_id","cm_api_key","cm_label",
  "cm_testing","cm_added","cm_delete","cm_your_key","cm_empty","cm_consent_ack",
  "cm_err_auth","cm_err_model_not_found","cm_err_rate_limited","cm_err_unreachable",
  "cm_err_bad_response","cm_err_bad_endpoint","cm_err_provider_error",
  "reg_tos_label","reg_tos_text","register_err_consent",
];

describe("custom-model i18n keys", () => {
  it("exist in ru and en", () => {
    for (const k of KEYS) {
      expect(STR[k], k).toBeDefined();
      expect(STR[k].ru.length, `${k}.ru`).toBeGreaterThan(0);
      expect(STR[k].en.length, `${k}.en`).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/pt-keys.test.ts`
Expected: FAIL — keys undefined.

- [ ] **Step 3: Add the keys**

Append to the `STR` object in `lib/seed/pt.ts` (RU then EN per entry). Use a standard disclaimer for `reg_tos_text`:

```ts
  cm_section:      { ru: "Свои модели", en: "Your models" },
  cm_add:          { ru: "Добавить модель", en: "Add model" },
  cm_provider:     { ru: "Провайдер", en: "Provider" },
  cm_base_url:     { ru: "Base URL", en: "Base URL" },
  cm_model_id:     { ru: "ID модели", en: "Model ID" },
  cm_api_key:      { ru: "API-ключ", en: "API key" },
  cm_label:        { ru: "Название", en: "Label" },
  cm_testing:      { ru: "Проверка…", en: "Validating…" },
  cm_added:        { ru: "Добавлено", en: "Added" },
  cm_delete:       { ru: "Удалить", en: "Delete" },
  cm_your_key:     { ru: "ваш ключ", en: "your key" },
  cm_empty:        { ru: "Пока нет своих моделей.", en: "No custom models yet." },
  cm_consent_ack:  { ru: "Я понимаю, что использую свой ключ на свой риск.", en: "I understand I use my own key at my own risk." },
  cm_err_auth:            { ru: "Ключ отклонён или нет доступа", en: "Key rejected or no access" },
  cm_err_model_not_found: { ru: "Модель не найдена у провайдера", en: "Model not found at provider" },
  cm_err_rate_limited:    { ru: "Лимит запросов исчерпан", en: "Rate limit exceeded" },
  cm_err_unreachable:     { ru: "Провайдер недоступен", en: "Provider unreachable" },
  cm_err_bad_response:    { ru: "Модель ответила некорректно", en: "Model returned an invalid response" },
  cm_err_bad_endpoint:    { ru: "Недопустимый адрес", en: "Invalid endpoint" },
  cm_err_provider_error:  { ru: "Ошибка провайдера", en: "Provider error" },
  reg_tos_label:   { ru: "Принимаю условия использования", en: "I accept the terms of use" },
  reg_tos_text:    { ru: "Сервис предоставляется «как есть», без гарантий. Вы используете его и любые добавленные API-ключи на свой страх и риск; вся ответственность за расходы, данные и соблюдение условий провайдеров LLM лежит на вас.", en: "The service is provided “as is”, without warranties. You use it and any API keys you add at your own risk; you are solely responsible for costs, data, and compliance with your LLM providers’ terms." },
  register_err_consent: { ru: "Подтвердите согласие с условиями", en: "Please accept the terms" },
```

Create `lib/auth/tos.ts`:

```ts
// lib/auth/tos.ts
/** Bump when the disclaimer text materially changes. */
export const TOS_VERSION = "2026-06-25";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/db/pt-keys.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/seed/pt.ts lib/auth/tos.ts lib/db/pt-keys.test.ts
git commit -m "feat(i18n): custom-model + consent strings (ru/en) and TOS version"
```

---

### Task 9: Picker merges custom models

> **Project testing reality:** there is NO DOM/component test stack (no `jsdom`,
> no `@testing-library/react`, zero `*.test.tsx`); vitest runs in the node
> environment. Do NOT add a component-test stack. Extract the pure logic into a
> node-testable helper and unit-test that; verify the rendered component via the
> full build + the project's Playwright smoke (see [[ffa-deploy-ops]] recipe).

**Files:**
- Create: `lib/llm/custom-model-view.ts` (pure mappers — shared with Task 10)
- Test: `lib/llm/custom-model-view.test.ts`
- Modify: `components/shell/ModelSelect.tsx` (fetch `/api/models`, merge via the helper, `cm_your_key` badge)

**Interfaces:**
- Consumes: `GET /api/models` → `{ models: CustomModelDTO[] }`.
- Produces:
  - `interface PickerRow { id: string; name: string; provider: string; custom?: boolean }`
  - `customPickerRows(dtos: { id: string; label: string; provider: string }[]): PickerRow[]` — maps each DTO to `{ id: "custom:"+id, name: label, provider, custom: true }`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/llm/custom-model-view.test.ts
import { describe, it, expect } from "vitest";
import { customPickerRows } from "./custom-model-view";

describe("customPickerRows", () => {
  it("maps DTOs to picker rows with custom:<id> ids", () => {
    expect(customPickerRows([{ id: "abc", label: "My GPT", provider: "openai" }])).toEqual([
      { id: "custom:abc", name: "My GPT", provider: "openai", custom: true },
    ]);
  });
  it("returns [] for an empty list", () => {
    expect(customPickerRows([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/llm/custom-model-view.test.ts`
Expected: FAIL — `Cannot find module './custom-model-view'`.

- [ ] **Step 3: Write the helper, then wire the component**

```ts
// lib/llm/custom-model-view.ts
export interface PickerRow { id: string; name: string; provider: string; custom?: boolean }

export function customPickerRows(
  dtos: { id: string; label: string; provider: string }[],
): PickerRow[] {
  return dtos.map((d) => ({ id: `custom:${d.id}`, name: d.label, provider: d.provider, custom: true }));
}
```

Then in `components/shell/ModelSelect.tsx`:
- add state `const [custom, setCustom] = useState<{ id: string; label: string; provider: string; modelSlug: string }[]>([])`;
- on mount, fetch (guarded so a failure leaves only built-ins):

```tsx
useEffect(() => {
  let alive = true;
  fetch("/api/models").then(r => (r.ok ? r.json() : { models: [] }))
    .then((d) => { if (alive) setCustom(d.models ?? []); }).catch(() => {});
  return () => { alive = false; };
}, []);
```
- build the list: `const MODELS = [...FREE_MODELS, PAID_LAST_RESORT, ...customPickerRows(custom)];`
- `cur` lookup already matches by id, so a `custom:<id>` selection resolves;
- in the row badge branch, when `("custom" in m && m.custom)` render a badge with `t("cm_your_key")` (reuse the free/paid badge styling), else the existing free/paid badge.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/llm/custom-model-view.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/llm/custom-model-view.ts lib/llm/custom-model-view.test.ts components/shell/ModelSelect.tsx
git commit -m "feat(ui): picker merges user custom models (custom:<id>)"
```

---

### Task 10: Settings "Свои модели" subsection + add-model form

> **Project testing reality (same as Task 9):** node-only vitest, no DOM stack.
> Unit-test the pure error→label mapper; verify the form/list via build + Playwright smoke.

**Files:**
- Modify: `lib/llm/custom-model-view.ts` (add `errorLabelKey`)
- Test: `lib/llm/custom-model-view.test.ts` (add `errorLabelKey` cases)
- Create: `components/settings/CustomModels.tsx`
- Modify: `components/settings/ModelCard.tsx` (render `<CustomModels />` under `<ModelSelect />`)

**Interfaces:**
- Consumes: `GET/POST /api/models`, `DELETE /api/models/[id]`, i18n keys from Task 8, `useI18n`, `PROVIDER_PRESETS`, `ProbeCode` (`@/lib/extract/llm/openai-compat`).
- Produces: `errorLabelKey(code: string): string` — maps a ProbeCode (or unknown) to a `cm_err_*` i18n key (unknown → `cm_err_provider_error`).

- [ ] **Step 1: Write the failing test**

```ts
// add to lib/llm/custom-model-view.test.ts
import { errorLabelKey } from "./custom-model-view";

describe("errorLabelKey", () => {
  it("maps known probe codes to cm_err_* keys", () => {
    expect(errorLabelKey("auth")).toBe("cm_err_auth");
    expect(errorLabelKey("model_not_found")).toBe("cm_err_model_not_found");
    expect(errorLabelKey("bad_endpoint")).toBe("cm_err_bad_endpoint");
  });
  it("falls back to provider_error for unknown codes", () => {
    expect(errorLabelKey("weird")).toBe("cm_err_provider_error");
    expect(errorLabelKey(undefined as unknown as string)).toBe("cm_err_provider_error");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/llm/custom-model-view.test.ts`
Expected: FAIL — `errorLabelKey` is not exported.

- [ ] **Step 3: Implement the mapper, then the component**

Add to `lib/llm/custom-model-view.ts`:

```ts
const ERR_KEYS = new Set([
  "auth", "model_not_found", "rate_limited", "unreachable", "bad_response", "bad_endpoint", "provider_error",
]);
export function errorLabelKey(code: string): string {
  return ERR_KEYS.has(code) ? `cm_err_${code}` : "cm_err_provider_error";
}
```

Then create `components/settings/CustomModels.tsx` — a client component that:
- on mount fetches `GET /api/models` → list state;
- renders each row: **Тип LLM** = `provider · modelSlug`, the masked key from `maskedKey`, a delete button (`DELETE /api/models/[id]` → refetch); empty state shows `t("cm_empty")`;
- an `t("cm_add")` toggle reveals a form: provider `<select>` (entries from `PROVIDER_PRESETS` + a `custom` option), base URL input (shown only when provider === `"custom"`), model id, api key, label, and a consent checkbox (`t("cm_consent_ack")`) whose checked value is sent as `acceptTos`;
- submit → `POST /api/models`; while pending show `t("cm_testing")`; on 201 prepend the returned DTO, reset the form, flash `t("cm_added")`; on a non-OK response read `code` and render `t(errorLabelKey(code))`.

Follow the inline-style conventions in `ModelSelect.tsx`/`ProfileCard.tsx` (no CSS modules). Then in `ModelCard.tsx` add `<CustomModels />` after `<ModelSelect />` inside the existing `col gap-16`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/llm/custom-model-view.test.ts`
Expected: PASS (4 tests total in the file).

- [ ] **Step 5: Commit**

```bash
git add lib/llm/custom-model-view.ts lib/llm/custom-model-view.test.ts components/settings/CustomModels.tsx components/settings/ModelCard.tsx
git commit -m "feat(ui): settings — Свои модели list + add form with typed errors"
```

---

### Task 11: Registration consent

**Files:**
- Modify: `components/auth/RegisterForm.tsx` (consent checkbox + disclaimer, block submit, send `acceptTos`)
- Modify: `app/api/register/route.ts` (require `acceptTos`, persist consent on create)
- Modify: `lib/db/users.ts` (`createUser` accepts optional consent fields)
- Test: `app/api/register/route.test.ts` (consent required) — or extend the existing register test if present.

**Interfaces:**
- Consumes: `TOS_VERSION` (`@/lib/auth/tos`).
- Produces: register `POST` rejects without `acceptTos===true` (`400 { error: "consent" }`); `createUser` writes `tosAcceptedAt`/`tosVersion`.

- [ ] **Step 1: Write the failing test**

```ts
// app/api/register/route.test.ts (new or extended)
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.mock("@/lib/db/users", () => ({ getUserByEmail: vi.fn(async () => null), createUser: vi.fn() }));
import { createUser } from "@/lib/db/users";
import { POST } from "./route";

const asMock = <T,>(f: T) => f as unknown as ReturnType<typeof vi.fn>;
beforeEach(() => vi.stubEnv("INVITE_CODE", "LET-ME-IN"));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

const body = (over: Record<string, unknown>) => new Request("http://x", {
  method: "POST", body: JSON.stringify({ email: "a@b.co", name: "A", password: "password1", inviteCode: "LET-ME-IN", ...over }),
});

describe("register consent", () => {
  it("rejects without acceptTos", async () => {
    const res = await POST(body({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("consent");
    expect(asMock(createUser)).not.toHaveBeenCalled();
  });

  it("creates the user and persists consent when acceptTos is true", async () => {
    const res = await POST(body({ acceptTos: true }));
    expect(res.status).toBe(200);
    const arg = asMock(createUser).mock.calls[0][0];
    expect(arg.tosAcceptedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/register/route.test.ts`
Expected: FAIL — no consent gate.

- [ ] **Step 3: Implement**

`lib/db/users.ts` — extend `DbUser` and `createUser`:

```ts
export interface DbUser { email: string; name: string; passwordHash: string; tosAcceptedAt?: Date | null; tosVersion?: string | null; }
// in createUser values():
await db.insert(users).values({
  email: u.email.toLowerCase(), name: u.name, passwordHash: u.passwordHash,
  tosAcceptedAt: u.tosAcceptedAt ?? null, tosVersion: u.tosVersion ?? null,
});
```

`app/api/register/route.ts` — after `validateRegistration` passes, gate consent and pass it through:

```ts
import { TOS_VERSION } from "@/lib/auth/tos";
// ...
if (body.acceptTos !== true) return NextResponse.json({ error: "consent" }, { status: 400 });
// ...
await createUser({ email: v.email, name: v.name, passwordHash, tosAcceptedAt: new Date(), tosVersion: TOS_VERSION });
```

`components/auth/RegisterForm.tsx` — add `const [agree, setAgree] = useState(false);`; render a checkbox tied to `reg_tos_label` + `reg_tos_text` before the submit button; disable submit unless `agree`; include `acceptTos: agree` in the POST body; map a `consent` error code to `register_err_consent`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/register/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/auth/RegisterForm.tsx app/api/register/route.ts app/api/register/route.test.ts lib/db/users.ts
git commit -m "feat(auth): registration consent disclaimer + persisted acceptance"
```

---

### Task 12: Full verification gate

- [ ] **Step 1: Typecheck** — `npx tsc --noEmit` → no errors.
- [ ] **Step 2: Lint** — `npx next lint` → no new warnings (pre-existing `<img>` warnings in ProfileCard/Sidebar are acceptable).
- [ ] **Step 3: Tests** — `npx vitest run` → all pass (369 existing + new).
- [ ] **Step 4: Build** — `npx next build` → green.
- [ ] **Step 5: Env note** — confirm `BYOK_ENCRYPTION_KEY` (32-byte base64; generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) is set locally and on Vercel before the custom-model path is exercised. Confirm `npx drizzle-kit push` applied the `user_models` table + `users` consent columns to each environment.

---

## Self-Review

**Spec coverage:**
- All-provider support → Tasks 2 (presets) + 3 (compat adapter). ✅
- Standalone, no fallback, explicit error → Task 3 (single call) + Task 7 (override). ✅
- Write-only, masked keys (first 2 + last 4) → Task 1 (`maskKey`) + Task 4 (`toDTO`) + Task 6 (never returns plaintext). ✅
- `custom:<uuid>` id scheme → Tasks 6/7/9. ✅
- `user_models` table + consent columns + migration → Task 4. ✅
- AES-256-GCM + `BYOK_ENCRYPTION_KEY`, fail-closed → Task 1. ✅
- GET/POST/DELETE routes, registered-only, consent gate, live probe → Tasks 5/6. ✅
- Error taxonomy → Task 3 (`classifyStatus` + codes) + Task 8 (`cm_err_*` labels). ✅
- SSRF guard → Task 2 + Task 5 (probe calls it). ✅
- Settings list (Тип LLM + masked key) + add form → Task 10. ✅
- Picker merge with badge → Task 9. ✅
- Registration consent + existing-user ack in add form → Tasks 11 + 10. ✅
- Testing strategy → node-only vitest (project has no DOM stack): logic lives in pure
  helpers (`customPickerRows`, `errorLabelKey`, `toDTO`, `classifyStatus`, crypto, SSRF)
  unit-tested per task; route handlers tested via mocked `auth`/db/probe; the two React
  components (`ModelSelect`, `CustomModels`) carry no untested logic and are verified by
  the Task 12 build + the project's Playwright smoke ([[ffa-deploy-ops]]). ✅

**Placeholder scan:** No "TBD/TODO". The few investigate-then-substitute notes (existing-`llm`-field id in Task 7; component-test harness presence in Tasks 9/10) are concrete fallbacks, not deferrals.

**Type consistency:** `ProbeCode` defined in Task 3, reused in Tasks 5/6/8. `CustomModelRow`/`CustomModelDTO`/`toDTO` defined in Task 4, used in 6/9/10. `openaiCompatModel`/`chatComplete` (Task 3) used in 5/7. `TOS_VERSION` (Task 8) used in 6/11. `modelOverride` (Task 7) matches `ExtractionModel` from `./llm/types`. Consistent.
