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

#### Scenario: Accent across devices
- **WHEN** an authenticated user with a saved accent signs in elsewhere
- **THEN** the server-side accent seeds the UI before first paint
