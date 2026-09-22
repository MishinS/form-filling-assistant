## 0. Prerequisite

- [ ] 0.1 `ed-passport-html` archived (after its UAT 8.1/8.2) and this branch
  rebased onto the result, so `openspec/specs/templates/spec.md` carries the
  HTML-format requirements. Proven by: `npx openspec validate edit-ed-template
  --strict` green against the updated main specs.

## 1. Storage

- [ ] 1.1 `lib/db/schema.ts`: `template_mappings` gains nullable `instruction`
  and `skeleton` text columns; `fields` loses `notNull`. Proven by:
  `npx tsc --noEmit` clean.
- [ ] 1.2 `lib/db/mappings.ts`: add `getTemplateLayers(user, templateId)` →
  `{ fields, instruction, skeleton } | null` and `saveTemplateLayers(user,
  templateId, layers)` upserting all three columns (null stays null);
  `getMapping` keeps returning `fields ?? null`. Proven by:
  `lib/db/mappings.test.ts` (mocked db: partial layers round-trip; `getMapping`
  returns null for a row with `fields = null`).

## 2. Resolver and validator (TDD)

- [ ] 2.1 Write `lib/templates/ed-custom.test.ts` red for `resolveEd(layers,
  defaults)`: null row → all defaults, `custom` all false; only instruction set
  → user instruction + default fields/skeleton; a user field with a catalog id
  inherits `paragraphHtml`/`listSeparator`, a `u…` field does not. Proven by:
  file fails to resolve the module (red on purpose).
- [ ] 2.2 Add red cases for `validateEd(effective)`: default ED → ok; slot with
  no field → `unaddressed_slot` naming it; field with a slot missing from the
  skeleton → `unknown_slot` naming the field; duplicate slot; `id` attribute /
  disallowed tag / `font-size: 16px` → `subset`; instruction over
  `MAX_INSTRUCTION_LENGTH` → `instruction_too_long`. Proven by: those cases red.
- [ ] 2.3 Implement `lib/templates/ed-custom.ts` (client-safe, no node imports)
  composing `checkSubset`, a dry `renderHtml` and the bound; add
  `MAX_INSTRUCTION_LENGTH = 4000` next to `MAX_NOTE_LENGTH`. Proven by:
  `lib/templates/ed-custom.test.ts` green.

## 3. API

- [ ] 3.1 `/api/mappings` GET `?templateId=ed`: returns effective layers,
  `custom` flags and `defaults` (skeleton read from `ED_SKELETON_PATH`). Proven
  by: `app/api/mappings/route.test.ts` — no row → defaults with all `custom`
  false; saved instruction → returned with `custom.instruction` true; guest → 403.
- [ ] 3.2 `/api/mappings` POST `templateId: "ed"`: shape-validate each non-null
  layer (`parseFieldList` with `format: "html"`, `ED_GROUPS`, slots of the
  effective skeleton; string types and bounds), `resolveEd` + `validateEd`, store
  on success; 400 with `{ error, code, name }` otherwise; body
  `paragraphHtml`/`listSeparator` never stored. Proven by:
  `app/api/mappings/route.test.ts` — valid partial save stored verbatim;
  unaddressed slot → 400 naming it; subset violation → 400; oversized
  instruction → 400; guest → 403; PT/custom POST cases unchanged.
- [ ] 3.3 `/api/extract` for `ed`: registered user → effective fields +
  instruction from `getTemplateLayers`; body fields still ignored; guest →
  defaults without a DB call; DB error → localized error, not defaults. Proven
  by: `app/api/extract/route.test.ts` — the user's instruction reaches the
  prompt; guest prompt equals the repository one.
- [ ] 3.4 `/api/fill` for `ed`: resolve server-side, `validateChoiceValues`
  against effective fields, `validateEd` before render; invalid stored version →
  422 with localized message; body `fields` ignored. Proven by:
  `app/api/fill/route.test.ts` — renamed section in a saved skeleton appears in
  the HTML; fourth «ЦФО» option accepted; body markup has no effect; invalid
  stored skeleton → 422; guest renders the repository skeleton.

## 4. Wizard

- [ ] 4.1 `WizardModal`: for `ed` and a registered user, fetch
  `/api/mappings?templateId=ed` and use the effective fields and instruction;
  guests keep `ED_FIELDS`. Extract the selection into a pure helper in
  `components/wizard/template-fields-core.ts`. Proven by:
  `components/wizard/template-fields-core.test.ts` — helper picks fetched fields
  for a user, static ones for a guest.
- [ ] 4.2 `Processing.tsx`: the local-model prompt takes the instruction passed
  down from the wizard instead of `builtinInstruction("ed")`. Proven by: the
  prompt-building helper's test asserts a supplied instruction wins; manual
  check in 7.4.

## 5. Editor

- [ ] 5.1 `components/templates/html-editor-core.ts`: draft reducer (edit field,
  add field with a `u…` id, delete field, set instruction, set skeleton, reset
  layer → null, reset all), placeholder values (`[label_ru]`), slot-token
  insertion at a cursor offset, `EdError` → i18n key + name. Proven by:
  `components/templates/html-editor-core.test.ts`.
- [ ] 5.2 `components/templates/HtmlTemplateEditor.tsx`: tabs Поля / Инструкция
  / Каркас, textarea + `iframe sandbox="" srcdoc` preview, slot helper, inline
  validation, Save disabled while invalid, per-tab «Вернуть по умолчанию» and
  "по умолчанию"/"свой" badge, «Вернуть всё» via DELETE. Proven by: manual check
  in 7.1–7.3 (component stays thin; logic covered by 5.1).
- [ ] 5.3 `app/(app)/templates/[id]/page.tsx`: `ed` for a registered user loads
  layers + default skeleton and renders `HtmlTemplateEditor`; guest → 404.
  Proven by: manual check (guest URL → 404) and `npx tsc --noEmit`.
- [ ] 5.4 `TemplateGallery`: edit action on the ED card for registered users
  only. Proven by: manual check as user and as guest.
- [ ] 5.5 All new strings in `lib/i18n.tsx` (RU/EN), including every `EdError`
  message and the fill 422 message. Proven by: existing i18n key-parity test
  green.

## 6. Verify

- [ ] 6.1 `npx vitest run` green. Proven by: Vitest summary.
- [ ] 6.2 `npx tsc --noEmit` clean. Proven by: empty output.
- [ ] 6.3 `npx openspec validate --all --strict` green. Proven by: command output.
- [ ] 6.4 `drizzle-kit push` applied to the dev database; existing PT mapping
  rows still load. Proven by: manual check — PT mapping editor shows saved cells.

## 7. UAT (before archiving)

- [ ] 7.1 Add a fourth «ЦФО» option, rename a section label in the skeleton,
  save; run an order passport — review offers four options, the document shows
  the new label. Proven by: manual run.
- [ ] 7.2 Add a new field and its slot row in the skeleton; try saving with the
  slot removed first (blocked with the field named), then with it present
  (saved); run — the new section is extracted and rendered. Proven by: manual run.
- [ ] 7.3 Reset only the skeleton (blocked while the new field exists — message
  names it), delete the field, save; then «Вернуть всё» — the next run matches
  the repository template. Proven by: manual run.
- [ ] 7.4 Edit the instruction; run once with a hosted model and once with a
  local model (desktop) — both prompts carry the edited instruction. Proven by:
  manual run.
- [ ] 7.5 Guest: no edit action, `/templates/ed` → 404, a run uses the
  repository template. Proven by: manual run.
- [ ] 7.6 Paste a document rendered from an edited skeleton into navi's editor —
  nothing dropped or rewritten. Proven by: manual check.
