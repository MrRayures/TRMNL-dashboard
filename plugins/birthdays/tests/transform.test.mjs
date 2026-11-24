// node --test: the birthdays transform against a Google Calendar style .ics
// (made-up people: this repository is public).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { runTransform } from '../../../scripts/run-transform.mjs'

const here = (p) => new URL(p, import.meta.url)
const code = readFileSync(here('../src/transform.js'), 'utf8')
const ics = readFileSync(here('../fixtures/inputs/calendar.ics'), 'utf8')
const run = (now, input = ics) => runTransform(code, input, now)

test('today, then upcoming in date order, with age and countdown', () => {
  const out = run('2026-11-24T10:00:00+01:00')
  assert.equal(out.available, true)
  assert.deepEqual(out.today, [
    { name: 'Léa', greeting: "C'est l'anniversaire de Léa", years_label: '9 ans', date_label: 'Mardi 24 novembre', date_short: '24 novembre', days: 0, countdown: "Aujourd'hui", age: 9, age_label: '9 ans', wedding: false, noces_label: '' },
  ])
  assert.deepEqual(
    out.upcoming.slice(0, 3).map((b) => [b.name, b.date_label, b.countdown, b.age_label]),
    [
      ['Papi Jean', 'Mercredi 25 novembre', 'Demain', '41 ans'],
      ['Hugo', 'Mardi 1er décembre', 'Dans 7 jours', '14 ans'],
      ['Tante Camille (année inconnue)', 'Samedi 12 décembre', 'Dans 18 jours', ''],
    ],
  )
})

test('at most 10, cancelled events skipped, wraps to next year', () => {
  const out = run('2026-11-24T10:00:00+01:00')
  const all = [...out.today, ...out.upcoming]
  assert.equal(all.length, 10)
  assert.ok(!all.some((b) => b.name === 'Oncle Paul')) // STATUS:CANCELLED
  const marraine = all.find((b) => b.name.startsWith('Marie-Christine'))
  assert.equal(marraine.name, 'Marie-Christine de La Fontaine-Beaulieu, marraine') // \, unescaped
  assert.equal(marraine.date_label, 'Mardi 5 janvier')
  assert.equal(marraine.age_label, '37 ans') // 2027 - 1990
})

test('wedding anniversary: names without "Mariage", years and noces', () => {
  const out = run('2026-11-24T10:00:00+01:00')
  const w = out.upcoming.find((b) => b.wedding)
  assert.deepEqual([w.name, w.date_label, w.age_label, w.noces_label], ['Claire et Antoine', 'Dimanche 20 décembre', '12 ans de mariage', 'Noces de soie'])
  const ev = (summary, year) => `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;VALUE=DATE:${year}1201
SUMMARY:${summary}
END:VEVENT
END:VCALENDAR`
  const one = (summary, year) => run('2026-11-24T10:00:00+01:00', ev(summary, year)).upcoming[0]
  assert.equal(one('Anniversaire de mariage : Paul & Zoé', 1976).noces_label, "Noces d'or")
  assert.equal(one('Anniversaire de mariage : Paul & Zoé', 1976).name, 'Paul & Zoé')
  assert.equal(one('Mariage Paul et Zoé', 1975).noces_label, '') // 51: no traditional name
  assert.equal(one('Mariage Paul et Zoé', 2026).age_label, '') // year unknown
  assert.equal(one('Mariage', 2000).name, 'Mariage')
  assert.equal(w.greeting, "C'est l'anniversaire de mariage de Claire et Antoine")
  assert.equal(w.years_label, '12 ans')
  assert.equal(one('Élodie', 2000).greeting, "C'est l'anniversaire d'Élodie")
  assert.equal(one('Mariagette', 2000).wedding, false)
})

test('29 February falls on the 28th in other years; "1 an"', () => {
  const out = run('2027-02-01T10:00:00+01:00')
  const noe = out.upcoming.find((b) => b.name === 'Noé')
  assert.equal(noe.date_label, 'Dimanche 28 février')
  assert.equal(noe.age_label, '11 ans')
  const one = '\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20251201\nSUMMARY:Bébé\nEND:VEVENT\n'
  const baby = run('2026-11-24T10:00:00+01:00', `BEGIN:VCALENDAR${one}END:VCALENDAR`).upcoming[0]
  assert.equal(baby.age_label, '1 an')
})

test('Paris date: 23:30 UTC on the 23rd is already the 24th', () => {
  assert.equal(run('2026-11-23T23:30:00Z').today[0].name, 'Léa')
})

test('the .ics may come wrapped, with CRLF and folded lines', () => {
  const crlf = ics.replace(/\n/g, '\r\n').replace('SUMMARY:Léa', 'SUMMARY:Lé\r\n a')
  assert.equal(run('2026-11-24T10:00:00+01:00', { data: crlf }).today[0].name, 'Léa')
})

test('empty calendar vs unavailable', () => {
  const empty = run('2026-11-24T10:00:00+01:00', 'BEGIN:VCALENDAR\nEND:VCALENDAR\n')
  assert.deepEqual(empty, { available: true, today_label: '24 novembre 2026', today: [], upcoming: [] })
  const down = run('2026-11-24T10:00:00+01:00', { error: '404' })
  assert.deepEqual(down, { available: false, today_label: '24 novembre 2026', today: [], upcoming: [], received: 'object { error: string(3) }' })
  assert.equal(run('2026-12-01T10:00:00+01:00').today_label, '1er décembre 2026')
})


test('finds the .ics nested a few levels deep', () => {
  assert.equal(run('2026-11-24T10:00:00+01:00', { IDX_0: { data: ics } }).today[0].name, 'Léa')
})

// run() as the serverless runtime calls it, with a fake fetch.
async function serverless(input, fetchImpl) {
  const context = vm.createContext({ input, fetch: fetchImpl, AbortSignal, Date: globalThis.Date })
  return JSON.parse(JSON.stringify(await vm.runInContext(`${code}\n;run(input)`, context)))
}
const settings = (url) => ({ trmnl: { plugin_settings: { custom_fields_values: { ical_url: url } } } })

test('run() downloads the .ics from the ical_url form field', async () => {
  let asked = ''
  const out = await serverless(settings('webcal://calendar.example/basic.ics'), async (url) => {
    asked = url
    return { ok: true, status: 200, text: async () => ics }
  })
  assert.equal(asked, 'https://calendar.example/basic.ics')
  assert.equal(out.available, true)
  assert.ok(out.today.length + out.upcoming.length > 0)
})

test('run() failures say why, never the secret URL', async () => {
  const notFound = await serverless(settings('https://secret.example/private-x/basic.ics'), async () => ({ ok: false, status: 404 }))
  assert.equal(notFound.received, 'HTTP 404')
  const offline = await serverless(settings('https://secret.example/private-x/basic.ics'), async () => {
    throw new TypeError('fetch failed https://secret.example/private-x/basic.ics')
  })
  assert.equal(offline.received, 'erreur réseau (TypeError)')
  const missing = await serverless({ trmnl: {} }, async () => assert.fail('no fetch'))
  assert.match(missing.received, /^pas de champ ical_url/)
})
