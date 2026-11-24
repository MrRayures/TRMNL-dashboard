# TRMNL plugins

My private TRMNL plugins, developed **one plugin at a time**. This repo hosts
their code and previews them locally; each plugin is deployed by hand on
trmnl.com.

| Plugin | Views | Framework | Status |
| ------ | ----- | --------- | ------ |
| [menu](plugins/menu/) | full | 3.4.7 | ready to deploy |
| [bus](plugins/bus/) | full | 3.4.7 | draft |
| [agenda](plugins/agenda/) | full | 3.4.7 | draft |
| [birthdays](plugins/birthdays/) | full | 3.4.7 | in progress |

## Getting started

Requires Node 20+ (`.nvmrc` pins 24). Two dev dependencies: `vite` and
`liquidjs`.

```bash
npm install      # also installs the commit-msg hook
npm run dev      # http://localhost:5173
npm test         # transform tests (node --test, no extra dependency)
```

The index lists every plugin, view and fixture. A view is at
`/<plugin>/<view>`, with optional query params:

- `?bits=1|2|4`: rendering depth (default 4, TRMNL X).
- `?fixture=<name>`: loads `fixtures/<name>.json` instead of `default.json`.

Edits to `.liquid`, `.json` or `settings.yml` reload the page.

## How the preview works

TRMNL renders a plugin's Liquid server-side against its data and wraps it in
the screen markup. The preview does the same on each request: it prepends
`src/shared.liquid`, exposes the fixture's keys as top-level variables and
platform globals under `trmnl`, then wraps the result in `.screen` / `.view`.
The framework CSS and JS come from trmnl.com, at the `framework_version` set
in the plugin's `src/settings.yml`.

It is an approximation (liquidjs, not TRMNL's Ruby Liquid): always check the
plugin on trmnl.com after deploying.

## Layout

```
plugins/<name>/
  src/                 full.liquid, shared.liquid, settings.yml: what goes on trmnl.com
  fixtures/            sample data: default.json, empty.json, ...
  README.md            payload contract
  CHANGELOG.md         written by the release script
preview/               preview shell, gallery (home page), trmnl.* globals
scripts/               release + commit-msg check
docs/                  framework notes, original spec and plan
.claude/               project rules and Claude Code settings
```

## Commits and releases

Conventional Commits with the plugin as scope (`feat(menu): …`), one branch
per plugin, squash-merged PRs into `main`. When a version is ready to deploy:

```bash
npm run release -- menu --dry-run
npm run release -- menu
```

This bumps the version from the commits, writes `plugins/menu/CHANGELOG.md`,
tags `menu@x.y.z`, pushes and creates the GitHub Release. Then paste
`plugins/menu/src/*.liquid` into the plugin on trmnl.com. Details in
[.claude/rules/git-workflow.md](.claude/rules/git-workflow.md).

## Target device

TRMNL X (`v2`), landscape, authored at **1040x780 CSS pixels** and scaled
1.8x to the 1872x1404 panel, 4-bit (16 grays). Read
`docs/TRMNL_FRAMEWORK_NOTES.md` before writing markup.
