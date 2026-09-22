## MODIFIED Requirements

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
