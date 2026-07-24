<!-- refreshed: 2026-07-23 -->
# Architecture

**Analysis Date:** 2026-07-23

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        UI (React client components)                  │
├──────────────────┬───────────────────────┬──────────────────────────┤
│  Auth'd shell    │  Guest landing        │  Desktop webview (Tauri) │
│  `app/(app)/`    │  `app/page.tsx` +     │  same UI, loads deployed │
│  `components/    │  `components/guest/   │  frontend; bridge via    │
│   shell/AppShell │   GuestShell.tsx`     │  `lib/desktop/tauri.ts`  │
│   .tsx`          │                       │                          │
└────────┬─────────┴───────────┬───────────┴────────────┬─────────────┘
         │ fetch (JSON/NDJSON) │                        │ invoke()
         ▼                     ▼                        ▼
┌─────────────────────────────────────────┐  ┌──────────────────────────┐
│  API route handlers (self-guarding)      │  │  Tauri Rust commands     │
│  `app/api/*/route.ts`                    │  │  `src-tauri/src/         │
│  auth guards: `lib/auth/guard.ts`        │  │   runtime.rs, files.rs`  │
└────────┬────────────────────────────────┘  └──────────┬───────────────┘
         ▼                                              │
┌─────────────────────────────────────────┐             │
│  Domain layer (framework-free modules)   │◄────────────┘
│  `lib/parse/` `lib/extract/` `lib/fill/` │   (local LLM chat, file save)
│  `lib/templates/` `lib/review/`          │
│  `lib/batch/` `lib/upload/` `lib/crypto/`│
└────────┬─────────────────┬──────────────┘
         ▼                 ▼
┌──────────────────┐  ┌───────────────────────────────────────────────┐
│  Persistence      │  │  External services                            │
│  `lib/db/*`       │  │  Vercel Blob (`@vercel/blob`), OpenRouter /   │
│  Drizzle ORM over │  │  Gemini / BYOK OpenAI-compatible endpoints,   │
│  Neon HTTP        │  │  local Ollama / LM Studio (desktop only)      │
└──────────────────┘  └───────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root layout | Fonts, theme/accent bootstrap script, `<html>` shell | `app/layout.tsx` |
| Authed layout | Session check, load user prefs/mapping/templates from DB (with fallbacks), mount all providers | `app/(app)/layout.tsx` |
| App shell | Sidebar/Topbar chrome + 4 React contexts (wizard trigger, model, mapping, templates) | `components/shell/AppShell.tsx` |
| Guest shell | Anonymous guest session (`signIn("guest")`), embedded wizard, PT-only | `components/guest/GuestShell.tsx` |
| Fill wizard | 4-step client flow: pick template + upload → process → review → done | `components/wizard/WizardModal.tsx` |
| Processing step | Client orchestrator: `/api/parse` → `/api/extract` NDJSON stream (or local desktop extract), race UI, retry/switch-model | `components/wizard/Processing.tsx` |
| Review step | Editable extracted values, advisory validation, needs-attention nav | `components/review/ReviewStep.tsx`, `lib/review/*` |
| Done step | Download filled xlsx (`/api/fill`), persist history (`/api/fills`), desktop save via Tauri | `components/wizard/DoneStep.tsx` |
| Batch fill | Sequential per-file upload→parse→extract→fill pipeline + zip download | `components/batch/BatchModal.tsx`, `lib/batch/run-batch.ts`, `lib/batch/run-one.ts` |
| Document parsing | PDF/XLSX/DOCX → `ParsedDoc` text blocks with locators | `lib/parse/index.ts`, `lib/parse/{pdf,xlsx,docx}.ts` |
| Extraction | Regex-rule pass + LLM pass with model race, own-company post-filter | `lib/extract/extract.ts`, `lib/extract/rules.ts`, `lib/extract/llm/*` |
| LLM adapters | `ExtractionModel` implementations: OpenRouter race, Gemini, OpenAI-compatible (BYOK + local) | `lib/extract/llm/{openrouter,gemini,openai-compat,local-model}.ts` |
| Excel fill | Raw OOXML cell writes via fflate zip surgery (no exceljs at runtime) | `lib/fill/xlsx.ts`, `lib/fill/{cell,values,schedule}.ts` |
| Template scan | LLM proposes fillable fields from uploaded xlsx sheet texts | `lib/templates/scan.ts`, `lib/templates/xlsx-scan.ts` |
| Auth | NextAuth v5 credentials (env users + DB users + guest), edge/node config split | `auth.ts`, `auth.config.ts`, `middleware.ts`, `lib/auth/*` |
| Persistence | Per-table repository modules over lazy Drizzle/Neon singleton | `lib/db/client.ts`, `lib/db/{fills,templates,mappings,users,avatars,accents,user-models,search}.ts` |
| BYOK secrets | AES-256-GCM encrypt/decrypt of user API keys | `lib/crypto/secrets.ts` |
| Desktop bridge | Tauri detection + typed `invoke()` wrappers (dynamic import, web-safe) | `lib/desktop/tauri.ts` |
| Desktop native | Local runtime detection (Ollama/LM Studio), LLM chat proxy, folder pick, safe file save | `src-tauri/src/{runtime,files}.rs`, `src-tauri/src/lib.rs` |

