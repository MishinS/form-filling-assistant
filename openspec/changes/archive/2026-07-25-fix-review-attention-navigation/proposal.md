## Why

Found in manual UAT on 2026-07-25. The Review step's needs-attention affordance
is unusable in the only case that matters: the header button never advances past
the first flagged row, and a row flagged solely for low confidence can never be
cleared, so the "N needs check" counter never reaches zero. Fields the extractor
did not return at all get `conf: "low"` by construction (`lib/review/rows.ts` —
`conf: v?.confidence ?? "low"`), so the rows the user must fill by hand are
exactly the rows that stay tinted after being filled. The two defects compound:
because the first flagged row is typically an unclearable low-confidence one, the
button appears frozen on a single field.

Both defects predate the four changes awaiting archive (the classifier arrived in
`fa20598`/`1afa75c`/`764a57e`); `fix-theme-tokens` touched these files for colour
tokens only.

## What Changes

- The header "К следующему →" button walks the flagged rows instead of restarting
  from the top. Navigation continues from the currently focused field when focus
  is inside the table, and from the start otherwise. `ReviewStep.tsx:64` passes a
  hardcoded `null`, which resolves to `from = -1` on every click;
  `nextAttentionIndex` already steps and wraps correctly and is unchanged.
- A field becomes "reviewed" when the user edits its value **or** presses Enter on
  it ("looked, it is correct"). Reviewed state suppresses **only** the `low`
  attention.
- `invalid` and `required` stay live: they are recomputed from the current value on
  every render and reappear if the user clears or corrupts a value, regardless of
  reviewed state. Precedence `invalid > required > low` is preserved.
- The needs-attention counter and the tint both fall away as rows are reviewed, so
  the counter can reach zero and the button terminates.
- Advisory date validation stops contradicting the fill layer. `lib/fill/values.ts`
  deliberately writes an unparseable date value verbatim ("otherwise write verbatim
  text"), but `lib/review/validate.ts` flagged that same value `invalid` forever.
  Validation now judges only values that *attempt* a numeric calendar date, so a
  typo like `31.02.2026` is still caught while free-form terms — the normal content
  of «Срок оплаты» (`f10`, `kind: "date"`, e.g. "14 календарных дней") — are
  accepted. Found in UAT: a correctly filled «Срок оплаты» stayed red permanently,
  because `invalid` is deliberately not dismissible by review.
- The needs-attention count, a missing-required count, and the next-field button
  are pinned to the top of the wizard's scroll container. The button was previously
  reachable only by scrolling back to the top of a long field list.

No change to the extraction payload, the fill request, or the persisted values —
reviewed state is ephemeral Review-step UI state.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fill-pipeline`: the "Review with advisory validation" requirement gains the
  navigation-cursor and reviewed-clears-low behaviour. Today it specifies only
  that Enter moves to the next needs-attention field and that a flagged row is
  tinted; it is silent on how the flag is dismissed and on the button's cursor,
  which is what allowed both defects.

## Non-goals

- The missing "why is this invalid" hint in Review (a known UI-review gap,
  promised by the review-UX spec) — separate change; this one does not add
  explanatory copy. Narrowing the date rule removes the false positive that made
  the gap acute, but a genuinely invalid value still gives no reason.
- Reworking `f10`'s `kind`. It stays `"date"` so a real date still fills as a
  serial; only the advisory rule changes.
- Recomputing or persisting confidence after a user edit. `conf` stays frozen
  extraction metadata; only its use as an attention trigger becomes dismissible.
- Marking a row reviewed on focus alone — that would let repeated button clicks
  clear every flag without the user reading anything.
- Any change to `nextAttentionIndex`, `attentionOf`'s precedence, or
  `lib/review/validate.ts`.

## Impact

- `components/review/ReviewStep.tsx` — navigation cursor, reviewed set, wiring,
  pinned status bar.
- `lib/review/validate.ts` — date rule narrowed to values attempting a calendar date.
- `lib/seed/pt.ts` — one new bilingual key for the compact missing-required count.
- `components/review/FieldRow.tsx`, `FieldInput.tsx` — Enter already reaches
  `onEnter`; it must additionally mark the row reviewed.
- `lib/review/attention.ts` — `attentionOf` gains a reviewed input; a new pure
  helper resolves the navigation cursor.
- New/extended co-located tests in `lib/review/` per the repo convention that
  logic lives in pure modules rather than React rendering tests.
- No API, database, or i18n-key changes.
