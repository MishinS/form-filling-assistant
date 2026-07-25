## MODIFIED Requirements

### Requirement: Review with advisory validation
The system SHALL present extracted values for editing before fill, with
advisory (non-blocking) validation for amount/date fields
(`lib/review/validate.ts`) and a needs-attention classifier with next-field
navigation (`lib/review/attention.ts`); Enter moves to the next
needs-attention field.

Needs-attention navigation SHALL advance through the flagged rows rather than
returning to the first one: each step resolves its starting point from the
currently focused field when focus is inside the review table, and from before
the first row otherwise. This applies to both the header button and Enter.

A field SHALL become reviewed when the user edits its value or presses Enter on
it. Reviewed state SHALL suppress the `low` attention only. The `invalid` and
`required` attentions SHALL be recomputed from the current value on every render
and SHALL reappear when a value is cleared or made invalid, regardless of
reviewed state; the precedence `invalid > required > low` is unchanged. Reviewed
state is ephemeral Review-step UI state and SHALL NOT be persisted or sent to
`/api/fill`.

Advisory date validation SHALL judge only values that attempt a numeric calendar
date; any other non-empty value SHALL be accepted, matching the fill layer, which
already writes an unparseable date value verbatim rather than rejecting it.

The needs-attention count, the count of empty required fields, and the next-field
control SHALL remain visible while the field list scrolls.

A row flagged `invalid` SHALL state the cause in text beside the field, in the
active locale, distinguishing an unparseable amount from an impossible calendar
date. The cause SHALL be derived from the same evaluation that produces the
`invalid` flag, so a flagged row always carries a cause and an unflagged row never
shows one. Rows flagged `required` or `low` SHALL NOT show this text.

Invalidity SHALL NOT be conveyed by colour alone: the control SHALL expose
`aria-invalid` when flagged, the cause text SHALL be reachable from the control
through `aria-describedby`, and every review control SHALL be associated with its
visible label.

#### Scenario: Low-confidence value
- **WHEN** an extracted value has low confidence or fails advisory validation
- **THEN** the row is tinted/flagged as needs-attention but the user can still proceed

#### Scenario: Reviewing a low-confidence field clears it
- **WHEN** the user edits the value of a row flagged only for low confidence, or
  presses Enter on it without editing
- **THEN** the row loses its needs-attention tint and the needs-attention count
  decreases by one

#### Scenario: Emptying a required field re-flags it
- **WHEN** the user clears the value of a required field they had already reviewed
- **THEN** the row is flagged `required` again despite being reviewed

#### Scenario: Free-form payment term is not flagged
- **WHEN** the user enters a period such as "14 календарных дней" into a
  `date`-kind field like «Срок оплаты»
- **THEN** the value is accepted, the row is not flagged `invalid`, and the fill
  writes the text verbatim

#### Scenario: Impossible calendar date is still flagged
- **WHEN** the user enters "31.02.2026" into a `date`-kind field
- **THEN** the row is flagged `invalid`, and reviewing the row does not clear it

#### Scenario: An invalid amount says why
- **WHEN** the user enters "12ab" into an `amount`-kind field
- **THEN** the row shows the amount-specific cause beneath the field, distinct from
  the date message, and the fill is still allowed to proceed

#### Scenario: An invalid date says why
- **WHEN** the user enters "31.02.2026" into a `date`-kind field
- **THEN** the row shows the date-specific cause beneath the field

#### Scenario: A valid value shows no cause
- **WHEN** a field holds a valid value, an empty value, or a value of a kind that
  is not validated
- **THEN** no cause text is shown for that row

#### Scenario: Invalidity is perceivable without colour
- **WHEN** a row is flagged `invalid`
- **THEN** its control reports `aria-invalid` and references the cause text through
  `aria-describedby`, so assistive technology announces both the state and the
  reason

#### Scenario: Status and navigation stay reachable
- **WHEN** the user scrolls down a long field list on the Review step
- **THEN** the attention count, the missing-required count, and the next-field
  button stay pinned at the top of the scroll area

#### Scenario: Navigation advances and terminates
- **WHEN** the user repeatedly triggers next-field navigation
- **THEN** focus moves to a different flagged row each time rather than staying on
  the first one, and once every row has been reviewed the needs-attention count
  reaches zero and the navigation affordance is gone
