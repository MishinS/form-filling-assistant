## Context

See `proposal.md` — Why. What matters for the approach is how little of the
pipeline is format-aware today.

`extractFields(docs, modelId, fields, …)` (`lib/extract/extract.ts:33`) already
takes the field catalog as a parameter and never asks which template it serves.
Review (`lib/review/`) works on `ExtractedValue[]` keyed by field id. Both are
format-blind and stay untouched. Format-awareness is concentrated in two places:

- **the end of the pipeline** — `lib/fill/values.ts` produces `CellWrite[]` and
  `lib/fill/xlsx.ts` performs OOXML zip surgery, reached from
  `app/api/fill/route.ts`;
- **the prompt** — `buildExtractionPrompt()` (`lib/extract/llm/prompt.ts`) opens
  with «Извлеки значения полей для российского "Платёжного требования"» and
  carries the own-company counterparty rule. Both are PT-specific and currently
  apply to every template, including user-scanned ones.

Built-in templates are DB rows with `userId = null` whose file is bundled in the
repository (`lib/db/templates.ts#listTemplates`, `lib/fill/templates/pt.xlsx`),
so an HTML built-in fits the existing shape: a row plus a repo-bundled asset.

The destination editor is navi's TinyMCE, configured in
`components/TextEditor/tinyMCE/tinyMCEInit.ts` in the company repo, which we
treat as a fixed external contract (read-only):

- `schema: 'html5'`, `extended_valid_elements` admits `table[style,border]`,
  `a[href|target=_self|style]` and `+@[data-options]`;
- `font_size_formats: '8px 10px 12px 14px 18px 24px 36px'`;
- `lib/paste.ts` removes every `id` attribute from pasted elements, and navi
  re-assigns its own UUIDs;
- `#00AEEF`, `#1F364D`, `#8592A6` are all entries in the editor's own palette.

## Goals / Non-Goals

**Goals:**
- One rendering path whose escaping is structural, not a matter of remembering
  to call an escape function at each substitution site.
- A skeleton a person can open in a browser and diff against a document pasted
  out of the editor, so drift between our output and the real form is visible.
- Template-owned prompts introduced without changing the behavior of the
  existing PT template or of user-scanned templates.

**Non-Goals:**
- A general templating engine. Slots substitute values; there are no loops, no
  conditionals, no expressions.
- Round-tripping edited HTML back out of the editor into our template.
- Sanitizing arbitrary third-party HTML. We emit; we never ingest markup.

## Decisions

### D1 — The skeleton is an HTML file with comment slots

The built-in skeleton lives at `lib/render/templates/ed.html` as a real HTML
fragment. A slot is an HTML comment carrying a field id: `<!--slot:f3-->`.
Rendering splits the file on those literal tokens and joins the static chunks
with formatted values.

Rationale: the file is valid HTML, so it opens in a browser and diffs cleanly
against a document copied out of the editor. The marker is a literal string, so
finding it requires no HTML parsing — we never run a regex over markup. And
because the join is "static chunk, formatted value, static chunk", every value
passes through exactly one formatter; there is no substitution site that can
forget to escape.

Alternatives considered:
- **`data-slot` attributes on real elements.** Prettier to read, but locating an
  attributed element means parsing HTML, which means either a new dependency or
  a regex over markup. Rejected for the parsing.
- **A server-side DOM (`linkedom`, `node-html-parser`).** Gives a safe
  `textContent` API, but adds a dependency and a second HTML semantics to reason
  about for a document we fully control. Rejected as unnecessary weight.
- **Building the HTML in TypeScript from a section list.** Also escapes by
  construction and needs no asset, but moves the layout into code where it can
  no longer be diffed against a real pasted document. Rejected on that.

### D2 — Each field declares how its value is rendered

`ExtractField` gains a render mode used only by HTML templates: `text` (escaped
inline), `paragraphs` (escaped, one `<p>` per line — blank lines collapse — each wrapped
in the template's own paragraph markup), `contact` (escaped, with an e-mail or phone
inside it turned into a `mailto:`/`tel:` link), and `list` (escaped lines joined
by a declared separator with one trailing separator — the documents row, whose
blanks the owner later fills with navi links by hand). The mode is a closed set — a
value never chooses its own rendering, so the amount of HTML a value can produce
is bounded by the template, not by the document it came from.

`mailto:`/`tel:` are the only link schemes ever emitted. Anything else in a value
renders as text (`html-render` — Values are escaped, never interpreted).

### D3 — Field addresses stay one string column, validated per format

`fields.cell` is `text` in the database and `ExtractField.cell` is a string, so
an HTML template's slot name needs no schema change. `validateCellRef`
(`lib/templates/cellref.ts`) gains a sibling for slot names, and
`parseFieldList` (`lib/templates/validate.ts`) picks the validator from the
template's format — the boundary rule the `templates` delta spells out.

Renaming the column and the property to `address` is the honest fix and is
deliberately not done here: it touches the DB, the mapping editor, the batch
path and every test, for no behavior change. It is named as a follow-up rather
than smuggled in.

### D4 — The prompt is composed from template data, PT included

`buildExtractionPrompt()` keeps only mechanics: the response-shape line, the
per-field lines, the local-model guidance, the truncated document text. Two new
inputs sit above them — the template's `instruction` and the run's optional
`userNote`, each under its own heading so the model can tell house rules from
one person's context for one run.

PT's current opening sentence and its own-company counterparty rule move
verbatim into PT's own `instruction`. This keeps today's PT prompt
byte-comparable while removing the last template-specific text from shared code;
the baseline snapshot records the PT prompt so any drift shows up at
verification. A template with no instruction (every user-scanned one) sends
mechanics only, which is what it effectively does today minus the PT sentences
that never applied to it.

