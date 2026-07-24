# accounts

## Purpose

Identity, access, and personalization: NextAuth v5 credentials auth (env users,
DB users, anonymous guests), invite-gated registration, user settings
(profile, password, avatar, BYOK models), and theme/accent/language
personalization. Implemented in `auth.ts`, `auth.config.ts`, `middleware.ts`,
`lib/auth/`, `app/api/{register,account,models}/`, `lib/{theme,accent,i18n}*`.

## Requirements

### Requirement: Edge/Node auth split
The system SHALL keep `auth.config.ts` free of Node-only imports (it is bundled
into Edge middleware); Credentials providers with `authorize()` logic SHALL
live only in `auth.ts`.

#### Scenario: Middleware gating
- **WHEN** an unauthenticated request hits an app page (matcher excludes `/api`,
  static assets, `/login`, `/register`, `/`)
- **THEN** the user is redirected to `/login`

### Requirement: Credential providers with fallback order
The system SHALL authenticate email/password against env `AUTH_USERS` first,
then DB users via bcrypt compare; DB failures SHALL NOT break env-user login
(degrade, never crash).

#### Scenario: DB down, env user logs in
- **WHEN** the database is unreachable and an `AUTH_USERS` account signs in
- **THEN** login succeeds

### Requirement: Guest as a first-class role
The system SHALL support anonymous guest sessions (`role: "guest"` on the JWT):
guests get the built-in PT template and default model only, their sources are
deleted after parse, no history or settings are persisted, and each API route
enforces these restrictions server-side.

#### Scenario: Guest tries a restricted API
- **WHEN** a guest calls an API reserved for full users (e.g. BYOK model CRUD)
- **THEN** the route returns 403 via `requireFullUser()`

### Requirement: API self-guarding
Every protected API route SHALL guard itself with `requireUser()` /
`requireFullUser()` from `lib/auth/guard.ts` (middleware excludes `/api`), and
SHALL NOT rely on bare `await auth()` truthiness.

#### Scenario: Unauthenticated API call
- **WHEN** a request without a session hits a protected route
- **THEN** the route returns a uniform 401 JSON response

### Requirement: Invite-gated registration
The system SHALL allow self-registration only when `INVITE_CODE` is set and the
submitted code matches; passwords are hashed with bcrypt.

#### Scenario: Registration closed
- **WHEN** `INVITE_CODE` is unset
- **THEN** `/api/register` rejects all registration attempts

### Requirement: BYOK custom models
The system SHALL let full users register OpenAI-compatible custom models with
their own API keys, stored AES-256-GCM-encrypted (`lib/crypto/secrets.ts`,
`user_models.key_cipher`), probed for connectivity on save, and SSRF-checked
(`assertSafeBaseUrl`, `redirect: "error"`) on every use.

#### Scenario: Unsafe base URL
- **WHEN** a stored or submitted base URL fails the safety check
- **THEN** the request is rejected and no outbound call is made

### Requirement: Theme, accent, and language personalization
The system SHALL persist theme, accent palette, and RU/EN language as cookies,
apply them pre-paint via the inline script in `app/layout.tsx`, persist accent
server-side for authenticated users (`user_accents`, guarded POST
`/api/account/accent`), and clear the accent cookie on sign-out. Accent colors
SHALL pass the luminance-based contrast guard (`lib/contrast.ts`).

Accent persistence SHALL be honest about failure: the client MUST inspect the
POST outcome and, when the change is not persisted (a non-2xx response or a
network error), MUST revert the optimistic accent (in-memory state, DOM
attribute, and cookie) to the previously persisted value and inform the user,
so that a local cookie never diverges from the stored value and no unsaved
choice survives to the next page load. The guarded accent API SHALL treat a
malformed or missing request body — including a JSON `null` body — as invalid
input and respond `400`, never a `500`.

#### Scenario: Accent across devices
- **WHEN** an authenticated user with a saved accent signs in elsewhere
- **THEN** the server-side accent seeds the UI before first paint

#### Scenario: Accent save fails
- **WHEN** the user selects an accent and the persistence POST returns a non-2xx
  response or the request errors
- **THEN** the selection reverts to the previously persisted accent and the user
  is shown an error notification, and no unsaved value remains in the cookie

#### Scenario: Malformed accent request body
- **WHEN** `POST /api/account/accent` receives a `null`, absent, or otherwise
  invalid body from an authenticated full user
- **THEN** the route responds `400` and persists nothing

### Requirement: Theme token discipline
Every themed color the UI renders SHALL resolve through a CSS custom property
that is defined in each theme block of `app/globals.css`, so that switching the
theme changes every semantic color. Components MUST NOT inline a color value
taken from one theme (a status hue, a surface tint, or hover feedback), because
such a value cannot follow the theme and silently renders wrong — or invisible —
in the other one. Status borders, status-pill fills, and hover feedback SHALL each
have a token, and every token's value SHALL be derived from the base color of the
theme block that defines it.

Color values that are deliberately theme-independent — modal scrims, black
shadows, and mask fills internal to an icon — are exempt, and the exemption SHALL
be enumerated rather than assumed, so that a new inline color is a visible
decision.

#### Scenario: Light theme renders status surfaces in its own palette
- **WHEN** the UI is in the light theme and a status border, status pill, or
  attention surface is shown
- **THEN** its color derives from the light theme's base colors, not from the
  dark theme's values

#### Scenario: Hover feedback survives the theme switch
- **WHEN** the user hovers a menu row in either theme
- **THEN** the hover background is visible against that theme's surface

#### Scenario: A newly frozen literal is rejected
- **WHEN** a component introduces an inline color literal that is not in the
  documented theme-independent exemption list
- **THEN** the theme-token guard fails

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
