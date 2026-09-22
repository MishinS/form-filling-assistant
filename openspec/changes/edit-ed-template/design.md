## Context

State on `feat/ed-passport-html` (see proposal.md — Why):

- The ED catalog, instruction and skeleton are repository constants:
  `ED_FIELDS` / `ED_INSTRUCTION` in `lib/render/ed.ts` (client-safe, no node
  imports) and `lib/render/templates/ed.html`, read from disk by
  `app/api/fill/route.ts` via `ED_SKELETON_PATH`.
- `lib/templates/builtins.ts` marks ED `fieldsLocked: true`; `/api/extract`
  therefore ignores `body.fields` for ED and uses `builtin.fields` and
  `builtin.instruction`.
- The fill route deliberately takes only values for ED: "режимы рендера задаёт
  каталог, поэтому чужая разметка в документ попасть не может". This property
  must survive.
- The client builds the prompt itself on two paths: `components/wizard/Processing.tsx`
  (local model, `builtinInstruction(templateId)`) and `lib/batch/run-one.ts`
  (batch; HTML is out of batch scope).
- `WizardModal` picks ED fields statically (`tpl === ED_TEMPLATE_ID ? ED_FIELDS`).
- `/templates/[id]` returns 404 for `ed` (built-in rows have `userId = null`;
  only `pt` is special-cased). `MappingEditor` is cell-centric (`validateCellRef`,
  `MiniSheet`).
- Validation building blocks already exist: `renderHtml` returns
  `unknown_slot` / `unaddressed_slot` / `duplicate_slot`; `checkSubset(html,
  NAVI_SUBSET)` checks elements, attributes, `id` and font sizes;
  `parseFieldList(…, { format: "html", allowedSlots, allowedGroups })` validates
  an HTML field list and drops `paragraphHtml` / `listSeparator` from the body.
- `template_mappings(user_id, template_id, fields jsonb not null, updated_at)`
  holds per-user field lists; `/api/mappings` GET/POST/DELETE serves them.
- Schema changes are applied with `drizzle-kit push` (no migrations folder).

## Goals / Non-Goals

**Goals:**
- One pure, client-safe function decides the effective ED template and whether a
  combination is valid; the editor, the save route, extract and fill all call it.
- Fill keeps receiving only values; the server resolves fields and skeleton.
- A layer that is not overridden is `null` in storage, never a copy of the
  default, so repository updates reach users who did not touch that layer.

**Non-Goals:**
- Generalizing to arbitrary HTML templates or to PT (the XLSX editor is untouched).
- A structured/WYSIWYG skeleton editor.

## Decisions

### D1. Storage: nullable layers on `template_mappings`

Add `instruction text null` and `skeleton text null`, and drop `NOT NULL` from
`fields`. One row per `(user, 'ed')`; each column `null` = repository default.

- *Why not a new table*: the row is keyed exactly like mappings, is read at the
  same moments, and PT/custom rows simply keep `instruction`/`skeleton` null.
- *Why not store the full effective template*: copying defaults would freeze
  them and break "untouched layer follows a new release".
- `getMapping` keeps returning `fields ?? null`, so every existing PT/custom
  caller is unaffected. New `getTemplateLayers(user, templateId)` returns
  `{ fields, instruction, skeleton }` (each nullable); `saveTemplateLayers`
  upserts all three columns at once; "reset all" reuses `deleteMapping`.

### D2. One resolver + validator in `lib/templates/ed-custom.ts` (pure, client-safe)

```
resolveEd(layers | null) → { fields, instruction, skeleton, custom: {fields,instruction,skeleton}:bool }
validateEd(effective)    → { ok: true } | { ok: false, error: EdError }
```

`EdError` is a discriminated union: `unknown_slot {fieldId}`,
`unaddressed_slot {slot}`, `duplicate_slot {slot}`, `subset {SubsetError}`,
`instruction_too_long`, `fields_invalid`. Implemented by composing existing
pieces: `checkSubset(skeleton, NAVI_SUBSET)`, a dry `renderHtml(skeleton, fields,
[])` for the slot checks, and the instruction bound. Error → message mapping
lives in i18n, keyed by code, with the slot/field name interpolated.

The default skeleton is needed on the client (preview, "restore layer"), but
`ed.html` is read from disk server-side. **Decision:** `resolveEd` takes the
defaults as an argument — `resolveEd(layers, defaults)` with
`defaults = { fields: ED_FIELDS, instruction: ED_INSTRUCTION, skeleton }` — and
the server supplies the skeleton: the editor page (a server component) passes it
as a prop, and `/api/mappings` GET returns it. `ed.html` stays the single source
and stays openable in a browser; no build-config change.
*Alternative rejected*: inlining the skeleton into a TS string module — a second
copy to keep in sync, or a codegen step.

### D3. Markup-bearing field props come from the catalog by id

`parseFieldList` drops `paragraphHtml` / `listSeparator` from the body (already).
On save and on resolve, a field whose `id` matches a catalog field inherits the
catalog's `paragraphHtml` / `listSeparator`; a new field has none (renders with
the renderer defaults `<p>{}</p>` / `" | "`). So editing `e5`'s label keeps its
18px amount paragraphs, and the only way to change markup is the skeleton, which
`checkSubset` validates.

### D4. API: `/api/mappings` learns the ED layers

- `GET ?templateId=ed` → `{ fields, instruction, skeleton, custom: {…},
  defaults: { fields, instruction, skeleton } }`. Registered users only (guests
  are already refused by the route; the wizard falls back to defaults for them).
