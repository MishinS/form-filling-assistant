## ADDED Requirements

### Requirement: Bilingual UI copy
Every user-facing string the UI renders SHALL resolve through the bilingual
dictionary (`lib/seed/pt.ts` via `lib/i18n`) for the active language. This
includes strings that are not visible prose: accessible names, titles, and unit
or status abbreviations. A component MUST NOT hardcode a string in one language,
and MUST NOT reuse a key whose wording belongs to a different role (a heading
used as a count label), because both render as wrong copy in at least one locale.

Counts SHALL use the plural form the active language requires: Russian
distinguishes the `one`, `few`, and `many` forms, so a count label MUST select
among them rather than assume a single plural.

Strings a component renders through an explicit per-language conditional are
compliant — they cannot leak — but the dictionary is the preferred home.

#### Scenario: English user sees no Russian
- **WHEN** the UI language is English
- **THEN** every rendered label, abbreviation, and accessible name is English

#### Scenario: Russian user sees no English
- **WHEN** the UI language is Russian
- **THEN** accessible names and titles are Russian too, not just visible prose

#### Scenario: Russian count agreement
- **WHEN** a count label renders 1, 3, and 5 files in Russian
- **THEN** it reads «1 файл», «3 файла», and «5 файлов»

#### Scenario: A newly hardcoded string is rejected
- **WHEN** a component introduces a Cyrillic string that is neither inside a
  per-language conditional nor a comment
- **THEN** the localization guard fails
