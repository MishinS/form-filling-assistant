## Why

The app already does everything this task needs except the last step. Upload →
parse (PDF/XLSX/DOCX with locators) → rules+LLM extraction → human review is
template-agnostic today: `extractFields()` takes `fields: ExtractField[]` as a
parameter (`lib/extract/extract.ts:33`). Only the output is hard-wired to a
workbook — `lib/fill/values.ts` turns reviewed values into `CellWrite[]` and
`lib/fill/xlsx.ts` writes them into sheet XML.

The owner's actual daily job ends somewhere else. He assembles an «Электронный
документ» in navi's TinyMCE editor — a «Паспорт Заказа и договора» — from the
same contracts, invoices and quotes the app already reads. Today he does it by
hand: open the supplier's PDF, retype the subject, the counterparty, the amount
and the payment schedule into the editor, keep the house colors right. The
source template he works from (`~/Downloads/Шаблон ЭД.txt`, CP1251) is literally
an extraction prompt with a worked example stapled to it: a list of twelve
mandatory sections, the rule that missing sections get a default, the two brand
colors, and a constant («ФИО инициатор» is always «Мишин С. С.»).

So the gap is one renderer and one prompt, not a service. Building this as a
standalone project would re-implement document parsing, the OpenRouter race,
BYOK key storage, the local-model bridge, accounts and history to gain nothing.

## What Changes

- **A template can render to HTML instead of a workbook.** `templates.format`
  gains `html` alongside `xlsx`/`docx` (`lib/db/schema.ts:4`). An HTML template
  carries a skeleton with named slots rather than a `fileKey` pointing at a
  workbook; a new `lib/render/` module substitutes reviewed values into it and
  returns a string. Nothing about upload, parse, extract or review changes.

- **The built-in «Паспорт Заказа и договора» template ships with the app**, next
  to PT: a field catalog of the twelve mandatory sections and the HTML skeleton
  that reproduces the owner's layout — the grey `#8592a6` header band, the
  single-column table, section labels in `#00aeef`, values in `#1f364d`.

- **Field addressing stops meaning "cell".** `ExtractField.cell` holds
  `"ПТ!D9"` today (`lib/extract/fields.ts`); for an HTML template the same
  column names a slot in the skeleton. The field stays a string in the database,
  so this is a widening of meaning, not a migration of shape — but the name is
  now wrong for half its users and the spec says so.

- **The extraction prompt becomes template-owned.** `buildExtractionPrompt()`
  opens with «Извлеки значения полей для российского "Платёжного требования"»
  and closes with our own-company rule (`lib/extract/llm/prompt.ts:20-27`) — all
  of it PT-specific, all of it applied to every template including user-scanned
  ones. A template gains its own instruction text, and the builder composes it
  with the shared mechanics (JSON shape, per-field lines, the document text).
  The ED template's instruction is the header of the owner's own template file,
  moved verbatim into data.

- **The documents line lists what the passport is based on.** The form opens with
  «Заказ |  |  |  |» — a row of the source documents' names, which the owner
  later turns into navi links by hand. The renderer emits the extracted document
  titles separated by `|` and keeps a trailing separator, so the manual step has
  somewhere to land. The count follows the upload, not the four blanks in the
  example.

- **Some fields are answered by the person, not by the documents.** «Класс
  расхода» is derived from the run note the user writes («закупка по проекту
  1905, мебель»), never from a supplier document. «ЦФО» is chosen from the three
  department heads. Neither is a low-confidence extraction failure, and the form
  must not report them as one.

- **The signature row is one line of three parts, in order**: «Запустил» always
  carries «Мишин С. С.»; «Инициатор» is deliberately left blank for the owner to
  complete by hand in the editor, like the document links; «ЦФО» is one of
  Суровцев (Развитие), Вознесенская (Мед. департамент) or Субханкулова
  (Фин. департамент). This replaces the example's «ФИО инициатор / ФИО ЦФО»
  pair and overrides the template file's instruction to always write
  «Мишин С. С.» into the initiator — that constant now belongs to «Запустил».

