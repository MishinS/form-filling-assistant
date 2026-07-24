# desktop

## Purpose

Tauri 2 desktop shell: reuses the deployed web frontend and adds native
capabilities — local LLM runtime detection and proxying (Ollama / LM Studio),
safe file save, directory picking, and auto-update. Implemented in `src-tauri/`
and bridged via `lib/desktop/tauri.ts`.

## Requirements

### Requirement: Remote-loaded webview with isolated bridge
The desktop app SHALL load the deployed Vercel frontend
(`frontendDist` in `src-tauri/tauri.conf.json`), and web code SHALL access
Tauri only through `lib/desktop/tauri.ts` (`isTauri()` gate + dynamic
`@tauri-apps/api` import) so the web bundle never includes Tauri code.

#### Scenario: Same build in browser
- **WHEN** the same frontend runs in a normal browser
- **THEN** `isTauri()` is false and no Tauri module is loaded

### Requirement: Local LLM runtime detection and chat proxy
The desktop app SHALL detect local runtimes on localhost (Ollama at `:11434`,
LM Studio at `:1234`) via the `detect_local_runtime` command and SHALL proxy
chat completions through the Rust `llm_chat` command (bypassing webview
CSP/CORS), exposed to extraction as `local:*` model slugs.

#### Scenario: Local extraction
- **WHEN** a `local:` model is selected in the desktop app
- **THEN** extraction runs in the webview via `run-local-extract.ts`, calling
  `llm_chat`, and emits the standard NDJSON progress events

### Requirement: Native file save
The desktop app SHALL save filled workbooks through the `save_file` command
(with directory picking via `pick_directory`) instead of browser downloads.

#### Scenario: Export on desktop
- **WHEN** a user completes a fill in the desktop app
- **THEN** the file is written to the chosen location via the Rust command

### Requirement: Signed auto-update
The desktop app SHALL check GitHub Releases `latest.json` for updates via
`@tauri-apps/plugin-updater`, verifying the minisign signature configured in
`tauri.conf.json`; releases are built and signed by
`.github/workflows/desktop-release.yml` on `desktop-v*` tags.

#### Scenario: Update available
- **WHEN** a newer signed release is published
- **THEN** the About card offers the update and applies it after verification
