## ADDED Requirements

### Requirement: Registered users can edit the order-passport template for themselves
A registered user SHALL be able to edit the built-in order-passport template in
three independent layers — its fields, its extraction instruction and its HTML
skeleton — and the edits SHALL apply to that user only. Field edits SHALL cover
labels, hints, the required flag, the default value, the constant value, the
options of a choice field and the slot mode from the renderer's closed set, and
SHALL include adding and removing fields. Field properties that inject raw markup
into the output SHALL NOT be editable; markup SHALL be changed only through the
skeleton. Guests SHALL NOT be offered the editor and SHALL NOT be able to save
edits.

#### Scenario: Opening the editor
- **WHEN** a registered user chooses to edit the order-passport template in the gallery
- **THEN** an editor opens showing the fields, the instruction and the skeleton currently in effect for that user

#### Scenario: Adding a department head
- **WHEN** the user adds a fourth option to «ЦФО» and saves
- **THEN** the user's next review of an order passport offers four options, and other users still see three

#### Scenario: Guest
- **WHEN** a guest opens the template gallery or sends a save request for the order-passport template
- **THEN** no edit action is shown, and the save request is refused with 403 and a localized message

#### Scenario: Markup through a field is refused
- **WHEN** a save request carries a field with a paragraph wrapper or list separator
- **THEN** that markup is not stored; only the repository catalog can set it for a field

### Requirement: Skeleton editing with live preview
The skeleton layer SHALL be edited as HTML text next to a read-only preview that
renders the current draft with placeholder values for every field, and that
isolates the draft from the application — the draft's scripts SHALL NOT run and
its styles SHALL NOT affect the application. The editor SHALL offer to insert
the slot token of any field at the cursor.

#### Scenario: Renaming a section
- **WHEN** the user changes the text «Штрафы, пени по договору» in the skeleton
- **THEN** the preview shows the new label without saving

#### Scenario: Inserting a slot
- **WHEN** the user picks a field in the slot helper
- **THEN** that field's slot token is inserted at the cursor and the preview shows the field's placeholder in that place

### Requirement: The three layers are validated as one template
The system SHALL refuse to save a user's version of the order-passport template
unless the combination of its effective fields, instruction and skeleton is a
valid template: every slot the skeleton declares SHALL be addressed by exactly
one field, every field that addresses a slot SHALL address one the skeleton
declares, no slot SHALL appear twice, the skeleton SHALL stay within the
destination editor's accepted subset (allowed elements and attributes, no `id`,
font sizes from the editor's list), and the instruction SHALL satisfy the
instruction bound. The editor SHALL show the reason before saving, and the
server SHALL re-check on save and reject an invalid combination with 400 and a
localized message naming the problem.

#### Scenario: Slot without a field
- **WHEN** the user adds `<!--slot:delivery-->` to the skeleton but no field addresses `delivery`
- **THEN** save is disabled with a message naming `delivery`, and a direct save request is rejected with 400

#### Scenario: Field without a slot
- **WHEN** the user removes a section's slot from the skeleton but keeps its field
- **THEN** save is disabled with a message naming that field

#### Scenario: Element the editor would drop
- **WHEN** the skeleton contains an element, attribute or font size outside the destination editor's subset
- **THEN** save is disabled with a message naming it

#### Scenario: Oversized instruction
- **WHEN** the instruction exceeds the permitted length
- **THEN** save is disabled and a direct save request is rejected with 400 and a localized message

### Requirement: Each layer returns to its default independently
Each layer SHALL be restorable to the repository default on its own, and the
whole template SHALL be restorable at once. A layer the user has not changed, or
has restored, SHALL follow the repository default, including later changes to
that default. A layer the user has saved SHALL stay as saved until the user
restores it.

#### Scenario: Restoring only the skeleton
- **WHEN** the user has edited fields and skeleton, then restores the skeleton to default and saves
- **THEN** the fields stay as edited and the skeleton is the repository one — provided the combination is valid, otherwise save is refused as for any invalid combination

#### Scenario: Restoring everything
- **WHEN** the user restores the whole template
- **THEN** the user's next run of an order passport uses the repository fields, instruction and skeleton

#### Scenario: Untouched layer follows a new release
- **WHEN** the user has edited only the instruction and a release changes the repository skeleton
- **THEN** the user's next rendered passport uses the new repository skeleton with the user's instruction

### Requirement: The user's version is the one that runs
For a registered user, every step that uses the order-passport template —
the review form, extraction on every model path including a local model, and
the rendered document — SHALL use that user's effective template: each layer
the user saved, otherwise the repository default. The fields and skeleton used
to render the document SHALL be taken from the stored template, never from the
fill request. Guests SHALL always get the repository template. A stored version
that no longer passes validation SHALL NOT produce a document; the user SHALL
get a localized message suggesting to restore the default, not a server error.

#### Scenario: Edited instruction reaches the model
- **WHEN** the user has saved an instruction and runs extraction with a hosted model or a local model
- **THEN** the prompt contains the user's instruction and not the repository one

#### Scenario: Edited skeleton reaches the document
- **WHEN** the user has saved a skeleton with a renamed section and completes a run
- **THEN** the rendered passport shows the renamed section

#### Scenario: Markup in the fill request is ignored
- **WHEN** a fill request for the order-passport template carries fields or markup in its body
- **THEN** the document is rendered from the stored template and the request's fields and markup have no effect

#### Scenario: Stored version became invalid
- **WHEN** the user's stored skeleton fails validation at fill time
- **THEN** no document is produced and the user sees a localized message suggesting to restore the default

## MODIFIED Requirements

### Requirement: Per-user field mappings
The system SHALL store per-user template customizations keyed by
`user_id + template_id` (`template_mappings`), applied to that user's runs. For
workbook templates the customization is the field-to-cell mapping, edited in the
mapping editor (`components/templates/MappingEditor.tsx`). For the built-in
order-passport template it is up to three independent layers — fields,
instruction and skeleton — each of which MAY be absent, an absent layer meaning
the repository default.

#### Scenario: Mapping override
- **WHEN** a user saves a custom cell address for a field
- **THEN** subsequent fills of that template by that user write to the new cell

#### Scenario: Partial customization
- **WHEN** a user saves only an instruction for the order-passport template
- **THEN** the stored customization holds the instruction alone and the fields and skeleton in effect are the repository defaults
