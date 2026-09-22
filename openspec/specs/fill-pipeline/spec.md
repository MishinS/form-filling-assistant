# fill-pipeline

## Purpose

The core single-document flow: a user uploads invoice/contract/quote files, the
system parses them, extracts template fields with a rules + LLM pipeline,
lets the user review and correct values, then fills the template XLSX and
records the fill in history. Implemented across `components/wizard/`,
`app/api/{parse,extract,fill,fills}/route.ts`, and `lib/{parse,extract,review,fill}/`.

## Requirements

### Requirement: Source file upload
The system SHALL upload source documents directly from the client to Vercel Blob
via client-token exchange (`app/api/blob/upload/route.ts`), accepting only
PDF/XLSX/DOCX files up to 20 MB each.

#### Scenario: Accepted file
- **WHEN** a user drops a PDF, XLSX, or DOCX file of 20 MB or less into the wizard
- **THEN** the file is uploaded to Vercel Blob and its URL enters the parse step

#### Scenario: Rejected file type
- **WHEN** a user provides a file of another type or over the size cap
- **THEN** the upload is refused and the wizard shows a localized error

### Requirement: Document parsing with locators
The system SHALL parse each uploaded blob into a `ParsedDoc` — normalized text
blocks with locators (PDF → page, XLSX → sheet+cell, DOCX → paragraph) plus
`scannedPages` flags and warnings (`lib/parse/index.ts`).

The parse endpoint SHALL fetch only URLs belonging to the application's own blob
store. Because the endpoint is reachable by an anonymous guest session, a
user-supplied URL is untrusted input: the system MUST validate every URL in a
request against the store allowlist **before** issuing any request, and MUST
reject the whole request with `400` when any of them fails, so that no
attacker-chosen host — internal service, link-local metadata endpoint, or
arbitrary external server — is ever contacted on the caller's behalf. Rejection
MUST NOT depend on whether the response would be parseable.

#### Scenario: Successful parse
- **WHEN** `/api/parse` receives blob URLs of supported documents
- **THEN** it returns `ParsedDoc[]` with text blocks, locators, and page counts

#### Scenario: Guest source cleanup
- **WHEN** a guest session parses uploaded sources
- **THEN** the blobs are deleted from storage immediately after parsing

#### Scenario: URL outside the blob store
- **WHEN** a request contains a source URL on any other host, or a non-`https`
  scheme, or a literal IP address
- **THEN** the request is rejected with `400`, no outbound request is made, and no
  blob is deleted

#### Scenario: One foreign URL among valid ones
- **WHEN** a request mixes valid blob URLs with one URL outside the store
- **THEN** the whole request is rejected and none of the valid URLs are fetched

### Requirement: Field extraction via rules then LLM
The system SHALL extract template fields in a fixed order: (1) regex rules pass
(`lib/extract/rules.ts`) for fields with `strategy: "rule"`, (2) LLM pass for
`strategy: "llm"` fields via the model selected in `lib/extract/llm/registry.ts`,
(3) empty placeholders for anything unresolved. LLM failure SHALL NOT fail the
request — extraction returns `{ llmFailed, warnings, values }`.

#### Scenario: LLM unavailable
- **WHEN** no LLM provider is configured or all attempts fail
- **THEN** the response still contains rule-extracted values and empty
  placeholders, with `llmFailed` set, and the UI offers retry / switch model /
  continue without LLM

#### Scenario: Model routing
- **WHEN** the selected model id is `gemini*`, contains `/`, is `custom:<id>`, or is a local runtime slug
- **THEN** extraction uses the Gemini adapter, OpenRouter race, BYOK
  OpenAI-compatible adapter, or the desktop local bridge respectively

### Requirement: Extraction progress streaming
The system SHALL stream extraction progress as NDJSON events
(`attempt`, `attempt-fail`, `attempt-win`, `result`) from `/api/extract`, and the
desktop local-model path SHALL emit the same event protocol in the webview so
one client consumer (`components/wizard/Processing.tsx`) handles both.

#### Scenario: Race progress
- **WHEN** the OpenRouter free-pool race runs during extraction
- **THEN** the client receives per-model attempt events and renders live race UI

### Requirement: Review with advisory validation
The system SHALL present extracted values for editing before fill, with
advisory (non-blocking) validation for amount/date fields
(`lib/review/validate.ts`) and a needs-attention classifier with next-field
navigation (`lib/review/attention.ts`); Enter moves to the next
needs-attention field.

Needs-attention navigation SHALL advance through the flagged rows rather than
returning to the first one: each step resolves its starting point from the
currently focused field when focus is inside the review table, and from before
the first row otherwise. This applies to both the header button and Enter.

A field SHALL become reviewed when the user edits its value or presses Enter on
it. Reviewed state SHALL suppress the `low` attention only. The `invalid` and
`required` attentions SHALL be recomputed from the current value on every render
and SHALL reappear when a value is cleared or made invalid, regardless of
reviewed state; the precedence `invalid > required > low` is unchanged. Reviewed
state is ephemeral Review-step UI state and SHALL NOT be persisted or sent to
`/api/fill`.