- `POST { templateId: "ed", fields: F|null, instruction: S|null, skeleton: S|null }`
  → validates each present layer's shape (`parseFieldList` with
  `format: "html"`, `allowedGroups: ED_GROUPS`, `allowedSlots` from the
  *effective* skeleton; strings bounded), resolves against defaults, runs
  `validateEd`, and on success stores the three columns verbatim (null stays
  null). 400 with `{ error, code, name? }` on failure.
- Per-layer reset is a client-side draft operation (set that layer to `null`)
  followed by a normal save — so it goes through the same combined validation.
  "Reset all" = existing `DELETE`.
- *Why not a separate `/api/templates/ed` route*: mappings already owns
  per-user template customization, auth and guest handling.

### D5. Runtime resolution

- **Extract** (`/api/extract`): for `templateId === "ed"` and a registered user,
  load layers, `resolveEd`, use effective fields + instruction; body fields stay
  ignored (ED remains effectively `fieldsLocked` against the *request*). Guests
  → defaults. DB failure → defaults would silently run a different template, so
  it returns the existing localized 500-class JSON error instead.
- **Fill** (`/api/fill`): same resolution; `validateChoiceValues` against the
  effective fields; `validateEd` before rendering; invalid stored version → 422
  with a localized «Шаблон ЭД не проходит проверку — верните значения по
  умолчанию в редакторе шаблона». Still values-only in the body.
- **Wizard**: for `ed`, a registered user's wizard fetches
  `/api/mappings?templateId=ed` (as it already does for custom templates) and
  uses the effective fields; `Processing.tsx` passes the fetched instruction to
  the local-model prompt instead of `builtinInstruction`. Guests keep the static
  path. `builtinTemplate("ed").fieldsLocked` stays `true` — it now means "the
  server, not the request, decides the catalog", which is still true.

### D6. Editor UI: `/templates/ed` → `HtmlTemplateEditor`

Server page (registered only; guests → 404 as for foreign templates) loads layers
and default skeleton, renders a client component with three tabs:

```
[ Поля ] [ Инструкция ] [ Каркас ]                 [Вернуть всё] [Сохранить]
─────────────────────────────────────────────────────────────────────────────
Каркас:  ┌ textarea (monospace) ────────┬ iframe sandbox="" srcdoc=preview ┐
         │ …<!--slot:penalties-->…      │ rendered with placeholder values  │
         │ [+ слот ▾]                   │                                    │
         └──────────────────────────────┴────────────────────────────────────┘
         ⚠ слот «delivery» не связан ни с одним полем          [Вернуть слой]
```

- Fields tab: a table of ED fields (label RU/EN, hint, required, slot, slot mode
  select, default, constant, options editor for choice fields), add/delete row.
  A new field gets a generated id and an empty slot; the slot helper in the
  skeleton tab lists fields to insert.
- Preview: `renderHtml(draftSkeleton, draftFields, placeholders)` where each
  placeholder is `[label_ru]`; shown in `iframe sandbox=""` with `srcdoc`, the
  same isolation the done step already uses.
- Validation runs on every change (`validateEd`), shown inline; Save disabled
  while invalid. Each tab has «Вернуть по умолчанию» (sets that layer to null in
  the draft; the tab shows a "по умолчанию" badge when the layer is null).
- Logic (draft reducer, placeholder values, error→message) lives in
  `components/templates/html-editor-core.ts` with Vitest tests; the component
  stays thin, per repo convention.
- Gallery: the ED card gets an edit action for registered users, linking to
  `/templates/ed`.

### D7. Instruction bound

`MAX_INSTRUCTION_LENGTH = 4000` next to `MAX_NOTE_LENGTH` (the default
instruction is ~600 chars). Over the bound → reject, never truncate (matches the
`template-prompts` requirement on instruction validation).

## Risks / Trade-offs

- [A saved skeleton goes stale when `ed.html` improves] → by design (proposal
  non-goal); the editor shows a "свой" badge per layer so the user knows what
  they own, and one click restores the default.
- [A later tightening of `NAVI_SUBSET` invalidates a stored skeleton] → fill
  re-validates and answers a localized 422 pointing at reset, never a 500 or a
  document the editor will rewrite.
- [New field ids collide with catalog ids after a release adds `e12`] → generated
  ids use a distinct prefix (`u…`), so catalog markup inheritance (D3) never
  attaches to a user field.
- [Removing a catalog field the renderer treats specially, e.g. `e1` list mode,
  changes the documents line] → allowed; it is the user's template. Validation
  only guarantees consistency, not the original layout.
- [The self-authored skeleton is pasted into navi by the same user] → no
  cross-user surface: edits are per user, preview is sandboxed, values stay
  escaped by `renderHtml`, and the skeleton must pass `checkSubset`.
- [Extract and fill each hit the DB once more for ED] → one indexed PK lookup;
  guests skip it.

## Migration Plan

1. Archive `ed-passport-html` (after its UAT) so `templates` carries the HTML
   requirements this change builds on; rebase this branch onto the result.
2. `drizzle-kit push` for the two new nullable columns and the dropped
   `NOT NULL` — additive, existing rows valid as-is.
3. Deploy. Rollback: revert the code; the extra columns are ignored by old code
   and `fields` rows written by the new code for `ed` with `fields = null` are
   read by old `getMapping` as "no mapping" (old code never reads `ed` mappings
   anyway).
