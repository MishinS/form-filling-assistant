# Coding Conventions

**Analysis Date:** 2026-07-23

## Naming Patterns

**Files:**
- Library modules: kebab-case — `lib/db/user-models.ts`, `lib/templates/run-local-scan.ts`, `lib/extract/llm/openai-compat.ts`
- Pure-logic companions extracted from providers use a `-core` suffix: `lib/accent-core.ts` / `lib/accent.tsx`, `lib/theme-core.ts` / `lib/theme.tsx`
- View-model logic extracted from components uses a `-view` suffix: `lib/llm/local-model-view.ts`, `lib/llm/custom-model-view.ts`
- React components: PascalCase — `components/review/FieldInput.tsx`, `components/settings/PasswordCard.tsx`
- Next.js App Router reserved names: `route.ts`, `page.tsx`, `layout.tsx` (e.g. `app/api/templates/route.ts`, `app/(app)/fills/page.tsx`)
- Tests co-located with the module: `foo.ts` + `foo.test.ts` (never a separate `tests/` tree)
- Rust (Tauri): snake_case modules — `src-tauri/src/files.rs`, `src-tauri/src/runtime.rs`

**Functions:**
- camelCase, verb-first: `createTemplate`, `requireUser`, `isTemplateAccessible`, `detectLocalRuntime`
- Boolean helpers prefixed `is`/`has`: `isGuest` (`lib/auth/guard.ts`), `isTauri` (`lib/desktop/tauri.ts`), `isOwnBlobUrl` (`lib/upload/avatar.ts`)
- React components and providers: PascalCase function declarations — `FieldInput`, `I18nProvider`
- Hooks: `useX` with a mandatory-provider throw: `useI18n` (`lib/i18n.tsx:24`), `useTheme` (`lib/theme.tsx:41`), `useAccent` (`lib/accent.tsx:42`)

**Variables:**
- camelCase locals; very short names accepted in tight scopes (`f`, `val`, `ev`, `res`, `db`)
- Module-level constants: UPPER_SNAKE — `MAX_NAME`, `MAX_FIELDS` (`app/api/mappings/route.ts`), `ICONS`, `STR`, `STATUS` (`lib/seed/pt.ts`)
- Module-private singletons prefixed `_`: `let _db` in `lib/db/client.ts`

**Types:**
- PascalCase `interface`/`type`: `TemplateRow` (`lib/db/templates.ts`), `RaceOutcome`, `Racer` (`lib/extract/llm/race.ts`), `LocalRuntime` (`lib/desktop/tauri.ts`)
- Discriminated unions for outcomes: `RunOutcome<T> = { win: true; value: T } | { win: false; reason: string }` — prefer this over throwing across module boundaries
- Component props typed as a local `type Props = {...}` or inline (`components/review/FieldInput.tsx`)
- Union string literals over enums: `type Lang = "ru" | "en"` (`lib/i18n.tsx`), `format: "xlsx" | "docx"`
- LLM-facing field keys use snake_case intentionally: `label_ru`, `label_en` (`lib/extract/fields.ts`)

## Code Style

**Formatting:**
- No Prettier/Biome config — formatting is manual but highly consistent. Match the surrounding file.
- Double quotes, semicolons always, 2-space indent, trailing commas in multiline literals
- Wide lines tolerated (~100–130 cols); related short statements are grouped on one line: `set.nameRu = patch.name; set.nameEn = patch.name;` (`lib/db/templates.ts:77`)
- Compact single-line guards: `if (!name) return NextResponse.json({ error: "name" }, { status: 400 });`
- Compact one-line try/catch when intent is a fallback: `try { body = (await req.json()) ... } catch { /* invalid below */ }`

**Linting:**
- ESLint 8 via `.eslintrc.json`: `extends: ["next/core-web-vitals", "next/typescript"]`
- Run with `npm run lint` (`next lint`)
- TypeScript `strict: true` (`tsconfig.json`); no `any` in reviewed code — unknown data is `unknown` + manual narrowing

## Import Organization

**Order:**
1. External packages (`next/server`, `drizzle-orm`, `react`)
2. Root-alias imports (`@/auth`, `@/lib/...`, `@/components/...`)
3. Relative imports within the same feature (`./client`, `./schema`, `./types`)

**Path Aliases:**
- `@/*` → repo root (`tsconfig.json` paths; mirrored in `vitest.config.ts` alias)
- Use `@/` for cross-feature imports, plain relative (`./`) inside a feature directory
- Type-only imports use `import type { ... }` or inline `type` specifiers: `import { proposeFields, coerceFields, type ScanResult } from "@/lib/templates/scan"`
- Client components start with `"use client";` on line 1 before imports
- Desktop-only packages are imported dynamically so the web bundle never includes them: `await import("@tauri-apps/api/core")` in `lib/desktop/tauri.ts`

## Error Handling

