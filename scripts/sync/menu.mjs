// Fetches every published canteen menu from the Meridio API and writes a
// trimmed copy (only the fields plugins/menu/src/transform.js reads).
// Run weekly by .github/workflows/sync-data.yml; published on GitHub Pages.
//
//   node scripts/sync/menu.mjs <out.json>
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const API =
  'https://rncuqer6baza2pzhumplpf24da0enxcg.lambda-url.eu-west-3.on.aws/satellite/ivawb/menuDay'
// Both dates are required; a wide range returns every published day.
const URL = `${API}?startDate=2020-01-01&endDate=2099-12-31`

export function trimMenu(days) {
  if (!Array.isArray(days)) throw new Error('Unexpected response: not an array')
  return days
    .filter((d) => typeof d.day === 'string' && Array.isArray(d.recipeList))
    .map((d) => ({
      day: d.day,
      recipeList: d.recipeList.map((r) => ({
        name: r.name,
        meal: r.meal,
        ...(r.dish ? { dish: r.dish } : {}),
        isHomeMade: r.isHomeMade === true,
        seasonality: r.seasonality,
        ingredientList: (r.ingredientList || [])
          .filter((i) => (i.labelList || []).length > 0)
          .map((i) => ({ labelList: i.labelList })),
      })),
    }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

async function main(out) {
  if (!out) throw new Error('Usage: node scripts/sync/menu.mjs <out.json>')
  const res = await fetch(URL, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`Meridio API: HTTP ${res.status}`)
  const days = trimMenu(await res.json())
  // An empty answer is more likely an API hiccup than no menu at all: keep
  // the previous file rather than blanking the panel.
  if (days.length === 0) throw new Error('Meridio API returned no day; keeping the previous file')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(days) + '\n')
  console.log(`${out}: ${days.length} days, ${days[0].day.slice(0, 10)} → ${days.at(-1).day.slice(0, 10)}`)
}

// Run only when called directly, not when imported by the tests.
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main(process.argv[2]).catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
