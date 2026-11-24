// node --test: the menu transform against real Meridio data (week of 2026-11-23).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runTransform } from '../../../scripts/run-transform.mjs'

const here = (p) => new URL(p, import.meta.url)
const code = readFileSync(here('../src/transform.js'), 'utf8')
const week = JSON.parse(readFileSync(here('../fixtures/inputs/meridio-2026-11-23.json'), 'utf8'))
const run = (now, input = week) => runTransform(code, input, now)

test('served day: lunch in course order, cleaned names, labels, homemade, snack', () => {
  const out = run('2026-11-23T10:00:00+01:00')

  assert.equal(out.service, true)
  assert.equal(out.day_label, 'Lundi 23 novembre')
  assert.deepEqual(
    out.lunch.map((c) => [c.dish, c.name]),
    [
      ['Entrée', 'Carottes râpées'],
      ['Plat', 'Omelette'], // trailing space trimmed
      ['Accompagnement', 'Pommes de terres rissolées'],
      ['Laitier', 'Fromage blanc fermier'],
    ],
  )
  assert.deepEqual(out.lunch[0].labels, ['BIO'])
  assert.equal(out.lunch[0].homemade, true)
  assert.equal(out.lunch[1].homemade, false)
  assert.deepEqual(
    out.snack.map((s) => s.name),
    ['Gateau aux yaourt', 'Pommes'],
  )
})

test('"de saison" only for seasonality A, like the Meridio app', () => {
  const byName = (out) => Object.fromEntries([...out.lunch, ...out.snack].map((c) => [c.name, c.seasonal]))
  const monday = byName(run('2026-11-23T10:00:00+01:00'))
  assert.equal(monday['Carottes râpées'], true) // A
  assert.equal(monday['Pommes'], true) // A
  assert.equal(monday['Omelette'], false) // NG
  const tuesday = byName(run('2026-11-24T10:00:00+01:00'))
  assert.equal(tuesday['Clémentine'], true) // A
  assert.equal(tuesday['Lasagne à la bolognaise'], false) // B
  assert.equal(tuesday["Radis d'hiver"], false) // C
})

test('decomposed accents from the API are composed (NFC)', () => {
  const out = run('2026-11-24T10:00:00+01:00')
  for (const c of [...out.lunch, ...out.snack]) assert.equal(c.name, c.name.normalize('NFC'), c.name)
})

test('names are capitalised and labels ordered BIO first', () => {
  const out = run('2026-11-24T10:00:00+01:00')
  assert.equal(out.lunch[0].name, "Radis d'hiver")
  assert.deepEqual(out.lunch.find((c) => c.dish === 'Plat').labels, ['BIO', 'AOP'])
  assert.equal(out.snack[1].name, 'Clémentine')
})

test('no service today: next published menu', () => {
  const out = run('2026-11-25T10:00:00+01:00') // Wednesday
  assert.equal(out.service, false)
  assert.equal(out.day_label, 'Jeudi 26 novembre')
  assert.ok(out.lunch.length > 0)
})

test('nothing published ahead, or empty input: empty state', () => {
  const empty = { service: false, day_label: '', lunch: [], snack: [], week_label: '', week: [] }
  assert.deepEqual(run('2026-11-28T10:00:00+01:00'), empty)
  assert.deepEqual(run('2026-11-23T10:00:00+01:00', []), empty)
  assert.deepEqual(run('2026-11-23T10:00:00+01:00', {}), empty)
})

test('accepts the array wrapped under `data`', () => {
  const out = run('2026-11-23T10:00:00+01:00', { data: week })
  assert.equal(out.day_label, 'Lundi 23 novembre')
})

test('uses the Paris date, winter and summer time', () => {
  // 23:30 UTC on Monday is already Tuesday 00:30 in Paris (UTC+1).
  assert.equal(run('2026-11-23T23:30:00Z').day_label, 'Mardi 24 novembre')
  // 22:30 UTC on 30 June is 1 July 00:30 in Paris (UTC+2).
  const summer = [{ day: '2026-07-01T00:00:00.000Z', recipeList: [{ name: 'x', meal: 'lunch', dish: 'entree' }] }]
  const out = run('2026-06-30T22:30:00Z', summer)
  assert.equal(out.service, true)
  assert.equal(out.day_label, 'Mercredi 1er juillet')
})

test('week: served days of the shown day\'s week, today flagged, date range', () => {
  const out = run('2026-11-24T10:00:00+01:00') // Tuesday
  assert.equal(out.week_label, 'du 23 au 27 novembre')
  assert.deepEqual(
    out.week.map((d) => [d.weekday, d.day, d.today]),
    [
      ['Lundi', '23', false],
      ['Mardi', '24', true],
      ['Jeudi', '26', false],
      ['Vendredi', '27', false],
    ],
  )
  assert.deepEqual(out.week[1].lunch, out.lunch) // same shape as the day view
  assert.deepEqual(out.week[1].snack, out.snack)
})

test('week on a weekend: next week; range across months', () => {
  const day = (iso) => ({ day: `${iso}T00:00:00.000Z`, recipeList: [{ name: 'x', meal: 'lunch', dish: 'vpo' }] })
  const input = [day('2026-11-27'), day('2026-11-30'), day('2026-12-01'), day('2026-12-04')]
  const out = run('2026-11-28T10:00:00+01:00', input) // Saturday
  assert.equal(out.service, false)
  assert.equal(out.day_label, 'Lundi 30 novembre')
  assert.equal(out.week_label, 'du 30 novembre au 4 décembre')
  assert.deepEqual(out.week.map((d) => d.day), ['30', '1er', '4'])
  assert.ok(out.week.every((d) => !d.today))
})

test('run(input), for the serverless runtime, returns the same as transform(input)', async () => {
  const vm = await import('node:vm')
  const context = vm.createContext({ input: week })
  const same = vm.runInContext(`${code}\n;JSON.stringify(run(input)) === JSON.stringify(transform(input))`, context)
  assert.equal(same, true)
})
