## 1. Classifier: reviewed suppresses low

- [x] 1.1 Extend `lib/review/attention.test.ts` first, red against the current
  classifier: a `conf: "low"`, valid, filled field with `reviewed: true` returns
  `null`; the same field with `reviewed: false` returns `"low"`. **Test:**
  `npx vitest run lib/review/attention.test.ts` — red before task 1.2
  (`expected null, received "low"`).
- [x] 1.2 Add a required `reviewed: boolean` to `attentionOf`'s input in
  `lib/review/attention.ts` and gate only the `low` branch on it; leave the
  `invalid` and `required` branches and the precedence order untouched.
  **Test:** the task 1.1 cases go green.
- [x] 1.3 Assert reviewed does **not** mask the live flags: a reviewed field with
  an empty required value returns `"required"`, and a reviewed field with an
  unparseable amount returns `"invalid"`. **Test:**
  `lib/review/attention.test.ts` — new cases green.
- [x] 1.4 Update the two pre-existing `attentionOf` cases in the same file for the
  new required field, keeping their original intent (precedence, and null for a
  valid filled high-confidence field). **Test:** whole file green.

## 2. Navigation cursor

Task 2.1 as originally written was abandoned during implementation: reading
`document.activeElement` in the button's click handler cannot work, because
clicking a `<button>` focuses the button, so the lookup resolves to `-1` and
reproduces the bug. The cursor stores a field id in a ref instead, and no
element→index helper is needed — see the revised decision in `design.md`.

- [x] 2.1 ~~Pure element→index helper.~~ Dropped. Replaced by 2.3; the pure
  surface stays `attentionOf` + `nextAttentionIndex`. **Test:** a regression case
  in `lib/review/attention.test.ts` pins the cursor contract — an advancing cursor
  visits `[1, 3, 4, 1]` while the old hardcoded `-1` yields `[1, 1, 1]`.
- [x] 2.2 In `components/review/ReviewStep.tsx`, make `focusNext`'s argument
  optional and default it to the cursor, so the header button calls `focusNext()`
  and Enter keeps passing its explicit row id. **Test:** `npx tsc --noEmit` + lint
  clean; behaviour → task 4.1.
- [x] 2.3 Hold the last focused field id in a `useRef` and update it from an
  `onFocus` threaded `ReviewStep` → `FieldRow` → `FieldInput` (which already had a
  focus handler for its border). Programmatic `.focus()` fires the same event, so
  the cursor self-maintains. **Test:** `npx tsc --noEmit` clean; behaviour → 4.1.

## 3. Marking rows reviewed

- [x] 3.1 Hold a `Set<string>` of reviewed field ids in `ReviewStep` state and
  feed membership into the `attentionOf` call that builds `attnById`. **Test:**
  `npx tsc --noEmit` clean; behaviour → task 4.1.
- [x] 3.2 Mark a row reviewed when its value changes (in the `onChange` passed to
  `FieldRow`) and when Enter fires on it (in `onEnter`, before `focusNext`).
  **Test:** `npx tsc --noEmit` + lint clean; behaviour → task 4.1.
- [x] 3.3 Confirm the attention count and tint both read from the same
  `attnById`, so a reviewed row drops out of the counter, the tint, and the
  navigation order together. **Test:** code read — `attentionCount`, the
  `FieldRow` tint, and `focusNext`'s row mapping all derive from `attnById`.

## 4. Date validation matches the fill layer

Added after UAT: a correctly filled «Срок оплаты» stayed red permanently.

- [x] 4.1 Extend `lib/review/validate.test.ts` red-first: free-form terms
  ("14 календарных дней", "по факту поставки", "до 31.12.2026", "Июль 2026") are
  valid for `date`. **Test:** `npx vitest run lib/review/validate.test.ts` — red
  before 4.2 (`expected false to be true`).
- [x] 4.2 In `lib/review/validate.ts`, judge a `date` value only when it matches a
  numeric-date shape; otherwise accept. **Test:** the 4.1 cases go green.
- [x] 4.3 Keep the impossible-date catch and move `"xx"` to the accepted list with
  a comment on why. **Test:** `31.31.2026`, `2026-13-01`, `45.01.2026`,
  `31.02.2026` still rejected.

## 5. Pinned status bar

- [x] 5.1 Add a bilingual `review_required_n` key for the compact
  missing-required count. **Test:** `app/i18n-leaks.test.ts` green (no Cyrillic
  leaks into the component).
- [x] 5.2 In `ReviewStep`, split the heading from a `position: sticky` bar holding
  the attention count, the missing-required count, and the next-field button;
  leave the itemised warning blocks in flow. **Test:**
  `app/theme-tokens.test.ts` green (tokens only, no colour literals);
  `npx tsc --noEmit` + lint clean; behaviour → task 6.1.

## 6. Verification

- [ ] 6.1 Manual UAT in the running app (needs a live session with a document
  whose extraction leaves low-confidence or unreturned fields):
  (a) fill a hand-entered field → the tint clears and the counter decreases;
  (b) press Enter on a low-confidence field without editing → same;
  (c) clear a required field afterwards → it is flagged again;
  (d) click "К следующему →" repeatedly → focus lands on a different flagged row
  each time and wraps, instead of staying on the first;
  (e) review every row → the counter reaches zero and the button disappears;
  (f) enter a period into «Срок оплаты» → accepted, no red border; enter
  `31.02.2026` there → still flagged;
  (g) scroll the field list → counts and the button stay pinned at the top, in
  both themes and both locales.
- [x] 6.2 Full suite, typecheck, lint: `npx vitest run` → 78 files / 535 tests
  pass; `npx tsc --noEmit` exits 0; `npm run lint` reports 0 errors (the two
  pre-existing `<img>` warnings in `ProfileCard`/`Sidebar` only). Both guard
  suites green: `app/theme-tokens.test.ts`, `app/i18n-leaks.test.ts`.
- [x] 6.3 `npx openspec validate --strict fix-review-attention-navigation` → valid.
