## 1. The renderer (TDD)

- [x] 1.1 Write `lib/render/html.test.ts` red against a not-yet-existing
  `./html`: a two-slot skeleton renders both values; a slot with no value still
  emits its section; a field's `constantValue` wins over an empty extracted
  value; an address naming a slot the skeleton lacks returns a typed error and no
  partial document. Proven by: `lib/render/html.test.ts` fails to resolve the
  module (red on purpose). Файл прогона: `08-render-red-1.txt`.
- [x] 1.2 Add the escaping cases to `lib/render/html.test.ts`: a value containing
  `<script>` renders as visible characters; a value containing `onclick=` emits
  no attribute; a `javascript:` URL in a `contact` value renders as plain text
  with no `<a>`; an e-mail in a `contact` value emits a `mailto:` link; a phone
  emits `tel:`. Proven by: those cases red. Файл прогона: `09-render-red-2.txt`.
- [x] 1.3 Add the value-mode cases: `paragraphs` splits a four-line payment
  schedule into four `<p>` elements in the skeleton's paragraph formatting;
  `list` joins items with the declared separator and leaves one trailing
  separator; an empty `list` renders separators and no items; `text` leaves a
  single escaped run. Proven by: those cases red. Файл прогона: `09-render-red-2.txt`.
- [x] 1.4 Implement `lib/render/html.ts`: split the skeleton on literal
  `<!--slot:ID-->` tokens into static chunks, join with per-mode formatted
  values, one escape function on the single substitution path. Proven by:
  `lib/render/html.test.ts` green. Файл прогона: `10-render-green.txt` — 26 passed.
- [x] 1.5 Add `lib/render/subset.ts` + `subset.test.ts` asserting a skeleton
  stays inside the destination editor's declared element/attribute subset and
  uses only font sizes from its list, and that loading a skeleton outside it
  fails with a typed error. Proven by: `lib/render/subset.test.ts` green. Файл прогона: `11-subset.txt` — 10 passed.

## 2. The «Паспорт Заказа и договора» template

- [x] 2.1 Convert `~/Downloads/Шаблон ЭД.txt` from CP1251 to UTF-8, strip the
  instruction header and every `id` attribute, and save the remainder as
  `lib/render/templates/ed.html` with `<!--slot:ID-->` markers in place of the
  example's values. Proven by: manual check — the file opens in a browser and
  renders the owner's layout; `lib/render/ed.test.ts` green on it. Файл прогона: `14-ed-green.txt` — 56 passed.
- [x] 2.2 Add `ED_FIELDS` to `lib/extract/fields.ts`: the documents row (`list`),
  the sections in form order with their slot addresses and render modes,
  «Класс расхода» as note-sourced, and the signature row as one line of three —
  «Запустил» constant «Мишин С. С.», «Инициатор» a blank label with no field,
  «ЦФО» a choice among Суровцев / Вознесенская / Субханкулова labelled by
  department. Proven by: `lib/extract/fields.test.ts` case asserting every
  `ED_FIELDS` address resolves to a slot present in `ed.html`, and that the
  signature slots appear in that order. Отступление от плана: каталог лежит в
  `lib/render/ed.ts` рядом со своей разметкой, а не в `lib/extract/fields.ts` —
  в общий файл уехал только тип `ExtractField`. Файл прогона:
  `14-ed-green.txt`; типы — `15-tsc-mid.txt`, весь набор — `16-tests-mid.txt`
  (601 passed).
- [ ] 2.3 Add the ED instruction text (the stripped header from 2.1, minus the
  colour rules that belong to the skeleton) as the template's own instruction.
  Proven by: `lib/extract/llm/prompt.test.ts` case asserting the rendered prompt
  contains the mandatory-section list.

## 3. Template-owned prompts

- [ ] 3.1 Write the red cases in `lib/extract/llm/prompt.test.ts`: a template's
  instruction appears under its own heading; a run note appears under a separate
  heading marked as the user's context; no note means no such section; a
  template with no instruction yields mechanics only; a note-sourced field's
  hint appears on its field line. Proven by: those cases red.
