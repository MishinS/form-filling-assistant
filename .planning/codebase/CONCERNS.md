# Codebase Concerns

**Analysis Date:** 2026-07-23

## Tech Debt

**No versioned database migrations:**
- Issue: `drizzle.config.ts` points `out` at `./drizzle`, but no migrations directory exists. Schema is applied via `drizzle-kit push` plus a hand-run seed (`scripts/db-seed.mjs` comment: "Run after drizzle-kit push"). There is no migration history, no rollback path, and schema drift between environments is undetectable.
- Files: `drizzle.config.ts`, `lib/db/schema.ts`, `scripts/db-seed.mjs`
- Impact: Any schema change is a manual, unaudited push against production Neon. A destructive change (column rename, type change) has no safety net.
- Fix approach: Adopt `drizzle-kit generate` + committed migration files; run migrations in a deploy step instead of ad-hoc push.

**Hardcoded single-tenant company identity:**
- Issue: `OWN_COMPANY` ("АО Семейный доктор", ИНН 7727194344) is a module constant used to exclude the operator's own company from counterparty extraction — but the app is multi-user with per-user templates and models.
- Files: `lib/extract/own-company.ts` (lines 11–14), consumed by `lib/extract/extract.ts`
- Impact: Every other tenant gets wrong counterparty filtering; generalizing the product requires moving this to per-user/org settings.
- Fix approach: Store own-company (name + ИНН) per user (new table or users column), thread it through `extractFields`.

**Regex-over-raw-XML spreadsheet engine:**
- Issue: XLSX filling unzips the workbook with fflate and edits worksheet XML with regexes. The ПТ path hardcodes образец internals: clone-of-row-5 style ids (`s="83"`–`s="100"`), the `D13` Итого formula cell, and the literal string `SUM(D5:D5)`.
- Files: `lib/fill/xlsx.ts` (`insertScheduleRows`, `retargetItogoFormula`, `scheduleRowXml`), `lib/fill/cell.ts`
- Impact: Any re-save of `lib/fill/templates/pt.xlsx` from Excel (which renumbers style ids or reformats XML) silently breaks row insertion and formula retargeting. Custom-template writes share the same fragility.
- Fix approach: Keep the approach (it is well-tested) but pin the template file as immutable and add a checksum test; longer term consider a real OOXML library for the custom path.

**UI strings live inside the seed file:**
- Issue: The entire RU/EN string table (`STR`, ~250 keys) lives in `lib/seed/pt.ts` alongside mock seed data (`TEMPLATES`, `PtField`, history rows). `lib/i18n.tsx` imports translations from a file named "seed".
- Files: `lib/seed/pt.ts`, `lib/i18n.tsx`
- Impact: Confusing ownership; seed/mock data and production strings change together. API routes additionally return hardcoded Russian error strings (`app/api/*/route.ts`), so the `en` locale only covers client-rendered text.
- Fix approach: Extract `STR` to `lib/i18n-strings.ts`; return stable error codes from API routes and translate client-side (some routes already do this with `code:` fields — make it uniform).

**Inconsistent email-case normalization for fill ownership:**
- Issue: Most DB helpers lowercase the email key (`lib/db/mappings.ts`, `lib/db/templates.ts`, `lib/db/user-models.ts`), but fills are written and queried with the raw session email: `createFill(session.user.email, …)` in `app/api/fills/route.ts` and `searchAll(userId…)` in `app/api/search/route.ts`.
- Files: `app/api/fills/route.ts` (line 25), `app/api/search/route.ts` (line 12), `lib/db/fills.ts`
- Impact: Works today because DB-registered emails are stored lowercased — but an `AUTH_USERS` env account with a mixed-case email writes history under verbatim case; if the env entry's casing is ever edited, that user's history and search silently vanish.
- Fix approach: Lowercase at the session boundary (one helper, e.g. `sessionEmail()` as in `app/api/models/route.ts`) and use it in every route.

