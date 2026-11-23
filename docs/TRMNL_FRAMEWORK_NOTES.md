# TRMNL Framework 3.4: best practices

Plugins pin **3.4.7** with `framework_version` in `src/settings.yml`; the preview
and TRMNL load it from `https://trmnl.com/css/3.4.7/plugins.css` and
`https://trmnl.com/js/3.4.7/plugins.js`. Nothing is vendored in this repo.

Every class, attribute and JS method named below was checked against the
published builds (3.3.0 and 3.4.7), not just the prose docs. Sources, in
order of authority: the built CSS/JS, the official agent guide
(`usetrmnl/trmnl-agent-skills`, `framework_v3_guide.md`), then
<https://trmnl.com/framework/docs/3.4>. Released versions:
`GET https://trmnl.com/api/framework` (no auth).

## Version history (v3)

| version | what changed |
|---|---|
| 3.0 | color support, CSS variable architecture, extended grayscale |
| 3.1 | pixel fonts by default, 3x3 mashups, scale / text-scale modifiers, `inverse` |
| 3.2 | themes, `TRMNLPaint`, `TRMNLCharts`, `image--adaptive`; deprecates `border--h-1…7` and `table-overflow-counter` |
| 3.3 | maps (`TRMNLMaps`), position utilities, `outline--muted` |
| 3.4 | custom typefaces (`typeface` class), card border art keeps its corners |

A plugin pinned to an older version only has the features up to it.

## What 3.4 adds over 3.3

One class, `typeface`, which with `--framework-typeface` sets a single font
for every text role in a container. It needs an `@font-face` rule, which this
repo bans: **do not use it**. Nothing was removed, and the font files are the
same as in 3.3.

## What 3.3 adds over 3.2

Diffed from the shipped CSS and JS. 3.3 removes nothing, so every class used
with 3.2 still renders.

- **Positioning utilities:** `relative`, `absolute`, `inset--{0…96}`,
  `top--*`, `right--*`, `bottom--*`, `left--*` (same spacing scale), `z--0`
  to `z--3`, and `outline`.
- **Map component:** `.map` (`map__label(s)`, `map__fallback`,
  `map__attribution`), the `window.TRMNLMaps` runtime, and the
  `data-map-slot` / `data-map-slot-kind` attributes.

Themes, `TRMNLPaint` and `TRMNLCharts` were **already in 3.2.0**. They are
described below because they are still opt-in.

## The one rule that matters

**CSS is the single source of truth for paint.** The framework decides colors,
dithering, borders and type. Your job is to pick the right classes, not to
re-derive the design system in your own stylesheet. Every override you write is
a place the preview can start disagreeing with the panel.

## Structure

The hierarchy is fixed. Screen wraps View wraps Layout, and Title Bar is a
**sibling** of Layout, never a child.

```html
<div class="screen screen--v2 screen--lg screen--density-2x screen--4bit">
  <div class="view view--full">
    <div class="layout">...</div>
    <div class="title_bar">
      <span class="title">Menu du jour</span>
      <span class="instance">Lundi 18 mai</span>
    </div>
  </div>
</div>
```

Rules worth remembering:

- One Layout per View. Never nest Layout inside Layout.
- Layout's direct children should be Columns, Grid, or Flex.
- `view--full` sits directly in the screen. Any other view type
  (`view--half_vertical`, `view--half_horizontal`, `view--quadrant`) must be
  inside a `.mashup` (`mashup--1Lx1R`, `mashup--1Tx1B`, `mashup--2x2`, …).
- A plugin submits **only** `.layout` and `.title_bar`; TRMNL (and the preview shell)
  supply Screen, View and Mashup. The view files in `plugins/<name>/src/`
  contain just that.
