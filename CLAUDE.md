# TRMNL plugins

Private plugins for a TRMNL X (e-ink, 1040x780 CSS px, 4-bit), built **one
plugin at a time** in `plugins/<name>/`. This repo only **hosts the code and
previews it locally**; the user deploys each plugin by hand on trmnl.com.
Keep it simple: Node + vite + liquidjs, no Docker/Ruby/CI unless asked.

```bash
npm install                        # deps + commit-msg hook
npm run dev                        # http://localhost:5173 → /menu/full?bits=1&fixture=empty
npm run release -- menu --dry-run  # version + changelog + tag, then deploy by hand
```

Rules live in `.claude/rules/` (workflow, preview, markup, Liquid/data, git).
For markup work, load the `trmnl` skill (official TRMNL plugin, enabled in
`.claude/settings.json`). Framework reference: `docs/TRMNL_FRAMEWORK_NOTES.md`.
Official docs: index at <https://docs.trmnl.com/go/llms.txt> (append `.md` to
any page), account API at <https://trmnl.com/api-docs.md>. The original
multi-plugin dashboard spec in `docs/superpowers/` is historical: data sources
and decisions still apply, the combined layout does not.

The user writes in French; answer in French. Code, comments and commits in
English; on-panel text in French.
