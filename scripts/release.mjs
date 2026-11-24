// Release one plugin: bump from Conventional Commits, update its CHANGELOG,
// commit, tag <plugin>@<version>, push, and create the GitHub Release.
//
//   npm run release -- <plugin> [patch|minor|major] [--dry-run]
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { RELEASE_BUMP, parseCommit } from './commit-conventions.mjs'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const [plugin, forced] = args.filter((a) => !a.startsWith('--'))

const fail = (msg) => {
  console.error(`✖ ${msg}`)
  process.exit(1)
}
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim()
const run = (cmd, a) => {
  console.log(`$ ${cmd} ${a.join(' ')}`)
  if (!dryRun) execFileSync(cmd, a, { stdio: 'inherit' })
}

// --- Preconditions -----------------------------------------------------------
if (!plugin) fail('Usage: npm run release -- <plugin> [patch|minor|major] [--dry-run]')
const dir = join('plugins', plugin)
if (!existsSync(dir)) fail(`No plugin folder ${dir}`)
if (forced && !['patch', 'minor', 'major'].includes(forced)) fail(`Unknown bump "${forced}"`)

if (git('status', '--porcelain')) fail('Working tree is not clean. Commit or stash first.')
const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
if (branch !== 'main') fail(`Releases are cut from main (current: ${branch}).`)
git('fetch', '--quiet', '--tags', 'origin')
const hasRemoteMain = git('ls-remote', '--heads', 'origin', 'main') !== ''
if (hasRemoteMain && git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/main')) {
  fail('main is not in sync with origin/main. Pull or push first.')
}

// --- Version -----------------------------------------------------------------
const lastTag = git('tag', '--list', `${plugin}@*`, '--sort=-v:refname').split('\n').filter(Boolean)[0]
const current = lastTag ? lastTag.slice(plugin.length + 1) : '0.0.0'
const range = lastTag ? [`${lastTag}..HEAD`] : ['HEAD']

const commits = git('log', ...range, '--format=%h%x1f%s%x1f%b%x1e', '--', dir)
  .split('\x1e')
  .map((r) => r.trim())
  .filter(Boolean)
  .map((r) => {
    const [hash, subject, body] = r.split('\x1f')
    return { hash, ...parseCommit(subject, body) }
  })
  .filter((c) => c.type && !(c.type === 'chore' && c.scope === 'release'))

const [major, minor, patch] = current.split('.').map(Number)
const rank = { patch: 1, minor: 2, major: 3 }
let bump = forced
if (!bump) {
  for (const c of commits) {
    // Before 1.0.0 a breaking change bumps minor, per semver convention.
    const b = c.breaking ? (major === 0 ? 'minor' : 'major') : RELEASE_BUMP[c.type]
    if (b && (!bump || rank[b] > rank[bump])) bump = b
  }
}
if (!bump) fail(`Nothing releasable for ${plugin} since ${lastTag ?? 'the beginning'} (only docs/chore/test commits).`)

const next =
  bump === 'major' ? `${major + 1}.0.0` : bump === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`
const tag = `${plugin}@${next}`

// --- Changelog ---------------------------------------------------------------
const sections = [
  ['⚠ Breaking changes', (c) => c.breaking],
  ['Features', (c) => !c.breaking && c.type === 'feat'],
  ['Fixes', (c) => !c.breaking && (c.type === 'fix' || c.type === 'perf')],
  ['Other', (c) => !c.breaking && !['feat', 'fix', 'perf'].includes(c.type)],
]
const notes = sections
  .map(([title, pick]) => {
    const items = commits.filter(pick)
    return items.length ? `### ${title}\n\n${items.map((c) => `- ${c.subject} (${c.hash})`).join('\n')}` : null
  })
  .filter(Boolean)
  .join('\n\n')

const date = new Date().toISOString().slice(0, 10)
const entry = `## ${next} (${date})\n\n${notes || '_No user-facing changes._'}\n`
const changelogPath = join(dir, 'CHANGELOG.md')
const header = `# Changelog: ${plugin}\n\n`
const previous = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8').replace(header, '') : ''

console.log(`\n${plugin}: ${current} → ${next} (${bump})\n\n${entry}`)
if (!dryRun) writeFileSync(changelogPath, header + entry + (previous ? `\n${previous}` : ''))

// --- Commit, tag, push, release ---------------------------------------------
run('git', ['add', changelogPath])
run('git', ['commit', '-m', `chore(release): ${tag}`])
run('git', ['tag', '-a', tag, '-m', tag])
run('git', ['push', 'origin', 'main', tag])
run('gh', ['release', 'create', tag, '--title', tag, '--notes', notes || 'No user-facing changes.'])

// What to paste on trmnl.com: one line per file in src/, with its copy command.
const TABS = {
  'full.liquid': 'Code, Full',
  'half_horizontal.liquid': 'Code, Half H',
  'half_vertical.liquid': 'Code, Half V',
  'quadrant.liquid': 'Code, Quadrant',
  'shared.liquid': 'Shared',
  'transform.js': 'Serverless (Node)',
  'settings.yml': 'Form Fields',
}
const PARTS = { 'transform.js': 'serverless', 'settings.yml': 'fields' }
const steps = readdirSync(join(dir, 'src'))
  .filter((f) => TABS[f])
  .map((f) => `  ${TABS[f].padEnd(18)} npm run copy -- ${plugin} ${PARTS[f] || f.replace('.liquid', '')}`)

console.log(
  dryRun
    ? '\n(dry run: nothing written or pushed)'
    : `\n✔ Released ${tag}. Update the plugin on trmnl.com, then Save:\n${steps.join('\n')}\n` +
        `(only what changed: see ${dir}/CHANGELOG.md)`,
)
