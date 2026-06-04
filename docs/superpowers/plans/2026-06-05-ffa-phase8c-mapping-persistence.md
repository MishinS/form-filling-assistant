# Phase 8c — ПТ mapping persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist each logged-in user's effective ПТ field→cell mapping to Neon Postgres and load it on app boot, so the editor, wizard, extraction, and fill start from the saved mapping instead of the code defaults.

**Architecture:** A new `template_mappings` jsonb table keyed by `(userId, templateId)` stores the whole `ExtractField[]`. A REST `/api/mappings` route (POST upsert + DELETE reset, auth-guarded) writes it; the server `app/(app)/layout.tsx` reads it and seeds `AppShell`'s mapping context. The `MappingEditor` Save/Reset buttons call the route (awaited, with an error surface). Mirrors the phase-8b DB pattern exactly.

**Tech Stack:** Next.js 14 App Router, Drizzle ORM (`drizzle-orm/neon-http`), Neon (already provisioned in 8b), NextAuth (8a) for identity, Vitest.

**Reference:** Spec `docs/superpowers/specs/2026-06-05-ffa-phase8c-mapping-persistence-design.md`. All paths below are relative to `claude/form_filling_assistent/web/`.

**Key facts / gotchas (read before starting):**
- Neon is ALREADY connected (8b) — `DATABASE_URL` is in `.env.local`. The new table just needs `drizzle-kit push` (controller, has network). Subagents are sandboxed (no network) → the controller runs every `drizzle-kit push` / `git push` / Playwright UAT with `dangerouslyDisableSandbox`.
- `getDb()` (`lib/db/client.ts`) is the lazy Drizzle handle. neon-http has no interactive transaction (not needed here — single-row ops).
- `drizzle-kit` bundles `schema.ts` and may NOT resolve the `@/` tsconfig path alias. So in `schema.ts` import `ExtractField` with a **relative** path (`../extract/fields`), not `@/...`.
- Per-user identity = `session.user.email` (same as 8b). The mapping context (`TemplateMappingContext` in `AppShell`) already drives the wizard/extract/fill — this phase only changes its **initial** value + adds the persistence calls. Do not rewire the wizard.
- The ПТ template row (`templates.id = 'pt'`) already exists (seeded in 8b) — the FK `template_id → templates.id` is satisfied.

---

## File structure

| File | Responsibility | Task |
|------|----------------|------|
| `lib/db/schema.ts` | + `templateMappings` table (jsonb, composite PK) | T1 |
| `lib/db/mappings.ts` | `getMapping` / `saveMapping` / `deleteMapping` over `getDb()` | T2 |
| `app/api/mappings/route.ts` | POST upsert + DELETE reset, auth-guarded, validated | T3 |
| `app/api/mappings/route.test.ts` | Route tests with mocked auth + db | T3 |
| `app/(app)/layout.tsx` | fetch `getMapping` → `initialFields` prop | T4 |
| `components/shell/AppShell.tsx` | accept `initialFields`, seed `useState` | T4 |
| `components/templates/MappingEditor.tsx` | Save→POST, Reset→DELETE, saving/err states | T5 |
| `lib/seed/pt.ts` | + i18n `mapping_saving`, `mapping_save_err` | T5 |
| `drizzle` (Neon) | `drizzle-kit push` the new table | T1, T6 |

---

## Task 1: Schema — `template_mappings` table + push

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Add the table to the schema**

In `lib/db/schema.ts`, change the import line:
```ts
import { pgTable, text, integer, boolean, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
```
to add `primaryKey`:
```ts
import { pgTable, text, integer, boolean, jsonb, timestamp, pgEnum, primaryKey } from "drizzle-orm/pg-core";
```
Add a **relative** type import at the top of the file (after the pg-core import) — relative, because drizzle-kit may not resolve the `@/` alias:
```ts
import type { ExtractField } from "../extract/fields";
```
Then append this table at the end of the file (after `extractedValues`):
```ts
export const templateMappings = pgTable("template_mappings", {
  userId: text("user_id").notNull(),
  templateId: text("template_id").notNull().references(() => templates.id),
  fields: jsonb("fields").$type<ExtractField[]>().notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.templateId] }) }));
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (exit 0).

- [ ] **Step 3: Push the new table to Neon** *(controller — needs network, `dangerouslyDisableSandbox`)*

Run: `set -a; source .env.local; set +a; npx drizzle-kit push`
Expected: drizzle-kit detects ONE new table `template_mappings` and applies it; prints the applied change. (The 5 existing tables are unchanged.) If drizzle-kit prompts interactively, accept the create.

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat(db): template_mappings table (per-user jsonb mapping)"
```

