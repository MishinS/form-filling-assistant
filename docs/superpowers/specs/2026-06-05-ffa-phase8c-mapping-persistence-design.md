# Phase 8c — ПТ mapping persistence (per-user) — Design

**Date:** 2026-06-05
**Status:** Approved (design)
**Depends on:** phase 7 (live mapping editor, session-only context), phase 8a (auth / `session.user.email`), phase 8b (live Neon Postgres + Drizzle, `getDb()`).

## Problem

The phase-7 mapping editor lets a user remap the ПТ template's field→cell assignments (cell address, label, kind, required; add/delete manual fields), and those edits drive both extraction (`/api/extract`) and fill (`/api/fill`) within the session. But the mapping lives only in a React context (`TemplateMappingContext` in `AppShell`, initialised to `PT_FIELDS`) — it **resets on every page reload**. Phase 8c persists each user's mapping so it survives reloads and sessions.

## Goal

Persist a logged-in user's effective ПТ field mapping to the database, scoped to that user, and load it on app boot so the editor, wizard, extraction, and fill all start from the saved mapping instead of the code defaults.

## Locked decisions (from brainstorming)

- **Scope = per-user** (keyed by `session.user.email`, consistent with phase-8b `fills.userId`). No shared/org mapping.
- **Storage = JSON blob** per `(userId, templateId)` in a new `template_mappings` table — NOT the normalized `fields` table. Matches the editor's whole-array edit model.
- **Content = the full effective `ExtractField[]`** (complete snapshot of all fields), not a diff/overrides set. Consequence accepted: if `PT_FIELDS` defaults later change, a user with a saved blob stays on their snapshot until they Reset. The template is singular and stable, so this is fine (YAGNI over a merge layer).
- **Mechanism = REST `/api/mappings`** (POST upsert + DELETE reset) + server-layout load — a direct mirror of the phase-8b pattern, consistent with `/api/extract` `/api/fill` `/api/fills`. (Server Actions rejected: zero precedent in the codebase.)
- **Save = awaited with explicit error surface** (not best-effort fire-and-forget like 8b's fill history). The mapping is deliberate configuration; the user must know if a save failed. The session edit still applies regardless.
- **Reset = delete the row** → app falls back to `PT_FIELDS` on next load.

## Architecture

```
app/(app)/layout.tsx (server)  ── getMapping(email,"pt") ──▶  initialFields prop
        │                                (try/catch → null on DB error)
        ▼
AppShell (client)  useState(initialFields ?? PT_FIELDS)  ──▶  TemplateMappingContext
        │                                                          │
        │                                          drives wizard (extract+fill) — unchanged
        ▼
MappingEditor  ── Save ─▶ setFields(draft) + POST /api/mappings {templateId, fields}
               ── Reset ▶ resetFields()    + DELETE /api/mappings {templateId}
                                                   │
                                                   ▼
                          /api/mappings (auth, session.email)
                            POST   → parseFieldList(fields) validate → saveMapping (upsert)
                            DELETE → deleteMapping
                                                   │
                                                   ▼
                                   lib/db/mappings.ts  over getDb()
                                                   │
                                                   ▼
                          template_mappings (user_id, template_id, fields jsonb, updated_at)
```

## Components

### 1. Schema — `lib/db/schema.ts` (+ one table)

```ts
export const templateMappings = pgTable("template_mappings", {
  userId: text("user_id").notNull(),
  templateId: text("template_id").notNull().references(() => templates.id),
  fields: jsonb("fields").$type<ExtractField[]>().notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.templateId] }) }));
```
Applied to Neon via `drizzle-kit push` (controller — Neon already provisioned in 8b, no owner action). `ExtractField` is imported as the `$type` for the jsonb column (type-only; stored as JSON).

### 2. `lib/db/mappings.ts` (over `getDb()`)

- `getMapping(userId, templateId): Promise<ExtractField[] | null>` — select the row, return `fields` or `null`.
- `saveMapping(userId, templateId, fields): Promise<void>` — `insert ... onConflictDoUpdate` on the composite PK, set `fields` + `updatedAt = now()`.
- `deleteMapping(userId, templateId): Promise<void>` — delete the row.

No unit test (DB-bound; verified in UAT), consistent with `fills.ts`. Correctness rests on the typed query builder + tsc.

### 3. `/api/mappings` route — `app/api/mappings/route.ts`

- `runtime = "nodejs"`. Both handlers read identity directly (`const session = await auth(); if (!session?.user?.email) return unauthorized();`).
- **POST** `{ templateId: string, fields: unknown }` → reuse phase-7 `parseFieldList(fields)`; if it returns `null` → `400` (invalid mapping, never stored). On valid → `saveMapping(email, templateId, parsed)` → `{ ok: true }`. `templateId` non-string → 400. DB error → 500 (caught, JSON error).
  - **Validation scope (accurate):** `parseFieldList` validates each element's shape (id, labels, `kind`∈KINDS, `strategy`∈STRATEGIES, `group`∈GROUPS), the **cell address** via `validateCellRef`, and a present `rule` against known `RULES`. It does **not** cap array length and does **not** reject duplicate cells/ids (phase-7's intentional "dupe-cell allowed" behavior carries over). Because 8c now *persists* the blob (not just a session value), the POST handler adds one cheap defense the session path didn't need: reject `fields.length > 100` with 400, bounding the stored jsonb. No dedupe — matches the editor's existing allow-dupe-cell behavior.
