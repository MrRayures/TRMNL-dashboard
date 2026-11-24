// node --test: the weekly sync (scripts/sync/menu.mjs) trims the API response
// without changing what the transform produces.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { trimMenu } from '../../../scripts/sync/menu.mjs'
import { runTransform } from '../../../scripts/run-transform.mjs'

const here = (p) => new URL(p, import.meta.url)
const code = readFileSync(here('../src/transform.js'), 'utf8')
const week = JSON.parse(readFileSync(here('../fixtures/inputs/meridio-2026-11-23.json'), 'utf8'))

test('trimmed data renders exactly like the raw API data', () => {
  const trimmed = trimMenu(week)
  for (const now of ['2026-11-23T10:00:00+01:00', '2026-11-25T10:00:00+01:00', '2026-11-27T10:00:00+01:00']) {
    assert.deepEqual(runTransform(code, trimmed, now), runTransform(code, week, now), now)
  }
})

test('days are sorted and malformed entries dropped', () => {
  const out = trimMenu([{ day: '2026-11-24T00:00:00.000Z', recipeList: [] }, { nope: 1 }, { day: '2026-11-23T00:00:00.000Z', recipeList: [] }])
  assert.deepEqual(out.map((d) => d.day.slice(0, 10)), ['2026-11-23', '2026-11-24'])
  assert.throws(() => trimMenu({ error: 'x' }))
})
