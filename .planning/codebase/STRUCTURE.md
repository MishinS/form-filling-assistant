# Codebase Structure

**Analysis Date:** 2026-07-23

## Directory Layout

```
web/                          # Repo root == Next.js app root (no src/ dir)
├── app/                      # Next.js 14 App Router
│   ├── layout.tsx            # Root layout: fonts, theme bootstrap script
│   ├── page.tsx              # Guest landing (redirects full users to /fills)
│   ├── globals.css           # Global CSS: variables, utility classes (row/col/mono/…)
│   ├── fonts/                # Local Geist woff files (unused by layout; Google fonts active)
│   ├── login/page.tsx        # Login screen (public)
│   ├── register/page.tsx     # Registration screen (public)
│   ├── (app)/                # Auth'd route group behind Sidebar+Topbar shell
│   │   ├── layout.tsx        # Session gate + provider stack + AppShell
│   │   ├── fills/            # Dashboard (page.tsx) + fill detail ([id]/page.tsx)
│   │   ├── templates/        # Gallery (page.tsx) + mapping editor ([id]/page.tsx)
│   │   ├── sources/page.tsx  # Sources archive
│   │   └── settings/page.tsx # Settings screen
│   └── api/                  # Route handlers (self-guarding; middleware skips /api)
│       ├── auth/[...nextauth]/route.ts   # NextAuth handlers re-export
│       ├── parse/route.ts    # Blob URLs → ParsedDoc[]
│       ├── extract/route.ts  # NDJSON extraction stream
│       ├── fill/route.ts     # Filled xlsx download
│       ├── fills/route.ts    # Persist fill history
│       ├── mappings/route.ts # Per-user field mappings CRUD
│       ├── templates/        # Template create (scan stream) + [id] update/delete
│       ├── models/           # BYOK custom models CRUD + [id] probe
│       ├── search/route.ts   # Global search (fills + sources)
│       ├── register/route.ts # Account creation (invite-gated)
│       ├── account/          # profile / password / avatar / accent routes
│       └── blob/             # Vercel Blob client-upload token routes (upload/avatar/template)
├── components/               # All client ("use client") React components, by feature
│   ├── primitives.tsx        # Shared atoms: Btn, Icon, Tag, Logo, Eyebrow
│   ├── shell/                # AppShell (+ all app contexts), Sidebar, Topbar, Toast,
│   │                         #   GlobalSearch, ModelSelect, ThemeToggle, GuestContext
│   ├── wizard/               # WizardModal, Stepper, TemplatePick, Dropzone,
│   │                         #   Processing, RaceList, DoneStep
│   ├── review/               # ReviewStep, FieldRow, FieldInput, SourceChip
│   ├── batch/                # BatchModal
│   ├── dashboard/            # Dashboard, RecentRow, FillDetail
│   ├── templates/            # TemplateGallery, MappingEditor, MiniSheet, NewTemplateModal
│   ├── settings/             # SettingsView + per-card components (Profile, Password,
│   │                         #   Preferences, CustomModels, ModelCard, About)
│   ├── sources/              # SourcesArchive
│   ├── guest/                # GuestShell (landing + embedded wizard)
│   └── auth/                 # LoginForm, RegisterForm
├── lib/                      # Domain layer (framework-free; co-located *.test.ts)
│   ├── types.ts              # Shared domain types (ExtractedValue, Fill, …)
│   ├── i18n.tsx              # RU/EN provider + useI18n(); strings live in seed/pt.ts
│   ├── theme.tsx / theme-core.ts     # Theme provider + pure mode logic
│   ├── accent.tsx / accent-core.ts   # Accent provider + palette
│   ├── contrast.ts           # WCAG contrast math
│   ├── auth/                 # guard.ts (API guards), users.ts (env users + bcrypt),
│   │                         #   register.ts, guest.ts, tos.ts
│   ├── db/                   # client.ts (getDb singleton), schema.ts (Drizzle),
│   │                         #   per-table repos: fills, templates, mappings, users,
│   │                         #   avatars, accents, user-models, search; map.ts (pure mapping)
│   ├── parse/                # parseDocument facade + pdf/xlsx/docx parsers, types.ts (MIME),
│   │                         #   __fixtures__/make.ts (test doc builders)
│   ├── extract/              # extract.ts (pipeline), rules.ts (regex), fields.ts (PT_FIELDS,
│   │   │                     #   ExtractField), format.ts, own-company.ts
│   │   └── llm/              # registry, race, catalog (free-model list), prompt,
│   │                         #   openrouter/gemini/openai-compat/local-model adapters,
│   │                         #   probe, run-local-extract, eta, providers (SSRF check), types
│   ├── fill/                 # xlsx.ts (OOXML writer), cell.ts, values.ts, schedule.ts,
│   │   │                     #   parse.ts (amount/date), daterule.ts
│   │   └── templates/pt.xlsx # Built-in PT template binary (runtime-read; traced in next.config.mjs)
│   ├── templates/            # scan.ts (LLM field proposal), xlsx-scan.ts (sheet texts),
│   │                         #   cellref.ts, validate.ts (parseFieldList), run-local-scan.ts
│   ├── review/               # rows.ts, validate.ts (advisory), attention.ts
│   ├── batch/                # run-batch.ts, run-one.ts (pipeline), extract-result.ts, zip.ts
│   ├── upload/               # client.ts (Blob client upload, MIME inference), avatar.ts
│   │                         #   (isOwnBlobUrl), format.test.ts
│   ├── crypto/               # secrets.ts (AES-256-GCM BYOK key encryption)
│   ├── llm/                  # View-model helpers: custom-model-view.ts, local-model-view.ts
│   ├── desktop/              # tauri.ts (isTauri + dynamic invoke wrappers)
│   └── seed/pt.ts            # UI seed: STR i18n table, TEMPLATES, PtField types
├── src-tauri/                # Tauri 2 desktop wrapper (Rust)
│   ├── src/main.rs           # Binary entry → app_lib::run()
│   ├── src/lib.rs            # Builder + command registration + updater plugin
│   ├── src/runtime.rs        # detect_local_runtime (Ollama/LM Studio probe), llm_chat
│   ├── src/files.rs          # pick_directory, save_file (basename sanitization)
│   ├── tauri.conf.json       # Window, updater endpoint, bundle targets; prod loads Vercel URL
│   ├── capabilities/         # Tauri permission grants
│   ├── icons/                # App icons
│   └── gen/, target/         # Generated / build output (not hand-edited)
├── auth.ts                   # NextAuth Node instance (credentials + guest providers)
├── auth.config.ts            # Edge-safe NextAuth config (no Node imports)
├── middleware.ts             # Edge auth gate for pages (matcher excludes /api, assets)
├── types/next-auth.d.ts      # Session/JWT role augmentation
├── scripts/                  # db-seed.mjs (PT template upsert), hash-password.mjs
├── .github/workflows/desktop-release.yml  # Desktop build/release CI
├── .planning/codebase/       # GSD codebase analysis docs (this file)
├── drizzle.config.ts         # drizzle-kit config (schema → push; out dir ./drizzle unused)
├── next.config.mjs           # outputFileTracingIncludes for lib/fill/templates/pt.xlsx
├── vitest.config.ts          # Vitest + @ alias + react plugin
├── tailwind.config.ts        # Tailwind present; components mostly use CSS vars + inline styles
├── tsconfig.json             # strict; paths: "@/*" → "./*"
├── vercel.json               # Vercel settings
└── .env.example / .env.local # Env template / local secrets (never read .env.local)
```

