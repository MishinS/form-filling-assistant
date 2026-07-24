## 1. ZIP dedup — no dropped files

- [x] 1.1 Write failing test `lib/batch/zip.test.ts` reproducing the collision:
  `zipOutputs` on entries named `report`, `report`, `report (2)` must yield 3
  distinct entries; assert `Object.keys` count == input count. **Test:**
  `lib/batch/zip.test.ts` (red).
- [x] 1.2 Add an "entry count preserved" case to `lib/batch/zip.test.ts`: for a
  mix including sanitized-name collisions, entry count == input count, and the
  original bytes are retrievable per entry (via `unzipSync`). **Test:**
  `lib/batch/zip.test.ts` (red).
- [x] 1.3 Fix `lib/batch/zip.ts` to de-duplicate on the **final** entry name
  (advance suffix with a `while (name in files)` loop until unused) instead of a
  base-name counter. **Test:** `lib/batch/zip.test.ts` (green) + existing
  duplicate-name behavior still passes.

## 2. Batch modal — protect a live / unsaved batch

- [x] 2.1 Add `batch_discard_confirm` RU + EN strings to `lib/i18n`. **Test:**
  manual — both locales resolve the key (no raw key shown); `npx tsc --noEmit`.
- [x] 2.2 In `components/batch/BatchModal.tsx` add a `saved` flag set true on a
  successful `download()`, and a `requestClose()` that: no-ops while `running`;
  else `confirm(t("batch_discard_confirm"))` when `doneItems` has a downloadable
  result and `!saved`; else calls `onClose`. Route the backdrop `onClick` and the
  header ✕ through `requestClose`. **Test:** manual — (a) backdrop click while
  running keeps modal open + batch continues; (b) backdrop click after finish
  with undownloaded results prompts confirm; (c) after Download, backdrop click
  closes without prompt.
- [x] 2.3 Verify no regression to normal open/close of the pre-run modal
  (backdrop click before any run closes immediately). **Test:** manual smoke.

## 3. Verification

- [x] 3.1 Run the batch suite green: `npx vitest run lib/batch`. **Test:**
  `lib/batch/*.test.ts` all pass.
- [x] 3.2 Typecheck + lint clean: `npx tsc --noEmit` and `npm run lint`. **Test:**
  both exit 0.
