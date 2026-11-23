---
paths:
  - "plugins/**"
---

# Liquid and payload data

## TRMNL Liquid is Ruby Liquid + trmnl-liquid

TRMNL renders with Shopify (Ruby) Liquid plus TRMNL's extensions
(trmnl-liquid). The local preview uses liquidjs set up to match; write Liquid
that behaves the same on both:

- Only `nil` and `false` are falsy. `""`, `0` and `[]` are **truthy**: test
  lists with `list.size > 0`, strings with `str != blank`.
- Reusable markup: define partials in `src/shared.liquid` with
  `{% template name %}…{% endtemplate %}` and use them in any view with
  `{% render "name", var: value %}`. Names: letters, digits, `_`, `/`
  (`components/header`). A template sees only the variables passed to it.
- Shared markup is prepended to every view. A view left empty renders the
  shared markup alone.
- Filters: standard Liquid ones. On TRMNL an unknown filter renders the value
  unfiltered (silently); in the preview it throws. TRMNL-only filters
  (`l_date`, `number_with_delimiter`, …) need a shim in `vite.config.js`
  first. Prefer pre-formatted strings in the payload (`date_label`) over
  clever filtering.

## Variables

- Payload keys are **top-level** (`{{ service }}`, `{{ lunch }}`), exactly as
  TRMNL exposes polling / webhook / transform output.
- Platform globals come from `trmnl.*` (`trmnl.plugin_settings.instance_name`,
  `trmnl.user.locale`, …). The title bar title is the instance name, not a
  hard-coded string.
- Guard every optional key. A missing key must degrade to the empty state,
  never to broken markup or leaked `{{ }}`.

## Fixtures

- `fixtures/default.json` is the contract: realistic values, French text with
  real accents, realistic lengths (the longest plausible name, not "Lorem").
  When the plugin runs on TRMNL, its real merge variables (plugin settings →
  merge variables) are the best source for this file.
- One fixture per edge case the markup branches on: always `empty.json`; also
  `long.json` (overflow) or `error.json` when relevant.
- A payload shape change updates the fixtures and the README table together.
  One that breaks existing markup is a breaking change (`feat(<plugin>)!:`).
- Never put secrets or private URLs in fixtures or config.

## Language

Comments in English. User-facing text on the panel in French.