Advisory date validation SHALL judge only values that attempt a numeric calendar
date; any other non-empty value SHALL be accepted, matching the fill layer, which
already writes an unparseable date value verbatim rather than rejecting it.

The needs-attention count, the count of empty required fields, and the next-field
control SHALL remain visible while the field list scrolls.

A row flagged `invalid` SHALL state the cause in text beside the field, in the
active locale, distinguishing an unparseable amount from an impossible calendar
date. The cause SHALL be derived from the same evaluation that produces the
`invalid` flag, so a flagged row always carries a cause and an unflagged row never
shows one. Rows flagged `required` or `low` SHALL NOT show this text.

Invalidity SHALL NOT be conveyed by colour alone: the control SHALL expose
`aria-invalid` when flagged, the cause text SHALL be reachable from the control
through `aria-describedby`, and every review control SHALL be associated with its
visible label.

#### Scenario: Low-confidence value
- **WHEN** an extracted value has low confidence or fails advisory validation
- **THEN** the row is tinted/flagged as needs-attention but the user can still proceed

#### Scenario: Reviewing a low-confidence field clears it
- **WHEN** the user edits the value of a row flagged only for low confidence, or
  presses Enter on it without editing
- **THEN** the row loses its needs-attention tint and the needs-attention count
  decreases by one

#### Scenario: Emptying a required field re-flags it
- **WHEN** the user clears the value of a required field they had already reviewed
- **THEN** the row is flagged `required` again despite being reviewed

#### Scenario: Free-form payment term is not flagged
- **WHEN** the user enters a period such as "14 календарных дней" into a
  `date`-kind field like «Срок оплаты»
- **THEN** the value is accepted, the row is not flagged `invalid`, and the fill
  writes the text verbatim

#### Scenario: Impossible calendar date is still flagged
- **WHEN** the user enters "31.02.2026" into a `date`-kind field
- **THEN** the row is flagged `invalid`, and reviewing the row does not clear it

#### Scenario: An invalid amount says why
- **WHEN** the user enters "12ab" into an `amount`-kind field
- **THEN** the row shows the amount-specific cause beneath the field, distinct from
  the date message, and the fill is still allowed to proceed

#### Scenario: An invalid date says why
- **WHEN** the user enters "31.02.2026" into a `date`-kind field
- **THEN** the row shows the date-specific cause beneath the field

#### Scenario: A valid value shows no cause
- **WHEN** a field holds a valid value, an empty value, or a value of a kind that
  is not validated
- **THEN** no cause text is shown for that row

#### Scenario: Invalidity is perceivable without colour
- **WHEN** a row is flagged `invalid`
- **THEN** its control reports `aria-invalid` and references the cause text through
  `aria-describedby`, so assistive technology announces both the state and the
  reason

#### Scenario: Status and navigation stay reachable
- **WHEN** the user scrolls down a long field list on the Review step
- **THEN** the attention count, the missing-required count, and the next-field
  button stay pinned at the top of the scroll area

#### Scenario: Navigation advances and terminates
- **WHEN** the user repeatedly triggers next-field navigation
- **THEN** focus moves to a different flagged row each time rather than staying on
  the first one, and once every row has been reviewed the needs-attention count
  reaches zero and the navigation affordance is gone

### Requirement: Template fill and export
The system SHALL produce the final artifact according to the template's format.
For a workbook template it SHALL fill the target XLSX by writing cell values
directly into the template workbook via OOXML zip surgery (`lib/fill/xlsx.ts`) —
the built-in PT template from the repo file `lib/fill/templates/pt.xlsx`, user
templates from their Blob-stored files — and return the result as a binary
attachment; on desktop the bytes SHALL be saved through the Tauri `save_file`
command instead of a browser download. For an HTML template it SHALL render the
template's skeleton with the reviewed values and return the document as text for
the user to copy, with no file written on either web or desktop.

#### Scenario: Web export
- **WHEN** the user confirms reviewed values in the browser
- **THEN** `/api/fill` returns the filled workbook as a download

#### Scenario: HTML template
- **WHEN** the user confirms reviewed values for an HTML template
- **THEN** the rendered document is returned as text and no download or file save occurs

#### Scenario: Desktop, HTML template
- **WHEN** an HTML template is completed in the desktop app
- **THEN** the document is offered for copying and the Tauri save path is not used

### Requirement: Fill history persistence
The system SHALL record completed fills (fill + source files + extracted
values) atomically via `db.batch()` (`lib/db/fills.ts#createFill`), fire-and-forget
from the done step. Guests SHALL have no history written.

#### Scenario: History after fill
- **WHEN** an authenticated non-guest user completes a fill
- **THEN** a history entry appears in `/fills` with its source files and values

#### Scenario: DB unreachable
- **WHEN** the history write fails
- **THEN** the export itself is unaffected (degrade, never crash)
