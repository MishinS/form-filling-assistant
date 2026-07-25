## ADDED Requirements

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
