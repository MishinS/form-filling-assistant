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
ignoring intermediate race events.

#### Scenario: Stream with race noise
- **WHEN** the extract stream emits attempt events before `result`
- **THEN** the batch adapter resolves with the terminal result only

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
