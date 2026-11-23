// Shared Conventional Commits definitions for the commit-msg hook and release.

export const TYPES = ['feat', 'fix', 'perf', 'refactor', 'style', 'docs', 'test', 'build', 'ci', 'chore', 'revert']

// Commit types that trigger a plugin release, and the bump they imply.
export const RELEASE_BUMP = { feat: 'minor', fix: 'patch', perf: 'patch', refactor: 'patch', style: 'patch' }

export const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[a-z0-9_-]+)\))?(?<breaking>!)?: (?<subject>.+)$/

export function parseCommit(subject, body = '') {
  const m = subject.match(HEADER)
  if (!m) return null
  const { type, scope, breaking, subject: text } = m.groups
  return { type, scope, subject: text, breaking: Boolean(breaking) || /^BREAKING CHANGE:/m.test(body) }
}