- **DELETE** `{ templateId: string }` (JSON body) → `deleteMapping(email, templateId)` → `{ ok: true }`. `templateId` non-string → 400.
- Unit-tested with mocked `@/auth` + `@/lib/db/mappings` (401 / 200 / 400-invalid-fields / 400-bad-body), mirroring `app/api/fills/route.test.ts`.

### 4. Server load — `app/(app)/layout.tsx`

Add after the existing `auth()`:
```ts
let initialFields: ExtractField[] | undefined;
const email = session?.user?.email;
if (email) {
  try { initialFields = (await getMapping(email, "pt")) ?? undefined; }
  catch { /* DB down → undefined → AppShell falls back to PT_FIELDS */ }
}
return <AppShell user={user} initialFields={initialFields}>{children}</AppShell>;
```

### 5. `AppShell` — accept `initialFields`

New optional prop `initialFields?: ExtractField[]`; `const [fields, setFields] = useState<ExtractField[]>(initialFields ?? PT_FIELDS);`. Everything else (context value, `resetFields`, wizard wiring) unchanged.

### 6. `MappingEditor` — persist on Save / Reset

- Add `saving`/`err` state.
- **Save** (`save()`): keep `setFields(normalized)`, then `await fetch("/api/mappings", {method:"POST", body: JSON.stringify({templateId:"pt", fields: normalized})})`; on non-ok → set an inline error (`mapping_save_err`), but the session edit stays applied. While in flight, the Save button shows a saving state. On success, the existing `dirty` indicator clears (draft === saved).
- **Reset** (`reset()`): keep `resetFields(); setDraft(PT_FIELDS)` (the UI reverts immediately), then `await DELETE /api/mappings {templateId:"pt"}`. Awaited with the same `err` surface as Save — a *silently* failed delete would resurrect the old mapping on the next reload ("I reset it but it came back"), so the user must be told. While in flight the Reset button shows the saving state.
- New i18n keys: `mapping_saving`, `mapping_save_err` (ru/en).

## Data flow

1. **Boot:** server layout reads the user's saved mapping → `AppShell` seeds the context → editor/wizard render from it.
2. **Edit + Save:** editor updates the context (session-live) and upserts the blob; subsequent reloads load the saved blob.
3. **Extraction/fill:** unchanged — they already receive the effective `fields` from the context (phase-7 variant A); persistence only changes the context's *initial* value, so the saved mapping automatically drives `/api/extract` and `/api/fill`.
4. **Reset:** clears the context to defaults and deletes the row → next boot loads `PT_FIELDS`.

## Error handling / degradation

- DB unreachable at boot → `getMapping` throws → caught → `initialFields` undefined → app renders with `PT_FIELDS`; no page 500.
- Save POST fails (network/DB) → inline error in the editor; the session mapping still works; nothing is silently lost.
- Untrusted POST body → `parseFieldList` rejects malformed elements / invalid cell addresses / unknown rule keys, and the handler's `length > 100` guard rejects oversized arrays → 400; the DB never stores a structurally invalid or unbounded mapping. (Duplicate cells/ids are allowed, matching the editor.)
- Per-user isolation enforced solely by `where userId = session.email` in every query — same model as 8b, no cross-user read/write.

## Testing

- **Unit:** `app/api/mappings/route.test.ts` (mocked auth+db): POST 401 unauth, POST 200 valid upsert, POST 400 invalid fields (`parseFieldList`→null), POST 400 oversized (`length>100`), DELETE 200, DELETE 401 unauth. (`mappings.ts` itself DB-bound → UAT.)
- **UAT (headless Playwright + `next start` + real Neon), per the 8b pattern:**
  1. **Persist across reload:** edit f1 cell ПТ!D9→D10, Save, full page reload → editor still shows D10 (loaded from DB).
  2. **Drives fill:** with the saved D10 mapping (no reload), run the wizard → Скачать Excel → unzipped sheet1.xml has the counterparty in `D10` (the persisted cell), proving the loaded mapping drives fill end-to-end.
  3. **Reset:** Save a change, then Reset → reload → mapping back to `PT_FIELDS` defaults (D9); DB row gone.
  4. **Per-user isolation:** user-2's mapping (or absence) does not see user-1's saved mapping (query-level if browser 2nd-user login is impractical, as in 8b S4).
- **Regression:** full suite expected ~121 Vitest (115 + ~6 route tests) + tsc + lint + `next build` green; `/api/mappings` appears in the route list.

## Out of scope (YAGNI)

Shared/org mapping; mapping version history; moving `PT_FIELDS` defaults into the DB (kept as the code default + fallback); a defaults-merge layer for future `PT_FIELDS` evolution; multi-template mapping CRUD (only `pt` exists); the deferred `/fills/[id]` detail page (phase-8b carry-over, unrelated).

## File manifest

| File | Change | 
|------|--------|
| `lib/db/schema.ts` | + `templateMappings` table (jsonb, composite PK) |
| `lib/db/mappings.ts` | new — `getMapping`/`saveMapping`/`deleteMapping` |
| `app/api/mappings/route.ts` | new — POST upsert + DELETE reset, auth-guarded |
| `app/api/mappings/route.test.ts` | new — mocked auth+db route tests |
| `app/(app)/layout.tsx` | fetch `getMapping` → `initialFields` prop |
| `components/shell/AppShell.tsx` | accept `initialFields`, seed `useState` |
| `components/templates/MappingEditor.tsx` | Save→POST, Reset→DELETE, saving/err states |
| `lib/seed/pt.ts` | + i18n `mapping_saving`, `mapping_save_err` |
| `drizzle` (Neon) | `drizzle-kit push` the new table |