- Reusable chunks go in `shared.liquid` as `{% template name %}` blocks,
  used with `{% render "name", var: value %}` (see
  <https://docs.trmnl.com/go/private-plugins/reusing-markup.md>).

## Devices and rendering modes

TRMNL X is `screen--v2`: **1040x780 CSS pixels at 1.8x**, size class
`screen--lg`, 4-bit / 16 grayscale.

The number to author against is **1040x780**, not the 1872x1404 panel spec.
`screen--density-2x` scales the CSS space up to the physical pixels. Both
numbers are correct, they just describe different layers, and mixing them up
produces a layout that is off by ~1.8x.

Mode classes and what they change:

- `screen--1bit`: every gray token dithers between black and white.
- `screen--2bit`: tokens dither across four tones.
- `screen--4bit`: gray tokens paint as solids, each border step gets its own
  shade, and the title bar drops the pixel-font padding tweak.
- `screen--color-full` for 12/24-bit panels; the `screen--color-*` family covers
  limited ink sets.

Color tokens always fall back to gray equivalents, so a hue never reaches a
panel that cannot print it.

## Layout: pick the right tool

- **Grid** (`grid grid--cols-N` + `col--span-N`) for strict alignment. A 40/60
  split is `grid--cols-5` with `col--span-2` and `col--span-3`.
- **Flex** (`flex flex--row|col`) for content-sized arrangements.
- **Columns** (`.columns` / `.column`) for lots of same-type items where you want
  the system to distribute and handle overflow for you.
- **Positioning** (3.3): `relative` on the container, `absolute` +
  `inset--*` / `top--*` … on the child, `z--*` to stack. Reserve it for
  overlays (a badge on a corner); normal flow should stay Grid / Flex.

Alignment defaults trip people up: `.layout` centers its children on both axes.
To get a conventional top-left document flow you need `layout--top` (main axis)
**and** `layout--align-start` (cross axis), plus `flex--top` / `flex--left` on the
inner containers. This is the single biggest source of "why is my content
floating in the middle of the panel".

Prefer the framework's own modifiers over custom CSS heights. Declaring
`height: 100%` on grid children fights the runtime's fitting pass and produced
overlapping text in the first prototype before it was removed.

## Typography and elements

Use the framework elements, not bare tags. A `<p>` or `<span>` without a
framework class renders in the page font, not the framework font.

- `title` (`--small` ... `--xxlarge`) for headings.
- `value` (`--xxsmall` ... `--peta`) for numbers you want to read at a glance.
  Add `value--tnums` for tabular figures so times and digits stop jittering.
- `label` (`--small` ... `--xxlarge`, plus `--outline`, `--underline`,
  `--filled`, `--gray-out`) for chips and section headers.
- `description` for secondary lines.
- `item` with `.meta` / `.index` / `.content` for list rows.

The tier names collide but the sizes do not: `value--*` and `text--*` read
different size tokens (`--value-xlarge-font-size` vs `--font-xlarge-font-size`),
and value tiers are much larger. Sizes are tokens that vary per device, so
check them in the preview rather than hard-coding pixel numbers.

## The runtime

`plugins.min.js` runs itself on load. Do not try to initialise it. Its pass, in
order: settle images, even out index badges, format values, fit values, adjust
grid and column gaps to integer pixels, run Overflow, then Clamp.

Useful opt-ins, all declarative:

- `data-overflow="true"` hides trailing items instead of spilling off the panel.
- `data-overflow-counter="true"` adds an "and N more" line.
- `data-value-format="true"` abbreviates numbers (k, M, B).
- `data-fit-value` auto-sizes a number to its container.
- `data-content-limiter="true"` shrinks and truncates overlong blocks.
- `data-clamp="N"` clamps text to N lines (responsive variants
  `data-clamp-sm|md|lg[-portrait]`).
- `data-list-limit` / `data-table-limit` cap lists and tables to the space
  available.

It exposes `window.TRMNL`, `window.TRMNLPaint`, `window.TRMNLCharts` and (3.3)
`window.TRMNLMaps`, and fires `trmnl:framework:ready`. There is **no public
re-render entry point**, so anything that changes layout needs a reload to be
measured honestly.

## Practical gotchas

- The stylesheet is big because it carries every device profile (~15.7MB
  minified in 3.4.7). The preview loads it from trmnl.com; never copy it into the repo.
- Do not scale the panel down to fit a browser window. It misrepresents stroke
  weight and pixel-font crispness. Keep it 1:1 and let the page scroll.
- Check the layout with realistic **and** empty data. E-ink has no scrollbar, so
  overflow is a silent failure.

## Deprecated: numbered border levels

`border--h-1` through `border--h-7` (and the vertical `border--v-*`
counterparts) still render in 3.4.7 but are deprecated and slated for removal
in Framework 4.0. Use the shade-step scale instead: `border--h-10` through
`border--h-75`.

## Themes (opt-in, present since 3.2)

Themes recolor a plugin without touching markup. Add `screen--theme-<id>`
to the `.screen` element and load the theme's stylesheet after the framework
(`https://trmnl.com/css/<version>/themes/<id>-theme.css`). On TRMNL a theme is
picked per device or playlist item.

```html
<div class="screen screen--theme-black-and-yellow">...</div>
```

Built-in themes: `black-and-yellow`, `dark`, `white-and-red`. Themes control
background, text, borders and chart series colors — never layout or spacing.

**Gotcha:** a themed screen ignores `screen--dark-mode` by default (a theme
already decides every color). A theme can opt back in by styling
`.screen--theme-<id>.screen--dark-mode` in its own stylesheet.

No theme is used here yet. A "dark mode" request is a theme switch, not a CSS
override.

## TRMNLPaint JS API (opt-in)

Only relevant when a plugin draws to a `<canvas>`/SVG/chart/map in JS instead
of using framework classes. `TRMNLPaint` reads the *actual* computed CSS value
(color, border, type spec) for a framework utility class, so custom drawing
stays in sync with bit depth, theme and dark mode without hand-maintained color
tables. It stages a hidden element with the class, reads the computed style,
then removes it.

```js
var accentColor = TRMNLPaint.bg("bg--accent", { el: "my-chart" });
var scaling = TRMNLPaint.px(260, { el: "my-chart" }); // density-aware px
TRMNLPaint.apply(node, accentColor);
```

Method groups: colors (`bg`, `text`, `stroke`, `semantic`, `apply`), charts
(`series`, `ramp`, `toHighcharts`), maps (`slot`, `toMapLibre`), borders
(`border`, `divider`), typography (`type`, `strokeSpec`), and scale (`scale`,
`px`).

## Chart component

`TRMNLCharts` is a theme/device-aware wrapper for Highcharts or Chartkick (the
chart library itself is **not** bundled). Key calls: `series(i, n, {el})` for
a series color, `options({el})` for adaptive Highcharts defaults,
`watch(el, buildFn)` to rebuild on device/scale/mode/theme change,
`applySwatches({el})` to color legend markers, `textStyle(role, {el})` for SVG
text.

- Container needs a stable id: `<div id="chart-x" class="w--full"></div>`.
- Legend swatches: tag markers with `data-chart-series="i"` (+ optional
  `data-chart-series-count="n"`).
- Disable chart-library animation: screenshots can capture mid-animation.
- Set chart `height: null` and size via `TRMNLPaint.px()` inside the watcher,
  not fixed pixel values, so it scales with device density.
- Older notes mention a `pattern-fill.js` for dithered charts. It is not
  published under `/js/3.3.0/` and the runtime does not reference it: verify
  against the current docs before relying on it.

## Map component (new in 3.3)

`.map` hosts a MapLibre map styled by the framework. `TRMNLMaps.watch(el,
build)` rebuilds it on device/mode/theme change (the same pattern as charts),
`TRMNLMaps.refresh()` rebuilds all maps, and the runtime waits for maps to
settle before the screenshot. `TRMNLPaint.slot()` / `toMapLibre()` give the
paint values for map layers; `data-map-slot` tags map elements, and
`data-map-unsupported` is set when the build fails. MapLibre itself is not
bundled. Not needed for any plugin here yet.

## Table component

```html
<table class="table table--indexed" data-table-limit="true">
  <thead><tr><th><span class="title">Column</span></th></tr></thead>
  <tbody>
    <tr>
      <td><span class="meta"><span class="index">1</span></span></td>
      <td><span class="label" data-clamp="1">Long cell text…</span></td>
    </tr>
  </tbody>
</table>
```

- Size variants: `table--xsmall`, `table--small`, `table--base` (default),
  `table--large`, `table--xlarge`. Combine with responsive prefixes, e.g.
  `lg:portrait:table--xlarge`.
- `table--indexed` adds a numbered left column (needs `.meta > span.index`
  per row).
- `data-table-limit="true"` constrains the table to the available height and
  appends an "and N more" row instead of spilling off-panel.
- `data-clamp="1"` on a cell's inner span truncates that cell to one line
  with an ellipsis without breaking the table layout.

## Item component

The dedicated list-row component, used by the `menu` plugin:

```html
<div class="item">
  <div class="meta"><span class="index">1</span></div>
  <div class="icon"><img class="image--adaptive" src="…"></div>
  <div class="content">…</div>
</div>
```

- `.meta` (optional) holds an `.index` for ranked/numbered rows.
- `.icon` (optional) sits between meta and content; use `image--adaptive` so
  the icon recolors with theme/dark-mode text-primary instead of staying a
  fixed color.
- `item--emphasis-2` / `item--emphasis-3` progressively darken the meta bar
  for visual hierarchy (e.g. highlighting "next" vs. later schedule rows).
- `item--shrink` lets one item expand to fill leftover space in a flex
  container instead of sizing strictly to content.
