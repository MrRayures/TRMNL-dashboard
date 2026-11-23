# Git workflow: commit, push, release

## Branches

- `main` is always releasable. No direct work on it, except the release
  commit made by `npm run release`.
- One branch per plugin or topic: `feature/plugin-<name>`, `fix/<name>-<topic>`,
  `chore/<topic>`. Branch from up-to-date `main`.
- Push the branch and open a PR to `main` (`gh pr create`). Merge with
  **squash**, so the PR title becomes the commit on `main` and must itself
  follow the format below.

## Commit messages: Conventional Commits

```
<type>(<scope>)!: <subject>
```

- **type:** `feat` `fix` `perf` `refactor` `style` `docs` `test` `build` `ci`
  `chore` `revert`.
- **scope:** the plugin folder name (`menu`, `bus`, …) for anything under
  `plugins/<name>/`; otherwise `ci`, `rules`, `release`, `deps`, `docs`.
- **subject:** English, imperative, lowercase start, no trailing period,
  header ≤ 72 chars.
- `!` (or a `BREAKING CHANGE:` footer) when the payload contract or a view's
  public behaviour changes incompatibly.
- One logical change per commit. Never mix two plugins in one commit.
- Enforced by `.githooks/commit-msg` (activated by `npm install` through the
  `prepare` script). Do not bypass it with `--no-verify`.

## Release (per plugin)

Each plugin is versioned independently with semver tags `<plugin>@x.y.z`.

```bash
git switch main && git pull
npm run release -- menu --dry-run   # preview version + changelog
npm run release -- menu             # do it
npm run release -- menu minor       # force a bump level
```

The script refuses to run unless on a clean, in-sync `main`. It reads the
commits touching `plugins/<name>/` since the last tag: `feat` → minor;
`fix`/`perf`/`refactor`/`style` → patch; breaking → major (minor before 1.0);
`docs`/`chore`/`test` alone do not release. It then writes
`plugins/<name>/CHANGELOG.md`, commits `chore(release): <name>@x.y.z`, creates
the annotated tag, pushes `main` + tag, and creates the GitHub Release with
`gh`.

**Deployment is manual.** After a release, the user pastes
`plugins/<name>/src/*.liquid` (and any settings change) into the plugin on
trmnl.com, then checks it there. A tag therefore means "this version is what
runs on TRMNL": release only what is about to be deployed.

## For Claude

- Commit or push only when asked. Never release, tag, force-push or rewrite
  `main` history without an explicit request.
- Always run the release with `--dry-run` first and show the result.