## Pattern Overview

**Overall:** Layered Next.js 14 App Router monolith with a framework-free domain core in `lib/`, plus a thin Tauri 2 desktop wrapper that reuses the deployed web frontend.

**Key Characteristics:**
- Server components fetch initial data and pass plain props down; all interactivity lives in `"use client"` components under `components/`.
- Client state is React Context only (no Redux/Zustand/SWR/React Query). Contexts are defined in `components/shell/AppShell.tsx` and provider files in `lib/` (`lib/i18n.tsx`, `lib/theme.tsx`, `lib/accent.tsx`).
- Long-running operations (extraction, template scan) stream NDJSON events over `Response(ReadableStream)`; the same event protocol is produced in-webview for desktop local models (`lib/extract/llm/run-local-extract.ts`).
- "Never 500 the app": server components and read APIs swallow DB failures and fall back to seed data / empty results (see `app/(app)/layout.tsx:29-65`, `app/(app)/fills/page.tsx:13-18`, `app/api/search/route.ts:19-22`).
- Guest mode is a first-class role (`role: "guest"` on the JWT): guests get the built-in PT template + default model only, sources deleted after parse, no history.

## Layers

**Route/UI layer (`app/`):**
- Purpose: Routing, session gating, initial data load, metadata.
- Location: `app/(app)/*/page.tsx` (server components), `app/login/page.tsx`, `app/register/page.tsx`, `app/page.tsx`.
- Contains: `async` server components that call `auth()` and `lib/db/*`, then render a client component with props.
- Depends on: `auth.ts`, `lib/db/*`, `components/*`.
- Used by: Next.js router.

**Client component layer (`components/`):**
- Purpose: All interactive UI. Grouped by feature (shell, wizard, review, templates, batch, dashboard, settings, sources, auth, guest).
- Location: `components/*/`; shared primitives in `components/primitives.tsx` (`Btn`, `Icon`, `Tag`, `Logo`, `Eyebrow`).
- Depends on: contexts from `AppShell.tsx`, hooks `useI18n()`/`useToast()`, browser-safe `lib/` modules, `fetch()` to `app/api/*`.
- Used by: pages and layouts.

**API layer (`app/api/*/route.ts`):**
- Purpose: HTTP boundary. Every protected route self-guards (middleware excludes `/api` — see `middleware.ts:11`).
- Contains: request validation, guard calls, delegation to `lib/`, response shaping (JSON, NDJSON stream, or file attachment).
- Guard pattern: `const denied = await requireUser(); if (denied) return denied;` or explicit `auth()` + `isGuest()` when identity/role is needed (`lib/auth/guard.ts`).
- Depends on: `lib/*` only. Route handlers contain no business logic beyond validation and wiring.