**Desktop shell pinned to one Vercel deployment URL:**
- Issue: `frontendDist` and the remote-capability allowlist hardcode `https://web-three-liart-43.vercel.app`.
- Files: `src-tauri/tauri.conf.json` (`build.frontendDist`), `src-tauri/capabilities/default.json` (`remote.urls`)
- Impact: Moving the web app to a custom domain (or a renamed Vercel project) bricks every installed desktop build's IPC until a new desktop release ships through the updater.
- Fix approach: Serve from a stable custom domain before wider desktop distribution.

**Silent catch-all error handling with zero observability:**
- Issue: The codebase deliberately swallows errors to "never 500 the app" (`catch { /* orphan stays */ }`, `catch { return EMPTY }` etc. throughout), but there is no error tracker and not a single `console.error` in production code — failures leave no trace anywhere.
- Files: `app/api/search/route.ts`, `app/api/parse/route.ts`, `app/api/templates/[id]/route.ts`, `auth.ts` (`avatarFor`), `app/(app)/layout.tsx`, many others
- Impact: Degradations (DB flaps, blob deletion failures, mapping-save failures noted "seen in UAT on a Neon cold start") are invisible in production.
- Fix approach: Add a minimal logging/reporting sink (even structured `console.error` → Vercel logs) inside the intentional catch blocks; keep the graceful behavior.

## Known Bugs

**Custom-template fill drops cell styles on existing cells:**
- Symptoms: Filling a user-uploaded template overwrites a styled cell with an unstyled one — borders/number formats/fonts on that cell disappear in the exported file.
- Files: `lib/fill/xlsx.ts` — `writeCellCustom` replaces an existing `<c>` with `buildCell(...)`, which never carries the `s="…"` attribute; contrast `lib/fill/cell.ts` `writeCell`, which preserves style via `styleAttr` for the ПТ path.
- Trigger: Any custom-template fill targeting a cell that already exists with a style in the workbook.
- Workaround: None from the UI. Fix: port the `styleAttr` preservation from `lib/fill/cell.ts` into `writeCellCustom`.

**Scanned-PDF warning promises OCR that does not exist:**
- Symptoms: Image-only PDF pages produce the user-facing warning "Страницы без текстового слоя: … — будут распознаны (фаза 4)", but no OCR phase exists anywhere in the codebase; those pages contribute nothing and extraction quietly runs on partial text.
- Files: `lib/parse/pdf.ts` (lines 19–21)
- Trigger: Upload a scanned PDF.
- Workaround: None; either implement OCR or change the copy to an honest "not processed".

## Security Considerations

