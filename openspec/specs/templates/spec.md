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
`parseFieldList()` (`lib/templates/validate.ts`) and cell addresses with
`validateCellRef` before using them for extraction or fill.

#### Scenario: Malformed field payload
- **WHEN** an API receives a field list that fails validation
- **THEN** the request is rejected with 400 and a localized message

### Requirement: Per-user field mappings
The system SHALL store per-user field-to-cell mappings keyed by
`user_id + template_id` (`template_mappings`), editable in the mapping editor
(`components/templates/MappingEditor.tsx`) and applied to that user's fills.

#### Scenario: Mapping override
- **WHEN** a user saves a custom cell address for a field
- **THEN** subsequent fills of that template by that user write to the new cell
