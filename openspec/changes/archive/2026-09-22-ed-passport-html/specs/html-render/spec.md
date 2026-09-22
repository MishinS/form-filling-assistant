## Purpose

Produces the finished document as an HTML string that a person pastes into an
external rich-text editor, in place of a filled workbook. The capability owns
the skeleton-plus-slots contract, the formatting of each value, and the
element/attribute subset the destination editor is known to keep.

## ADDED Requirements

### Requirement: Skeleton with named slots
An HTML template SHALL consist of a skeleton document plus a field catalog whose
addresses name slots in that skeleton. Rendering SHALL replace every slot with
the reviewed value for the field addressed to it and SHALL leave the rest of the
skeleton — tables, labels, colors, spacing — byte-identical to the shipped
source.

#### Scenario: Every slot is filled
- **WHEN** a template with N addressed slots is rendered from a complete set of reviewed values
- **THEN** the output contains no slot markers and each value appears at its slot

#### Scenario: Unknown address
- **WHEN** a field's address names a slot that the skeleton does not contain
- **THEN** rendering is refused with a typed error naming the field, and no partial document is returned

### Requirement: A section always appears
Rendering SHALL emit every section of the skeleton even when its field has an
empty value, so the document's structure never varies with what the source
documents happened to contain. A field carrying a constant SHALL render that
constant; a field with neither value nor constant SHALL render its section with
an empty value rather than dropping the section.

#### Scenario: Nothing found for a section
- **WHEN** extraction and review leave «Штрафы, пени по договору» empty and the field declares no constant
- **THEN** the rendered document still contains that labelled section, with an empty value after the label

#### Scenario: Constant section
- **WHEN** a field declares a constant value
- **THEN** that constant is rendered regardless of what the source documents said

### Requirement: Output restricted to the editor's accepted subset
Rendered HTML SHALL be confined to the elements and attributes the destination
editor preserves, as declared by the template: outside that subset nothing is
emitted. The renderer SHALL NOT emit `id` attributes, because the destination
editor strips them on paste and re-assigns its own. Inline font sizes SHALL come
from the editor's configured size list; a template requesting a size outside that
list SHALL be rejected when the template is loaded, not silently rendered.

#### Scenario: Pasted document survives unchanged
- **WHEN** the rendered HTML is pasted into the destination editor
- **THEN** the visible result matches the rendered document — no element, attribute, or color is dropped or rewritten

#### Scenario: Template declares an unsupported size
- **WHEN** a template's skeleton uses a font size the editor does not offer
- **THEN** loading that template fails with a typed error rather than producing a document the editor will rewrite

### Requirement: Values are escaped, never interpreted
Extracted values originate in third-party documents and pass through a language
model, so they are untrusted. The renderer SHALL escape every value as text
before substitution: markup in a value SHALL appear as visible characters and
SHALL NOT become elements, attributes, or links in the output. Where a template
declares a slot that emits a link, the renderer SHALL emit only `mailto:` and
`tel:` targets built from the value, and SHALL fall back to plain text for
anything else.

#### Scenario: Markup inside a supplier document
- **WHEN** an extracted value contains `<script>` or an `onclick` attribute
- **THEN** the rendered document shows those characters as text and contains no such element or attribute

#### Scenario: Contact e-mail
- **WHEN** the counterparty contact value contains an e-mail address
- **THEN** the rendered document links it with a `mailto:` target

#### Scenario: Hostile URL in a value
- **WHEN** a value contains a `javascript:` URL
- **THEN** it is rendered as plain text and no link is emitted

### Requirement: Multi-line values keep their structure
A value that a person entered or corrected as several lines SHALL render as
several paragraphs inside its slot, preserving the template's own paragraph
formatting. Line breaks SHALL NOT collapse into one run of text.

#### Scenario: Payment stages
- **WHEN** the payment-terms value holds four lines — total, advance, second and third payment
- **THEN** the rendered section shows four separate paragraphs in the template's formatting

### Requirement: A list value renders as a separated row
A template SHALL be able to declare a slot whose value is a list, and the
renderer SHALL emit the list items separated by the template's declared
separator, ending with a trailing separator so that a person can extend the row
by hand after pasting. An empty list SHALL render the row with its separator and
no items rather than collapsing it.

#### Scenario: Three source documents
- **WHEN** an order passport is rendered from a contract, an invoice and a cost estimate
- **THEN** the documents row shows the three titles separated by the declared separator and ends with one more separator

#### Scenario: Item count follows the upload
- **WHEN** five source documents were uploaded
- **THEN** the documents row holds five items, not the number the shipped example happened to show

### Requirement: The document is delivered as text, not a file
For an HTML template the system SHALL present the rendered document to the user
as copyable text with a preview of its rendered appearance, instead of a binary
download. Copying SHALL place the HTML source on the clipboard, because the
destination is an editor that accepts pasted markup.

#### Scenario: Finishing an HTML fill
- **WHEN** the user confirms reviewed values for an HTML template
- **THEN** the done step shows a preview and a copy action, and no file download is offered

#### Scenario: Clipboard unavailable
- **WHEN** the browser refuses clipboard access
- **THEN** the HTML source is shown in a selectable text area with a localized explanation
