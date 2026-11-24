// TRMNL transform. Paste into the plugin's "Serverless" tab (language: Node)
// on trmnl.com; strategy Static. run() (serverless: fetch allowed, 5 s)
// downloads the calendar; transform() (plain JS, no network) parses .ics text
// and is what the local preview and the tests run.
//
// Input: a dedicated "Anniversaires" Google Calendar, read through its secret
// iCal address (ical_url form field): one all-day event per person, on the
// birth date, repeated every year.
// Output: the upcoming birthdays full.liquid renders (see ../README.md).

const LIMIT = 10
const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
const DAY = 86400e3

// Wedding anniversaries: an event titled "Mariage <names>" (or "Anniversaire
// de mariage <names>"). Its start date is the wedding day.
const WEDDING = /^(anniversaire\s+de\s+)?mariage\b[\s:–-]*/i
// Traditional French names, by year of marriage. Years not listed: no name.
const NOCES = {
  1: 'coton', 2: 'cuir', 3: 'froment', 4: 'cire', 5: 'bois', 6: 'chypre', 7: 'laine',
  8: 'coquelicot', 9: 'faïence', 10: 'étain', 11: 'corail', 12: 'soie', 13: 'muguet',
  14: 'plomb', 15: 'cristal', 16: 'saphir', 17: 'rose', 18: 'turquoise', 19: 'cretonne',
  20: 'porcelaine', 21: 'opale', 22: 'bronze', 23: 'béryl', 24: 'satin', 25: 'argent',
  26: 'jade', 27: 'acajou', 28: 'nickel', 29: 'velours', 30: 'perle', 31: 'basane',
  32: 'cuivre', 33: 'porphyre', 34: 'ambre', 35: 'rubis', 36: 'mousseline', 37: 'papier',
  38: 'mercure', 39: 'crêpe', 40: 'émeraude', 41: 'fer', 42: 'nacre', 43: 'flanelle',
  44: 'topaze', 45: 'vermeil', 46: 'lavande', 47: 'cachemire', 48: 'améthyste',
  49: 'cèdre', 50: 'or', 55: 'orchidée', 60: 'diamant', 70: 'platine', 75: 'albâtre',
  80: 'chêne',
}

// "Noces de soie", "Noces d'or"; "" for an unnamed year.
function nocesLabel(years) {
  const n = NOCES[years]
  if (!n) return ''
  return /^[aeiouyàâéèêëîïôûh]/i.test(n) ? `Noces d'${n}` : `Noces de ${n}`
}

// Today's date in Europe/Paris as "YYYY-MM-DD". No Intl in the default
// runtime: UTC+2 from the last Sunday of March 01:00 UTC to the last Sunday
// of October 01:00 UTC, UTC+1 otherwise.
function parisToday(now) {
  const year = now.getUTCFullYear()
  const lastSunday = (month) => {
    const last = new Date(Date.UTC(year, month + 1, 0))
    return Date.UTC(year, month, last.getUTCDate() - last.getUTCDay(), 1)
  }
  const t = now.getTime()
  const offset = t >= lastSunday(2) && t < lastSunday(9) ? 2 : 1
  return new Date(t + offset * 3600e3).toISOString().slice(0, 10)
}

// The .ics text, wherever TRMNL put it: the input itself, or a string value
// nested up to 3 levels deep (`data`, `IDX_0`...).
function icsText(input, depth = 0) {
  if (typeof input === 'string') return input.includes('BEGIN:VCALENDAR') ? input : ''
  if (input && typeof input === 'object' && depth < 3) {
    for (const value of Object.values(input)) {
      const text = icsText(value, depth + 1)
      if (text) return text
    }
  }
  return ''
}

// What the input looks like, without its content (it is private): shown on
// the "Agenda indisponible" screen to diagnose polling. e.g.
// "object { data: string(4499), error: string(9) }".
function describe(input, depth = 0) {
  if (input === null) return 'null'
  if (Array.isArray(input)) return `array(${input.length})`
  if (typeof input === 'string') return `string(${input.length})`
  if (typeof input !== 'object') return typeof input
  const keys = Object.keys(input)
  if (depth > 0) return `object(${keys.length} keys)`
  const shown = keys.slice(0, 6).map((k) => `${k}: ${describe(input[k], depth + 1)}`)
  return `object { ${shown.join(', ')}${keys.length > 6 ? ', …' : ''} }`
}

