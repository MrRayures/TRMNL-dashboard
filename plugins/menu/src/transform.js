// TRMNL transform, default runtime (plain JS: no network, no Intl, 1 s max).
// Paste into the plugin's "Transform" editor on trmnl.com.
//
// Input: every published Meridio menu day, as synced weekly to our menu.json
// (scripts/sync/menu.mjs) or straight from the API:
// [{ day: "2026-11-23T00:00:00.000Z", recipeList: [...] }].
// Output: the merge variables full.liquid renders (see ../README.md): the day
// to show (today, or the next served day) and the school week around it. The
// "display" setting picks one of the two in Liquid.

const DISHES = {
  entree: 'Entrée',
  vpo: 'Plat',
  accompagnement: 'Accompagnement',
  laitier: 'Laitier',
  dessert: 'Dessert',
}
const DISH_ORDER = Object.keys(DISHES)
const LABEL_ORDER = ['BIO', 'AOP', 'AOC', 'IGP', 'Label Rouge']
const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

// Today's date in Europe/Paris as "YYYY-MM-DD". No Intl in this runtime, so
// apply the EU DST rule by hand: UTC+2 from the last Sunday of March 01:00 UTC
// to the last Sunday of October 01:00 UTC, UTC+1 otherwise.
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

const DAY = 86400e3
const toDate = (iso) => new Date(`${iso}T12:00:00Z`)
const toIso = (d) => d.toISOString().slice(0, 10)
const dayNumber = (d) => (d.getUTCDate() === 1 ? '1er' : String(d.getUTCDate()))

// "2026-11-23" → "Lundi 23 novembre", "2026-12-01" → "Mardi 1er décembre"
function dayLabel(iso) {
  const d = toDate(iso)
  return `${WEEKDAYS[d.getUTCDay()]} ${dayNumber(d)} ${MONTHS[d.getUTCMonth()]}`
}

// ("2026-11-23", "2026-11-27") → "du 23 au 27 novembre";
// across months → "du 30 novembre au 4 décembre"; a single day → "du 23 novembre".
function rangeLabel(fromIso, toIsoDate) {
  const a = toDate(fromIso)
  const b = toDate(toIsoDate)
  const month = (d) => MONTHS[d.getUTCMonth()]
  if (fromIso === toIsoDate) return `du ${dayNumber(a)} ${month(a)}`
  if (a.getUTCMonth() === b.getUTCMonth()) return `du ${dayNumber(a)} au ${dayNumber(b)} ${month(b)}`
  return `du ${dayNumber(a)} ${month(a)} au ${dayNumber(b)} ${month(b)}`
}

// Compose accents (the API sends some names decomposed, "a" + U+0300, which
// pixel fonts may draw badly), trim, collapse spaces, capitalise the first
// letter: "radis d'hiver " → "Radis d'hiver".
function cleanName(name) {
  let s = String(name || '')
  try {
    s = s.normalize('NFC')
  } catch (e) {
    // runtime without Unicode normalisation: keep the text as is
  }
  s = s.trim().replace(/\s+/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Labels live on ingredients: merge them into one badge list per dish.
function labelsOf(recipe) {
  const set = new Set()
  for (const ingredient of recipe.ingredientList || []) {
    for (const label of ingredient.labelList || []) if (label) set.add(label)
  }
  const rank = (l) => (LABEL_ORDER.indexOf(l) === -1 ? LABEL_ORDER.length : LABEL_ORDER.indexOf(l))
  return [...set].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

// Meridio grades seasonality A, B, C, or NG (not graded: dairy, bakes...).
// Its app shows the "de saison" tag on A only.
function item(recipe) {
  return {
    name: cleanName(recipe.name),
    labels: labelsOf(recipe),
    seasonal: recipe.seasonality === 'A',
    homemade: recipe.isHomeMade === true,
  }
}

const dishRank = (dish) => (DISH_ORDER.indexOf(dish) === -1 ? DISH_ORDER.length : DISH_ORDER.indexOf(dish))

// One served day: lunch in course order (stable sort keeps API order within a
// dish), then the afternoon snack.
function meals(recipes) {
  return {
    lunch: recipes
      .filter((r) => r.meal === 'lunch')
      .sort((a, b) => dishRank(a.dish) - dishRank(b.dish))
      .map((r) => ({ dish: DISHES[r.dish] || cleanName(r.dish), ...item(r) })),
    snack: recipes.filter((r) => r.meal === 'snackAfternoon').map(item),
  }
}

function shapeMenu(days, now) {
  const today = parisToday(now)
  const served = days
    .filter((d) => d && typeof d.day === 'string' && (d.recipeList || []).length > 0)
    .map((d) => ({ date: d.day.slice(0, 10), recipes: d.recipeList }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const todayMenu = served.find((d) => d.date === today)
  const shown = todayMenu || served.find((d) => d.date > today)
  if (!shown) return { service: false, day_label: '', lunch: [], snack: [], week_label: '', week: [] }

  // The school week (Monday to Sunday) of the shown day: on a weekend, the
  // shown day is next Monday, so this is next week.
  const d = toDate(shown.date)
  const monday = toIso(new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY))
  const sunday = toIso(new Date(toDate(monday).getTime() + 6 * DAY))
  const week = served.filter((w) => w.date >= monday && w.date <= sunday)

  return {
    service: Boolean(todayMenu),
    day_label: dayLabel(shown.date),
    ...meals(shown.recipes),
    week_label: rangeLabel(week[0].date, week[week.length - 1].date),
    week: week.map((w) => ({
      weekday: WEEKDAYS[toDate(w.date).getUTCDay()],
      day: dayNumber(toDate(w.date)),
      today: w.date === today,
      ...meals(w.recipes),
    })),
  }
}

function transform(input) {
  // A bare JSON array may reach us as-is or wrapped under `data`: accept both.
  const days = Array.isArray(input) ? input : Array.isArray(input && input.data) ? input.data : []
  return shapeMenu(days, new Date())
}
