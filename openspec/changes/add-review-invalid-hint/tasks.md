## 1. Reason as the primary contract

- [x] 1.1 Extend `lib/review/validate.test.ts` red-first for a not-yet-existing
  `invalidReason`: `"amount"` for `"abc"`, `"12ab"`, `"1.2.3"`; `"date"` for
  `"31.31.2026"`, `"2026-13-01"`, `"45.01.2026"`, `"31.02.2026"`; `null` for valid
  amounts, real dates, free-form terms, empty and whitespace values, and every
  `string`/`text` value. **Test:** `npx vitest run lib/review/validate.test.ts` —
  red before 1.2.
- [x] 1.2 In `lib/review/validate.ts`, add `export type InvalidReason = "amount" |
  "date"` and `invalidReason(kind, value)`, moving the existing amount and date
  rules into it unchanged (including the `looksLikeCalendarDate` narrowing).
  **Test:** the 1.1 cases go green.
- [x] 1.3 Redefine `isValidValue` as `invalidReason(kind, value) === null` and
  leave its signature alone. **Test:** every pre-existing `isValidValue` case in the
  same file still passes, proving the derived boolean did not drift.

## 2. Copy

- [x] 2.1 Add `review_invalid_amount` and `review_invalid_date` to `lib/seed/pt.ts`
  with the approved ru/en text. **Test:** `app/i18n-leaks.test.ts` green.
- [x] 2.2 Pin both keys in `lib/i18n.test.ts`: each resolves in `ru` and `en` and
  never returns the key itself. **Test:** `npx vitest run lib/i18n.test.ts`.

## 3. Wiring the reason to the row

- [x] 3.1 In `ReviewStep`, record the reason in the same pass that builds
  `attnById` (it already holds `ef.kind` and the live value) and pass it to
  `FieldRow` as a token. **Test:** `npx tsc --noEmit` clean; behaviour → 5.1.
- [x] 3.2 In `FieldRow`, accept `reason: InvalidReason | null` and render the
  message beneath `FieldInput` inside the same grid column when
  `attention === "invalid"`, coloured `var(--bad)`, keyed
  `review_invalid_${reason}`. **Test:** `app/theme-tokens.test.ts` green (token, not
  a literal); `npx tsc --noEmit` + lint clean.

## 4. Assistive-technology contract

- [x] 4.1 In `FieldInput`, accept `id` and `describedBy`; set `aria-invalid` when
  `invalid` and `aria-describedby` when a message is present. Apply to both the
  `<input>` and `<textarea>` branches. **Test:** `npx tsc --noEmit` + lint clean.
- [x] 4.2 In `FieldRow`, turn the label `<div>` into `<label htmlFor={inputId}>`,
  pass `rv-<f.id>` as the control id and `rv-<f.id>-err` as the message id, and
  give the message element that id. **Test:** `npx tsc --noEmit` + lint clean;
  behaviour → 5.1.

## 5. Verification

- [x] 5.1 Manual UAT in the running app — performed 2026-07-25 against a local dev
  server, walking the full wizard to the Review step. All checks below passed:
  (a) `12ab` in an amount field → the amount message appears beneath it;
  (b) `31.02.2026` in a date field → the date message, distinct from (a);
  (c) a valid value, an empty value, and a text/area field → no message;
  (d) switch locale → both messages follow;
  (e) confirm and fill still work with an invalid value present;
  (f) both themes → the message colour reads correctly against the row tint;
  (g) with a screen reader or the accessibility inspector, the control announces
  its label, its invalid state, and the reason.
- [x] 5.2 Full suite, typecheck, lint: `npx vitest run` → 78 files / 539 tests pass
  (up 4: three `invalidReason` cases and one i18n reason-key case); `npx tsc
  --noEmit` exits 0; `npm run lint` reports 0 errors (the two pre-existing `<img>`
  warnings in `ProfileCard`/`Sidebar` only). Both guards green:
  `app/theme-tokens.test.ts`, `app/i18n-leaks.test.ts`.
- [x] 5.3 `npx openspec validate --strict add-review-invalid-hint` → valid.
