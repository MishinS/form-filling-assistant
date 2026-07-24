# Technology Stack

**Analysis Date:** 2026-07-23

## Languages

**Primary:**
- TypeScript ^5 (strict mode) - Entire web app: `app/`, `components/`, `lib/`, `middleware.ts`, `auth.ts`
- Rust (edition 2021, `rust-version = 1.77.2`) - Desktop shell: `src-tauri/src/` (`lib.rs`, `runtime.rs`, `files.rs`)

**Secondary:**
- JavaScript (ESM `.mjs`) - Ops scripts: `scripts/db-seed.mjs`, `scripts/hash-password.mjs`; config: `next.config.mjs`, `postcss.config.mjs`

## Runtime

**Environment:**
- Node.js 20 (CI pins `node-version: 20` in `.github/workflows/desktop-release.yml`; `@types/node ^20`); local dev observed on Node 22
- Vercel serverless functions (Node.js runtime; API routes declare `export const runtime = "nodejs"`, e.g. `app/api/extract/route.ts` with `maxDuration = 60`)
- Edge runtime for `middleware.ts` (edge-safe auth config isolated in `auth.config.ts` — no bcrypt in the Edge bundle)
- Tauri 2 webview (desktop) loading the deployed web app; Rust commands over IPC

**Package Manager:**
- npm (web) - Lockfile: `package-lock.json` present
- cargo (desktop) - Lockfile: `src-tauri/Cargo.lock` present

## Frameworks

**Core:**
- Next.js `14.2.35` (App Router) - Full-stack web framework; pages in `app/(app)/`, API routes in `app/api/*/route.ts`
- React `^18` / React DOM `^18` - UI
- NextAuth (Auth.js) `^5.0.0-beta.31` - Credentials + guest auth, JWT sessions (`auth.ts`, `auth.config.ts`, `middleware.ts`)
- Drizzle ORM `^0.45.2` (`drizzle-orm/neon-http`) - Postgres data layer (`lib/db/schema.ts`, `lib/db/client.ts`)
- Tailwind CSS `^3.4.1` + PostCSS `^8` - Styling via CSS variables (`tailwind.config.ts`, `app/globals.css`)
- Tauri `2` - Desktop shell (`src-tauri/`): crate `tauri 2.11.3`, npm `@tauri-apps/api ^2.11.1`, `@tauri-apps/cli ^2.11.4`, `@tauri-apps/plugin-updater ^2.10.1`

**Testing:**
- Vitest `^4.1.7` - Unit tests co-located as `*.test.ts` throughout `lib/` and `app/api/`; config `vitest.config.ts` (alias `@` → repo root, `@vitejs/plugin-react`)
- Rust `#[cfg(test)]` unit tests - `src-tauri/src/runtime.rs`

**Build/Dev:**
- ESLint `^8` with `next/core-web-vitals` + `next/typescript` (`.eslintrc.json`)
- drizzle-kit `^0.31.10` - Schema push (`drizzle.config.ts` → `dialect: postgresql`, schema `lib/db/schema.ts`, out `./drizzle`; no migrations directory committed — push workflow, then `node scripts/db-seed.mjs`)
- tauri-build `2.6.3` - Desktop build (`src-tauri/build.rs`)

## Key Dependencies

**Critical:**
- `@neondatabase/serverless ^1.1.0` - Neon Postgres HTTP driver; lazy singleton in `lib/db/client.ts` so `next build` works without `DATABASE_URL`
- `@vercel/blob ^2.4.0` - File storage; client uploads (`lib/upload/client.ts`) + server token exchange (`app/api/blob/*/route.ts`)
- `bcryptjs ^3.0.3` - Password hashing/verification (`auth.ts`, `scripts/hash-password.mjs`); Node-only, kept out of the Edge bundle by design
- `exceljs ^4.4.0` - XLSX parsing of uploaded sources (`lib/parse/xlsx.ts`)
- `fflate ^0.8.3` - Raw-zip XLSX template filling (`lib/fill/xlsx.ts`), template scanning (`lib/templates/xlsx-scan.ts`), batch ZIP export (`lib/batch/zip.ts`)
- `unpdf ^1.6.2` - PDF text extraction (`lib/parse/pdf.ts`)
- `mammoth ^1.12.0` - DOCX text extraction (`lib/parse/docx.ts`)
- `next-auth ^5.0.0-beta.31` - Beta dependency; auth API may shift on upgrade

**Infrastructure:**
- `docx ^9.7.1`, `pdf-lib ^1.17.1` (devDependencies) - Test-fixture generation only (`lib/parse/__fixtures__/make.ts`)
- Rust: `reqwest 0.12` (local LLM runtime probing + chat proxy in `src-tauri/src/runtime.rs`), `rfd 0.15` (native file dialogs in `src-tauri/src/files.rs`), `serde`/`serde_json`, `tauri-plugin-log 2`, `tauri-plugin-updater 2`

## Configuration

**Environment:**
- `.env.example` documents all vars; `.env.local` present (not committed; pull with `vercel env pull .env.local`)
- Key vars: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_USERS` (JSON array with bcrypt hashes; `$` must be escaped as `\$` for dotenv-expand), `INVITE_CODE`, `BLOB_READ_WRITE_TOKEN`, `OPENROUTER_API_KEY`, `OPENROUTER_SITE_URL`, `GEMINI_API_KEY`
- `BYOK_ENCRYPTION_KEY` (32-byte base64, AES-256-GCM master key in `lib/crypto/secrets.ts`) is required for BYOK models but is NOT listed in `.env.example`
- `GROQ_API_KEY` and `LLM_PROVIDER_ORDER` appear in `.env.example` but have no code references (unwired)
- Graceful degradation is a design rule: missing `DATABASE_URL` → empty dashboard, fills not recorded; missing LLM keys → regex-only extraction

**Build:**
- `next.config.mjs` - `experimental.outputFileTracingIncludes` bundles `lib/fill/templates/pt.xlsx` into the `/api/fill` serverless function (fill downloads 500 without it)
- `tsconfig.json` - strict, `moduleResolution: bundler`, path alias `@/*` → `./*`
- `tailwind.config.ts` - theme entirely via CSS variables (colors, radii, fonts); content globs `app/**`, `components/**`
- `vercel.json` - `framework: nextjs`; `.vercel/project.json` links the Vercel project
- `src-tauri/tauri.conf.json` - `frontendDist` points at the deployed web app `https://web-three-liart-43.vercel.app` (desktop is a remote-loading shell, not a static bundle); dev URL `http://localhost:3000`; bundles: nsis, appimage, deb, rpm; updater artifacts enabled
- `src-tauri/capabilities/*.json` - remote URL capability for the Vercel origin; permissions `core:default`, `updater:default`

**npm scripts** (`package.json`): `dev`, `build`, `start`, `lint`, `test` (vitest run), `tauri`

## Platform Requirements

**Development:**
- Node.js 20+, npm; Rust stable + Tauri CLI for desktop work (Linux desktop builds need `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf` per `.github/workflows/desktop-release.yml`)
- Fonts are local (`app/fonts/GeistVF.woff`, `GeistMonoVF.woff`) — no network font fetch

**Production:**
- Web: Vercel (serverless Next.js; `trustHost: true` in `auth.config.ts` also allows self-hosted `next start`)
- Desktop: Windows (NSIS installer) + Linux (AppImage/deb/rpm) via GitHub Actions on `desktop-v*` tags; auto-update from GitHub Releases

---

*Stack analysis: 2026-07-23*
