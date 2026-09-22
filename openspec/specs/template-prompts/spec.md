# template-prompts Specification

## Purpose
Makes the extraction instruction a property of the template rather than a
constant in the extraction code, so that each document kind states its own
rules — tone, defaults, house conventions — and so a person can add
run-specific context that no supplier document contains.

## Requirements

### Requirement: The template owns its extraction instruction
A template SHALL carry its own instruction text, and extraction SHALL compose
that text with the shared prompt mechanics — the per-field lines, the response
shape, the document text. The shared mechanics SHALL NOT name any particular
document kind; a statement that applies to one template only SHALL live in that
template's instruction.

#### Scenario: Two templates, two instructions
- **WHEN** the same source document is extracted once for the payment-request template and once for the order-passport template
- **THEN** each run sends its own template's instruction and neither sends the other's

#### Scenario: Template without an instruction
- **WHEN** a template carries no instruction text — as a freshly scanned user template does
- **THEN** extraction runs on the shared mechanics alone and succeeds

### Requirement: The instruction reaches every model path
The template's instruction SHALL be applied identically on every extraction
path — hosted models, the parallel race across free models, a user's own keyed
model, and a local runtime — so that switching models changes accuracy and cost
but never the rules the model is given.

#### Scenario: Local model
- **WHEN** a local model is selected for a template that carries an instruction
- **THEN** the prompt sent to the local runtime contains that instruction

### Requirement: Per-run clarifying context
Before extraction the user SHALL be able to supply a free-text note for that run,
and the system SHALL include it in the prompt, marked as the user's own context
and distinct from the template's instruction. The note SHALL apply to that run
only and SHALL NOT be stored as part of the template.

#### Scenario: Naming the project
- **WHEN** the user notes "закупка по проекту 1905, класс расхода ПРОЕКТЫ/1905/Мебель" and starts extraction
- **THEN** the extracted values reflect that context, and a later run without the note does not

#### Scenario: No note
- **WHEN** the user leaves the note empty
- **THEN** the prompt contains no user-context section

### Requirement: A field can declare the run note as its source
A template SHALL be able to declare that a field is answered from the user's run
note rather than from the source documents. Such a field SHALL be asked of the
model together with the others, and the model SHALL be told that this field's
answer comes from the user's context and that an absent answer is to be left
empty rather than inferred from the documents.

#### Scenario: Internal classification from the note
- **WHEN** the user notes "закупка по проекту 1905, мебель" and runs an order passport
- **THEN** «Класс расхода» is answered from that note

#### Scenario: Nothing in the note
- **WHEN** the note says nothing about the classification
- **THEN** «Класс расхода» comes back empty rather than guessed from the supplier's contract

### Requirement: A field can be chosen from a fixed list
A template SHALL be able to declare that a field's value is chosen by the person
from a fixed list of options. Such a field SHALL be excluded from the model's
field list, SHALL be presented in review as a choice, and SHALL reject a value
outside its list at the same boundary that validates field lists.

#### Scenario: Responsible officer
- **WHEN** the review step is reached for an order passport
- **THEN** «ЦФО» is offered as a choice among the three department heads, labelled by department, not as free text

#### Scenario: Value outside the list
- **WHEN** a request carries a value for such a field that is not one of its options
- **THEN** the request is rejected with 400 and a localized message

### Requirement: Fields the documents cannot answer do not raise warnings
A field answered from the run note or chosen from a list SHALL NOT be reported as
a low-confidence extraction failure when it is empty, so that extraction warnings
keep meaning "the documents did not say".

#### Scenario: Warnings stay meaningful
- **WHEN** a run completes with only note-sourced and chosen fields empty
- **THEN** no extraction warning is raised about them

### Requirement: Instruction text is validated at the boundary
Any instruction text arriving from a client SHALL be validated before it reaches
a prompt: bounded in length and rejected if it is not text. An instruction that
fails validation SHALL cause the request to be refused with a localized message
rather than being truncated or silently dropped.

#### Scenario: Oversized instruction
- **WHEN** a request carries an instruction longer than the permitted bound
- **THEN** the request is rejected with 400 and a localized message, and no extraction runs
