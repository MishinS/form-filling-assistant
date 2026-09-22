## ADDED Requirements

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

## MODIFIED Requirements

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
