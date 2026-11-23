---
paths:
  - "plugins/**/*.liquid"
---

# TRMNL framework markup

Full reference and rationale: `docs/TRMNL_FRAMEWORK_NOTES.md`. Plugins are
pinned to framework **3.4.7** (`framework_version` in `src/settings.yml`). When
a class or behaviour is in doubt, check it against
`https://trmnl.com/css/<version>/plugins.css` or in the preview, not against
memory. The `trmnl` skill (official TRMNL Claude Code plugin, installed for
this project) carries TRMNL's own design-system guide: load it for markup
work.

## Structure

- A view file contains **only** one `.layout` and, optionally, one
  `.title_bar` as its **sibling** (never inside the layout). No `.screen`,
  `.view` or `.mashup`: TRMNL (and the preview shell) add them.
- Never nest `.layout` in `.layout`. Direct children of `.layout` are
  `grid`, `flex` or `columns`.
- `.layout` centres by default. For document flow use
  `layout--top layout--align-start`, and `flex--top flex--left` inside.

## Paint belongs to the framework

- **No `<style>` blocks, no `style=""` attributes, no custom classes for
  color, size or spacing.** Pick framework classes. If something cannot be
  expressed with them, stop and ask rather than override. (TRMNL allows
  `<style>` in shared markup; this repo is stricter on purpose.)
- No `typeface` class (3.4) or `@font-face`: the device fonts are the default.
- Every text node is wrapped in a framework element: `title`, `value`,
  `label`, `description`, `text--*`. Bare `<p>`/`<span>` fall back to the
  page font.
- Numbers and times: `value` + `value--tnums`.
- Rows of a list: the `item` component (`meta` / `index` / `icon` / `content`).
- Borders use the shade scale `border--h-10` … `border--h-75`. The numbered
  `border--h-1…7` / `border--v-1…7` are deprecated (removed in 4.0).
- Icons and images: `image--adaptive` so they follow theme and dark mode.

## Device

Author for TRMNL X: **1040x780 CSS px**, 4-bit. Never use pixel sizes taken
from the 1872x1404 panel spec. No fixed heights: they fight the runtime's
fitting pass.

## Runtime

`plugins.min.js` runs itself. Use its declarative attributes
(`data-overflow`, `data-overflow-counter`, `data-clamp`, `data-fit-value`,
`data-value-format`, `data-table-limit`) instead of writing JS. No `<script>`
in plugin markup unless a chart truly needs it.
