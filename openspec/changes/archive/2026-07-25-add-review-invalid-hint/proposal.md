## Why

An invalid amount or date on the Review step gets a red input border and a row
tint, and no explanation. The `2026-07-02` review-UX design promised an
"invalid value" string in `lib/seed/pt.ts`; it was never added, and the 2026-07-23
UI review logged the gap twice — once as missing copy, once as an accessibility
defect: `aria-invalid` is never set and the label is not associated with the
input, so **invalidity is carried by colour alone**.

The 2026-07-25 UAT made it concrete. The operator filled «Срок оплаты» correctly,
the row stayed red, and nothing on screen accounted for it. The cause turned out
to be an over-strict date rule, since fixed — but the next legitimately invalid
value will be exactly as silent.

## What Changes

- `lib/review/validate.ts` inverts its contract: a new `invalidReason(kind, value)`
  returns `"amount" | "date" | null`, and `isValidValue` becomes derived from it.
  One source of truth, so a red border without a reason — or a reason without a
  border — cannot occur.
- The Review row renders a cause-specific message directly beneath the offending
  input when its attention is `invalid`.
- The input exposes `aria-invalid` and points at the message through
  `aria-describedby`, and its visible label is associated with it, so invalidity
  is no longer a colour-only signal.
- Two new bilingual keys, `review_invalid_amount` and `review_invalid_date`,
  named so the component composes the key from the reason token.

Validation stays advisory: the hint never blocks confirm or fill.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fill-pipeline`: the "Review with advisory validation" requirement gains the
  per-field reason and the assistive-technology contract. It currently states that
  a flagged row is tinted, and is silent on whether the user is told why.

## Non-goals

- Explaining the `required` or `low` attentions. Each already has a signal: `low`
  shows a Confidence pill in the same row, `required`-empty shows an empty input
  plus the summary banner naming the missing fields. `invalid` is the only state
  where the value looks filled, the row is red, and nothing accounts for it.
- Blocking confirm or fill on an invalid value.
- Validating kinds beyond `amount` and `date`.
- A summary list of invalid fields at the top of the step. It does not conflict
  with this design and can be added later, but it does not fix the per-field gap.
- Repurposing `hint_ru`/`hint_en` from `lib/extract/fields.ts` — those are prompt
  instructions for the LLM (`lib/extract/llm/prompt.ts`), never user-facing.

## Impact

- `lib/review/validate.ts` — reason function; `isValidValue` derived.
- `components/review/ReviewStep.tsx` — records the reason in the pass that already
  builds `attnById`; it is the only component holding both `ef.kind` and the live
  value, since `PtField` carries no `kind`.
- `components/review/FieldRow.tsx` — renders the hint; label becomes `<label htmlFor>`.
- `components/review/FieldInput.tsx` — `id`, `aria-invalid`, `aria-describedby`.
- `lib/seed/pt.ts` — two bilingual keys.
- Tests in `lib/review/validate.test.ts` and `lib/i18n.test.ts`; the
  `app/theme-tokens.test.ts` and `app/i18n-leaks.test.ts` guards must stay green.
- No API, database, or extraction changes.

Full design, including the correction it makes to the 2026-07-02 spec:
`../docs/superpowers/specs/2026-07-25-review-invalid-hint-design.md`.