---

## Task 2: Query module — `lib/db/mappings.ts`

**Files:**
- Create: `lib/db/mappings.ts`

No unit test (DB-bound; verified in UAT — Task 6), consistent with `lib/db/fills.ts`. Correctness rests on the typed query builder + tsc.

- [ ] **Step 1: Write the implementation**

Create `lib/db/mappings.ts`:
```ts
import { eq, and } from "drizzle-orm";
import { getDb } from "./client";
import { templateMappings } from "./schema";
import type { ExtractField } from "@/lib/extract/fields";

/** The user's saved mapping for a template, or null if they have none. */
export async function getMapping(userId: string, templateId: string): Promise<ExtractField[] | null> {
  const db = getDb();
  const [row] = await db
    .select({ fields: templateMappings.fields })
    .from(templateMappings)
    .where(and(eq(templateMappings.userId, userId), eq(templateMappings.templateId, templateId)))
    .limit(1);
  return row?.fields ?? null;
}

/** Upsert the user's mapping for a template (whole-array replace). */
export async function saveMapping(userId: string, templateId: string, fields: ExtractField[]): Promise<void> {
  const db = getDb();
  await db
    .insert(templateMappings)
    .values({ userId, templateId, fields, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [templateMappings.userId, templateMappings.templateId],
      set: { fields, updatedAt: new Date() },
    });
}

/** Remove the user's mapping for a template (Reset → falls back to PT_FIELDS on next load). */
export async function deleteMapping(userId: string, templateId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(templateMappings)
    .where(and(eq(templateMappings.userId, userId), eq(templateMappings.templateId, templateId)));
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (`mappings.ts` uses the `@/` alias for app code, which tsc resolves — only `schema.ts` needed the relative import for drizzle-kit.)

- [ ] **Step 3: Commit**

```bash
git add lib/db/mappings.ts
git commit -m "feat(db): getMapping/saveMapping/deleteMapping queries"
```

---

## Task 3: `/api/mappings` route (POST upsert + DELETE reset)

**Files:**
- Create: `app/api/mappings/route.ts`
- Test: `app/api/mappings/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/api/mappings/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/mappings", () => ({ saveMapping: vi.fn(async () => {}), deleteMapping: vi.fn(async () => {}) }));

import { POST, DELETE } from "./route";
import { auth } from "@/auth";
import { saveMapping, deleteMapping } from "@/lib/db/mappings";

