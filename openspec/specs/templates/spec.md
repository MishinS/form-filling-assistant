# templates

## Purpose

Template management: the built-in «Платёжное требование» (PT) template plus
user-created templates scanned from uploaded XLSX files, with per-user
field-to-cell mappings. Implemented in `components/templates/`,
`app/api/{templates,mappings}/route.ts`, `lib/templates/`, `lib/db/{templates,mappings}.ts`.

## Requirements

### Requirement: Built-in PT template
The system SHALL ship the PT (form PR-F15) template with its field catalog
(`PT_FIELDS` in `lib/extract/fields.ts`) and repo-bundled workbook
(`lib/fill/templates/pt.xlsx`), available to all users including guests.

#### Scenario: Guest template access
- **WHEN** a guest opens the wizard
- **THEN** only the PT template is offered

### Requirement: Template creation via LLM scan
The system SHALL create user templates by uploading an XLSX to Blob and
scanning it: sheet texts are extracted (`lib/templates/xlsx-scan.ts`) and free
models race to propose an `ExtractField[]` catalog
(`lib/templates/scan.ts#proposeFields`). On scan failure (typed codes
`llm` | `nofields`) the template SHALL NOT be created.

#### Scenario: Successful scan
- **WHEN** the scan proposes at least one fillable field
- **THEN** the template and its default mapping are persisted and appear in the gallery

#### Scenario: Scan failure
- **WHEN** all LLM attempts fail or no fields are found
- **THEN** no template row is created and the user sees a typed, localized error

### Requirement: Field list validation at every boundary
The system SHALL validate any client-supplied field list with
`parseFieldList()` (`lib/templates/validate.ts`) before using it for extraction
or output, and SHALL validate each field's address against the format of the
template it belongs to: a workbook template's address SHALL be a cell reference,
an HTML template's address SHALL be a slot name declared by that template's
skeleton. An address valid for one format SHALL be rejected for the other.

#### Scenario: Malformed field payload
- **WHEN** an API receives a field list that fails validation
- **THEN** the request is rejected with 400 and a localized message

#### Scenario: Cell reference on an HTML template
- **WHEN** a field list for an HTML template carries a spreadsheet cell reference as an address
- **THEN** the request is rejected with 400 and a localized message

#### Scenario: Slot name not in the skeleton
- **WHEN** a field list for an HTML template names a slot the skeleton does not declare
- **THEN** the request is rejected with 400 and a localized message

### Requirement: Per-user field mappings
The system SHALL store per-user field-to-cell mappings keyed by
`user_id + template_id` (`template_mappings`), editable in the mapping editor
(`components/templates/MappingEditor.tsx`) and applied to that user's fills.

#### Scenario: Mapping override
- **WHEN** a user saves a custom cell address for a field
- **THEN** subsequent fills of that template by that user write to the new cell

### Requirement: HTML template format
A template SHALL declare its format, and `html` SHALL be a format alongside
`xlsx` and `docx`. An HTML template SHALL carry a skeleton document instead of a
workbook file, and its fields SHALL address slots in that skeleton. The format
SHALL determine what the pipeline produces at the end and nothing else: upload,
parsing, extraction and review behave identically for every format.

#### Scenario: Gallery shows both kinds
- **WHEN** a user opens the template gallery
- **THEN** HTML and workbook templates are both listed, each showing what it produces

#### Scenario: Format drives only the output
- **WHEN** the same source documents are run against a workbook template and an HTML template with the same fields
- **THEN** the extracted and reviewed values are the same and only the final artifact differs

### Requirement: Built-in order-passport template
The system SHALL ship «Паспорт Заказа и договора» as a built-in HTML template
available to all users including guests, with its field catalog and its skeleton
bundled in the repository rather than stored per user. Its catalog SHALL contain
the twelve sections the form requires, in the order the form presents them, and
SHALL declare the constants the form mandates so they are never asked of a model.

#### Scenario: Guest access
- **WHEN** a guest opens the wizard
- **THEN** the order-passport template is offered alongside the payment-request template

#### Scenario: Mandated constants
- **WHEN** an order passport is rendered
- **THEN** «Запустил» carries its mandated constant without having been extracted

#### Scenario: Signature row
- **WHEN** an order passport is rendered
- **THEN** «Запустил», «Инициатор» and «ЦФО» appear on one line in that order, with «Инициатор» left blank for completion by hand
