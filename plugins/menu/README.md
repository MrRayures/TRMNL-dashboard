# Plugin: menu

Canteen menu (Cuisine Centrale de Saint Yrieix, Meridio): lunch courses and
the afternoon snack, with BIO/AOP labels and "De saison" / "Fait maison"
badges. The **Affichage** setting (`display`) picks the layout:

- **Menu du jour** (`day`, default): today's menu under its date. On days
  without service (Wednesday, weekends, holidays) it says so and shows the
  next published menu.
- **Semaine** (`week`): one column per served day of the school week
  (Lundi, Mardi, Jeudi, Vendredi), today highlighted. On a weekend, next week.

Both end with a full-width footer, "Menu du 23 au 27 novembre".

- **Views:** `full` only.
- **Framework:** pinned to 3.4.7 in `src/settings.yml`.
- **Data:** polling the Meridio `menuDay` API (public, no auth) over a wide
  fixed date range, which returns every published day (~6 weeks, ~150 KB).
  `src/transform.js` (default runtime) picks today in Europe/Paris, or the next
  served day, and cleans the data.
- **Preview:** `npm run dev`, then `/menu/full`. Fixtures are scenarios
  (`?fixture=no-service`, `week`, `no-menu`, `empty`…);
  `?now=2026-11-26T12:00:00%2B01:00` changes the date, `?display=week` the
  layout.
- **Tests:** `npm test` runs `tests/transform.test.mjs` against real API data.

## Deploy on trmnl.com

1. Settings: strategy **Polling**, URL = `polling_url` from `src/settings.yml`,
   verb GET, refresh as in `refresh_interval`. Form fields: paste the
   `custom_fields` YAML from `src/settings.yml`, then pick **Affichage**.
2. Transform: paste `src/transform.js` (default runtime, JavaScript).
3. Markup: paste `src/shared.liquid` into **Shared** and `src/full.liquid`
   into **Full**.
4. Check the plugin's merge variables: they must match the table below. If
   they are empty, look at how the raw array reaches the transform
   (`transform.js` accepts a bare array or `{ data: [...] }`).

## Merge variables (transform output)

| Key         | Type                                                   | Notes |
| ----------- | ------------------------------------------------------ | ----- |
| `service`   | boolean                                                | `true` when today is served. |
| `day_label` | string                                                 | Day of the menu shown, "Lundi 23 novembre"; `""` when none. |
| `lunch`     | `{ dish, name, labels[], seasonal, homemade }[]`       | Entrée → Plat → Accompagnement → Laitier → Dessert; any may be missing. |
| `snack`     | `{ name, labels[], seasonal, homemade }[]`             | Afternoon snack; may be empty. |
| `week_label`| string                                                 | Served days of that week, "du 23 au 27 novembre" (across months: "du 30 novembre au 4 décembre"); `""` when none. |
| `week`      | `{ weekday, day, today, lunch[], snack[] }[]`         | Served days, Monday to Sunday, of the week of `day_label`. `day`: "23", "1er". |

`labels`: unique ingredient labels, BIO first (`["BIO", "AOP"]`).
`seasonal`: Meridio `seasonality` is `"A"` (the app's "de saison" tag; B, C
and NG are not). `homemade`: Meridio `isHomeMade`.

## Fixtures

`fixtures/inputs/meridio-2026-11-23.json` is a real API response (week of
23 Nov 2026, trimmed to the fields the transform reads). Each
`fixtures/<scenario>.json` is `{ now, input }`:

| Scenario     | When                    | Shows |
| ------------ | ----------------------- | ----- |
| `default`    | Monday 23, 10:00        | Today's lunch + snack |
| `no-service` | Wednesday 25            | Notice + Thursday's menu |
| `no-menu`    | Saturday 28 (data ends) | Notice, nothing published |
| `empty`      | API returned `[]`       | Notice, nothing published |
| `week`       | Tuesday 24, `display: week` | 4 columns, Tuesday highlighted |
| `week-no-menu` | Saturday 28, `display: week` | Notice, nothing published |

A scenario's optional `settings` sets custom field values
(`{ "display": "week" }`); otherwise the defaults from `src/settings.yml`.