**SSRF via `/api/parse` (reachable by anonymous guests):**
- Risk: The route fetches every user-supplied `sources[].url` server-side with no allowlist — unlike deletes, which check `isOwnBlobUrl`, and unlike the custom-model path, which runs `assertSafeBaseUrl`. `http:` URLs, internal IPs, and cloud metadata endpoints are all fetchable. The guest Credentials provider (`auth.ts` lines 42–47) issues a session with zero credentials, so this is effectively unauthenticated.
- Files: `app/api/parse/route.ts` (line 30: `await fetch(s.url)`), `lib/upload/avatar.ts` (`isOwnBlobUrl` — used only for deletion), `auth.ts`
- Current mitigation: Response bytes are only interpreted as PDF/XLSX/DOCX; unparseable responses return a warning. This still allows blind SSRF and content exfiltration of any internal resource that happens to be one of those formats.
- Recommendations: Require `isOwnBlobUrl(s.url)` before fetching (all legitimate callers upload to the app's own blob store first — see `lib/upload/client.ts`, `lib/batch/run-one.ts`).

**Uploaded documents live on public blob URLs forever:**
- Risk: All uploads use `access: "public"` (`lib/upload/client.ts` line 46) — invoices/contracts containing personal and financial data are readable by anyone holding the URL. Registered users' source blobs are never deleted (guest sources are cleaned up in `app/api/parse/route.ts`; batch-mode uploads in `lib/batch/run-one.ts` are never deleted and never recorded in history — permanent orphans).
- Files: `lib/upload/client.ts`, `app/api/blob/upload/route.ts`, `lib/batch/run-one.ts`
- Current mitigation: `addRandomSuffix: true` makes URLs unguessable; blob URLs are stored only in the owner-scoped `source_files.blob_key`.
- Recommendations: Move to non-public blob access or short-lived signed URLs; add a retention/cleanup job (especially for batch orphans).

**No rate limiting anywhere; paid LLM spend on the owner's key:**
- Risk: `/api/register` allows unlimited invite-code guessing and account creation; the login credentials flow is brute-forceable; `/api/extract` and `/api/templates` (scan) burn the operator's `OPENROUTER_API_KEY` — including the paid last-resort model `openai/gpt-4.1-nano` (`lib/extract/llm/catalog.ts` `PAID_LAST_RESORT`) for any registered user, on every free-pool failure.
- Files: `app/api/register/route.ts`, `auth.ts`, `app/api/extract/route.ts`, `lib/extract/llm/openrouter.ts`
- Current mitigation: Registration is invite-gated (`lib/auth/register.ts` — closed when `INVITE_CODE` unset); guests are pinned to `freeOnly` + `PT_FIELDS` (`app/api/extract/route.ts` lines 39–40).
- Recommendations: Add per-IP/per-user rate limits (Vercel WAF rules or an Upstash-style limiter) on register, login, extract, and parse; add a per-user spend cap before opening registration wider.

**Desktop webview: remote content with IPC and CSP disabled:**
- Risk: The Tauri shell loads the production website remotely and grants it IPC (`core:default`, updater) with `"csp": null`. `llm_chat` accepts an arbitrary `base_url` from the webview and performs local-network POSTs from the user's machine; `save_file` writes attacker-chosen bytes into an arbitrary directory (only the basename is sanitized in `src-tauri/src/files.rs`). Any XSS on the web app becomes local-network access + arbitrary-directory file drop on desktop users.
- Files: `src-tauri/tauri.conf.json` (`security.csp: null`), `src-tauri/capabilities/default.json`, `src-tauri/src/runtime.rs` (`llm_chat`), `src-tauri/src/files.rs` (`save_file`)
- Current mitigation: React's default escaping (no `dangerouslySetInnerHTML` found); capability list is small; filename traversal is unit-tested.
- Recommendations: Set a real CSP; restrict `llm_chat` base_url to `127.0.0.1:11434`/`127.0.0.1:1234` in Rust (the only supported runtimes per `detect_local_runtime`); consider constraining `save_file` to the picked-directory handle.

**DNS-rebinding TOCTOU on custom model endpoints (accepted residual risk):**
- Risk: `assertSafeBaseUrl` resolves DNS and validates the IP, but the subsequent `fetch` re-resolves independently — a rebinding window.
- Files: `lib/extract/llm/providers.ts` (lines 44–48 document this explicitly), `app/api/extract/route.ts` (re-validates on every use)
- Current mitigation: `redirect: "error"` on calls, https-only, per-use re-validation, invite-gated user base.
- Recommendations: Custom undici dispatcher pinned to the validated IP if custom providers are opened to untrusted users.

**Gemini API key sent as a URL query parameter:**
- Risk: `?key=${key}` can leak into proxy/CDN/server logs.
- Files: `lib/extract/llm/gemini.ts` (line 45)
- Current mitigation: Server-to-Google TLS; the key never reaches the client.
- Recommendations: Send via `x-goog-api-key` header instead.

**Updater signing key has an empty passphrase:**
- Risk: The Tauri updater private key stored in the GitHub secret is unencrypted (workflow comment: "generated with an EMPTY password"). A leaked secret directly signs malicious desktop updates.
- Files: `.github/workflows/desktop-release.yml` (env `TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ""`)
- Recommendations: Regenerate the key with a passphrase and store both as secrets.

**`isOwnBlobUrl` is store-agnostic:**
- Risk: It accepts any `*.public.blob.vercel-storage.com` host — a URL from *someone else's* Vercel Blob store passes as "own". Affects template registration (`app/api/templates/route.ts`) and avatar/template delete targets.
- Files: `lib/upload/avatar.ts`
- Current mitigation: `del()` only succeeds against the app's own store token; foreign template URLs still parse as xlsx only if valid.
- Recommendations: Pin the exact store-id hostname (available from any `BLOB_READ_WRITE_TOKEN`-issued URL).

## Performance Bottlenecks

**Unindexed foreign keys + correlated subqueries in history/search:**
- Problem: `fills.user_id`, `source_files.fill_id`, and `extracted_values.fill_id` have no indexes (`lib/db/schema.ts` defines none beyond PKs), while `listFills`, `listSources`, and `searchAll` run 2–3 correlated subqueries per row plus `ILIKE '%…%'` (unindexable without pg_trgm).
- Files: `lib/db/schema.ts`, `lib/db/fills.ts` (lines 29–45), `lib/db/search.ts` (lines 53–83)
- Cause: Small-scale-first design; fine at dozens of fills, degrades linearly with table growth across all users (each subquery scans by `fill_id`).
- Improvement path: Add indexes on `fills(user_id, created_at)`, `source_files(fill_id)`, `extracted_values(fill_id, field_id)`; consider pg_trgm for search.

**Synchronous bcrypt on the request path:**
- Problem: `bcrypt.hashSync(password, 10)` blocks the Node event loop ~100ms per call.
- Files: `app/api/register/route.ts` (line 34), `app/api/account/password/route.ts` (line 27)
- Improvement path: Use the async `bcrypt.hash` (already used via `bcrypt.compare` elsewhere).

**Batch mode is strictly sequential:**
- Problem: `runBatch` processes files one at a time; each file runs upload → parse → extract (a full free-model race with a 30s wall) → fill. Ten files can take 5+ minutes.
- Files: `lib/batch/run-batch.ts`, `lib/batch/run-one.ts`
- Cause: Deliberate simplicity + free-pool rate-limit friendliness.
- Improvement path: Small concurrency window (2–3) with per-file progress; parse and upload could overlap with extraction of the previous file.

## Fragile Areas

**OpenRouter free-model catalog (external churn):**
- Files: `lib/extract/llm/catalog.ts`
- Why fragile: The comment log shows constant rotation (slugs leaving the free pool, models hanging, regional 403s). Extraction reliability depends on manually re-probing and editing this list; the auto-router entry is explicitly "roulette".
- Safe modification: Update `FREE_MODELS` only with probed models (fast valid-JSON responses); keep `PAID_LAST_RESORT` out of `FREE_MODELS` (tests assert everything in the list is free).
- Test coverage: `lib/extract/llm/catalog.test.ts`, `openrouter.test.ts` cover chain logic, not live model health.

**Drizzle correlated-subquery qualification gotcha:**
- Files: `lib/db/fills.ts` (lines 26–29, 62–64), `lib/db/search.ts` (lines 51–54)
- Why fragile: `${fills.id}` inside a `.select()` projection renders unqualified and binds to the inner table — silently matching nothing. Fixed with `sql.raw('"fills"."id"')` literals; the pattern must be repeated by hand in every new correlated subquery.
- Safe modification: Copy the documented `sql.raw` pattern; verify with the existing route tests (`app/api/fills/route.test.ts`, `lib/db/search.test.ts`).

**BYOK master key has no rotation story:**
- Files: `lib/crypto/secrets.ts`, `app/api/models/route.ts` (GET decrypts every stored key), `app/api/extract/route.ts`
- Why fragile: A single `BYOK_ENCRYPTION_KEY` encrypts all user API keys with no key-version byte. Rotating (or losing) it makes `decryptSecret` throw; `GET /api/models` has no try/catch around decryption → the settings page 500s for every user with a stored model.
- Safe modification: Never change the env var casually; add a version prefix to `keyCipher` before introducing a second key, and wrap the GET-route decryption in a per-row try/catch.
- Test coverage: `lib/crypto/secrets.test.ts` covers round-trip, not rotation.

**ПТ template file is load-bearing at runtime:**
- Files: `lib/fill/templates/pt.xlsx`, `next.config.mjs` (`outputFileTracingIncludes` for `/api/fill`)
- Why fragile: The fill route reads the file from disk with a dynamic path that Next's tracing can't see — the config entry is the only thing keeping it in the serverless bundle. Renaming/moving the file or the route breaks production downloads with a 500.
- Safe modification: Update `next.config.mjs` in the same commit as any move; smoke-test `/api/fill` after deploy.

**NDJSON-over-200 streaming protocol between routes and clients:**
- Files: `app/api/extract/route.ts`, `app/api/templates/route.ts` (server); `components/wizard/Processing.tsx` (`handleLine`), `lib/batch/extract-result.ts`, `components/templates/NewTemplateModal.tsx` (clients)
- Why fragile: Errors after the stream opens can only be delivered as in-band events; guards answer plain JSON before the stream and clients distinguish by Content-Type. `Processing.tsx` `JSON.parse`s each line without a per-line try — one malformed line aborts the whole run into the error phase. Event vocabulary (`attempt`/`attempt-win`/`attempt-fail`/`local-eta`/`result`) is duplicated in each consumer.
- Safe modification: Extend event types in all consumers together; keep terminal `result`/`error` semantics.

**Guest-mode gating is per-route convention, not middleware:**
- Files: `middleware.ts` (excludes `/api` entirely), `lib/auth/guard.ts`, every `app/api/*/route.ts`
- Why fragile: Each API route must remember to call `requireUser`/`requireFullUser`/`isGuest` with the correct variant; a new route that forgets is silently open to guests (or to no one). The comment in `auth.config.ts` also documents that a misconfigured host makes `auth()` return a truthy error object — guards must check `session?.user`, never bare truthiness.
- Safe modification: Copy the guard call from a sibling route; test both 401 and guest-403 paths (existing route tests model this).

## Scaling Limits

**Neon HTTP driver — no interactive transactions:**
- Current capacity: `db.batch()` gives statement-level atomicity only (`lib/db/fills.ts` line 17).
- Limit: Any future flow needing read-modify-write in one transaction (quota counters, unique-name checks) cannot be done safely with `drizzle-orm/neon-http`.
- Scaling path: Switch hot paths to the WebSocket driver (`neon-serverless`) or Postgres session mode.

**Vercel function ceilings:**
- Current capacity: `maxDuration = 60` on parse/extract/templates; 20 MB upload cap (`app/api/blob/upload/route.ts`); the LLM time budget (30s free wave + 12s paid) is engineered to fit inside 60s (`lib/extract/llm/openrouter.ts` comment).
- Limit: Very large PDFs (hundreds of pages) or slower model waves blow the 60s wall; the desktop-local path avoids this with its own 300s timeout (`src-tauri/src/runtime.rs`).
- Scaling path: Background jobs/queue for parse+extract if document sizes grow.

**Blob storage growth without lifecycle:**
- Current capacity: Unbounded accumulation — registered users' source blobs are kept forever; batch uploads are orphaned by design; failed template scans leave the blob "for a retry" (`app/api/templates/route.ts` comment).
- Limit: Storage cost and PII retention grow monotonically.
- Scaling path: Retention policy + scheduled cleanup keyed off `source_files.blob_key` and unclaimed uploads.

## Dependencies at Risk

**next-auth v5 beta:**
- Risk: `next-auth@5.0.0-beta.31` — production auth on a beta line whose APIs have shifted repeatedly; the codebase already carries workarounds (`trustHost: true` + the truthy-error-object guard convention in `lib/auth/guard.ts`).
- Impact: Upgrades within the beta line can break session/JWT callbacks.
- Migration plan: Pin exactly (currently caret-ranged in `package.json`); move to stable v5 when released and re-run `lib/auth/guard.test.ts` + login flows.

**OpenRouter free tier:**
- Risk: The entire zero-config extraction experience rides on OpenRouter's rotating free pool (see `lib/extract/llm/catalog.ts` history) plus one paid fallback billed to the operator.
- Impact: Pool churn silently degrades extraction until the catalog is manually refreshed.
- Migration plan: Users can add BYOK custom models (`app/api/models/route.ts`) — already the designed escape hatch.

**Next.js 14.2 / experimental tracing config:**
- Risk: `outputFileTracingIncludes` lives under `experimental` in 14.2 (`next.config.mjs` comment); a Next 15 upgrade moves it top-level and changes App Router defaults.
- Impact: Missed config migration silently breaks `/api/fill` template bundling.
- Migration plan: Verify the pt.xlsx runtime read in a preview deploy during any Next major upgrade.

## Missing Critical Features

**OCR for scanned documents:**
- Problem: Scanned pages are detected (`scannedPages` in `lib/parse/pdf.ts`) but never processed; the UI copy promises a "фаза 4" that isn't built.
- Blocks: Extraction from image-only PDFs — common for signed contracts/invoices.

**Account recovery:**
- Problem: No password reset, no email verification, no admin tooling. A registered user who forgets their password is locked out permanently (only `AUTH_USERS` env accounts can be recovered by editing the env).
- Blocks: Opening registration beyond a trusted invite circle.
- Files: `app/api/register/route.ts`, `app/api/account/password/route.ts` (change requires the current password)

**DOCX template fill:**
- Problem: The schema and parse layer support docx (`template_format` enum in `lib/db/schema.ts`, `lib/parse/docx.ts`), but template creation hardcodes `format: "xlsx"` (`lib/db/templates.ts` `createTemplate`) and only xlsx fill paths exist (`lib/fill/xlsx.ts`).
- Blocks: Filling Word-based forms — the enum promises more than the product delivers.

## Test Coverage Gaps

**React components — zero tests:**
- What's not tested: All 42 components (`components/**/*.tsx`) including the wizard state machine (`components/wizard/WizardModal.tsx`, `Processing.tsx`), review flow (`components/review/ReviewStep.tsx`), batch modal, and mapping editor. `@vitejs/plugin-react` is configured in `vitest.config.ts` but no component test exists.
- Files: `components/wizard/`, `components/review/`, `components/batch/`, `components/templates/`
- Risk: The NDJSON stream consumer in `Processing.tsx` (manual buffer splitting, event dispatch, ETA timer) and wizard step transitions can regress unnoticed — logic-heavy code living in components escapes the otherwise strong lib coverage (73 test files across `lib/` and `app/api`).
- Priority: High (extract `Processing.tsx`'s stream consumer into a testable lib function, mirroring `lib/batch/extract-result.ts`)

**No end-to-end coverage:**
- What's not tested: Login → upload → parse → extract → review → fill download as a whole; guest mode restrictions; desktop (Tauri) flows.
- Risk: Route guards, streaming Content-Type switching, and blob round-trips only meet in production.
- Priority: Medium (one Playwright happy-path against a preview deploy would catch most integration breaks)

**Auth provider wiring:**
- What's not tested: `auth.ts` `authorize` (env-user precedence over DB users, avatar lookup failure tolerance, guest issuance) — `lib/auth/users.test.ts` and `lib/auth/guard.test.ts` cover the pure helpers only.
- Files: `auth.ts`, `auth.config.ts`
- Risk: A regression in provider ordering or JWT role propagation (`auth.config.ts` callbacks) breaks guest gating app-wide.
- Priority: Medium

**SSRF/security regression tests:**
- What's not tested: `/api/parse` URL handling (no test asserts rejection of non-blob URLs — because none exists in the route), `isOwnBlobUrl` host-pinning behavior.
- Files: `app/api/parse/route.test.ts`, `lib/upload/avatar.ts`
- Risk: The SSRF fix (when made) has no spec to lock it in.
- Priority: High (pair with the fix)

---

*Concerns audit: 2026-07-23*