const validField = { id: "f1", group: "req", label_ru: "Контрагент", label_en: "Counterparty", cell: "ПТ!D9", kind: "string", required: true, strategy: "llm" };
const body = (b: unknown) => new Request("http://t/api/mappings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const delReq = (b: unknown) => new Request("http://t/api/mappings", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const asAuthed = () => (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: { email: "me@x.ru" } });

beforeEach(() => vi.clearAllMocks());

describe("POST /api/mappings", () => {
  it("401s without a session", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await POST(body({ templateId: "pt", fields: [validField] }));
    expect(res.status).toBe(401);
    expect(saveMapping).not.toHaveBeenCalled();
  });

  it("upserts a valid mapping for the session user", async () => {
    asAuthed();
    const res = await POST(body({ templateId: "pt", fields: [validField] }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(saveMapping).toHaveBeenCalledWith("me@x.ru", "pt", expect.arrayContaining([expect.objectContaining({ id: "f1", cell: "ПТ!D9" })]));
  });

  it("400s when fields fail validation (bad cell)", async () => {
    asAuthed();
    const res = await POST(body({ templateId: "pt", fields: [{ ...validField, cell: "9D" }] }));
    expect(res.status).toBe(400);
    expect(saveMapping).not.toHaveBeenCalled();
  });

  it("400s when fields[] exceeds the length cap", async () => {
    asAuthed();
    const big = Array.from({ length: 101 }, (_, i) => ({ ...validField, id: `f${i}` }));
    const res = await POST(body({ templateId: "pt", fields: big }));
    expect(res.status).toBe(400);
    expect(saveMapping).not.toHaveBeenCalled();
  });

  it("400s on a malformed body (missing fields)", async () => {
    asAuthed();
    const res = await POST(body({ templateId: "pt" }));
    expect(res.status).toBe(400);
    expect(saveMapping).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/mappings", () => {
  it("401s without a session", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await DELETE(delReq({ templateId: "pt" }));
    expect(res.status).toBe(401);
    expect(deleteMapping).not.toHaveBeenCalled();
  });

  it("deletes the mapping for the session user", async () => {
    asAuthed();
    const res = await DELETE(delReq({ templateId: "pt" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteMapping).toHaveBeenCalledWith("me@x.ru", "pt");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/mappings/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write the route**

Create `app/api/mappings/route.ts`:
```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorized } from "@/lib/auth/guard";
import { parseFieldList } from "@/lib/templates/validate";
import { saveMapping, deleteMapping } from "@/lib/db/mappings";

export const runtime = "nodejs";

const MAX_FIELDS = 100;

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.email) return unauthorized();

  let body: { templateId?: unknown; fields?: unknown };
  try {
    body = (await req.json()) as { templateId?: unknown; fields?: unknown };
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }
  if (typeof body.templateId !== "string") {
    return NextResponse.json({ error: "Ожидается templateId" }, { status: 400 });
  }
  if (Array.isArray(body.fields) && body.fields.length > MAX_FIELDS) {
    return NextResponse.json({ error: "Слишком много полей" }, { status: 400 });
  }
  const fields = parseFieldList(body.fields);
  if (!fields) {
    return NextResponse.json({ error: "Некорректная карта полей" }, { status: 400 });
  }

  try {
    await saveMapping(session.user.email, body.templateId, fields);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить карту полей" }, { status: 500 });
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.email) return unauthorized();

  let body: { templateId?: unknown };
  try {
    body = (await req.json()) as { templateId?: unknown };
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }
  if (typeof body.templateId !== "string") {
    return NextResponse.json({ error: "Ожидается templateId" }, { status: 400 });
  }

  try {
    await deleteMapping(session.user.email, body.templateId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Не удалось сбросить карту полей" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/mappings/route.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/mappings/route.ts app/api/mappings/route.test.ts
git commit -m "feat(db): POST/DELETE /api/mappings (auth-guarded upsert + reset)"
```

---

## Task 4: Load the saved mapping on boot

**Files:**
- Modify: `app/(app)/layout.tsx`
- Modify: `components/shell/AppShell.tsx`

No unit test (server wiring; covered by build + UAT).

- [ ] **Step 1: Fetch the mapping in the server layout**

Replace the entire contents of `app/(app)/layout.tsx` with:
```tsx
import { I18nProvider } from "@/lib/i18n";
import AppShell from "@/components/shell/AppShell";
import { auth } from "@/auth";
import { getMapping } from "@/lib/db/mappings";
import type { ExtractField } from "@/lib/extract/fields";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = { name: session?.user?.name ?? "", email: session?.user?.email ?? "" };

  let initialFields: ExtractField[] | undefined;
  if (user.email) {
    try {
      initialFields = (await getMapping(user.email, "pt")) ?? undefined;
    } catch {
      // DB unreachable → undefined → AppShell falls back to PT_FIELDS. Never 500 the app.
    }
  }

  return (
    <I18nProvider>
      <AppShell user={user} initialFields={initialFields}>{children}</AppShell>
    </I18nProvider>
  );
}
```

- [ ] **Step 2: Accept `initialFields` in AppShell**

In `components/shell/AppShell.tsx`, change the component signature:
```tsx
export default function AppShell({ children, user }: { children: ReactNode; user: SessionUser }) {
```
to:
```tsx
export default function AppShell({ children, user, initialFields }: { children: ReactNode; user: SessionUser; initialFields?: ExtractField[] }) {
```
and change the fields state init line:
```tsx
  const [fields, setFields] = useState<ExtractField[]>(PT_FIELDS);
```
to:
```tsx
  const [fields, setFields] = useState<ExtractField[]>(initialFields ?? PT_FIELDS);
```
(Leave `resetFields: () => setFields(PT_FIELDS)` and everything else unchanged. `ExtractField` and `PT_FIELDS` are already imported in this file.)

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. `next build` runs without `DATABASE_URL`; the layout's `try/catch` + lazy `getDb()` mean the (app) routes still build (they are already dynamic `ƒ` via `auth()`). If the build errors on a DB call at prerender, confirm the try/catch wraps `getMapping` — it should.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/layout.tsx" components/shell/AppShell.tsx
git commit -m "feat(db): load saved ПТ mapping on boot into the shell context"
```

---

## Task 5: Persist on Save / Reset in the editor

**Files:**
- Modify: `components/templates/MappingEditor.tsx`
- Modify: `lib/seed/pt.ts` (+2 i18n keys)

No unit test (UI side-effect; covered by UAT). Verified by build.

- [ ] **Step 1: Add the i18n keys**

In `lib/seed/pt.ts`, next to the existing `mapping_unsaved:` key, add:
```ts
  mapping_saving:  { ru: "Сохранение…", en: "Saving…" },
  mapping_save_err:{ ru: "Не удалось сохранить — изменения только в этой сессии", en: "Save failed — changes apply to this session only" },
```

- [ ] **Step 2: Make Save/Reset persist (awaited, error-surfaced)**

In `components/templates/MappingEditor.tsx`:

(a) Add two state hooks right after the existing `const [sel, setSel] = useState(...)` line (around line 29):
```tsx
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
```

(b) Replace the existing `save` function (currently):
```tsx
  const save = () => {
    // Normalize cells on save (bare → ПТ!…)
    const normalized = draft.map(f => {
      const r = validateCellRef(f.cell);
      return r.ok ? { ...f, cell: r.normalized } : f;
    });
    setFields(normalized);
    setDraft(normalized);
  };
```
with:
```tsx
  const save = async () => {
    // Normalize cells on save (bare → ПТ!…)
    const normalized = draft.map(f => {
      const r = validateCellRef(f.cell);
      return r.ok ? { ...f, cell: r.normalized } : f;
    });
    setFields(normalized);   // session-live immediately
    setDraft(normalized);
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, fields: normalized }),
      });
      if (!res.ok) setErr(t("mapping_save_err"));
    } catch {
      setErr(t("mapping_save_err"));
    } finally {
      setSaving(false);
    }
  };
```

(c) Replace the existing `reset` function (currently):
```tsx
  const reset = () => { resetFields(); setDraft(PT_FIELDS); setSel(PT_FIELDS[0].id); };
```
with:
```tsx
  const reset = async () => {
    resetFields();              // revert the session immediately
    setDraft(PT_FIELDS);
    setSel(PT_FIELDS[0].id);
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/mappings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) setErr(t("mapping_save_err"));
    } catch {
      setErr(t("mapping_save_err"));
    } finally {
      setSaving(false);
    }
  };
```

(d) In the header button row, surface the saving/error state and disable buttons while saving. Replace this block (around lines 93-100):
```tsx
        {editable && (
          <div className="row gap-10" style={{ alignItems: "center" }}>
            {dirty && <span className="mono dim" style={{ fontSize: 11, color: "var(--warn)" }}>{t("mapping_unsaved")}</span>}
            <Btn variant="ghost" size="md" onClick={reset}>{t("tpl_reset")}</Btn>
            <Btn variant="ghost" size="md" icon="plus" onClick={add}>{t("add_field")}</Btn>
            <Btn variant="primary" size="md" icon="check" disabled={!canSave} onClick={save}>{t("save")}</Btn>
          </div>
        )}
```
with:
```tsx
        {editable && (
          <div className="row gap-10" style={{ alignItems: "center" }}>
            {err && <span className="mono" style={{ fontSize: 11, color: "var(--bad)" }}>{err}</span>}
            {!err && saving && <span className="mono dim" style={{ fontSize: 11 }}>{t("mapping_saving")}</span>}
            {!saving && dirty && <span className="mono dim" style={{ fontSize: 11, color: "var(--warn)" }}>{t("mapping_unsaved")}</span>}
            <Btn variant="ghost" size="md" onClick={reset} disabled={saving}>{t("tpl_reset")}</Btn>
            <Btn variant="ghost" size="md" icon="plus" onClick={add} disabled={saving}>{t("add_field")}</Btn>
            <Btn variant="primary" size="md" icon="check" disabled={!canSave || saving} onClick={save}>{saving ? t("mapping_saving") : t("save")}</Btn>
          </div>
        )}
```

- [ ] **Step 3: Typecheck, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS. (`Btn` already supports a `disabled` prop — it's used elsewhere in this file.)

- [ ] **Step 4: Commit**

```bash
git add components/templates/MappingEditor.tsx lib/seed/pt.ts
git commit -m "feat(db): persist ПТ mapping on Save/Reset (awaited, error-surfaced)"
```

---

## Task 6: Verify, UAT & push (controller — needs network)

**Files:** none (verification).

- [ ] **Step 1: Full verification**

Run: `npx tsc --noEmit && npm run lint && npx vitest run && npm run build`
Expected: tsc PASS, lint clean, all Vitest pass (115 prior + ~7 mappings-route = ~122), build green with `ƒ /api/mappings` in the route list.

- [ ] **Step 2: Browser UAT** *(headless Playwright against `next start`, prod build — controller, `dangerouslyDisableSandbox`)*

Setup mirrors phases 7/8a/8b: `npm install --no-save playwright@1.60.0` (Chromium cached at `~/.cache/ms-playwright`); run the throwaway script FROM the web dir; `.env.local` already has `DATABASE_URL` + `OPENROUTER_API_KEY` + `BLOB_READ_WRITE_TOKEN` + `AUTH_SECRET` + `AUTH_USERS` (test user `test@ffa.ru` / `test1234`). Build (`npm run build`) then start `next start -p 3100` in the background. Reminders: kill the server by **port PID** (`ss -ltnp | grep :3100`), NOT `pkill -f "next start"` (self-match); blob upload to vercel-storage can take >30s headless; `next start` reads `.env.local` via `@next/env`. Scenarios:

1. **Persist across reload:** log in → open `/templates/pt` editor → change f1's cell `ПТ!D9`→`D10` → click Save (await the `/api/mappings` POST 200) → full `page.reload()` → the f1 cell input shows `ПТ!D10` (loaded from DB, not the default D9). Assert the editable cell `input.mono` for f1 has value containing `D10`.
2. **Saved mapping drives fill:** with D10 saved (NO reload needed, but a reload is fine), run the wizard: open "Новое заполнение" → upload a generated Russian-invoice `schet.docx` (use `docx` dep; include `Итого к оплате: 48 500,00 руб.` and `ООО «Ромашка»`) → wait for Review → "Подтвердить и заполнить" → "Скачать Excel" → capture the download, unzip `xl/worksheets/sheet1.xml`, assert `<c r="D10"` carries the counterparty (the persisted cell drove the fill), and the default `D9` does NOT.
3. **Reset → defaults:** click "Сбросить" (await DELETE 200) → `page.reload()` → f1 cell back to `ПТ!D9` (default). Optionally assert the DB row is gone via a direct `neon()` query (`select count(*) from template_mappings where user_id='test@ffa.ru'` === 0).
4. **Per-user isolation:** (query-level, as in 8b S4 — a 2nd browser login is impractical) via `tsx`: `saveMapping("test@ffa.ru","pt",[...D10])`, then `getMapping("user2@ffa.ru","pt")` === null and `getMapping("test@ffa.ru","pt")` has the D10 field; clean up.

Direct-DB checks use the retry wrapper pattern from 8b (neon-http occasionally ConnectTimeouts from a script). Remove the throwaway script/fixtures afterward; clean any test rows so the DB is left tidy. Commit nothing from UAT.

- [ ] **Step 3: Final review + push** *(controller)*

After UAT passes: dispatch a final whole-feature review (opus) of the phase-8c diff; fix any Important/Critical findings with atomic commits; then push:

Run: `git push origin ffa-web-scaffold` *(controller, `dangerouslyDisableSandbox`)*

---

## Self-review notes (author)

- **Spec coverage:** per-user jsonb table (T1), `getMapping`/`saveMapping`/`deleteMapping` (T2), `/api/mappings` POST upsert + DELETE reset with `parseFieldList` validation + length cap (T3), server-layout load → `initialFields` → context seed (T4), editor Save→POST / Reset→DELETE awaited+error-surfaced (T5), degradation via try/catch + lazy client (T4), per-user isolation by `where userId=…` (T2), unit tests for the route + UAT for the DB-bound pieces (T3/T6). Every spec section maps to a task.
- **Out of scope honored:** no shared/org mapping, no version history, `PT_FIELDS` stays the code default + fallback, no defaults-merge layer, single-template only.
- **Type consistency:** `getMapping(userId, templateId): ExtractField[] | null`, `saveMapping(userId, templateId, fields)`, `deleteMapping(userId, templateId)` — signatures match the route calls (T3), the layout call (T4), and the test mocks (T3). `parseFieldList(unknown): ExtractField[] | null` is the existing phase-7 validator (returns the normalized array the route hands to `saveMapping`). `initialFields?: ExtractField[]` prop threads layout→AppShell→`useState`. The route returns `{ ok: true }`, which the editor only checks via `res.ok` (no body shape coupling).
- **Gotcha guarded:** `schema.ts` imports `ExtractField` relatively (drizzle-kit alias resolution); `mappings.ts` and app code use `@/`.