**Domain layer (`lib/`):**
- Purpose: All business logic, deliberately framework-free and unit-tested (co-located `*.test.ts`, 73 test files).
- Location: `lib/parse/`, `lib/extract/`, `lib/fill/`, `lib/templates/`, `lib/review/`, `lib/batch/`, `lib/upload/`, `lib/auth/`, `lib/crypto/`, `lib/llm/` (view-model helpers), plus root singletons (`lib/types.ts`, `lib/i18n.tsx`, `lib/theme*.ts`, `lib/accent*.ts`, `lib/contrast.ts`).
- Depends on: `lib/db/*` (server-only modules), external SDKs.
- Used by: API routes, server components, and client components (browser-safe subset).

**Persistence layer (`lib/db/`):**
- Purpose: One module per table/aggregate; pure row-mapping logic split into testable `lib/db/map.ts`.
- Connection: `getDb()` lazy singleton in `lib/db/client.ts` (Neon HTTP driver — serverless, no pool, no interactive transactions).
- Schema: `lib/db/schema.ts` (Drizzle pgTable definitions; pushed via `drizzle-kit push`, seeded by `scripts/db-seed.mjs`).

**Desktop layer (`src-tauri/`):**
- Purpose: Native capabilities the web can't do: probe `localhost` LLM runtimes, proxy chat to them (webview CSP/CORS bypass), pick directories, write files safely.
- Location: `src-tauri/src/lib.rs` (command registration), `runtime.rs`, `files.rs`; config `src-tauri/tauri.conf.json` (prod webview loads the deployed Vercel frontend; auto-updater via GitHub Releases).
- Bridge: `lib/desktop/tauri.ts` — `isTauri()` gate + dynamic `import("@tauri-apps/api/core")` so the web bundle never includes Tauri.

## Data Flow

### Primary Request Path (fill wizard)

1. Upload: client uploads files directly to Vercel Blob via client tokens (`lib/upload/client.ts` → `app/api/blob/upload/route.ts`, 20 MB / pdf-xlsx-docx only).
2. Parse: `components/wizard/Processing.tsx:138` POSTs blob URLs to `app/api/parse/route.ts`, which fetches each blob and runs `lib/parse/index.ts` → `ParsedDoc[]` (text blocks + locators). Guest sources are deleted from Blob immediately after parse (`app/api/parse/route.ts:47-54`).
3. Extract: `Processing.tsx:90` POSTs `{ templateId, model, docs, fields }` to `app/api/extract/route.ts`, which streams NDJSON events (`attempt` / `attempt-fail` / `attempt-win` / `result`). Inside, `lib/extract/extract.ts` runs: (1) regex rules pass (`lib/extract/rules.ts`), (2) LLM pass via `getModel()` (`lib/extract/llm/registry.ts`) — OpenRouter free-pool race (`lib/extract/llm/race.ts`, timeouts in `lib/extract/llm/openrouter.ts`) with paid last-resort, or a BYOK custom model (decrypted key, SSRF re-check `assertSafeBaseUrl`), (3) empty placeholders for the rest.
4. Review: `components/review/ReviewStep.tsx` renders rows from `lib/review/rows.ts`; advisory validation `lib/review/validate.ts`; needs-attention classification `lib/review/attention.ts`.
5. Export: `components/wizard/DoneStep.tsx` POSTs values to `app/api/fill/route.ts` → `lib/fill/xlsx.ts` writes cells into the template xlsx (repo file `lib/fill/templates/pt.xlsx` for the built-in, Blob-stored file for user templates) → binary attachment. On desktop the bytes go through Tauri `save_file` instead of a browser download.
6. History: `DoneStep` fire-and-forgets POST `/api/fills` → `lib/db/fills.ts#createFill` (atomic `db.batch()` insert of fills + source_files + extracted_values). Skipped for guests (`components/shell/GuestContext.tsx`).

### Desktop local-model extraction

