# Testing Patterns

**Analysis Date:** 2026-07-23

## Test Framework

**Runner:**
- Vitest ^4.1.7 (devDependency in `package.json`)
- Config: `vitest.config.ts` — minimal: `@vitejs/plugin-react` + `@` alias to repo root. No setup file, no environment override (tests run in Node, not jsdom)

**Assertion Library:**
- Vitest built-in `expect`

**Run Commands:**
```bash
npm test               # vitest run (all 73 test files, single pass)
npx vitest             # watch mode
npx vitest run lib/review/attention.test.ts   # single file
cd src-tauri && cargo test                    # Rust unit tests (Tauri commands)
```

## Test File Organization

**Location:**
- Co-located: every `foo.ts` has `foo.test.ts` in the same directory. Applies to `lib/**` and `app/api/**/route.ts` alike (e.g. `app/api/templates/route.test.ts` next to `app/api/templates/route.ts`)

**Naming:**
- `*.test.ts` only — no `.spec.ts`, no `.test.tsx` (there are no React rendering tests)

**Structure:**
```
lib/extract/llm/race.ts
lib/extract/llm/race.test.ts       # co-located unit test
lib/parse/__fixtures__/make.ts     # fixture builders for parse tests
app/api/mappings/route.ts
app/api/mappings/route.test.ts     # route handler test (direct import, no server)
src-tauri/src/runtime.rs           # #[cfg(test)] mod tests at file bottom
```

## Test Structure

**Suite Organization:**
```typescript
// Pure-function suite (lib/review/attention.test.ts)
import { describe, it, expect } from "vitest";
import { attentionOf, nextAttentionIndex, type Attention } from "./attention";

describe("attentionOf", () => {
  it("flags invalid before required before low (precedence)", () => {
    expect(attentionOf({ kind: "amount", required: true, conf: "low", value: "abc" })).toBe("invalid");
  });
});
```

- `describe` per exported function, or per endpoint for routes: `describe("POST /api/templates", ...)`
- `it` titles state behavior, often with arrow notation for cause → effect: `"empty scan (llm) → terminal error, template NOT created"`, `"401 without a session"`
- Small arrow-function helpers defined above the suite instead of shared utils: `post(b)` builds a `Request`, `events(res)` drains an NDJSON stream, `rows(a)` builds row arrays

**Patterns:**
- Setup: `beforeEach` does `vi.clearAllMocks()` and installs happy-path defaults (`mockAuth.mockResolvedValue({ user: { email: "u@x.ru" } })`); individual tests override with `mockResolvedValueOnce`
- Teardown: `afterEach(() => vi.unstubAllGlobals())`, `afterEach(() => vi.unstubAllEnvs())`, `afterEach(() => { vi.useRealTimers(); })` — always undo stubs
- Assertions: exact-shape `toEqual` for event objects, `toMatchObject`/`expect.objectContaining` for partial checks, `toContainEqual` for NDJSON event streams, negative assertions on side effects (`expect(createTemplate).not.toHaveBeenCalled()`)

## Mocking

**Framework:** Vitest `vi` (`vi.mock`, `vi.fn`, `vi.stubGlobal`, `vi.stubEnv`, fake timers)

**Patterns:**
```typescript
// Route test boundary mocking (app/api/templates/route.test.ts)
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/templates", () => ({ createTemplate: vi.fn(async () => {}) }));
vi.mock("@/lib/templates/scan", async (orig) => ({
  ...(await orig() as object),                      // partial mock: keep real coerceFields
  proposeFields: vi.fn(async () => ({ fields: [], failure: "llm" })),
}));

import { POST } from "./route";                     // import AFTER vi.mock declarations
import { auth } from "@/auth";
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;   // typed handle idiom

// Network stubbing
vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => bytes.buffer }) as unknown as Response));

// Env stubbing (lib/crypto/secrets.test.ts)
beforeEach(() => vi.stubEnv("BYOK_ENCRYPTION_KEY", KEY_B64));

// Timeout testing (lib/extract/llm/race.test.ts)
vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
const p = raceModels(racers, { timeoutMs: 5000 });
await vi.advanceTimersByTimeAsync(5000);
```

**What to Mock:**
- `@/auth` in every API route test (session control per test)
- `lib/db/*` query modules in route tests — DB is never hit in tests
- Global `fetch` for blob/LLM HTTP calls
- Env vars via `vi.stubEnv` (never mutate `process.env` directly)

