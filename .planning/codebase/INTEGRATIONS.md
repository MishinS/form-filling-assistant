# External Integrations

**Analysis Date:** 2026-07-23

## APIs & External Services

**LLM Providers (field extraction + template scanning):**
- OpenRouter - Default provider; races the free-model pool with a paid last-resort tail
  - Endpoint: `https://openrouter.ai/api/v1/chat/completions` (`lib/extract/llm/openrouter.ts`, `lib/templates/scan.ts`)
  - Auth: `OPENROUTER_API_KEY` (Bearer); attribution headers `HTTP-Referer` from `OPENROUTER_SITE_URL`, `X-Title: Form-Filling Assistant`
  - Model catalog + free pool: `lib/extract/llm/catalog.ts` (`FREE_MODEL_IDS`, `PAID_LAST_RESORT`, `openrouter/free` auto-router); race logic: `lib/extract/llm/race.ts`
  - Timeouts: 30s free wave / 12s paid tail (extraction), 20s per attempt (template scan) — bounded by `maxDuration = 60` on `app/api/extract/route.ts`
- Google Gemini - Direct API for `gemini*` model ids
  - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` (`lib/extract/llm/gemini.ts`)
  - Auth: `GEMINI_API_KEY` (query param); structured JSON via `responseSchema`
- BYOK (user-supplied keys) - OpenAI-compatible chat calls against user-chosen providers
  - Adapter: `lib/extract/llm/openai-compat.ts` (`chatComplete`); provider presets in `lib/extract/llm/providers-data.ts`: OpenRouter `https://openrouter.ai/api/v1`, OpenAI `https://api.openai.com/v1`, Anthropic `https://api.anthropic.com/v1`, Google `https://generativelanguage.googleapis.com/v1beta/openai`, plus `custom` base URL
  - CRUD + connectivity probe: `app/api/models/route.ts`, `app/api/models/[id]/route.ts`, `lib/extract/llm/probe.ts`
  - Keys stored AES-256-GCM-encrypted (`key_cipher` in `user_models` table) using `BYOK_ENCRYPTION_KEY` (`lib/crypto/secrets.ts`)
  - SSRF hardening: base-URL validation (`assertSafeBaseUrl` in `lib/extract/llm/providers.ts`) and `redirect: "error"` on fetch
- Local LLM runtimes (desktop only) - Ollama and LM Studio autodetected on localhost
  - Detection/proxy via Tauri Rust commands `detect_local_runtime` / `llm_chat` (`src-tauri/src/runtime.rs`: Ollama `http://127.0.0.1:11434`, LM Studio `http://127.0.0.1:1234`)
  - JS bridge: `lib/desktop/tauri.ts` (`isTauri()`, dynamic `@tauri-apps/api` import); model adapter: `lib/extract/llm/local-model.ts` (lenient JSON parse for small models)
- Model routing: `lib/extract/llm/registry.ts` — `gemini*` → Gemini, slugs containing `/` → OpenRouter, `custom:<id>` → BYOK, local runtime slugs → desktop bridge
- Declared but unwired: `GROQ_API_KEY` and `LLM_PROVIDER_ORDER` exist in `.env.example` with no code references

**Graceful degradation:** all LLM calls are best-effort — with no keys configured the pipeline still returns regex-extracted fields.

## Data Storage

**Databases:**
- Neon Postgres (serverless, via Vercel Marketplace integration)
  - Connection: `DATABASE_URL` (auto-injected on Vercel; locally `vercel env pull .env.local`)
  - Client: `@neondatabase/serverless` HTTP driver + Drizzle ORM (`lib/db/client.ts` lazy singleton `getDb()`)
  - Schema: `lib/db/schema.ts` — `templates`, `fields`, `fills`, `source_files`, `extracted_values`, `template_mappings`, `users`, `user_avatars`, `user_accents`, `user_models`
  - Migrations: `drizzle-kit push` (config `drizzle.config.ts`; no committed migrations dir); seed: `scripts/db-seed.mjs` (upserts the built-in `pt` template)
  - DB failures never block core flows (login/avatar lookups wrapped in try/catch in `auth.ts`)