1. `Processing.tsx:86-88` detects `isTauri() && model.startsWith("local:")`.
2. `lib/extract/llm/run-local-extract.ts` runs `extractFields()` **in the webview**, with `localCompatModel` (`lib/extract/llm/local-model.ts`) calling the Rust `llm_chat` command (`src-tauri/src/runtime.rs`) against the detected Ollama/LM Studio base URL.
3. It emits the same NDJSON lines (`local-eta`, `attempt*`, `result`) into the same client consumer — server and local paths share one event protocol.

### Template creation

1. `components/templates/NewTemplateModal.tsx` uploads the xlsx to Blob, then POSTs to `app/api/templates/route.ts` (NDJSON stream).
2. Server: `lib/templates/xlsx-scan.ts` extracts sheet texts → `lib/templates/scan.ts#proposeFields` races free models to propose `ExtractField[]` → `lib/db/templates.ts#createTemplate` + `lib/db/mappings.ts#saveMapping`. On scan failure the template is NOT created (typed failure codes `llm` / `nofields`).
3. Per-user field mappings are edited in `components/templates/MappingEditor.tsx` and persisted via `app/api/mappings/route.ts` (PK `user_id + template_id` in `template_mappings`).

### Auth flow

1. Page requests hit `middleware.ts` (Edge) built from `auth.config.ts` only — unauthenticated users redirect to `/login`. API routes are excluded from the matcher and self-guard with 401/403.
2. `auth.ts` (Node) adds two Credentials providers: email/password (env `AUTH_USERS` fallback first, then DB users with bcrypt) and `guest` (anonymous, `lib/auth/guest.ts`).
3. JWT sessions carry `role: "user" | "guest"` (`auth.config.ts` callbacks; type augmentation in `types/next-auth.d.ts`). Guests are redirected out of `app/(app)/layout.tsx:19-22`.

**State Management:**
- Server: none beyond the DB — every request re-reads.
- Client: React Context + `useState` in `AppShell.tsx` (`ModelContext`, `TemplateMappingContext`, `TemplatesContext`, `WizardTrigger`); wizard step state is local to `WizardModal.tsx`. Theme/lang/accent persist as cookies (read server-side in layouts, bootstrapped pre-hydration by the inline script in `app/layout.tsx:15-20`).

## Key Abstractions

**`ParsedDoc` (`lib/parse/types.ts`):**
- Purpose: Format-agnostic parsed document — `blocks` of text with locators (page/sheet/cell), `scannedPages`, `warnings`.
- Produced by: `lib/parse/{pdf,xlsx,docx}.ts` behind the `parseDocument()` facade (`lib/parse/index.ts`).

**`ExtractField` (`lib/extract/fields.ts`):**
- Purpose: Per-template field catalog entry — cell address, kind, `strategy: "rule" | "llm" | "manual"`, `fillMode: "auto" | "constant" | "date"`, LLM hints, `isCounterparty` flag.
- Built-in PT catalog: `PT_FIELDS` in the same file; user templates store theirs in `template_mappings.fields` (jsonb) and `templates.default_fields`.
- Untrusted-input validation: `lib/templates/validate.ts#parseFieldList` (every API accepting fields runs it).

**`ExtractedValue` (`lib/types.ts`):**
- Purpose: One extraction result — value, confidence (`high|med|low`), source `{ fileId, locator }`. Flows wizard → review → fill → history unchanged.

**`ExtractionModel` (`lib/extract/llm/types.ts`):**
- Purpose: Strategy interface `{ id, extract(fields, text, onAttempt) }` implemented by all four adapters; selected by `lib/extract/llm/registry.ts#getModel` or overridden (BYOK/local) by callers.
- `raceModels()` (`lib/extract/llm/race.ts`) is the shared concurrency engine: first win aborts the rest, failures are collected with typed reasons.

**`OnAttempt` / NDJSON event protocol (`lib/extract/llm/types.ts`):**
- Purpose: Progress events (`start|fail|win`) serialized as NDJSON lines by `/api/extract`, `/api/templates`, and `run-local-extract.ts`; consumed by one client parser in `Processing.tsx#handleLine`.

**Repository modules (`lib/db/*.ts`):**
- Purpose: One file per aggregate; exported functions take primitive args (email lowercase, ids) and return typed row shapes. Pure mapping extracted to `lib/db/map.ts` for testability.

