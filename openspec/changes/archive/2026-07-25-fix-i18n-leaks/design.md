## Context

Localization here is deliberately minimal: `STR` in `lib/seed/pt.ts` maps a key
to `{ ru, en }`, `translate(key, lang)` falls back to `ru` and then to the key
itself, and `useI18n()` hands components a `t()` bound to the active language.
There is no interpolation and no plural machinery — by design, since the app has
two locales and a fixed vocabulary.

That design has one blind spot: nothing stops a component from typing a literal.
The audit found eight sites that did, in both directions (Russian shown to English
users; an English `aria-label` shown to Russian users), plus two structural
mistakes — the batch footer reusing the `files_added` *heading* as a count label,
and `RecentRow` hardcoding a two-form Russian plural where the language has three.

## Goals / Non-Goals

**Goals:**
- No user-visible string, including accessible names, is fixed to one language.
- Russian counts agree grammatically.
- The next hardcoded literal fails a test.

**Non-Goals:**
- Introducing an i18n framework or message interpolation.
- Migrating the existing bilingual ternaries to keys (they do not leak).
- Localizing root-layout metadata / `<html lang>` (rendering-strategy decision).

## Decisions

### Counts stay interpolation-free: label key + number at the call site

`t()` returns a plain string, and adding `{n}` placeholders would mean a format
function, an escaping story, and a migration of ~270 keys. Instead `files_count`
holds only the noun phrase («Файлов» / "Files") and the component renders
`` `${t("files_count")}: ${n}` ``. The colon form reads correctly in both languages
and sidesteps declension entirely — which is why it beats the audit's alternative
suggestion «Добавлено файлов: 3».

*Alternative considered:* a tiny `format(key, vars)` helper. Rejected for one call
site; if a second interpolated string appears, that is the moment to add it.

### Plurals: a pure `lib/plural.ts`, not a per-call ternary

```ts
export function pluralForm(n: number, lang: Lang): "one" | "few" | "many";
```

Russian: `n % 10 === 1 && n % 100 !== 11` → `one`; `n % 10` in 2–4 and `n % 100`
outside 12–14 → `few`; otherwise `many`. English collapses to `one` / `many`
(`few` is unreachable), so `files_few` and `files_many` share the English word.
Callers compose the key: `` t(`files_${pluralForm(n, lang)}`) ``. Keeping the rule
in `lib/` makes it unit-testable at the boundaries that actually break — 11, 21,
111 — which is exactly where the previous two-form ternary was wrong.

*Alternative considered:* `Intl.PluralRules`. It returns the right category, but
would still need the three keys and adds a runtime dependency on ICU data in the
Tauri webview for a rule that is four lines and fully testable.

### The `OK` chip becomes «Готово» in Russian

`upload_ok` is `{ ru: "Готово", en: "OK" }`, symmetric with the existing
`upload_failed` (`{ ru: "Ошибка", en: "Failed" }`). Leaving `OK` in both locales
would have been defensible — it is near-universal — but then the key exists only
to satisfy the guard, and the Russian UI already says «Готово» for this state
everywhere else (`batch_done`).

### `EmptyState` reuses existing keys instead of gaining new ones

Its headings duplicate `nav_sources` / `nav_settings` verbatim, and its settings
subtitle is a stale variant of `settings_subtitle` — the one that still promises
team and integrations. Reusing the existing keys removes the duplication and the
false promise in one move; only the sources subtitle needs a new key
(`sources_empty_sub`).

### The guard: Cyrillic outside a conditional or a comment

`app/i18n-leaks.test.ts` scans `app/**/*.tsx` and `components/**/*.tsx` for
Cyrillic and fails unless the line is one of:

- a comment (`//`, `/* … */`, ` * …`, or Cyrillic appearing after `//`),
- a per-language conditional (`lang === "ru" ? … : …`, or a `ru ? … : …` ternary) —
  provably cannot leak,
- a documented exemption: the `"ПТ!"` sheet reference and the `ПТ_…Ф15.xlsx`
  output filename (domain identifiers, not copy), and `app/layout.tsx`'s metadata
  description (the deferred rendering-strategy item).

The rule is not "no Cyrillic" but "no Cyrillic that cannot follow the language",
which is precisely the defect class. It mirrors the theme-token guard added in
`fix-theme-tokens`, so the two read as one family.

## Risks / Trade-offs

- **The guard only catches Russian leaks, not English ones** (a hardcoded English
  `aria-label` is invisible to a Cyrillic scan) → accepted: a scan for English
  literals cannot distinguish copy from identifiers, so it would be noise. The
  requirement covers both directions; the guard covers the mechanically detectable
  half.
- **A bilingual ternary passes the guard** even though the dictionary is preferred
  → intentional; the guard enforces the invariant users feel, and forcing the
  migration would balloon the change without changing any rendered pixel.
- **`upload_ok` and the batch footer change Russian copy** → both were flagged as
  defects by the audit; the wording follows the existing keys rather than inventing
  new voice.