## Directory Purposes

**`app/`:**
- Purpose: Routing only — thin server components + API handlers.
- Contains: `page.tsx` server components that gate the session, load initial data, and render one feature component from `components/`; `route.ts` handlers that validate, guard, and delegate to `lib/`.
- Key files: `app/(app)/layout.tsx` (the provider/data hub), `app/api/extract/route.ts` (streaming pattern reference).

**`components/`:**
- Purpose: All interactive UI, one subdirectory per feature area.
- Contains: `"use client"` `.tsx` files, PascalCase. Contexts live where their provider lives (`shell/AppShell.tsx`, `shell/GuestContext.tsx`, `shell/Toast.tsx`).
- Key files: `components/shell/AppShell.tsx` (contexts: `WizardTrigger`, `ModelContext`, `TemplateMappingContext`, `TemplatesContext`), `components/primitives.tsx`.

**`lib/`:**
- Purpose: The domain core — everything testable without a browser or Next.
- Contains: kebab-case `.ts` modules with co-located `.test.ts` (73 test files); `.tsx` only for React providers (`i18n.tsx`, `theme.tsx`, `accent.tsx`).
- Key files: `lib/extract/extract.ts`, `lib/fill/xlsx.ts`, `lib/db/schema.ts`, `lib/extract/fields.ts`.

**`lib/db/`:**
- Purpose: Persistence. One repo module per aggregate; no queries elsewhere in the codebase.
- Key files: `client.ts` (`getDb()` — the only place the driver is constructed), `schema.ts`, `map.ts` (pure row builders/formatters, unit-tested).

**`src-tauri/`:**
- Purpose: Desktop-only native commands and packaging.
- Generated: `gen/`, `target/` — Yes (do not edit). `Cargo.lock` committed.

**`.planning/`:**
- Purpose: GSD planning + codebase maps. Committed: Yes.

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: root HTML shell.
- `app/page.tsx`: guest landing / redirect.
- `app/(app)/layout.tsx`: authed shell + providers + initial DB loads.
- `middleware.ts`: Edge auth gate.
- `src-tauri/src/main.rs`: desktop binary.