**Guard helpers (`lib/auth/guard.ts`):**
- `requireUser()` → 401, `requireFullUser()` → 401/403, `isGuest()`. The comment at `guard.ts:10-15` explains why bare `await auth()` truthiness is unsafe.

## Entry Points

**Web root (`app/layout.tsx`):**
- Triggers: every request.
- Responsibilities: Google fonts (Space Grotesk / Manrope / IBM Plex Mono as CSS vars), pre-hydration theme/accent cookie script, global CSS.

**Guest landing (`app/page.tsx`):**
- Triggers: `/`. Full users redirect to `/fills`; everyone else gets `GuestShell` (auto guest sign-in + embedded PT wizard).

**Authed app (`app/(app)/layout.tsx` + pages `fills`, `fills/[id]`, `templates`, `templates/[id]`, `sources`, `settings`):**
- Triggers: authenticated navigation (middleware-gated).
- Responsibilities: session/role gate, initial DB loads with fallbacks, provider stack, `AppShell`.

**API surface (`app/api/*/route.ts`):**
- `parse`, `extract`, `fill`, `fills`, `mappings`, `templates` (+`[id]`), `models` (+`[id]`, BYOK CRUD/probe), `search`, `register`, `account/{profile,password,avatar,accent}`, `blob/{upload,avatar,template}`, `auth/[...nextauth]`.
- Node runtime is forced where DB/LLM/fs access happens (`export const runtime = "nodejs"`); streaming routes set `maxDuration = 60`.

**Middleware (`middleware.ts`):**
- Edge NextAuth instance from `auth.config.ts` only; matcher excludes `api`, static assets, `login`, `register`, and `/`.

**Desktop (`src-tauri/src/main.rs` → `lib.rs#run`):**
- Registers commands `detect_local_runtime`, `llm_chat`, `pick_directory`, `save_file`; updater plugin. Release pipeline: `.github/workflows/desktop-release.yml`.

**Ops scripts:** `scripts/db-seed.mjs` (idempotent PT template seed), `scripts/hash-password.mjs` (bcrypt hash for `AUTH_USERS`).

## Architectural Constraints

- **Edge/Node split of auth:** `auth.config.ts` must stay free of Node-only imports (bcrypt) because `middleware.ts` bundles it for Edge. Providers with `authorize()` live only in `auth.ts`.
- **Neon HTTP driver:** no interactive transactions — multi-insert atomicity uses `db.batch()` (`lib/db/fills.ts:12-20`). Also note the correlated-subquery aliasing workaround with `sql.raw('"fills"."id"')` (`lib/db/fills.ts:26-30`).
- **Serverless file tracing:** `/api/fill` reads `lib/fill/templates/pt.xlsx` at runtime; `next.config.mjs` must keep `experimental.outputFileTracingIncludes` for it or downloads 500 on Vercel.
- **Global state:** module-level singletons exist in `lib/db/client.ts` (`_db`), `lib/desktop/tauri.ts` (`cached` runtime), `components/wizard/WizardModal.tsx` (`uid` counter). All are intentional and safe per-process.
- **Tauri isolation:** `@tauri-apps/api` is only imported dynamically inside `lib/desktop/tauri.ts`; everything else checks `isTauri()` first.
- **Route timeouts:** LLM chains budget against Vercel's 60s (`maxDuration = 60`); wave timeouts in `lib/extract/llm/openrouter.ts` (30s free + 12s paid) and `lib/templates/scan.ts` (20s per attempt) are tuned to fit.
- **Circular imports:** none detected; `lib/` dependencies flow parse → extract → fill/review with shared types at `lib/types.ts`.
- **Bilingual constraint:** every user-facing string exists as ru/en in `lib/seed/pt.ts#STR` and is rendered via `useI18n().t(key)`. Server-side error strings are Russian literals in routes.

## Anti-Patterns

### Bare truthiness check on `auth()`

