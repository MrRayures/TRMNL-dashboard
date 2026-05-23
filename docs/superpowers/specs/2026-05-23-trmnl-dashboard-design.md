# TRMNL Dashboard — Document de design

**Date :** 2026-05-23
**Statut :** Validé (brainstorming)
**Framework :** [trmnlp](https://github.com/usetrmnl/trmnlp)
**Appareil cible :** [TRMNL X](https://shop.trmnl.com/collections/devices/products/trmnl-x)

## 0. Appareil cible — TRMNL X

| | TRMNL classique | **TRMNL X (cible)** |
|---|---|---|
| Résolution | 800 × 480 | **1872 × 1404** |
| Taille | 7,5" | **10,3"** |
| Niveaux de gris | 1 bit (N&B) | **16 niveaux de gris** |
| Orientation | paysage | paysage **+ portrait** |

**Choix v1 :**
- **Orientation : paysage** (1872 × 1404). La disposition 2 colonnes validée reste
  identique, simplement agrandie à cette résolution.
- **Rendu : noir & blanc** pour la v1. Les 16 niveaux de gris restent disponibles
  pour un raffinement ultérieur (fonds de blocs, hiérarchie de texte), hors v1.
- À vérifier à l'implémentation : comment `trmnlp` (historiquement calé sur
  800×480) gère la résolution du X — via config, viewport, ou rendu adapté.

## 1. Objectif

Un plugin TRMNL privé affichant, sur un seul écran e-ink plein écran
(TRMNL X, 1872 × 1404, paysage), un tableau de bord personnel combinant trois
sources :

1. **Agenda Google Calendar** — vue semaine (aujourd'hui → +6 jours)
2. **Horaires de bus STGA / réseau Möbius** — prochains passages du jour, 2 lignes
3. **Menu de la cantine** — menu du déjeuner du jour (Cuisine Centrale de Saint Yrieix)

## 2. Disposition validée (layout `full`, paysage 1872×1404)

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

TRMNL **Polling supporte plusieurs URLs** (séparées par retour ligne, accessibles
via `IDX_0`, `IDX_1`…), avec interpolation des champs de formulaire
(`{{ form_field_keyname }}`). On exploite ça : TRMNL poll directement les sources
réseau, et un **transform serverless Python léger** met en forme et calcule les bus
depuis un JSON local.

```
TRMNL Polling (multi-URL)            Transform Python (run(input))
┌──────────────────────────┐        ┌─────────────────────────────────┐
│ IDX_0 = API Menu (JSON)  │ ─────► │ menu_source : mise en forme jour │
│ IDX_1 = iCal (.ics texte)│ ─────► │ calendar_source : parse + récur. │
│        (voir repli ↓)    │        │ bus_source : lit bus_schedule.json│
└──────────────────────────┘        │              + prochains passages │
                                     │ → { calendar, bus, menu, meta }   │
                                     └─────────────────────────────────┘
                                                    ↓
                              full.liquid + shared.liquid → 1872×1404
```

**Langage du transform : Python** (parsing iCal, JSON, et lecture du JSON bus).

### Point à vérifier en début d'implémentation — réponse iCal
Le polling TRMNL est orienté JSON. L'iCal renvoie du **texte `.ics`**. Première
tâche du plan : vérifier que le polling passe une réponse non-JSON au transform
comme texte brut.
- **Cas idéal** : iCal + menu pollés nativement (2 URLs).
- **Repli (hybride)** : si le polling refuse le `.ics`, seul le menu est pollé
  nativement ; le transform fetch l'iCal lui-même via HTTP. Le bus reste local
  dans tous les cas.

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

**Données GTFS vérifiées (2026-05-23) :**
- URL stable (toujours la dernière saison) :
  `https://www.data.gouv.fr/api/1/datasets/r/021fd4a3-ba9a-4d78-aa65-71d4d289f389`
- Ligne 9 = `route_id` 185 (`route_short_name` "9"), headsign **"St Michel
  Puygrelier Pkg"**. Arrêt **Transformateur** = station `10386` (quais 20780/20781).
- Ligne 3 = `route_id` 179 (`route_short_name` "3"), headsign **"Magnac Mairie"**.
  Arrêt **Nautilis** = station `10598` (quais 21219/21220).
- Filtrage du sens : par `trip_headsign` (et non par `direction_id`).
- Type de jour : via `calendar.txt` + `calendar_dates.txt` (exceptions/fériés).

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
- Réponse vérifiée (2026-05-23) : liste de jours, chacun avec `recipeList`. Champs
  par recette : `meal` (`lunch` | `snackAfternoon`), `dish`, `name`,
  `allergenList`, `ingredientList`.
- Valeurs `dish` du déjeuner observées : `entree`, `vpo` (plat protéiné),
  `accompagnement`, `laitier`, `dessert`.
- **Labels (BIO/AOC/AOP)** : au niveau **ingrédient** (`ingredientList[].labelList`),
  pas au niveau recette → on agrège pour un badge par plat.
- Traitement :
  - filtrer `meal == "lunch"` (ignorer `snackAfternoon`) ;
  - regrouper par `dish` dans l'ordre entrée → vpo → accompagnement → laitier →
    dessert ;
  - agréger les labels des ingrédients pour le badge ;
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
- Cible : 1872×1404 paysage, noir & blanc. Tailles de police et espacements
  dimensionnés pour cette résolution (lisibilité à ~10").
- Vérification visuelle via `trmnlp serve` (preview HTML + PNG), en confirmant le
  rendu à la résolution du TRMNL X.

## 10. Hors périmètre v1 (YAGNI)

- Temps réel bus (GTFS-RT / Protobuf) — théorique suffit pour e-ink.
- Layouts half_horizontal / half_vertical / quadrant.
- Orientation portrait (paysage uniquement en v1).
- Exploitation des 16 niveaux de gris (noir & blanc en v1).
- Parsing du PDF de menu (l'API Meridio le remplace avantageusement).
- OAuth Google Calendar (l'URL iCal privée suffit).
```
