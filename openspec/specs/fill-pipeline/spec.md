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

#### Scenario: Successful parse
- **WHEN** `/api/parse` receives blob URLs of supported documents
- **THEN** it returns `ParsedDoc[]` with text blocks, locators, and page counts

#### Scenario: Guest source cleanup
- **WHEN** a guest session parses uploaded sources
- **THEN** the blobs are deleted from storage immediately after parsing

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

#### Scenario: Low-confidence value
- **WHEN** an extracted value has low confidence or fails advisory validation
- **THEN** the row is tinted/flagged as needs-attention but the user can still proceed

### Requirement: Template fill and export
The system SHALL fill the target XLSX by writing cell values directly into the
template workbook via OOXML zip surgery (`lib/fill/xlsx.ts`) — the built-in PT
template from the repo file `lib/fill/templates/pt.xlsx`, user templates from
their Blob-stored files — and return the result as a binary attachment. On
desktop the bytes SHALL be saved through the Tauri `save_file` command instead
of a browser download.

#### Scenario: Web export
- **WHEN** the user confirms reviewed values in the browser
- **THEN** `/api/fill` returns the filled workbook as a download

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
