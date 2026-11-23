// TRMNL transform, default runtime (plain JS: no network, no Intl, 1 s max).
// Paste into the plugin's "Transform" editor on trmnl.com.
//
// Input: the Meridio menuDay response for a wide date range, i.e. every
// published day: [{ day: "2026-11-23T00:00:00.000Z", recipeList: [...] }].
// Output: the merge variables full.liquid renders (see ../README.md).

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

// "2026-11-23" → "Lundi 23 novembre"
function dayLabel(date) {
  const d = new Date(`${date}T12:00:00Z`)
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

// Trim, collapse spaces, capitalise the first letter: "radis d'hiver " → "Radis d'hiver".
function cleanName(name) {
  const s = String(name || '').trim().replace(/\s+/g, ' ')
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

function item(recipe) {
  return { name: cleanName(recipe.name), labels: labelsOf(recipe), homemade: recipe.isHomeMade === true }
}

function shapeMenu(days, now) {
  const today = parisToday(now)
  const served = days
    .filter((d) => d && typeof d.day === 'string' && (d.recipeList || []).length > 0)
    .map((d) => ({ date: d.day.slice(0, 10), recipes: d.recipeList }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const todayMenu = served.find((d) => d.date === today)
  const shown = todayMenu || served.find((d) => d.date > today)
  if (!shown) return { service: false, day_label: '', lunch: [], snack: [] }

  const rank = (dish) => (DISH_ORDER.indexOf(dish) === -1 ? DISH_ORDER.length : DISH_ORDER.indexOf(dish))
  const lunch = shown.recipes
    .filter((r) => r.meal === 'lunch')
    .sort((a, b) => rank(a.dish) - rank(b.dish)) // stable: keeps API order within a dish
    .map((r) => ({ dish: DISHES[r.dish] || cleanName(r.dish), ...item(r) }))
  const snack = shown.recipes.filter((r) => r.meal === 'snackAfternoon').map(item)

  return { service: Boolean(todayMenu), day_label: dayLabel(shown.date), lunch, snack }
}

function transform(input) {
  // A bare JSON array may reach us as-is or wrapped under `data`: accept both.
  const days = Array.isArray(input) ? input : Array.isArray(input && input.data) ? input.data : []
  return shapeMenu(days, new Date())
}
