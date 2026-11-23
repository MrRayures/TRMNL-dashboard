// commit-msg hook: enforce Conventional Commits. Usage: node check-commit-msg.mjs <msg-file>
import { readFileSync } from 'node:fs'
import { TYPES, parseCommit } from './commit-conventions.mjs'

const header = readFileSync(process.argv[2], 'utf8').split(/\r?\n/)[0].trim()

// Git-generated messages pass through untouched.
if (/^(Merge |Revert "|fixup! |squash! |amend! )/.test(header)) process.exit(0)

const parsed = parseCommit(header)
const errors = []
if (!parsed) errors.push('Header must match "<type>(<scope>)!: <subject>", e.g. "feat(menu): show snack labels".')
else {
  if (!TYPES.includes(parsed.type)) errors.push(`Unknown type "${parsed.type}". Allowed: ${TYPES.join(', ')}.`)
  if (/^[A-Z]/.test(parsed.subject)) errors.push('Subject starts lowercase (imperative mood: "add", not "Added").')
  if (/\.$/.test(parsed.subject)) errors.push('Subject has no trailing period.')
}
if (header.length > 72) errors.push(`Header is ${header.length} chars, keep it to 72.`)

if (errors.length) {
  console.error(`\n✖ Invalid commit message:\n  ${header}\n\n${errors.map((e) => `  - ${e}`).join('\n')}\n`)
  console.error('See .claude/rules/git-workflow.md\n')
  process.exit(1)
}
