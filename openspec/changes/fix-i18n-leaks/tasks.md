## 1. Plural rule

- [x] 1.1 Write failing `lib/plural.test.ts`: `pluralForm(n, "ru")` returns `one`
  for 1/21/101, `few` for 2/3/4/22/104, `many` for 0/5/11/12/13/14/25/111; for
  `"en"` returns `one` for 1 and `many` otherwise. **Test:** `lib/plural.test.ts` (red).
- [x] 1.2 Implement `lib/plural.ts` per the design rule. **Test:**
  `lib/plural.test.ts` — 4 cases green, including the audit's «1 файл» / «3 файла» /
  «5 файлов».

## 2. Dictionary keys

- [x] 2.1 Add to `lib/seed/pt.ts`: `files_count`, `pages_short`, `scanned_short`,
  `upload_ok`, `paid_model`, `theme_toggle`, `sources_empty_sub`, and the plural
  trio `files_one` / `files_few` / `files_many`. **Test:** `lib/plural.test.ts`
  ("has a files_* string for every form in both locales") + `lib/i18n.test.ts`
  ("resolves the keys that replaced hardcoded copy").

## 3. Replace the leaking literals

- [x] 3.1 `components/batch/BatchModal.tsx` footer: `${files.length} ${t("files_added")}`
  → `${t("files_count")}: ${files.length}`. **Test:** guard test + `npx tsc --noEmit`.
- [x] 3.2 `components/wizard/Dropzone.tsx`: «стр.» → `t("pages_short")`, «скан» →
  `t("scanned_short")`, the `OK` chip → `t("upload_ok")`. **Test:** guard + tsc.
- [x] 3.3 `components/dashboard/FillDetail.tsx`: «стр.» → `t("pages_short")`.
  **Test:** guard + tsc.
- [x] 3.4 `components/dashboard/RecentRow.tsx`: file count →
  `` `${n} ${t(`files_${pluralForm(n, lang)}`)}` `` (component gained `useI18n`);
  the `?? "файл"` glyph fallback → `"file"` (both map to the `FILE` glyph, so
  nothing rendered changes). **Test:** guard + tsc.
- [x] 3.5 `components/shell/ModelSelect.tsx` and `components/wizard/RaceList.tsx`:
  «платная» → `t("paid_model")` (RaceList gained `useI18n`). **Test:** guard + tsc.
- [x] 3.6 `components/shell/ThemeToggle.tsx`: `aria-label` → `t("theme_toggle")`,
  `title` → `t("set_theme")`. **Test:** guard + tsc.
- [x] 3.7 `components/shell/EmptyState.tsx`: headings → `t("nav_sources")` /
  `t("nav_settings")`, subtitles → `t("sources_empty_sub")` /
  `t("settings_subtitle")`, dropping the copy that promised team and integrations.
  **Test:** guard + tsc + the `settings_subtitle` assertion in `lib/i18n.test.ts`.

## 4. Regression guard

- [x] 4.1 Write `app/i18n-leaks.test.ts` first, against the un-migrated tree, so it
  reports exactly the leaking sites and none of the bilingual ternaries or comments
  (confirms the rule discriminates). **Test:** red before task 3 listing exactly the
  six Cyrillic leak lines (`FillDetail:41`, `RecentRow:12,24`, `ModelSelect:61`,
  `Dropzone:72`, `RaceList:25`) while ignoring every `lang === "ru" ? …` line and
  every Russian comment; green after.
- [x] 4.2 Document each exemption in the test with its reason: `"ПТ!"` sheet
  reference, the `ПТ_…Ф15.xlsx` filename, and `app/layout.tsx` metadata (deferred,
  see proposal non-goals). **Test:** covered by 4.1.

## 5. Verification

- [x] 5.1 Full suite, typecheck, lint: `npx vitest run` → 78 files / 521 tests
  pass; `npx tsc --noEmit` exits 0; `npm run lint` reports 0 errors (2 pre-existing
  `<img>` warnings).
- [x] 5.2 Confirm no key regressed: `lib/i18n.test.ts` asserts all 11 keys used by
  the touched components resolve in both locales (never returning the key itself).
- [x] 5.3 `npx openspec validate --strict fix-i18n-leaks` → valid.
- [ ] 5.4 Manual check in the running app (not performed — needs a live session):
  switch to English and walk dashboard → wizard → batch → settings looking for
  Russian; switch to Russian and check the theme toggle's tooltip and the batch
  footer count.