**What NOT to Mock:**
- Pure logic under test (validators, classifiers, parsers) — feed real inputs
- File-format layers: tests build REAL xlsx/pdf/docx bytes and run the actual parser (see Fixtures)
- Partial-mock rule: when mocking a module for one function, spread the original (`...(await orig())`) so sibling pure functions stay real

## Fixtures and Factories

**Test Data:**
```typescript
// Real-document builders (lib/parse/__fixtures__/make.ts)
export async function makeTextPdf(): Promise<Buffer> { /* pdf-lib */ }
export async function makeScannedPdf(): Promise<Buffer> { /* image-only page */ }
export async function makeXlsx(): Promise<Buffer> { /* exceljs */ }
export async function makeDocx(): Promise<Buffer> { /* docx Packer */ }

// Inline minimal-XLSX builder inside a route test (fflate)
const xlsxBytes = () => zipSync({ "xl/workbook.xml": strToU8(`<workbook>...`), ... });

// Row factory via spread-over-base (lib/db/templates.test.ts)
const base: TemplateRow = { id: "tpl-1", ..., userId: "owner@x.ru", deletedAt: null };
expect(isTemplateAccessible({ ...base, userId: null }, "anyone@x.ru")).toBe(true);
```

**Location:**
- Shared document builders: `lib/parse/__fixtures__/make.ts` (used by `lib/parse/*.test.ts`); builder deps (`pdf-lib`, `docx`, `exceljs`) are devDependencies
- Everything else: inline constants/factories at the top of the test file (`FIELD`, `OK_URL`, `base`)
- Test data is realistic and Russian where the domain is: `"Поставщик"`, sheet `"Лист1"`, `"Моя форма"`

## Coverage

**Requirements:** None enforced — no coverage provider installed, no thresholds configured

**View Coverage:**
```bash
# Not configured. Would require: npm i -D @vitest/coverage-v8
npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- The dominant type (~64 files under `lib/`). Pure functions tested directly with edge cases (wrapping indices, precedence, case-insensitive emails, empty inputs)
- Component logic is NOT tested via rendering; it is extracted into pure modules and tested there: `lib/review/attention.ts`, `lib/llm/local-model-view.ts`, `lib/accent-core.ts`, `lib/theme-core.ts`. Follow this pattern for new UI logic — extract, then unit test

**Integration Tests:**
- API route tests (9 files in `app/api/**`): import the exported handler (`POST`, `GET`), pass a hand-built `Request`, assert on the `Response` — status, content-type, JSON body, and full NDJSON event sequences. Auth/DB/network mocked at module boundary; validation, streaming, and orchestration logic run for real
- Parser tests run real generated documents through the real parse pipeline (`lib/parse/index.test.ts`)

**E2E Tests:**
- Not used (no Playwright/Cypress)

**Rust (desktop):**
- `#[cfg(test)] mod tests` with `#[test]` fns inside `src-tauri/src/files.rs` and `src-tauri/src/runtime.rs`; run via `cargo test` in `src-tauri/`. Also exercised by CI only at build time (`.github/workflows/desktop-release.yml` does not run tests — there is no test CI workflow)

## Common Patterns

**Async Testing:**
```typescript
// Plain async it-blocks; helpers drain streams
const events = async (res: Response) =>
  (await res.text()).trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);

it("streams stages → result; creates template + initial mapping", async () => {
  const res = await POST(post({ name: "Моя форма", url: OK_URL }));
  const evs = await events(res);
  expect(evs.map(e => e.type)).toEqual(["stage", "stage", "result"]);
});

// Abort/cancellation: real AbortController wiring, observed via listeners
{ model: "b", run: (signal) => new Promise<never>(() => {
    signal.addEventListener("abort", () => { abortedB = true; }); }) }
```

**Error Testing:**
```typescript
// Thrown errors: matcher on message
expect(() => encryptSecret("x")).toThrow(/BYOK_ENCRYPTION_KEY/);

// Rejected dependency → error-shaped response, side effects asserted absent
(createTemplate as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("db down"));
expect(terminal(evs)).toEqual({ type: "error", code: "server" });
expect(saveMapping).not.toHaveBeenCalled();

// Result-union narrowing instead of non-null assertions
const out = await raceModels(racers, { timeoutMs: 1000 });
expect(out.ok).toBe(false);
if (!out.ok) expect(out.failures[0].reason).toContain("Таймаут");
```

**Contract/regression comments:**
- Tests document invariants and past incidents in titles/comments: `"saveMapping failure is recoverable → still result (retry must not mint a duplicate)"` (`app/api/templates/route.test.ts:113`). Preserve these when refactoring — they encode production lessons

---

*Testing analysis: 2026-07-23*
