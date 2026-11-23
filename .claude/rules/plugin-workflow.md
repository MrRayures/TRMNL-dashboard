# Plugin workflow

This repo holds **private TRMNL plugins, built one at a time**. It is for
writing, previewing and versioning their code; the user deploys each plugin
by hand on trmnl.com. There is no combined dashboard: TRMNL combines plugins
in mashups itself. Do not add cross-plugin pages or layouts.

## One plugin, one folder

`src/` uses the file names of TRMNL's private-plugin export, so the files map
one-to-one to the editor tabs (and to an import archive):

```
plugins/<name>/
  src/full.liquid          required. Markup tab "Full"
  src/half_horizontal.liquid, half_vertical.liquid, quadrant.liquid
                           only once designed
  src/shared.liquid        "Shared" tab, prepended to every view;
                           {% template %} partials live here
  src/settings.yml         plugin settings as exported by TRMNL
                           (name, strategy, framework_version, form fields)
  src/transform.js         optional "Transform" (default runtime, transform(input))
  fixtures/default.json    payload, or { now, input } scenario with a transform
  fixtures/<case>.json     edge cases: at least empty.json
  fixtures/inputs/*.json   real API responses the scenarios point to
  tests/*.test.mjs         node --test, for the transform
  README.md                purpose, views, source, payload contract table
  CHANGELOG.md             written by `npm run release`, never by hand
```

- Folder names are lowercase kebab-case and are also the commit scope and
  release tag prefix (`menu` → `feat(menu): …` → `menu@1.2.0`).
- Folders starting with `_` are local scratch space: hidden from the preview
  index and git-ignored (they may hold private data). Never commit them.
- `src/` files must stay **copy-pasteable into trmnl.com unchanged**. Nothing
  preview-specific goes in `plugins/`.
- Pin `framework_version` to an exact version, the same as on trmnl.com.

## Scope discipline

- Work on **one plugin per branch** (`feature/plugin-<name>`). Do not touch
  another plugin's folder in the same branch.
- Ship `full` first. Add half/quadrant views only when asked, each as its own
  commit.
- A new plugin starts with its payload contract: `fixtures/default.json` and
  the README table, then the markup.

## Definition of done for a view

1. Renders in the preview with every fixture, no Liquid error.
2. Checked at `?bits=4` and `?bits=1` (dithering must stay legible).
3. Nothing clipped off-panel: e-ink has no scrollbar. Lists use
   `data-overflow="true"` or are limited in Liquid.
4. The empty / unavailable case shows a short French message, never a blank
   panel.
5. README payload table matches the fixtures.
6. After deployment, the user checks it on trmnl.com (the reference renderer).