**File Storage:**
- Vercel Blob - Source documents, user template files, avatars
  - Client-side direct uploads: `lib/upload/client.ts` (`@vercel/blob/client` `upload`)
  - Token-exchange routes (`handleUpload`): `app/api/blob/upload/route.ts` (sources, 20 MB cap, pdf/xlsx/docx only), `app/api/blob/template/route.ts`, `app/api/blob/avatar/route.ts`
  - Deletion (`del`): `app/api/parse/route.ts` (post-parse cleanup), `app/api/account/avatar/route.ts`, `app/api/templates/[id]/route.ts`
  - Auth: `BLOB_READ_WRITE_TOKEN`
  - Avatar URL host allow-list: `lib/upload/avatar.ts` (`*.public.blob.vercel-storage.com`, https only)
- Built-in fill template shipped in-repo: `lib/fill/templates/pt.xlsx` (traced into the `/api/fill` function via `next.config.mjs`)

**Caching:**
- None (no Redis/memcache; only in-memory module state such as the local-runtime cache in `lib/desktop/tauri.ts`)

## Authentication & Identity

**Auth Provider:**
- NextAuth (Auth.js) v5 — Credentials-based, self-hosted; no OAuth providers
  - Providers (`auth.ts`): Credentials (env users from `AUTH_USERS` first, then DB `users` table via bcrypt compare) and a `guest` provider (`lib/auth/guest.ts`, role `guest` with restricted API access via `lib/auth/guard.ts`)
  - Sessions: JWT strategy; role propagated through `jwt`/`session` callbacks (`auth.config.ts`); `trustHost: true`
  - Route protection: `middleware.ts` (everything except `/api/*`, Next internals, `/login`, `/register`, `/`); API routes self-guard with 401 (`lib/auth/guard.ts`)
  - Registration: `app/api/register/route.ts`, gated by `INVITE_CODE` (registration closed when unset); passwords hashed with bcryptjs
  - Secrets: `AUTH_SECRET`; owner accounts in `AUTH_USERS` env JSON

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry or similar detected)

**Logs:**
- Web: console / Vercel function logs only
- Desktop: `tauri-plugin-log` enabled in debug builds only (`src-tauri/src/lib.rs`)

## CI/CD & Deployment

**Hosting:**
- Web: Vercel (`vercel.json`, `.vercel/project.json`); deploy on push (Vercel Git integration; no web workflow in `.github/workflows/`)
- Desktop: Tauri 2 shell loading the deployed Vercel app (`frontendDist: https://web-three-liart-43.vercel.app` in `src-tauri/tauri.conf.json`); the same origin is allow-listed in `src-tauri/capabilities/`

**CI Pipeline:**
- GitHub Actions: `.github/workflows/desktop-release.yml` — on `desktop-v*` tags builds Windows (NSIS) + Linux (AppImage/deb/rpm) bundles with `tauri-apps/tauri-action`, signs updater artifacts with repo secret `TAURI_SIGNING_PRIVATE_KEY` (empty passphrase), publishes a GitHub Release including `latest.json`
- No CI for lint/tests detected (tests run locally via `npm test`)

**Desktop auto-update:**
- `@tauri-apps/plugin-updater` checks `https://github.com/MishinS/form-filling-assistant/releases/latest/download/latest.json` (endpoint + minisign pubkey in `src-tauri/tauri.conf.json`); update UI in `components/settings/AboutCard.tsx`

## Environment Configuration

**Required env vars** (names only; see `.env.example`):
- `DATABASE_URL` - Neon Postgres (optional; app degrades without it)
- `AUTH_SECRET`, `AUTH_USERS`, `INVITE_CODE` - Auth.js + registration gate
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob
- `OPENROUTER_API_KEY`, `OPENROUTER_SITE_URL`, `GEMINI_API_KEY` - LLM extraction (optional; regex fallback)
- `BYOK_ENCRYPTION_KEY` - BYOK key encryption (required for `/api/models`; missing from `.env.example`)
- `GROQ_API_KEY`, `LLM_PROVIDER_ORDER` - Present in `.env.example` but unused in code

**Secrets location:**
- Vercel project env vars (pull locally with `vercel env pull .env.local`); `.env.local` present locally, git-ignored
- GitHub repo secrets: `TAURI_SIGNING_PRIVATE_KEY` (desktop release signing)

## Webhooks & Callbacks

**Incoming:**
- Vercel Blob upload callbacks: `onUploadCompleted` handlers in `app/api/blob/*/route.ts` (currently no-op; parsing is client-triggered via `POST /api/parse`)
- No other incoming webhooks

**Outgoing:**
- None

---

*Integration audit: 2026-07-23*
