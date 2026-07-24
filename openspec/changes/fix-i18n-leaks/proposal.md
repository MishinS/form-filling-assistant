## Why

`lib/seed/pt.ts` is a strong bilingual copy contract — ~270 RU/EN keys with
cause-differentiated errors and action-specific CTAs — but eight user-facing
strings never reach it. An English user is shown «стр.», «скан» and «платная»;
a Russian user is shown the theme toggle's English `aria-label`; the batch footer
reuses a *heading* key as a count label and renders «3 Добавленные файлы»; the
files counter says «5 файла» because it only knows one plural form; and the
sources/settings empty states are inlined bilingual ternaries, one of which
advertises team and integrations features that do not exist in the product.

## What Changes

- **Seven new keys** in `lib/seed/pt.ts`: `files_count` (a real count label),
  `pages_short`, `scanned_short`, `upload_ok`, `paid_model`, `theme_toggle`, and
  `sources_empty_sub`; plus the three plural forms `files_one` / `files_few` /
  `files_many`.
- **Every leaking site reads a key**: `BatchModal` footer count,
  `Dropzone` («стр.» / «скан» / `OK`), `FillDetail` («стр.»),
  `ModelSelect` and `RaceList` («платная»), `ThemeToggle` (`aria-label` + `title`),
  and `EmptyState`, which switches to `nav_sources` / `sources_empty_sub` and
  `nav_settings` / `settings_subtitle` — the last one replacing the copy that
  promised non-existent features.
- **Russian plurals are computed, not guessed**: a pure `lib/plural.ts` picks the
  `one` / `few` / `many` form (`1 файл`, `3 файла`, `5 файлов`), collapsing to
  singular/plural for English. `RecentRow` uses it.
- **A regression guard is added**: `app/i18n-leaks.test.ts` fails when a component
  contains a Cyrillic string that is neither inside a bilingual conditional nor a
  comment — i.e. exactly the shape of a string that cannot follow the language.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `accounts`: the theme/accent/language personalization capability gains a
  requirement that every user-facing string — visible text and accessible names
  alike — resolves through the bilingual dictionary for the active language, with
  grammatically correct plural forms.

## Non-goals

- **Root-layout metadata and `<html lang>`** stay Russian-only. Localizing them
  means reading the language cookie in `app/layout.tsx`, which opts the whole tree
  (including the static landing page) into dynamic rendering — a rendering-strategy
  decision, not a copy fix. The guard carries this as a single documented
  exemption so the gap stays visible.
- **Bilingual inline ternaries are not migrated** to `STR` keys (`ModelSelect`,
  `MiniSheet`, `SourceChip`, `MappingEditor`, `DoneStep`, `TemplateGallery`).
  They are a pattern break, not a leak — they render correctly in both languages —
  and rewriting ~10 files changes nothing a user sees.
- **The missing "invalid value" review hint** (also flagged by the audit) is a new
  UI affordance, not a leaking string; it belongs with review-UX work.
- `EmptyState`'s `kind="settings"` branch has no call site today; it is corrected
  rather than deleted, since removing it is a separate judgement call.

## Impact

- **Code:** `lib/seed/pt.ts` (+10 keys), new `lib/plural.ts`,
  `components/batch/BatchModal.tsx`, `components/wizard/Dropzone.tsx`,
  `components/dashboard/{FillDetail,RecentRow}.tsx`,
  `components/shell/{ModelSelect,ThemeToggle,EmptyState}.tsx`,
  `components/wizard/RaceList.tsx`.
- **Tests:** new `lib/plural.test.ts` and `app/i18n-leaks.test.ts`.
- **Copy visible to RU users** changes in three places: the batch footer count
  («Файлов: 3» instead of «3 Добавленные файлы»), the upload chip (`OK` → «Готово»),
  and the settings empty state (now matching `settings_subtitle`).
- **APIs / deps / data:** none.
