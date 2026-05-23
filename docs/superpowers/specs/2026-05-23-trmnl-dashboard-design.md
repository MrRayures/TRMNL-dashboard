# TRMNL Dashboard — Document de design

**Date :** 2026-05-23
**Statut :** Validé (brainstorming)
**Framework :** [trmnlp](https://github.com/usetrmnl/trmnlp)

## 1. Objectif

Un plugin TRMNL privé affichant, sur un seul écran e-ink plein écran (800×480), un
tableau de bord personnel combinant trois sources :

1. **Agenda Google Calendar** — vue semaine (aujourd'hui → +6 jours)
2. **Horaires de bus STGA / réseau Möbius** — prochains passages du jour, 2 lignes
3. **Menu de la cantine** — menu du déjeuner du jour (Cuisine Centrale de Saint Yrieix)

## 2. Disposition validée (layout `full`, 800×480)

```
┌──────────────────────────────────────────────────────────┐
│  TABLEAU DE BORD                              Lun. 18 mai  │
├────────────────────────┬─────────────────────────────────┤
│  PROCHAINS BUS         │  AGENDA — SEMAINE                │
│  [9] → St Michel …     │  LUN 18 · 09:00 Dentiste · …     │
│      Arrêt Transfo.    │  MAR 19 · 18:30 Sport            │
│      08:12  puis …     │  MER 20 · 12:00 Déjeuner · …     │
│  [3] → Magnac Mairie   │  JEU 21 · Rien de prévu          │
│      Arrêt Nautilis    │  VEN 22 · 20:00 Cinéma           │
│      08:19  puis …     │  SAM 23 · 10:00 Marché           │
├────────────────────────┤  DIM 24 · Rien de prévu          │
│  MENU DU JOUR          │                                  │
│  Entrée · …            │                                  │
│  Plat · …              │                                  │
│  Dessert · …   [BIO]   │                                  │
└────────────────────────┴─────────────────────────────────┘
   colonne gauche (~40%)      colonne droite (~60%)
```

- **Colonne droite (dominante, ~60%)** : agenda semaine, 7 jours.
- **Colonne gauche haut** : bus, 2 lignes, chacune avec son arrêt et son prochain passage.
- **Colonne gauche bas** : menu du jour (entrée / plat / dessert + labels).
- **v1 : uniquement le layout `full`.** Les variantes half/quadrant ne sont pas
  implémentées (le plugin est destiné à un usage plein écran). Elles pourront être
  ajoutées plus tard sans refonte.

## 3. Architecture

TRMNL n'appelle qu'une seule URL par plugin. On utilise donc un **transform
serverless en Python** (exécuté avant chaque rendu) qui agrège les 3 sources en un
seul objet de données consommé par les templates Liquid.

```
┌─────────────────────────────────────────────────┐
│  transform.py — exécuté à chaque refresh (~15min) │
│    calendar_source.fetch()  → agenda 7 jours      │
│    bus_source.fetch()       → prochains passages  │
│    menu_source.fetch()      → menu du jour         │
│    → { calendar, bus, menu, meta }                │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  full.liquid + shared.liquid → rendu 800×480      │
└─────────────────────────────────────────────────┘
```

**Langage du transform : Python** (parsing iCal, ZIP GTFS et JSON bien outillés).

### Tolérance aux pannes
Chaque source est isolée dans un `try/except`. Si une source échoue (réseau, API
down), les autres s'affichent quand même ; le bloc en échec affiche un message
discret (« Indisponible »). Le transform renvoie **toujours** un objet complet avec
des valeurs par défaut — l'écran ne plante jamais entièrement.

## 4. Sources de données

| Source | Méthode | Auth |
|--------|---------|------|
| Calendrier | URL iCal privée Google (`.ics`) | URL secrète |
| Bus | GTFS statique Möbius (transport.data.gouv.fr) | aucune |
| Menu | API Meridio (AWS Lambda) | aucune (vérifié) |

### 4.1 Calendrier (iCal) — au refresh
- Télécharge l'URL `.ics` privée Google, parse avec `icalendar`.
- Fenêtre : aujourd'hui → +6 jours (7 jours glissants).
- **Expansion des événements récurrents (RRULE)** via `recurring-ical-events`.
- Gestion des événements « toute la journée ».
- Tri par date/heure, regroupement par jour.
- Sortie :
  ```
  calendar.days = [ { date, weekday, label, events: [ { time, title } ] }, … ]
  ```

### 4.2 Bus (GTFS statique) — pré-traitement + refresh

**Pré-traitement one-shot — `bin/build_bus_data.py`**
Télécharge le GTFS Möbius une fois et extrait un petit JSON pré-filtré
(`src/bus_schedule.json`, quelques Ko) :

```json
{
  "stops": [
    { "line": "9", "direction": "St Michel Puygrelier Pkg", "stop": "Transformateur",
      "times": { "weekday": ["07:42","08:12"], "saturday": [], "sunday": [] } },
    { "line": "3", "direction": "Magnac Mairie", "stop": "Nautilis",
      "times": { "weekday": [], "saturday": [], "sunday": [] } }
  ],
  "generated_at": "2026-05-23",
  "gtfs_feed_date": "…"
}
```

**Au refresh — `bus_source.py`** lit ce JSON, détermine le type de jour (semaine /
samedi / dimanche), et calcule pour chaque ligne le **prochain passage + 2 suivants**
à partir de l'heure courante.

- Compromis assumé : horaires **théoriques**, figés au pré-traitement. À la
  modification des horaires réseau (rentrée…), relancer `build_bus_data.py`.
- Risque à lever à l'implémentation : identifier les bons `stop_id`
  (« Transformateur », « Nautilis ») et la bonne direction dans le feed. Si un
  libellé est ambigu, demander confirmation.
- Configuration des 2 lignes :
  - **Ligne 9** → direction *St Michel Puygrelier Pkg*, arrêt *Transformateur*
  - **Ligne 3** → direction *Magnac Mairie*, arrêt *Nautilis*

### 4.3 Menu (API Meridio) — au refresh
- Endpoint vérifié, sans auth :
  `GET /satellite/ivawb/menuDay?startDate=<jour>&endDate=<jour>`
  base : `https://rncuqer6baza2pzhumplpf24da0enxcg.lambda-url.eu-west-3.on.aws`
- `satelliteCode` = `ivawb` (Cuisine Centrale de Saint Yrieix).
- Réponse : liste de jours, chacun avec `recipeList` (`meal`, `dish`, `name`,
  `allergenList`, `labelList`).
- Traitement :
  - filtrer `meal == "lunch"` ;
  - regrouper par `dish` dans l'ordre entrée → vpo/plat → accompagnement →
    fromage → dessert ;
  - agréger les labels (ex. BIO) pour le badge ;
  - sortie : `menu = { date, served: bool, courses: [ { type, name, labels } ] }`.
- Si aucun menu (week-end / vacances) : `served: false` → bloc « Pas de service ».

## 5. Rafraîchissement

- `refresh_interval` = **900 s (15 min)**, défini dans `src/settings.yml`.
- Cohérent avec un écran e-ink ; le temps réel ultra-précis n'a pas d'intérêt ici.

## 6. Structure du projet

```
TRMNL-dashboard/
├── .trmnlp.yml              # config dev local (URLs, secrets) — NON commité
├── .trmnlp.yml.example      # modèle sans secrets — commité
├── src/
│   ├── settings.yml         # config plugin TRMNL (refresh 900s, champs custom)
│   ├── full.liquid          # layout principal (disposition validée)
│   ├── shared.liquid        # styles + macros communs (badge bus, titres)
│   └── bus_schedule.json    # horaires pré-filtrés (généré)
├── lib/
│   ├── transform.py         # agrégateur principal (orchestration)
│   ├── calendar_source.py   # parsing iCal + récurrences
│   ├── bus_source.py        # lecture bus_schedule.json + prochains passages
│   └── menu_source.py       # appel API Meridio + mise en forme
├── bin/
│   └── build_bus_data.py    # pré-traitement GTFS → bus_schedule.json (one-shot)
├── tests/
│   ├── fixtures/            # .ics exemple, menuDay.json réel, mini-GTFS
│   ├── test_calendar.py
│   ├── test_bus.py
│   └── test_menu.py
└── README.md                # setup, config, régénération GTFS
```

- Chaque source = module isolé avec `fetch() → dict`, testable indépendamment.
- `transform.py` orchestre et fusionne uniquement.

## 7. Gestion des secrets

- L'URL iCal privée donne accès à l'agenda → sensible.
- Local : dans `.trmnlp.yml` (gitignored). Production : champs de config TRMNL.
- Jamais commitée. `.gitignore` mis à jour.

## 8. Tests (TDD)

Développement test-first par source, à partir de fixtures réelles :
- un vrai `menuDay.json`, un `.ics` d'exemple, un mini-GTFS.
- Cas limites : pas de menu (week-end), événement récurrent, aucun bus restant
  dans la journée, source en panne (le bloc dégrade proprement).

## 9. Rendu & vérification

- Templates Liquid + TRMNL Design System reproduisant la disposition validée.
- Vérification visuelle via `trmnlp serve` (preview HTML + PNG).

## 10. Hors périmètre v1 (YAGNI)

- Temps réel bus (GTFS-RT / Protobuf) — théorique suffit pour e-ink.
- Layouts half_horizontal / half_vertical / quadrant.
- Parsing du PDF de menu (l'API Meridio le remplace avantageusement).
- OAuth Google Calendar (l'URL iCal privée suffit).
```