The ED template's instruction is the header of the owner's own file
(`~/Downloads/Шаблон ЭД.txt`, CP1251 — converted to UTF-8 on the way in), which
already reads as a prompt: the mandatory section list, the "insert a default when
the request lacks a section" rule, and the colour conventions. The colour rules
belong to the skeleton and are dropped from the instruction; the rest is data.

### D5 — Three kinds of field the supplier's documents cannot answer

The ED form mixes facts from the documents with facts only the organization
holds, and they are not all the same kind:

- **Answered from the run note.** «Класс расхода» («ПРОЕКТЫ/1905/Мебель») exists
  only in the owner's head until he writes the note. It stays `strategy: "llm"`
  and is asked of the model alongside the rest, with a per-field hint saying the
  answer comes from the user's context and must be left empty otherwise. This is
  why the note is placed in the prompt as a labelled section rather than mixed
  into the document text — the model has to be able to tell the two apart to
  honour that hint.
- **Chosen from a list.** «ЦФО» is one of three department heads — Суровцев
  (Развитие), Вознесенская (Мед. департамент), Субханкулова (Фин. департамент).
  `strategy: "manual"` already excludes a field from the rules pass and the LLM
  field list (`lib/extract/extract.ts:47,66`); the addition is a closed option
  set on the field, offered as a choice in review and enforced in
  `parseFieldList`. The options are configuration, not code, so a fourth
  department costs a config line.
- **Fixed by the form.** «Запустил» is always «Мишин С. С.».
  `fillMode: "constant"` with `constantValue` covers it and the extraction pass
  already skips such fields.
- **Blank on purpose.** «Инициатор» is a label the owner completes by hand in
  the editor, like the navi links in the documents row. It is not a field at all
  — nothing extracts it, nothing reviews it, and the renderer emits the label
  with an empty value. Modelling it as an always-empty manual field would put a
  control in review that is never used; if that turns out to be wrong it becomes
  a manual field with no other change.

The warnings filter treats the first two the same: empty is not a failure.
Only the third needs no filtering, because it is never empty.

The «участник ЭДО» GUID in the owner's notes belongs to a different workflow and
is not a field of this form.

### D6 — `/api/fill` branches; no new route

For `format: "html"` the route returns `application/json` with the rendered
document as a string; for `xlsx` it keeps returning the binary attachment. One
route means one guard, one authorization check and one history write. A separate
`/api/render` would duplicate all three to gain a content type.

History (`lib/db/fills.ts#createFill`) records the fill exactly as today — the
rendered HTML is not stored, only the values it was rendered from, which is what
lets a fill be re-rendered later if the skeleton changes.

### D7 — The enum gains a value; nothing is backfilled

`template_format` gains `html` via `ALTER TYPE … ADD VALUE` in a Drizzle
migration, and one seed row is inserted for the ED template (`userId = null`,
`fileKey = null`, `format = 'html'`). Existing rows are untouched, so the
migration is additive and the rollback is "stop offering the template" rather
than a data change.

## Risks / Trade-offs

- **Our HTML drifts from what the editor accepts.** navi's TinyMCE config can
  change in the company repo without us noticing, and the failure is silent —
  the paste just looks wrong. → The editor's accepted subset is declared in our
  template, not assumed in the renderer, and a test asserts the skeleton stays
  inside it. Verification includes one manual paste into the real editor; that
  step cannot be automated from here and is named in `verification.md` as the
  owner's.

- **Extraction quality on «Паспорт» is unproven.** PT's fields are mostly
  invoice header facts; the ED form wants judgement — an argued case for the
  counterparty, a payment schedule in prose. → The reference set is the owner's
  own documents in `~/Downloads` (about 30 contracts, invoices and
  specifications, several with matching «Счёт + Договор + Смета» triples). The
  baseline snapshot fixes the count and the sample used, and the same sample is
  re-run at verification.

- **The per-run note is a prompt-injection surface only against its own
  author.** It is the user's own text in their own run, bounded in length; the
  value is worth it. Third-party document text is the real untrusted input and
  was already trusted into the prompt before this change; nothing here widens
  that.

- **Two output shapes on one route.** `/api/fill` returning either binary or
  JSON is a mild smell. → The branch is on the template's stored format, not on
  anything the client sends, so a client cannot choose the shape.

- **`cell` now means two things.** Named in D3 and left as a follow-up; the
  spec's boundary rule keeps the two kinds from being confused at runtime even
  while the name is wrong.

## Migration Plan

1. Drizzle migration adds `html` to `template_format`. Additive; no backfill.
2. Seed the ED template row. Guarded by `id = 'ed'` so re-running is a no-op.
3. Ship the skeleton, catalog and renderer. Until step 2 runs, no one can select
   the template, so the code path is dark.
4. Rollback: soft-delete the row (`deleted_at`). The enum value stays — Postgres
   does not drop enum values, and an unused one is harmless.

## Open Questions

- **Whether «Инициатор» should be offered in review.** Deferred by the owner
  («проверим потом»). It ships as a blank label completed in the editor; turning
  it into a manual field later changes the catalog entry and nothing else.
- **Where the rendered document should be re-openable from.** History stores the
  values, so an old fill could re-render on demand. Whether the history row
  offers that is a later UI decision and changes nothing here.
- **Whether user-authored HTML templates ever arrive.** Out of scope
  (`proposal.md` — Non-goals); if they do, the skeleton would move from the repo
  to Blob and `fileKey` would carry it. The format column and the renderer are
  already shaped for that.