- **Defaults for absent sections come from the field catalog, not the model.**
  The ED template requires a section to appear even when the documents say
  nothing about it («стандартные условия» for penalties, «Мишин С. С.» for
  «Запустил»). `fillMode: "constant"` with `constantValue` already does exactly this
  (`lib/extract/fields.ts`), and the extraction pass already skips constants.

- **The wizard's final step offers the rendered HTML** for an HTML template —
  preview plus copy — where an XLSX template offers a download. The owner pastes
  it into the editor himself.

## Non-goals

- **No changes to navi.** The company repo is read-only here; the contract is
  one-directional — we emit HTML that navi's editor accepts on paste. In
  particular we do not add a navi screen, a navi API call, or an ED template
  entry in navi's own «Список шаблонов ЭД» (`modals/PageTemplates`).
- **No automated insertion into the editor.** No browser extension, no
  clipboard automation, no navi session. A human pastes.
- **No user-authored HTML templates in this change.** The LLM template scan
  (`lib/templates/scan.ts`) stays XLSX-only; the ED template is built-in like
  PT. Generalizing template creation to HTML is a later change if it is ever
  wanted.
- **No HTML in batch mode.** `batch-processing` keeps producing a ZIP of
  workbooks; a batch of pasteable HTML documents has no use we can name.
- **No OCR.** Scanned-only PDFs stay as weak as they are for PT — the existing
  `scannedPages` warning covers it.
- **No payment-schedule sheet.** The ED «Паспорт» states payment stages as
  prose in one section; `lib/fill/schedule.ts` and its «График оплат» sheet
  belong to PT and are not reused.

## Capabilities

### New Capabilities

- `html-render`: turning a template's HTML skeleton plus reviewed values into a
  document string that survives the target editor's paste filter — slot
  substitution, per-field inline formatting, escaping, and the element/attribute
  subset the editor keeps.
- `template-prompts`: per-template extraction instructions — where a template's
  own guidance lives, how it composes with the shared prompt mechanics, and what
  happens to a template that has none.

### Modified Capabilities

- `templates`: gains the `html` format, the built-in ED template alongside PT,
  and the widened meaning of a field's address (cell reference or skeleton
  slot).
- `fill-pipeline`: the terminal step branches on template format — workbook
  download for `xlsx`, rendered HTML for `html` — while upload, parse, extract
  and review stay single-path.

## Impact

- **Database**: `template_format` enum gains `html` (Drizzle migration).
  `templates.fileKey` stays null for built-in HTML templates, whose skeleton is
  repo-bundled like `lib/fill/templates/pt.xlsx`.
- **New code**: `lib/render/` (skeleton parse, slot substitution, editor-subset
  escaping) with co-located Vitest tests; the ED field catalog and skeleton
  under `lib/render/templates/`.
- **Changed code**: `lib/extract/llm/prompt.ts` (template-owned instruction),
  `lib/extract/fields.ts` (address semantics, ED catalog), `app/api/fill/route.ts`
  (format branch), the wizard's done step, `lib/db/schema.ts`.
- **Untouched**: `lib/parse/`, `lib/extract/llm/openrouter.ts`, the local-model
  path (`run-local-extract.ts`), `lib/crypto/`, accounts, history. The OpenRouter
  race, Gemini, BYOK and Ollama/LM Studio all work for the ED template on day
  one because extraction never learns which template it is serving.
- **External contract** (navi, read-only): the editor is configured with
  `schema: 'html5'` and
  `extended_valid_elements: 'a[href|target=_self|style],+@[data-options],table[style,border],…'`
  (`components/TextEditor/tinyMCE/tinyMCEInit.ts:59`), a fixed font-size list
  (`8px 10px 12px 14px 18px 24px 36px`), and a paste handler that strips every
  `id` attribute before insertion (`components/TextEditor/lib/paste.ts:22`).
  The UUID ids in the owner's example file are therefore noise we must not
  reproduce. `#00AEEF`, `#1F364D` and `#8592A6` are all in the editor's own
  palette (`tinyMCE/tinyMCEColors.ts`).
