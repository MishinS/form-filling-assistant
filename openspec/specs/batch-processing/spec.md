# batch-processing

## Purpose

Throughput mode: fill one template from many source files in a single run,
producing a ZIP of filled workbooks. Implemented in `components/batch/BatchModal.tsx`,
`lib/batch/{run-batch,run-one,extract-result,zip}.ts`.

## Requirements

### Requirement: Sequential per-file pipeline
The system SHALL process batch files sequentially, running the full
upload → parse → extract → fill pipeline per file (`lib/batch/run-one.ts`),
and SHALL continue with remaining files when one file fails
(`lib/batch/run-batch.ts`).

#### Scenario: One file fails
- **WHEN** file 2 of 5 fails at any pipeline stage
- **THEN** files 3–5 are still processed and the failure is reported per-file

### Requirement: Terminal-result NDJSON parsing
The system SHALL consume the extraction NDJSON stream in throughput mode by
parsing only the terminal `result` event per file (`lib/batch/extract-result.ts`),
ignoring intermediate race events. The parser is the trust boundary for that
stream and SHALL validate the shape of a `result` event before accepting it: an
event whose `values` is not an array MUST be treated as malformed and skipped
rather than returned, and the remaining fields MUST be normalized (`warnings` to
an array, `llmFailed` to a boolean, `usedModel` to a string or `null`). The
parser MUST NOT return a result whose declared array fields are absent.

#### Scenario: Stream with race noise
- **WHEN** the extract stream emits attempt events before `result`
- **THEN** the batch adapter resolves with the terminal result only

#### Scenario: Malformed result event
- **WHEN** the terminal `result` event carries no `values` array (missing, `null`,
  or a non-array value)
- **THEN** the parser skips it and reports no result, so the file fails at the
  extraction boundary instead of being filled with undefined values

#### Scenario: Partial result event
- **WHEN** a valid `result` event carries `values` but omits `warnings`,
  `llmFailed`, or `usedModel`
- **THEN** the returned result exposes an empty `warnings` array, `llmFailed`
  `false`, and `usedModel` `null`

### Requirement: ZIP packaging of outputs
The system SHALL package successfully filled workbooks into a single ZIP
(`lib/batch/zip.ts` using fflate), sanitizing entry names and de-duplicating
collisions. De-duplication SHALL guarantee that no filled workbook is dropped:
every input entry MUST appear as a distinct entry in the resulting ZIP, even
when a sanitized source name collides with a name generated for an earlier
collision. The de-duplication MUST therefore check the **final** candidate name
against names already placed in the archive and keep advancing the suffix until
an unused name is found.

#### Scenario: Duplicate output names
- **WHEN** two source files would produce the same output filename
- **THEN** the ZIP contains both entries with de-duplicated names

#### Scenario: Source name collides with a generated dedup name
- **WHEN** the source files are named `report`, `report`, and `report (2)`
- **THEN** the ZIP contains three distinct entries and no entry is overwritten
  or lost

#### Scenario: Entry count is preserved
- **WHEN** N filled workbooks are packaged, for any combination of names
- **THEN** the resulting ZIP contains exactly N entries

### Requirement: Batch UI entry and progress
The system SHALL expose batch mode from the sidebar, with a modal offering
template selection, multi-file input, per-file progress, and a final ZIP
download (`components/batch/BatchModal.tsx`), with RU/EN strings. The modal
SHALL protect batch results from accidental loss: while a batch is running it
MUST NOT be dismissable by a backdrop click or the header close control, and
when a finished batch still has downloadable results that have not been saved,
dismissal MUST require explicit user confirmation.

The modal SHALL also keep its controls truthful about failures:
- A failure while saving the ZIP MUST be reported to the user, and the batch
  MUST NOT be marked as saved unless the save succeeded.
- A failure to load a template's field mapping MUST be surfaced to the user and
  MUST NOT be cached as "this template has no fields"; re-selecting the template
  MUST retry the load, so a transient failure cannot leave the Run control
  permanently disabled without explanation.
- The running state MUST always be left when a batch settles, however it settles.

#### Scenario: Completed batch
- **WHEN** all files finish processing
- **THEN** the modal offers the ZIP download and shows per-file success/failure

#### Scenario: Backdrop click during a running batch
- **WHEN** the user clicks the backdrop (or the close control) while a batch is
  running
- **THEN** the modal stays open and the batch continues uninterrupted

#### Scenario: Dismissing a finished batch with unsaved results
- **WHEN** a batch has finished with at least one downloadable result and the
  user attempts to dismiss the modal without downloading
- **THEN** the user is asked to confirm before the modal closes and the results
  are discarded

#### Scenario: ZIP save fails
- **WHEN** writing the ZIP fails (for example, the desktop save target is not
  writable)
- **THEN** the user is shown an error and the results still count as unsaved, so
  dismissing the modal still asks for confirmation

#### Scenario: Template field mapping fails to load
- **WHEN** the mapping request for a selected template fails or returns a
  non-ok response
- **THEN** the modal shows a load error instead of a silently disabled Run
  button, and selecting that template again retries the request

#### Scenario: Batch settles unexpectedly
- **WHEN** the batch run terminates by an unexpected rejection rather than
  normal completion
- **THEN** the modal leaves the running state and its controls become usable
  again

### Requirement: Localized per-file failure reporting
Per-file batch failures SHALL be raised as stable, machine-readable codes
(optionally carrying the originating HTTP status) rather than prose, and SHALL
be translated for display at render time so that both locales get a message in
their own language. The UI MUST NOT render an unrecognized failure payload
verbatim: any error it cannot decode MUST fall back to the generic failure
label, so a raw response body (an HTML proxy error page, a JSON blob, or any
other unbounded server output) can never reach the batch UI.

#### Scenario: Fill step fails with an error page
- **WHEN** the fill request fails and the response body is an HTML error page
- **THEN** the per-file row shows the localized fill-failure message with the
  status code, and none of the response body is displayed

#### Scenario: English locale
- **WHEN** a file fails at any pipeline stage while the UI language is English
- **THEN** the per-file error message is shown in English

#### Scenario: Unrecognized failure
- **WHEN** a file fails with an error that does not carry a known code
- **THEN** the per-file row shows the generic failure label