**API routes (`app/api/**/route.ts`):**
- Guard first, in order: guest check → auth check. Helpers in `lib/auth/guard.ts`: `unauthorized()`, `requireUser()`, `requireFullUser()`, `isGuest()`. Pattern: `const denied = await requireUser(); if (denied) return denied;`
- Never trust `auth()` truthiness — check `session?.user` explicitly (documented in `lib/auth/guard.ts`)
- Body validation is manual `typeof`/`Array.isArray` narrowing on `Record<string, unknown>` — no zod or validation library
- Every DB/external call is wrapped in try/catch that returns a JSON error with the right status: `return NextResponse.json({ error: "Не удалось сохранить карту полей" }, { status: 500 })` (`app/api/mappings/route.ts`)
- Streaming routes emit NDJSON events and terminate with `{ type: "result" }` or `{ type: "error", code }`; writes to a possibly-dead controller are swallowed (`app/api/templates/route.ts:39-41`)
- Machine-readable error codes are short strings (`"file" | "xlsx" | "llm" | "nofields" | "server"`, `"wrong_password"`); user-facing error strings are Russian

**Library code (`lib/`):**
- Expected failures return discriminated unions / null, not exceptions: `RaceOutcome` (`lib/extract/llm/race.ts`), `ScanResult` with a `failure` code (`lib/templates/scan.ts`), `getTemplate(): TemplateRow | null`
- Misconfiguration throws early with a named env var: `"DATABASE_URL is not set"` (`lib/db/client.ts`), `"BYOK_ENCRYPTION_KEY must be 32 bytes (base64)"` (`lib/crypto/secrets.ts`)
- Tauri command rejections are normalized to `Error` with a stable code string (`lib/desktop/tauri.ts:30-49`)

**Client components:**
- `fetch` → check `res.ok` → map server error code to an i18n key → set local `msg` state; `catch` → generic message; `finally { setBusy(false) }` (`components/settings/PasswordCard.tsx`)
- Parse error bodies defensively: `await res.json().catch(() => ({ error: "server" }))`

## Logging

**Framework:** None — there are zero `console.*` calls in `app/`, `components/`, and `lib/` production code.

**Patterns:**
- Do not add `console.log`. Failures surface as: JSON/NDJSON error responses (server), UI state messages via i18n (client), or thrown `Error`s with actionable messages
- Empty catch blocks always carry a why-comment: `catch { /* client gone */ }`, `catch { /* recoverable */ }`

## Comments

**When to Comment:**
- Comment the WHY, not the what — including incident references: see the `saveMapping` recoverability note citing a UAT Neon cold start (`app/api/templates/route.ts:86-90`)
- Route-level contract comments at the top of streaming handlers (NDJSON protocol, terminal events)
- Mixed languages: English and Russian both appear (Russian JSDoc on `raceModels` in `lib/extract/llm/race.ts`); either is acceptable, user-facing strings must be in `lib/seed/pt.ts` with ru + en

**JSDoc/TSDoc:**
- One-line `/** ... */` JSDoc on exported functions stating the contract: `/** Rename own active template. False when not found / not owned / built-in. */` (`lib/db/templates.ts:72`)
- No `@param`/`@returns` tags — the type signature carries that

## Function Design

**Size:** Small and single-purpose in `lib/`; route handlers may be long but are linearly structured (guards → validate → work → respond)

**Parameters:** Multi-value inputs are a single object with inline type: `createTemplate(t: { id: string; code: string; ... })`; options objects for optional knobs: `raceModels(racers, { timeoutMs, total?, onAttempt? })`

**Return Values:** Explicit return types on exported functions (`Promise<Response>`, `Promise<TemplateRow | null>`, `boolean`); prefer `null`/union results over throwing for expected absence

## Module Design

**Exports:**
- `lib/`: named exports only, no default exports
- `components/`: default export for the single main component per file (`export default function FieldInput...`); named exports for multi-primitive files (`components/primitives.tsx` exports `Icon`, `Logo`, `Btn`, `Tag`, `Card`, ...) and for context/hook pairs (`components/shell/GuestContext.tsx`, `components/shell/Toast.tsx`)

**Barrel Files:** Not used — import directly from the concrete module. `lib/parse/index.ts` is a real dispatcher module (routes by file type), not a re-export barrel.

**Layering:**
- `app/api/*/route.ts` = thin HTTP layer: auth guards + validation + calls into `lib/`
- `lib/db/*` = one file per table/domain, all queries via the lazy `getDb()` singleton (`lib/db/client.ts`); pure predicates (e.g. `isTemplateAccessible`) live beside queries so they are unit-testable without a DB
- Components keep testable logic out of JSX by delegating to `lib/**` pure modules (`lib/review/attention.ts`, `lib/llm/local-model-view.ts`)

**Styling (components):**
- Inline `style` objects with CSS custom properties (`var(--surface-1)`, `var(--accent)`, `var(--r-lg)`) plus tiny utility classes (`row`, `col`, `gap-8`, `mono`, `muted`) from `app/globals.css`; Tailwind is configured but component styling is predominantly inline-vars
- User-visible text always goes through `useI18n().t(key)` / `translate()` with keys in `lib/seed/pt.ts` (ru is the source language, en the fallback pair)

---

*Convention analysis: 2026-07-23*
