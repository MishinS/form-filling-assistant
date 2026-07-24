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
collisions.

#### Scenario: Duplicate output names
- **WHEN** two source files would produce the same output filename
- **THEN** the ZIP contains both entries with de-duplicated names

### Requirement: Batch UI entry and progress
The system SHALL expose batch mode from the sidebar, with a modal offering
template selection, multi-file input, per-file progress, and a final ZIP
download (`components/batch/BatchModal.tsx`), with RU/EN strings.

#### Scenario: Completed batch
- **WHEN** all files finish processing
- **THEN** the modal offers the ZIP download and shows per-file success/failure