- [ ] 3.2 Move PT's opening sentence and own-company counterparty rule out of
  `buildExtractionPrompt()` into PT's own instruction, leaving only mechanics in
  shared code, and thread `instruction` + `userNote` through. Proven by:
  `lib/extract/llm/prompt.test.ts` green, including a case asserting the PT
  prompt still matches the string recorded in `baseline.md`.
- [ ] 3.3 Thread the note through every model path — hosted, OpenRouter race,
  BYOK, and `run-local-extract.ts`. Proven by:
  `lib/extract/llm/run-local-extract.test.ts` case asserting the local prompt
  carries the instruction and the note.
- [ ] 3.4 Exclude note-sourced and choice fields from the empty-value warning.
  Proven by: `lib/extract/extract.test.ts` case — a run whose only empty fields
  are of those kinds raises no warning.

## 4. Boundary validation

- [ ] 4.1 Add `lib/templates/slotref.ts` + `slotref.test.ts` validating a slot
  name against a skeleton's declared slots. Proven by:
  `lib/templates/slotref.test.ts` green.
- [ ] 4.2 Make `parseFieldList()` pick its address validator from the template
  format and enforce a choice field's option set. Proven by:
  `lib/templates/validate.test.ts` cases — a cell reference on an HTML template
  is rejected, a slot name on an XLSX template is rejected, an undeclared slot is
  rejected, and a choice value outside its options is rejected.
- [ ] 4.3 Bound the run note's length and reject a non-string note at the API
  boundary. Proven by: `lib/templates/validate.test.ts` case — an oversized note
  is rejected rather than truncated.

## 5. Persistence

- [ ] 5.1 Add `html` to the `template_format` enum in `lib/db/schema.ts` and
  generate the Drizzle migration; widen `TemplateRow["format"]`. Proven by:
  `npx tsc --noEmit` clean and the generated SQL containing only
  `ALTER TYPE … ADD VALUE`.
- [ ] 5.2 Add the idempotent ED seed row (`id: 'ed'`, `userId: null`,
  `fileKey: null`, `format: 'html'`). Proven by: manual check — running the seed
  twice leaves one row.

## 6. Pipeline and API

- [ ] 6.1 Branch `app/api/fill/route.ts` on the template's stored format:
  workbook bytes for `xlsx`, JSON `{ html }` for `html`, one guard and one
  history write for both. Proven by: `app/api/fill/route.test.ts` cases — an
  HTML template returns JSON and writes no file; an XLSX template is unchanged.
- [ ] 6.2 Accept the run note on the extraction request and pass it to
  `extractFields`. Proven by: `app/api/extract/route.test.ts` case asserting the
  note reaches the prompt.

## 7. Wizard

- [ ] 7.1 Add the run-note box to the upload step. Proven by:
  `components/wizard/<note>-core.test.ts` covering the bounded-length and
  empty-note logic (React rendering untested, per repo convention).
- [ ] 7.2 Show note-sourced and choice fields in review as awaiting input rather
  than as low-confidence extractions, with a choice control for the option set.
  Proven by: `lib/review/*.test.ts` case on the field-state logic.
- [ ] 7.3 Replace the done step's download with a preview and a copy action for
  an HTML template, falling back to a selectable text area when the clipboard is
  refused. Proven by: `components/wizard/<done>-core.test.ts` on the branch
  logic; manual check of the preview.

## 8. Verification against reality

- [ ] 8.1 Run the ED template against the owner's own documents from
  `~/Downloads` — at minimum the «Договор №07_26 + Счёт №7 + Смета» triple and
  two single-invoice cases — and record per-field accuracy. Proven by: the run
  output file named in `verification.md`.
- [ ] 8.2 Paste one rendered document into navi's editor and compare it with the
  owner's original. Proven by: manual check by the owner — this cannot be
  automated from this repo and is named in `verification.md` as his.
- [ ] 8.3 Confirm the PT path is untouched: the PT prompt still matches the
  baseline string and a PT fill still downloads a workbook. Proven by:
  `npm test` green plus the PT fill re-run recorded in `verification.md`.