// iCal text → [{ summary, start: "YYYY-MM-DD" }]. Unfolds continuation lines,
// unescapes text, skips cancelled events and single-occurrence overrides.
function parseEvents(text) {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/)
  const events = []
  let event = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') event = {}
    else if (line === 'END:VEVENT') {
      if (event && event.summary && event.start && !event.override && event.status !== 'CANCELLED') events.push(event)
      event = null
    } else if (event) {
      const colon = line.indexOf(':')
      if (colon === -1) continue
      const name = line.slice(0, colon).split(';')[0].toUpperCase()
      const value = line.slice(colon + 1)
      if (name === 'SUMMARY') event.summary = value.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim()
      else if (name === 'DTSTART') {
        const m = value.match(/^(\d{4})(\d{2})(\d{2})/)
        if (m) event.start = `${m[1]}-${m[2]}-${m[3]}`
      } else if (name === 'RECURRENCE-ID') event.override = true
      else if (name === 'STATUS') event.status = value.trim().toUpperCase()
    }
  }
  return events
}

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// Next occurrence (today included) of a yearly date. 29 February falls on
// the 28th in other years.
function nextOccurrence(start, today) {
  const [, m, d] = start.split('-').map(Number)
  let year = Number(today.slice(0, 4))
  const on = (y) => iso(y, m, m === 2 && d === 29 && !isLeap(y) ? 28 : d)
  if (on(year) < today) year += 1
  return on(year)
}

function dateLabel(date) {
  const d = new Date(`${date}T12:00:00Z`)
  const n = d.getUTCDate() === 1 ? '1er' : String(d.getUTCDate())
  return `${WEEKDAYS[d.getUTCDay()]} ${n} ${MONTHS[d.getUTCMonth()]}`
}

// Title bar date, e.g. "24 novembre 2026" ("1er" on the first).
function longDate(date) {
  const [y, m, d] = date.split('-').map(Number)
  return `${d === 1 ? '1er' : d} ${MONTHS[m - 1]} ${y}`
}

function countdown(days) {
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Demain'
  return `Dans ${days} jours`
}

function shapeBirthdays(text, now) {
  const today = parisToday(now)
  const today_label = longDate(today)
  if (!text) return { available: false, today_label, today: [], upcoming: [] }

  const seen = new Set()
  const all = parseEvents(text)
    .map((e) => {
      const date = nextOccurrence(e.start, today)
      const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY)
      // The event starts on the birth date: its year gives the age, unless it
      // was created in the year shown (birth year unknown).
      const age = Number(date.slice(0, 4)) - Number(e.start.slice(0, 4))
      const wedding = WEDDING.test(e.summary)
      const years = age > 0 ? `${age} an${age > 1 ? 's' : ''}` : ''
      const name = wedding ? e.summary.replace(WEDDING, '') || e.summary : e.summary
      // "de Léa", "d'Élodie" (not before h: "de Hugo" is always correct).
      const of = /^[aeiouyàâéèêëîïôû]/i.test(name) ? `d'${name}` : `de ${name}`
      return {
        name,
        greeting: `C'est l'anniversaire ${wedding ? 'de mariage ' : ''}${of}`,
        years_label: years,
        date,
        date_label: dateLabel(date),
        date_short: dateLabel(date).replace(/^\S+ /, ''), // "1er décembre"
        days,
        countdown: countdown(days),
        age: age > 0 ? age : null,
        age_label: wedding && years ? `${years} de mariage` : years,
        wedding,
        noces_label: wedding && age > 0 ? nocesLabel(age) : '',
      }
    })
    .filter((b) => {
      const key = `${b.name}|${b.date}`
      return seen.has(key) ? false : seen.add(key)
    })
    .sort((a, b) => a.days - b.days || a.name.localeCompare(b.name))
    .slice(0, LIMIT)
    .map(({ date, ...b }) => b)

  return { available: true, today_label, today: all.filter((b) => b.days === 0), upcoming: all.filter((b) => b.days > 0) }
}

function transform(input) {
  const out = shapeBirthdays(icsText(input), new Date())
  if (!out.available) out.received = describe(input)
  return out
}

// The ical_url form field value, wherever TRMNL puts it in the input
// (input.trmnl.plugin_settings.custom_fields_values, top level...).
function icalUrl(input, depth = 0) {
  if (!input || typeof input !== 'object' || depth > 5) return ''
  if (typeof input.ical_url === 'string' && input.ical_url.trim()) {
    return input.ical_url.trim().replace(/^webcal:\/\//i, 'https://')
  }
  for (const value of Object.values(input)) {
    const url = icalUrl(value, depth + 1)
    if (url) return url
  }
  return ''
}

// Serverless runtime (Node, internet allowed), the one the plugin uses on
// trmnl.com: TRMNL polling only accepts JSON, so the plugin uses the Static
// strategy and run() downloads the .ics itself from the ical_url form field.
async function run(input) {
  if (icsText(input)) return transform(input)
  const url = icalUrl(input)
  const down = (reason) => ({ ...shapeBirthdays('', new Date()), received: reason })
  if (!url) return down(`pas de champ ical_url ; ${describe(input)}`)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return down(`HTTP ${res.status}`)
    return transform(await res.text())
  } catch (e) {
    return down(`erreur réseau (${e.name})`) // never the message: it may contain the secret URL
  }
}