**What happens:** Guarding with `if (!(await auth())) return unauthorized()`.
**Why it's wrong:** With a misconfigured host, NextAuth v5 resolves to a truthy error object, silently bypassing the guard (documented at `lib/auth/guard.ts:11-14` and `auth.config.ts:7-10`).
**Do this instead:** Check `session?.user` explicitly, or use `requireUser()` / `requireFullUser()` from `lib/auth/guard.ts`.

### Static import of Tauri or Node-only modules in shared code

**What happens:** `import { invoke } from "@tauri-apps/api/core"` at module top level, or importing `bcryptjs`/`node:crypto` into files reachable from `auth.config.ts` or client components.
**Why it's wrong:** Bloats/breaks the web bundle (Tauri) or the Edge middleware bundle (bcrypt) — the exact failure the `auth.ts`/`auth.config.ts` split exists to prevent.
**Do this instead:** Route all desktop calls through `lib/desktop/tauri.ts` (dynamic import behind `isTauri()`); keep Node-only crypto in server-only modules (`lib/crypto/secrets.ts`, `lib/auth/users.ts`).

### Throwing on DB failure in server components / read paths

**What happens:** Letting `lib/db/*` errors propagate out of a page or layout.
**Why it's wrong:** The app's contract is "DB unreachable → degraded render, never 500" (guest-friendly, env-user fallback still works). An uncaught reject turns the whole shell into an error page.
**Do this instead:** Wrap DB reads in `try/catch` with a seed/empty fallback, as in `app/(app)/layout.tsx:30-36`, `app/(app)/fills/page.tsx:13-18`, `app/api/search/route.ts:19-22`. Write paths may return 500 with a localized message.

### Trusting client-supplied fields/URLs

**What happens:** Passing `body.fields` straight to fill/extract, or fetching arbitrary user-supplied URLs server-side.
**Why it's wrong:** Fields are untrusted jsonb driving cell writes; URLs enable SSRF/deleting foreign blobs.
**Do this instead:** Validate fields with `parseFieldList()` (`lib/templates/validate.ts`), restrict blob URLs with `isOwnBlobUrl()` (`lib/upload/avatar.ts`), and re-check BYOK base URLs on every use with `assertSafeBaseUrl()` (`app/api/extract/route.ts:47-52`).

## Error Handling

**Strategy:** Degrade, never crash. Typed failure codes at boundaries; localized (RU) user messages; raw errors only in warnings arrays.

**Patterns:**
- Extraction never throws for LLM failure — it returns `{ llmFailed, warnings, values }` with empty placeholders (`lib/extract/extract.ts:100-109`); the UI offers retry / switch model / continue-without-LLM (`components/wizard/Processing.tsx` "llm-failed" phase).
- Typed error taxonomies: `ProbeCode` (`lib/extract/llm/openai-compat.ts`) mapped to RU copy in `lib/extract/extract.ts:13-21` and to i18n keys in `lib/llm/custom-model-view.ts`; `ScanFailure = "llm" | "nofields"` (`lib/templates/scan.ts`).
- NDJSON streams guard dead controllers (`try { write(...) } catch { /* client gone */ }` — `app/api/extract/route.ts:73-79`, `app/api/templates/route.ts`).
- API validation returns 400 with a Russian message; auth guards return uniform 401/403 JSON.

## Cross-Cutting Concerns

**Logging:** none (no logger framework; Rust side logs via `tauri_plugin_log` in debug builds only).
**Validation:** manual per-route body checks + `parseFieldList` for field lists + `validateCellRef` (`lib/templates/cellref.ts`) for cell addresses.
**Authentication:** NextAuth v5 JWT sessions; middleware for pages, `lib/auth/guard.ts` helpers for APIs; guest role restrictions enforced server-side in each route (model lock, PT-only fill, no persistence).
**i18n:** `lib/i18n.tsx` context over the `STR` table in `lib/seed/pt.ts`; lang cookie synced client-side.
**Theming:** CSS variables + `data-theme`/`data-accent` on `<html>`; `lib/theme*.ts`, `lib/accent*.ts`, contrast math in `lib/contrast.ts`.

---

*Architecture analysis: 2026-07-23*