**Configuration:**
- `auth.ts` / `auth.config.ts`: NextAuth (Node vs Edge halves — keep the split).
- `next.config.mjs`: file-tracing for the PT template binary.
- `drizzle.config.ts` + `lib/db/schema.ts`: DB schema source of truth (`drizzle-kit push`, then `node scripts/db-seed.mjs`).
- `.env.example`: canonical env var list (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_USERS`, `BLOB_READ_WRITE_TOKEN`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `INVITE_CODE`, …). Never read `.env.local`.

**Core Logic:**
- `lib/parse/index.ts`: document parsing facade.
- `lib/extract/extract.ts`: extraction pipeline (rules → LLM → placeholders).
- `lib/extract/llm/catalog.ts`: curated free-model list (single source for picker + fallback chain).
- `lib/fill/xlsx.ts`: Excel writing (raw OOXML via fflate).
- `lib/templates/scan.ts`: template field proposal.
- `lib/auth/guard.ts`: API auth guards.

**Testing:**
- Co-located everywhere: `foo.ts` + `foo.test.ts` in the same directory (also for API routes: `app/api/extract/route.test.ts`).
- Fixtures: `lib/parse/__fixtures__/make.ts` (builds real pdf/xlsx/docx test bytes with dev-deps `pdf-lib`, `exceljs`, `docx`).
- Config: `vitest.config.ts`; run with `npm test`.

## Naming Conventions

**Files:**
- `lib/`: kebab-case — `run-local-extract.ts`, `openai-compat.ts`, `user-models.ts`.
- `components/`: PascalCase matching the default export — `WizardModal.tsx`, `FieldRow.tsx`.
- Tests: `<name>.test.ts` / `route.test.ts` beside the unit.
- Pure logic split from React: `theme-core.ts` (logic) vs `theme.tsx` (provider); same for `accent-core.ts` / `accent.tsx`. Follow this when a provider needs testable logic.
- View-model helpers for a component live in `lib/llm/*-view.ts` (e.g. `custom-model-view.ts`), keeping components thin.

**Directories:**
- Feature-scoped, lowercase: `components/wizard/`, `lib/extract/llm/`.
- Route groups: `app/(app)/` for the authed shell; dynamic segments `[id]`, catch-all `[...nextauth]`.

**Symbols:**
- Components/contexts/providers: PascalCase. Hooks: `useX` (`useI18n`, `useToast`). Functions/vars: camelCase. Const tables: SCREAMING_SNAKE (`PT_FIELDS`, `FREE_MODELS`, `STR`). DB columns snake_case in SQL, camelCase in Drizzle properties.
- User emails are lowercased before any DB use (`email.toLowerCase()` at every boundary).

## Where to Add New Code

**New page/screen:**
- Server component: `app/(app)/<route>/page.tsx` — gate with `auth()`, load data in try/catch with fallback, render a feature component.
- Feature UI: new directory `components/<feature>/` with a top-level `<Feature>View.tsx`.
- Add nav entry in `components/shell/Sidebar.tsx` and strings to `lib/seed/pt.ts#STR` (both ru and en).

**New API endpoint:**
- `app/api/<name>/route.ts` + `route.test.ts`. Start with `requireUser()` / `requireFullUser()` (or explicit `auth()` when you need identity/role), force `export const runtime = "nodejs"` if it touches DB/fs/LLM, validate the body manually, delegate to `lib/`.

**New domain logic:**
- New module in the matching `lib/<area>/` (or a new `lib/<area>/` for a new domain), with a co-located `.test.ts`. Keep it import-free of React/Next unless it is a provider.

**New DB table:**
- Define in `lib/db/schema.ts`, add a repo module `lib/db/<aggregate>.ts` using `getDb()`, extract any pure mapping into `lib/db/map.ts` or a local pure function, push with `drizzle-kit push`, seed via `scripts/db-seed.mjs` if needed.

**New LLM provider/adapter:**
- Implement `ExtractionModel` in `lib/extract/llm/<provider>.ts`; register in `lib/extract/llm/registry.ts` (or pass as `modelOverride`). Reuse `raceModels` and the `OnAttempt` protocol.

**New desktop capability:**
- Rust command in `src-tauri/src/` (register in `src-tauri/src/lib.rs`), typed wrapper in `lib/desktop/tauri.ts`, always behind `isTauri()`.

**Shared UI atoms:** `components/primitives.tsx`. **Shared types:** `lib/types.ts`. **UI strings:** `lib/seed/pt.ts#STR`.

## Special Directories

**`app/api/`:**
- Purpose: HTTP boundary; excluded from middleware — every route must self-guard.
- Generated: No. Committed: Yes.

**`lib/fill/templates/`:**
- Purpose: Binary xlsx template(s) read at runtime by `/api/fill`. Adding one requires a matching `next.config.mjs` tracing entry.
- Generated: No. Committed: Yes.

**`lib/parse/__fixtures__/`:**
- Purpose: Test-only document builders. Never imported by production code.

**`src-tauri/gen/`, `src-tauri/target/`, `.next/`, `node_modules/`:**
- Generated: Yes. Committed: No (build output).

**`.superpowers/`, `.planning/`, `.github/`:**
- Tooling/planning/CI metadata. Committed: Yes.

---

*Structure analysis: 2026-07-23*
