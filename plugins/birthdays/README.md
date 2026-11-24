# Plugin: birthdays

Les prochains anniversaires, avec l'âge et le nombre de jours restants. Celui
du jour est mis en avant. Les anniversaires de mariage affichent le type de
noces.

## Préparer l'agenda (une seule fois)

1. Dans Google Agenda, crée un nouvel agenda **Anniversaires**.
2. Pour chaque personne : un événement **toute la journée**, à sa **date de
   naissance** (l'année compte, pour l'âge), répété **chaque année**. Titre =
   le nom à afficher.
   Année inconnue : crée-le cette année, l'âge ne sera pas affiché.
   **Anniversaire de mariage** : même chose, à la date du mariage, avec un
   titre qui commence par **Mariage** (ex. `Mariage Claire et Antoine`).
   L'écran affiche « 12 ans de mariage · Noces de soie ».
3. Paramètres de l'agenda Anniversaires → **Adresse secrète au format iCal** :
   copie-la. Ne la partage pas, ne la mets jamais dans ce dépôt.

## Installer sur TRMNL

Sur trmnl.com : **Plugins → Private Plugin → Add Private Plugin**. Remplis
les champs ci-dessous. Ceux qui ne sont pas listés restent tels quels.

| Champ | Valeur |
| ----- | ------ |
| **Nom** | `Anniversaires` |
| **Strategy** | `Static` |
| **Static data** (le champ JSON qui apparaît) | `{}` |
| **Form Fields** | le bloc ci-dessous (`npm run copy -- birthdays fields`) |
| **Allow self-signed certificate** | désactivé |
| **Enable OAuth Authentication?** | désactivé |
| **Fastest refresh rate** | vide |
| **Remove bleed margin?** | `No` |
| **Enable Dark Mode?** | `No` |
| **Framework CSS version** | `v3.4.7` |

**Form Fields**, à copier tel quel :

```yaml
- keyname: ical_url
  field_type: password
  name: Adresse iCal secrète
  description: 'Google Agenda → paramètres de l''agenda Anniversaires → Adresse secrète au format iCal.'
  placeholder: https://calendar.google.com/calendar/ical/…/private-…/basic.ics
```

Clique sur **Enregistrer**. Dans les réglages du plugin, colle l'adresse
secrète dans **Adresse iCal secrète**.

Puis **Modifier le balisage**. Pour copier un fichier, lance sa commande dans
le terminal du projet, puis colle (Ctrl+V) dans l'onglet :

| Onglet (en bas) | Commande pour copier |
| ------ | -------------------- |
| **Code**, avec **Full** sélectionné en haut | `npm run copy -- birthdays full` |
| **Shared** | `npm run copy -- birthdays shared` |
| **Serverless**, langage **Node** (obligatoire) | `npm run copy -- birthdays serverless` |

Clique sur **Save**. La prévisualisation doit montrer les prochains
anniversaires. Si elle affiche « Agenda indisponible », la ligne « Reçu : … »
en dessous dit pourquoi : envoie-la.

**Ajouter ou modifier un anniversaire** : directement dans Google Agenda.
L'écran se met à jour tout seul.

**Mettre à jour** après une nouvelle version : recopie seulement les
fichiers modifiés (voir [CHANGELOG.md](CHANGELOG.md)).

## Development

- **Views:** `full` only: two columns, centred vertically. Left third, on a
  very light background (`bg--gray-75`, gone in 1 bit), centred:
  the icon (cake, or rings for a wedding), `greeting` (title),
  `years_label` (value xsmall) and `noces_label`; with nobody today, the
  cake and "Pas d'anniversaire aujourd'hui". Right two thirds: the others as
  items (name, then countdown · `date_short` · age), no icon. Up to 10
  birthdays in all; a second birthday today shows in the list as
  "Aujourd'hui".
- **Data:** private, so not hosted here (`.claude/rules/data-hosting.md`).
  TRMNL polling only accepts JSON ("Malformed JSON from url" on an .ics), so
  the plugin uses the **Static** strategy and the **serverless** `run()`
  downloads the calendar's secret iCal address itself, read from the
  `ical_url` password field (looked up anywhere in `input`, e.g.
  `input.trmnl.plugin_settings.custom_fields_values`). `transform()` parses
  the .ics, treats every event as a yearly birthday on its start date (29 Feb
  → 28 Feb in other years), skips cancelled events and overrides, and works
  in Europe/Paris.
- **Weddings:** a title starting with "Mariage" (or "Anniversaire de
  mariage") is a wedding anniversary: the prefix is dropped from the name,
  the age reads "12 ans de mariage" and `noces_label` gives the traditional
  French name (1-50, then 55, 60, 70, 75, 80; other years: none).
- **Diagnosis:** when unavailable, `received` describes the input's shape or
  the fetch failure (HTTP status, error name), never its content or the URL;
  the screen shows it.
- **Preview:** `npm run dev`, then `/birthdays` (all fixtures: `?fixture=all`) or `/birthdays/full`
  (`?fixture=no-today`, `wedding`, `empty`, `unavailable`).
- **Tests:** `npm test` runs `tests/transform.test.mjs`. Fixture people are
  made up: this repository is public.

## Merge variables (transform output)

| Key         | Type | Notes |
| ----------- | ---- | ----- |
| `available` | boolean | `false` when the input holds no iCal data (wrong URL, fetch error). |
| `received`  | string | Only when unavailable: why (input shape, HTTP status, network error). |
| `today_label` | string | Today's date for the title bar, e.g. `24 novembre 2026` (`1er` on the first). Always set. |
| `today`     | `Birthday[]` | Birthdays today; may be empty. |
| `upcoming`  | `Birthday[]` | Next ones, soonest first; `today` + `upcoming` ≤ 10. |

`Birthday`: `{ name, greeting, years_label, date_label, date_short, days, countdown, age,
age_label, wedding, noces_label }`, e.g. `{ "name": "Hugo", "greeting": "C'est
l'anniversaire de Hugo", "years_label": "14 ans", "date_label": "Mardi 1er décembre", "date_short": "1er décembre", "days": 7, "countdown":
"Dans 7 jours", "age": 14, "age_label": "14 ans", "wedding": false,
"noces_label": "" }`. For a wedding: `"wedding": true`, `"greeting": "C'est
l'anniversaire de mariage de Claire et Antoine"`, `"years_label": "12 ans"`,
`"age_label": "12 ans de mariage"`, `"noces_label": "Noces de soie"`.
`greeting` elides before a vowel ("d'Élodie", not before h). `age` is `null` and
`age_label` `""` when the birth year is unknown.

## Fixtures

`fixtures/inputs/calendar.ics`: a Google Calendar style export with made-up
people (yearly events, a 29 February, an unknown year, a wedding, a
cancelled event, an escaped comma).

| Scenario      | When                  | Shows |
| ------------- | --------------------- | ----- |
| `default`     | Tuesday 24 November   | Léa today, then the next 9 |
| `wedding`     | Sunday 20 December    | Claire and Antoine's 12th wedding anniversary today (noces de soie) |
| `no-today`    | Thursday 26 November  | 10 upcoming, nobody today |
| `empty`       | Calendar with no event | "Aucun anniversaire" |
| `unavailable` | No iCal data          | "Agenda indisponible" |
