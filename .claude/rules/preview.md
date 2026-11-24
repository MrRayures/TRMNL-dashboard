---
paths:
  - "preview/**"
  - "vite.config.js"
  - "plugins/**"
---

# Local preview

This repo hosts the plugins' code and previews it locally. **Deployment is
manual, on trmnl.com.** Keep the tooling light: Node + `vite` + `liquidjs`,
nothing else. No Docker, Ruby, trmnlp, CI deploy or vendored framework files
unless the user asks.

```bash
npm run dev    # http://localhost:5173 → /<plugin> (gallery) or /<plugin>/<view>?bits=1&fixture=empty
npm test       # node --test plugins/**/tests/*.test.mjs (transforms)
```

When a plugin has `src/transform.js`, the preview runs it on the fixture's
`input` at the fixture's `now` (`?now=<ISO>` overrides it), in an isolated
context like TRMNL's default runtime (`scripts/run-transform.mjs`).

The home page `/` and `/<plugin>` are the gallery, like trmnl.com's
framework examples: every view as a card, a plugin picker, a fixture picker
(`toutes` = one card per fixture) and a bit-depth picker. At `/` the plugin
picker is empty and nothing shows until a plugin is chosen. Other query
params (custom fields) pass through. Cards are
iframes of the 1:1 pages, shrunk for the overview only (`?scale=`); click one
to check it at 1:1.

Custom fields (`custom_fields` in `src/settings.yml`) reach the markup as
`trmnl.plugin_settings.custom_fields_values.<keyname>`: their `default`,
then a scenario's `settings` object, then `?<keyname>=` in the URL.

## How it mimics TRMNL

- `src/shared.liquid` is prepended to the view, fixture keys are top-level
  variables, platform globals live under `trmnl` (`preview/trmnl.json`, with
  `instance_name` taken from `name` in `src/settings.yml`).
- The framework CSS/JS load from `https://trmnl.com/{css,js}/<version>/`,
  `<version>` being `framework_version` in `src/settings.yml`. `/fonts/*` is
  proxied to trmnl.com.
- Output is wrapped in `preview/shell.liquid` (`.screen`, `.view`, and a
  `.mashup` for non-full views), as TRMNL does.
- Liquid: liquidjs with Ruby truthiness (`jsTruthy: false`), `strictFilters`,
  and an emulation of TRMNL's `{% template %}` tag.

## Known gaps: TRMNL is the reference

- liquidjs is not Ruby Liquid: TRMNL custom filters (`l_date`,
  `number_with_delimiter`, …) are missing and throw "undefined filter".
  Prefer pre-formatted payload values; if a TRMNL filter is truly needed, add a
  shim in `vite.config.js` that mirrors its documented behaviour.
- No polling and no serverless runtime: the preview renders fixtures, and
  only default-runtime transforms (`transform(input)`, plain JS).
- After pasting into trmnl.com, check the plugin's preview there before
  considering a change done.

## Rules

- `preview/preview.css` is page chrome only. **Never** add rules that change
  how plugin markup paints: a fix that only works here is a bug on the device.
- Keep the panel at 1:1 on `/<plugin>/<view>`; only the gallery shrinks it,
  as an overview. Judge strokes, dithering and fit at 1:1.
- Prefer a reload with a query param over toggling classes in the console:
  the framework runtime only measures on load.
