## Context

Full design and its rationale live in
`../docs/superpowers/specs/2026-07-25-review-invalid-hint-design.md` (approved
2026-07-25). This file carries the decisions an implementer needs.

`attentionOf` classifies each row `invalid > required > low > null`;
`lib/review/validate.ts` decides `invalid` through a boolean `isValidValue`, which
discards the reason. `FieldRow` tints the row, `FieldInput` reddens the border, and
nothing says why. `FieldInput` sets no `aria-invalid` and the label in `FieldRow`
is a plain `<div>`, so the state reaches assistive technology as nothing at all.

Only `amount` and `date` are validated. Since 2026-07-25 the date rule judges only
values shaped like a numeric calendar date, so `date` has exactly one failure mode
and `amount` one — two causes total.

## Goals / Non-Goals

**Goals:**

- A cause-specific message beneath an invalid field, in the active locale.
- Invalidity perceivable without colour: `aria-invalid` plus `aria-describedby`.
- Every review control associated with its visible label.
- The reason and the flag provably cannot disagree.

**Non-Goals:**

- Explaining `required` or `low`; blocking fill on an invalid value; validating
  further kinds; a top-of-step summary of invalid fields; touching the
  `hint_ru`/`hint_en` prompt strings.

## Decisions

**The reason becomes primary and the boolean derived.** `invalidReason(kind, value)`
returns `"amount" | "date" | null`; `isValidValue` is `invalidReason(...) === null`.
*Alternative considered:* keep `isValidValue` and add a second function that
re-derives the cause. Rejected — two validators drift, and the UI could then show a
border with no message. Deriving means `attentionOf` needs no signature change
while both call sites funnel through one implementation.

**`ReviewStep` computes the reason, not `FieldRow`.** `PtField` carries no `kind`
(checked: `lib/seed/pt.ts:11`), so the row cannot evaluate the value itself.
`ReviewStep` already walks every row to build `attnById` with `ef.kind` and the
live value in hand; the reason is recorded in that same pass.
*Alternative considered:* add `kind` to `PtField`. Rejected — `buildRows` output is
a view model, and widening it to let a leaf re-run validation duplicates work the
parent already does.

**The reason travels as a token, not as localised text.** `FieldRow` already has
`useI18n` and composes `review_invalid_${reason}`. Keeps the key naming mechanical
and keeps `ReviewStep` out of the copy business.

**Ids are derived from `f.id`**, which is unique within the step: `rv-<id>` for the
control and `rv-<id>-err` for the message. No `useId` — the step never renders twice
on a page, and stable ids are easier to debug.

**Placement is beneath the input, inside the existing second grid column.**
*Alternatives considered:* a `title` tooltip — rejected, invisible on touch,
unreachable by keyboard, inconsistently announced, so it would restate the
colour-only problem; a summary list at the top — rejected as the sole fix, since it
leaves the control with nothing to reference, though it remains compatible as a
later addition.

## Risks / Trade-offs

- **The row grows by about one line when a hint appears** → Accepted. Reserving
  space permanently would put an empty strip under every field for a rare state.

- **Copy could drift from the reason tokens** → The union type makes the composed
  key unreachable-if-wrong in TypeScript, and `lib/i18n.test.ts` pins both keys in
  both locales so a rename cannot silently render the key itself.

- **`area` fields never show a hint** → Correct by construction: all three `area`
  fields are `kind: "text"` (checked: `f2`, `f9`, `f11`), which is never validated.
  The a11y attributes still apply to the `<textarea>` branch.

- **Guards could trip** → The hint colour must be `var(--bad)`, never a literal
  (`app/theme-tokens.test.ts`), and its Cyrillic must live in the dictionary, not
  the component (`app/i18n-leaks.test.ts`).
