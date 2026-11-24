# Plugin: menu

Menu de la cantine (Cuisine Centrale de Saint Yrieix, via Méridio) : menu du
jour ou de la semaine, avec les badges BIO, AOP, De saison et Fait maison.

## Installer sur TRMNL

Sur trmnl.com : **Plugins → Private Plugin → Add Private Plugin**. Remplis
les champs ci-dessous. Ceux qui ne sont pas listés restent tels quels.

| Champ | Valeur |
| ----- | ------ |
| **Nom** | `Menu cantine` |
| **Strategy** | `Polling` |
| **Polling URL(s)** | l'adresse ci-dessous |
| **Polling Verb** | `GET` |
| **Polling Headers** | vide |
| **Polling Body** | vide |
| **Form Fields** | le bloc ci-dessous (`npm run copy -- menu fields`) |
| **Allow self-signed certificate** | désactivé |
| **Enable OAuth Authentication?** | désactivé |
| **Fastest refresh rate** | vide |
| **Remove bleed margin?** | `No` |
| **Enable Dark Mode?** | `No` |
| **Framework CSS version** | `v3.4.7` |

**Polling URL(s)**, à copier tel quel :

```
https://mrrayures.github.io/TRMNL-dashboard/menu.json
```

**Form Fields**, à copier tel quel :

```yaml
- keyname: display
  field_type: select
  name: Affichage
  description: Menu du jour, ou les jours servis de la semaine en colonnes.
  options:
  - 'Menu du jour': day
  - 'Semaine': week
  default: day
```

Clique sur **Enregistrer**, puis sur **Modifier le balisage** et colle chaque
fichier dans son onglet :

Pour copier un fichier, lance sa commande dans le terminal du projet, puis
colle (Ctrl+V) dans l'onglet :

| Onglet (en bas) | Commande pour copier |
| ------ | -------------------- |
| **Code**, avec **Full** sélectionné en haut | `npm run copy -- menu full` |
| **Shared** | `npm run copy -- menu shared` |
| **Serverless**, langage **Node** | `npm run copy -- menu serverless` |

Clique sur **Save**. La prévisualisation doit montrer le menu du jour. Si
elle affiche « Aucun menu publié », clique sur **Variables** et vérifie que
`lunch` et `week` y figurent.

**Changer d'affichage** : dans les réglages du plugin, champ **Affichage** →
`Menu du jour` ou `Semaine`.

**Mettre à jour** après une nouvelle version : recopie seulement les
fichiers modifiés (voir [CHANGELOG.md](CHANGELOG.md)).

## Development

Layouts, picked by the `display` custom field:

- `day` (default): today's menu under its date. On days without service
  (Wednesday, weekends, holidays) a notice and the next published menu.
- `week`: one column per served day of the school week, today highlighted;
  on a weekend, next week.

Both end with a full-width footer, "Menu du 23 au 27 novembre".

- **Views:** `full` only.
- **Framework:** pinned to 3.4.7 in `src/settings.yml`.
- **Data:** every Monday, `.github/workflows/sync-data.yml` runs
  `scripts/sync/menu.mjs`: it fetches every published day from the Meridio
  `menuDay` API (public, no auth, ~6 weeks, ~150 KB), keeps only the fields
  the transform reads (~25 KB) and publishes `menu.json` on GitHub Pages
  (`data` branch). If the API fails, the previous file stays.
  `src/transform.js` (default runtime) picks today in Europe/Paris, or the
  next served day, and cleans the data.
- **Manual refresh:** GitHub → Actions → *sync data* → *Run workflow*.
- **Preview:** `npm run dev`, then `/menu/full`. Fixtures are scenarios
  (`?fixture=no-service`, `week`, `no-menu`, `empty`…);
  `?now=2026-11-26T12:00:00%2B01:00` changes the date, `?display=week` the
  layout.
- **Tests:** `npm test` runs `tests/*.test.mjs` against real API data.
- **First deploy check:** the transform accepts the polled array bare or as
  `{ data: [...] }`; if trmnl.com shows "Aucun menu publié" on a school day,
  inspect the merge variables there.

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
