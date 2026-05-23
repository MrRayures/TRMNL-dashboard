# TRMNL Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-screen TRMNL X plugin showing a weekly Google Calendar agenda, next STGA/Möbius buses (lines 9 & 3), and today's school-canteen menu, on one 1872×1404 landscape e-ink screen.

**Architecture:** TRMNL Polling fetches the network sources (canteen JSON API; iCal feed — native if accepted, otherwise fetched inside the transform). A lightweight Python serverless transform (`src/transform.py`, `run(input)`) shapes that data and computes upcoming buses from a pre-generated local `src/bus_schedule.json`. Liquid templates (`full.liquid` + `shared.liquid`) render the validated 2-column layout. Bus data is produced once by a one-shot GTFS pre-processing script (`bin/build_bus_data.py`).

**Tech Stack:** Python 3.11+, Liquid (TRMNL Design System), trmnlp dev server, pytest. Python libs: `icalendar`, `recurring-ical-events`, `requests` (stdlib `zipfile`/`csv` for GTFS).

**Reference spec:** `docs/superpowers/specs/2026-05-23-trmnl-dashboard-design.md`

**Verified facts (2026-05-23):**
- Canteen API (no auth): `GET https://rncuqer6baza2pzhumplpf24da0enxcg.lambda-url.eu-west-3.on.aws/satellite/ivawb/menuDay?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- GTFS stable URL: `https://www.data.gouv.fr/api/1/datasets/r/021fd4a3-ba9a-4d78-aa65-71d4d289f389`
- Line 9 → route_id 185, headsign "St Michel Puygrelier Pkg", stop Transformateur = station 10386 (platforms 20780/20781)
- Line 3 → route_id 179, headsign "Magnac Mairie", stop Nautilis = station 10598 (platforms 21219/21220)

---

## File Structure

| File | Responsibility |
|------|----------------|
| `requirements.txt` | Python deps for transform + build script + tests |
| `pytest.ini` | Test config (rootdir, testpaths) |
| `bin/build_bus_data.py` | One-shot: download GTFS, filter lines 9/3 at their stops, emit `src/bus_schedule.json` |
| `src/bus_schedule.json` | Generated: per-line departure times by day-type |
| `lib/bus_source.py` | Read `bus_schedule.json`, compute next departures for "now" |
| `lib/menu_source.py` | Parse canteen menuDay JSON → today's courses |
| `lib/calendar_source.py` | Parse iCal text → 7-day agenda with recurrence expansion |
| `lib/transform_core.py` | Pure aggregator: combine the three source dicts into final payload |
| `src/transform.py` | trmnlp entrypoint `run(input)`; wires polling input + bus JSON into `transform_core` |
| `src/settings.yml` | TRMNL plugin config: strategy=polling, polling URLs, form fields, refresh |
| `src/full.liquid` | Full layout (validated 2-column design) |
| `src/shared.liquid` | Shared CSS + markup macros |
| `.trmnlp.yml.example` | Dev config template (committed, no secrets) |
| `.trmnlp.yml` | Dev config with real iCal URL (gitignored) |
| `tests/fixtures/` | Real `menuDay.json`, sample `.ics`, sample `bus_schedule.json` |
| `tests/test_bus.py`, `tests/test_menu.py`, `tests/test_calendar.py`, `tests/test_transform.py` | Unit tests |
| `README.md` | Setup, config, regenerating GTFS |

---

## Task 0: Project scaffolding & dependencies

**Files:**
- Create: `requirements.txt`, `pytest.ini`, `.gitignore` (append), `lib/__init__.py`, `tests/__init__.py`

- [ ] **Step 1: Create `requirements.txt`**

```
requests==2.32.3
icalendar==6.1.0
recurring-ical-events==3.3.4
pytest==8.3.4
```

- [ ] **Step 2: Create `pytest.ini`**

```ini
[pytest]
testpaths = tests
pythonpath = . lib
```

- [ ] **Step 3: Append to `.gitignore`**

```
.trmnlp.yml
__pycache__/
*.pyc
.pytest_cache/
```

- [ ] **Step 4: Create empty package markers**

Create `lib/__init__.py` (empty) and `tests/__init__.py` (empty).

- [ ] **Step 5: Install deps and verify pytest runs**

Run: `python -m pip install -r requirements.txt && python -m pytest -q`
Expected: pytest collects 0 items, exits 0 (no tests yet).

- [ ] **Step 6: Commit**

```bash
git add requirements.txt pytest.ini .gitignore lib/__init__.py tests/__init__.py
git commit -m "chore: scaffold python project for trmnl dashboard"
```

---

## Task 1: Verify TRMNL polling accepts non-JSON iCal (spike)

This resolves the spec's open question before building. It is a manual investigation task; record the outcome in the README.

**Files:**
- Modify: `README.md` (create with a "## Polling notes" section)

- [ ] **Step 1: Test whether a `.ics` polling response reaches the transform as text**

Run trmnlp later in Task 7; for now, document the decision rule. Inspect the trmnlp/TRMNL behaviour by reading: https://help.trmnl.com/en/articles/9510536-private-plugins and the trmnlp README polling section.

Decision rule to record:
- If polling passes raw text for non-JSON content types → **native iCal polling** (`IDX_1` = iCal text).
- If polling requires JSON / drops the body → **hybrid**: transform fetches iCal itself via `requests`.

- [ ] **Step 2: Write `README.md` skeleton recording the decision**

```markdown
# TRMNL Dashboard

Full-screen TRMNL X plugin: weekly Google Calendar agenda, STGA/Möbius bus times
(lines 9 & 3), and the daily canteen menu.

## Polling notes

- Canteen menu: polled natively (JSON) as `IDX_0`.
- iCal calendar: decided mode = **<NATIVE|HYBRID>** (set after Task 7 spike).
  - NATIVE: second polling URL, transform reads `input["IDX_1"]` as text.
  - HYBRID: transform fetches the iCal URL itself (URL provided via env/custom field).

## Setup

(Filled in Task 9.)
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: record polling strategy decision rule"
```

> **Note for implementer:** `calendar_source.parse_ical(text)` (Task 4) takes iCal **text** regardless of mode, so calendar parsing is mode-independent. Only `src/transform.py` (Task 6) differs slightly between NATIVE and HYBRID. Build Tasks 2–6 mode-agnostically; finalize the wiring in Task 7.

---

## Task 2: Bus pre-processing script (`build_bus_data.py`)

**Files:**
- Create: `bin/build_bus_data.py`
- Create: `src/bus_schedule.json` (generated output, committed)
- Test: `tests/test_build_bus_data.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_build_bus_data.py
import io, zipfile, json
from pathlib import Path
import importlib.util

def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod

build = _load("build_bus_data", "bin/build_bus_data.py")

def _mini_gtfs():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("routes.txt", "route_id,route_short_name,route_long_name\n185,9,Ligne 9\n179,3,Ligne 3\n")
        z.writestr("trips.txt",
            "route_id,service_id,trip_id,trip_headsign\n"
            "185,WK,t9a,St Michel Puygrelier Pkg\n"
            "185,WK,t9b,St Yrieix la Pouyade\n"   # wrong direction, must be excluded
            "179,WK,t3a,Magnac Mairie\n")
        z.writestr("stops.txt",
            "stop_id,stop_name,location_type,parent_station\n"
            "10386,Transformateur,1,\n20780,Transformateur,0,10386\n"
            "10598,Nautilis,1,\n21219,Nautilis,0,10598\n")
        z.writestr("stop_times.txt",
            "trip_id,arrival_time,departure_time,stop_id,stop_sequence\n"
            "t9a,08:12:00,08:12:00,20780,5\n"
            "t9b,09:00:00,09:00:00,20780,5\n"   # excluded (wrong headsign)
            "t3a,08:19:00,08:19:00,21219,3\n")
        z.writestr("calendar.txt",
            "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n"
            "WK,1,1,1,1,1,0,0,20250101,20261231\n")
        z.writestr("calendar_dates.txt", "service_id,date,exception_type\n")
    return buf.getvalue()

def test_build_filters_lines_stops_directions(tmp_path):
    gtfs = tmp_path / "g.zip"; gtfs.write_bytes(_mini_gtfs())
    out = tmp_path / "bus_schedule.json"
    build.build(str(gtfs), str(out), config=build.DEFAULT_CONFIG)
    data = json.loads(out.read_text(encoding="utf-8"))
    stops = {(s["line"], s["stop"]): s for s in data["stops"]}
    assert stops[("9","Transformateur")]["times"]["weekday"] == ["08:12"]
    assert stops[("3","Nautilis")]["times"]["weekday"] == ["08:19"]
    assert "09:00" not in stops[("9","Transformateur")]["times"]["weekday"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_build_bus_data.py -v`
Expected: FAIL (`build_bus_data.py` not found / no attribute `build`).

- [ ] **Step 3: Implement `bin/build_bus_data.py`**

```python
#!/usr/bin/env python3
"""One-shot: download Möbius GTFS and emit src/bus_schedule.json filtered to the
two configured line/stop/direction pairs. Re-run when network schedules change."""
import sys, csv, io, json, zipfile, datetime
from urllib.request import urlopen

GTFS_URL = "https://www.data.gouv.fr/api/1/datasets/r/021fd4a3-ba9a-4d78-aa65-71d4d289f389"

# line short_name, stop station name, direction headsign
DEFAULT_CONFIG = [
    {"line": "9", "stop": "Transformateur", "headsign": "St Michel Puygrelier Pkg"},
    {"line": "3", "stop": "Nautilis",       "headsign": "Magnac Mairie"},
]

DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]

def _read(z, name):
    return list(csv.DictReader(io.TextIOWrapper(z.open(name), encoding="utf-8-sig")))

def _hhmm(t):
    # GTFS times can exceed 24h (e.g. 25:10); normalize to display HH:MM, keep order key
    h, m, _ = t.split(":")
    return f"{int(h)%24:02d}:{m}"

def _daytype(service_id, calendar):
    row = calendar.get(service_id)
    if not row:
        return None
    if row["saturday"] == "1": sat = True
    else: sat = False
    if row["sunday"] == "1": sun = True
    else: sun = False
    wk = any(row[d] == "1" for d in DAYS[:5])
    return {"weekday": wk, "saturday": sat, "sunday": sun}

def build(gtfs_path_or_zipbytes, out_path, config=DEFAULT_CONFIG):
    if isinstance(gtfs_path_or_zipbytes, (bytes, bytearray)):
        z = zipfile.ZipFile(io.BytesIO(gtfs_path_or_zipbytes))
    else:
        z = zipfile.ZipFile(gtfs_path_or_zipbytes)

    routes = _read(z, "routes.txt")
    trips = _read(z, "trips.txt")
    stops = _read(z, "stops.txt")
    calendar = {r["service_id"]: r for r in _read(z, "calendar.txt")}

    short_to_routeids = {}
    for r in routes:
        short_to_routeids.setdefault(r["route_short_name"], set()).add(r["route_id"])

    # station name -> set of platform stop_ids (location_type 0 children) + station id
    name_to_stopids = {}
    station_id_by_name = {s["stop_id"]: s["stop_name"] for s in stops if s.get("location_type") == "1"}
    for s in stops:
        ids = name_to_stopids.setdefault(s["stop_name"], set())
        ids.add(s["stop_id"])

    out_stops = []
    for cfg in config:
        route_ids = short_to_routeids.get(cfg["line"], set())
        stop_ids = name_to_stopids.get(cfg["stop"], set())
        # trips for this line in the wanted direction
        wanted_trips = {
            t["trip_id"]: t["service_id"]
            for t in trips
            if t["route_id"] in route_ids and t.get("trip_headsign") == cfg["headsign"]
        }
        times = {"weekday": set(), "saturday": set(), "sunday": set()}
        for st in _read(z, "stop_times.txt"):
            tid = st["trip_id"]
            if tid in wanted_trips and st["stop_id"] in stop_ids:
                dt = _daytype(wanted_trips[tid], calendar)
                if not dt: continue
                hhmm = _hhmm(st["departure_time"])
                for key in ("weekday","saturday","sunday"):
                    if dt[key]: times[key].add(hhmm)
        out_stops.append({
            "line": cfg["line"],
            "direction": cfg["headsign"],
            "stop": cfg["stop"],
            "times": {k: sorted(v) for k, v in times.items()},
        })

    payload = {
        "stops": out_stops,
        "generated_at": datetime.date.today().isoformat(),
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return payload

def main():
    print(f"Downloading GTFS from {GTFS_URL} ...")
    data = urlopen(GTFS_URL, timeout=120).read()
    build(data, "src/bus_schedule.json")
    print("Wrote src/bus_schedule.json")

if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_build_bus_data.py -v`
Expected: PASS.

- [ ] **Step 5: Generate the real `src/bus_schedule.json`**

Run: `python bin/build_bus_data.py`
Expected: prints "Wrote src/bus_schedule.json"; file contains lines 9 and 3 with non-empty weekday times.

- [ ] **Step 6: Sanity-check the generated file**

Run: `python -c "import json;d=json.load(open('src/bus_schedule.json',encoding='utf-8'));print([(s['line'],s['stop'],len(s['times']['weekday'])) for s in d['stops']])"`
Expected: both lines present with weekday count > 0 (e.g. line 9 ~49, line 3 ~120).

- [ ] **Step 7: Commit**

```bash
git add bin/build_bus_data.py tests/test_build_bus_data.py src/bus_schedule.json
git commit -m "feat: GTFS pre-processing to bus_schedule.json"
```

---

## Task 3: Bus source — next departures (`lib/bus_source.py`)

**Files:**
- Create: `lib/bus_source.py`
- Test: `tests/test_bus.py`
- Create: `tests/fixtures/bus_schedule.json`

- [ ] **Step 1: Create fixture `tests/fixtures/bus_schedule.json`**

```json
{
  "stops": [
    { "line": "9", "direction": "St Michel Puygrelier Pkg", "stop": "Transformateur",
      "times": { "weekday": ["08:12","08:32","08:52","09:12"], "saturday": ["09:00"], "sunday": [] } },
    { "line": "3", "direction": "Magnac Mairie", "stop": "Nautilis",
      "times": { "weekday": ["08:19","08:49","09:19"], "saturday": [], "sunday": [] } }
  ],
  "generated_at": "2026-05-23"
}
```

- [ ] **Step 2: Write the failing test**

```python
# tests/test_bus.py
import datetime
import bus_source

FIX = "tests/fixtures/bus_schedule.json"

def test_next_departures_weekday_midmorning():
    now = datetime.datetime(2026, 5, 18, 8, 20)  # Monday 08:20
    result = bus_source.next_departures(FIX, now=now, count=3)
    line9 = next(b for b in result if b["line"] == "9")
    assert line9["direction"] == "St Michel Puygrelier Pkg"
    assert line9["stop"] == "Transformateur"
    assert line9["next"] == "08:32"
    assert line9["following"] == ["08:52", "09:12"]

def test_no_more_buses_today():
    now = datetime.datetime(2026, 5, 18, 23, 0)  # Monday night
    result = bus_source.next_departures(FIX, now=now, count=3)
    line3 = next(b for b in result if b["line"] == "3")
    assert line3["next"] is None
    assert line3["following"] == []

def test_sunday_empty_service():
    now = datetime.datetime(2026, 5, 24, 9, 0)  # Sunday
    result = bus_source.next_departures(FIX, now=now, count=3)
    line9 = next(b for b in result if b["line"] == "9")
    assert line9["next"] is None
```

- [ ] **Step 3: Run test to verify it fails**

Run: `python -m pytest tests/test_bus.py -v`
Expected: FAIL (`bus_source` not found).

- [ ] **Step 4: Implement `lib/bus_source.py`**

```python
"""Read a pre-generated bus_schedule.json and compute the next departures."""
import json, datetime

def _daytype(now):
    wd = now.weekday()  # Mon=0..Sun=6
    if wd == 5: return "saturday"
    if wd == 6: return "sunday"
    return "weekday"

def next_departures(schedule_path, now=None, count=3):
    now = now or datetime.datetime.now()
    daytype = _daytype(now)
    cur = now.strftime("%H:%M")
    with open(schedule_path, encoding="utf-8") as f:
        data = json.load(f)
    out = []
    for s in data["stops"]:
        upcoming = [t for t in s["times"].get(daytype, []) if t > cur]
        out.append({
            "line": s["line"],
            "direction": s["direction"],
            "stop": s["stop"],
            "next": upcoming[0] if upcoming else None,
            "following": upcoming[1:count],
        })
    return out
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_bus.py -v`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/bus_source.py tests/test_bus.py tests/fixtures/bus_schedule.json
git commit -m "feat: bus_source computes next departures from local schedule"
```

---

## Task 4: Menu source (`lib/menu_source.py`)

**Files:**
- Create: `lib/menu_source.py`
- Test: `tests/test_menu.py`
- Create: `tests/fixtures/menuDay_served.json`, `tests/fixtures/menuDay_empty.json`

- [ ] **Step 1: Create fixtures**

`tests/fixtures/menuDay_served.json`:
```json
[
  { "day": "2026-05-18T00:00:00.000Z",
    "recipeList": [
      { "meal": "lunch", "dish": "entree", "name": "Oeufs mimosa",
        "ingredientList": [ { "name": "Oeuf", "labelList": [] }, { "name": "Mayonnaise", "labelList": ["BIO"] } ] },
      { "meal": "lunch", "dish": "vpo", "name": "Boulgour aux petits légumes",
        "ingredientList": [ { "name": "Boulgour", "labelList": ["BIO"] } ] },
      { "meal": "lunch", "dish": "laitier", "name": "Petit suisse", "ingredientList": [] },
      { "meal": "lunch", "dish": "dessert", "name": "Fraises", "ingredientList": [] },
      { "meal": "snackAfternoon", "dish": null, "name": "Biscuit", "ingredientList": [] }
    ] }
]
```

`tests/fixtures/menuDay_empty.json`:
```json
[]
```

- [ ] **Step 2: Write the failing test**

```python
# tests/test_menu.py
import json
import menu_source

def _load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)

def test_served_day_groups_and_orders_courses():
    raw = _load("tests/fixtures/menuDay_served.json")
    menu = menu_source.shape(raw)
    assert menu["served"] is True
    types = [c["type"] for c in menu["courses"]]
    assert types == ["entree", "vpo", "laitier", "dessert"]  # snackAfternoon excluded, ordered
    entree = menu["courses"][0]
    assert entree["name"] == "Oeufs mimosa"

def test_labels_aggregated_from_ingredients():
    raw = _load("tests/fixtures/menuDay_served.json")
    menu = menu_source.shape(raw)
    vpo = next(c for c in menu["courses"] if c["type"] == "vpo")
    assert "BIO" in vpo["labels"]

def test_empty_day_not_served():
    raw = _load("tests/fixtures/menuDay_empty.json")
    menu = menu_source.shape(raw)
    assert menu["served"] is False
    assert menu["courses"] == []
```

- [ ] **Step 3: Run test to verify it fails**

Run: `python -m pytest tests/test_menu.py -v`
Expected: FAIL (`menu_source` not found).

- [ ] **Step 4: Implement `lib/menu_source.py`**

```python
"""Shape the Meridio menuDay JSON into today's lunch courses."""
DISH_ORDER = ["entree", "vpo", "accompagnement", "laitier", "dessert"]

def shape(raw_days):
    """raw_days: list as returned by GET /satellite/<code>/menuDay (one or more days).
    Returns the first day's lunch menu shaped for display."""
    if not raw_days:
        return {"date": None, "served": False, "courses": []}
    day = raw_days[0]
    recipes = [r for r in day.get("recipeList", []) if r.get("meal") == "lunch"]
    if not recipes:
        return {"date": day.get("day"), "served": False, "courses": []}

    by_dish = {}
    for r in recipes:
        labels = set()
        for ing in (r.get("ingredientList") or []):
            for l in (ing.get("labelList") or []):
                labels.add(l)
        by_dish.setdefault(r.get("dish"), []).append(
            {"type": r.get("dish"), "name": r.get("name"), "labels": sorted(labels)}
        )

    courses = []
    for dish in DISH_ORDER:
        courses.extend(by_dish.get(dish, []))
    # include any unexpected dish types at the end, stable
    for dish, items in by_dish.items():
        if dish not in DISH_ORDER:
            courses.extend(items)

    return {"date": day.get("day"), "served": True, "courses": courses}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_menu.py -v`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/menu_source.py tests/test_menu.py tests/fixtures/menuDay_served.json tests/fixtures/menuDay_empty.json
git commit -m "feat: menu_source shapes Meridio menuDay into courses"
```

---

## Task 5: Calendar source (`lib/calendar_source.py`)

**Files:**
- Create: `lib/calendar_source.py`
- Test: `tests/test_calendar.py`
- Create: `tests/fixtures/sample.ics`

- [ ] **Step 1: Create fixture `tests/fixtures/sample.ics`**

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//FR
BEGIN:VEVENT
UID:1@test
DTSTART:20260518T090000
DTEND:20260518T093000
SUMMARY:Dentiste
END:VEVENT
BEGIN:VEVENT
UID:2@test
DTSTART;VALUE=DATE:20260520
DTEND;VALUE=DATE:20260521
SUMMARY:Jour ferie
END:VEVENT
BEGIN:VEVENT
UID:3@test
DTSTART:20260519T183000
DTEND:20260519T193000
RRULE:FREQ=WEEKLY;COUNT=4
SUMMARY:Sport
END:VEVENT
END:VCALENDAR
```

- [ ] **Step 2: Write the failing test**

```python
# tests/test_calendar.py
import datetime
import calendar_source

def _ics():
    with open("tests/fixtures/sample.ics", encoding="utf-8") as f:
        return f.read()

def test_week_window_groups_events_by_day():
    start = datetime.date(2026, 5, 18)  # Monday
    cal = calendar_source.parse_ical(_ics(), start=start, days=7)
    by_date = {d["date"]: d for d in cal["days"]}
    assert len(cal["days"]) == 7
    mon = by_date["2026-05-18"]
    assert any(e["title"] == "Dentiste" and e["time"] == "09:00" for e in mon["events"])

def test_all_day_event_has_no_time():
    start = datetime.date(2026, 5, 18)
    cal = calendar_source.parse_ical(_ics(), start=start, days=7)
    wed = next(d for d in cal["days"] if d["date"] == "2026-05-20")
    ferie = next(e for e in wed["events"] if e["title"] == "Jour ferie")
    assert ferie["time"] is None
    assert ferie["all_day"] is True

def test_recurring_event_expanded_within_window():
    start = datetime.date(2026, 5, 18)
    cal = calendar_source.parse_ical(_ics(), start=start, days=7)
    tue = next(d for d in cal["days"] if d["date"] == "2026-05-19")
    assert any(e["title"] == "Sport" and e["time"] == "18:30" for e in tue["events"])

def test_empty_day_has_empty_events():
    start = datetime.date(2026, 5, 18)
    cal = calendar_source.parse_ical(_ics(), start=start, days=7)
    thu = next(d for d in cal["days"] if d["date"] == "2026-05-21")
    assert thu["events"] == []
```

- [ ] **Step 3: Run test to verify it fails**

Run: `python -m pytest tests/test_calendar.py -v`
Expected: FAIL (`calendar_source` not found).

- [ ] **Step 4: Implement `lib/calendar_source.py`**

```python
"""Parse an iCal feed (text) into a 7-day agenda with recurrence expansion."""
import datetime
import icalendar
import recurring_ical_events

WEEKDAYS_FR = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"]

def _as_date(value):
    if isinstance(value, datetime.datetime):
        return value.date()
    return value

def parse_ical(text, start=None, days=7):
    start = start or datetime.date.today()
    end = start + datetime.timedelta(days=days - 1)
    cal = icalendar.Calendar.from_ical(text)
    events = recurring_ical_events.of(cal).between(start, end + datetime.timedelta(days=1))

    buckets = {start + datetime.timedelta(days=i): [] for i in range(days)}
    for ev in events:
        dtstart = ev.get("DTSTART").dt
        is_all_day = not isinstance(dtstart, datetime.datetime)
        d = _as_date(dtstart)
        if d not in buckets:
            continue
        buckets[d].append({
            "title": str(ev.get("SUMMARY", "")),
            "time": None if is_all_day else dtstart.strftime("%H:%M"),
            "all_day": is_all_day,
            "_sort": "" if is_all_day else dtstart.strftime("%H:%M"),
        })

    out_days = []
    for i in range(days):
        d = start + datetime.timedelta(days=i)
        evs = sorted(buckets[d], key=lambda e: e["_sort"])
        for e in evs:
            e.pop("_sort", None)
        out_days.append({
            "date": d.isoformat(),
            "weekday": WEEKDAYS_FR[d.weekday()],
            "label": f"{WEEKDAYS_FR[d.weekday()]} {d.day:02d}",
            "events": evs,
        })
    return {"days": out_days}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_calendar.py -v`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/calendar_source.py tests/test_calendar.py tests/fixtures/sample.ics
git commit -m "feat: calendar_source parses iCal into 7-day agenda"
```

---

## Task 6: Aggregator core (`lib/transform_core.py`)

**Files:**
- Create: `lib/transform_core.py`
- Test: `tests/test_transform.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_transform.py
import transform_core

def test_aggregate_combines_three_sources():
    calendar = {"days": [{"date": "2026-05-18", "weekday": "LUN", "label": "LUN 18", "events": []}]}
    bus = [{"line": "9", "direction": "X", "stop": "Transformateur", "next": "08:32", "following": ["08:52"]}]
    menu = {"date": "2026-05-18", "served": True, "courses": [{"type": "entree", "name": "Oeufs", "labels": []}]}
    payload = transform_core.aggregate(calendar=calendar, bus=bus, menu=menu)
    assert payload["calendar"]["days"][0]["label"] == "LUN 18"
    assert payload["bus"][0]["next"] == "08:32"
    assert payload["menu"]["served"] is True
    assert payload["meta"]["ok"] is True

def test_failed_source_degrades_without_crashing():
    payload = transform_core.aggregate(
        calendar={"days": []}, bus=None, menu=None,
        errors={"bus": "boom", "menu": "timeout"},
    )
    assert payload["bus"] == []
    assert payload["menu"]["served"] is False
    assert payload["meta"]["ok"] is False
    assert "bus" in payload["meta"]["errors"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_transform.py -v`
Expected: FAIL (`transform_core` not found).

- [ ] **Step 3: Implement `lib/transform_core.py`**

```python
"""Pure aggregator: merge the three shaped sources into the final template payload.
No I/O here — keeps it trivially testable."""

def aggregate(calendar=None, bus=None, menu=None, errors=None):
    errors = errors or {}
    safe_calendar = calendar if calendar else {"days": []}
    safe_bus = bus if bus else []
    safe_menu = menu if menu else {"date": None, "served": False, "courses": []}
    return {
        "calendar": safe_calendar,
        "bus": safe_bus,
        "menu": safe_menu,
        "meta": {"ok": not errors, "errors": errors},
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_transform.py -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite**

Run: `python -m pytest -q`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/transform_core.py tests/test_transform.py
git commit -m "feat: transform_core aggregates sources with graceful degradation"
```

---

## Task 7: trmnlp entrypoint + settings + polling spike resolution

**Files:**
- Create: `src/transform.py`
- Create: `src/settings.yml`
- Create: `.trmnlp.yml.example`
- Modify: `README.md` (set NATIVE/HYBRID decision)

- [ ] **Step 1: Implement `src/transform.py` supporting both modes**

```python
"""trmnlp serverless entrypoint. Receives polled data on stdin as JSON via run(input).
Shapes menu + calendar, computes buses from the local schedule, aggregates."""
import os, sys, json, datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))

import bus_source, menu_source, calendar_source, transform_core

SCHEDULE = os.path.join(os.path.dirname(__file__), "bus_schedule.json")

def _get_ical_text(input):
    # NATIVE: TRMNL polled the iCal as a second URL -> input["IDX_1"] is the text.
    # HYBRID: no iCal in input -> fetch it ourselves from ICAL_URL.
    idx1 = input.get("IDX_1")
    if isinstance(idx1, str) and "BEGIN:VCALENDAR" in idx1:
        return idx1
    url = os.environ.get("ICAL_URL")
    if url:
        import requests
        return requests.get(url, timeout=20).text
    return None

def _menu_raw(input):
    # NATIVE single source is IDX_0; if only one polling URL, data is unprefixed.
    if "IDX_0" in input:
        return input["IDX_0"]
    if isinstance(input.get("data"), list):
        return input["data"]
    return input if isinstance(input, list) else []

def run(input):
    errors = {}
    today = datetime.date.today()

    try:
        menu = menu_source.shape(_menu_raw(input))
    except Exception as e:
        menu, errors["menu"] = None, str(e)

    try:
        ical = _get_ical_text(input)
        calendar = calendar_source.parse_ical(ical, start=today, days=7) if ical else None
        if calendar is None:
            errors["calendar"] = "no ical source"
    except Exception as e:
        calendar, errors["calendar"] = None, str(e)

    try:
        bus = bus_source.next_departures(SCHEDULE, count=3)
    except Exception as e:
        bus, errors["bus"] = None, str(e)

    return transform_core.aggregate(calendar=calendar, bus=bus, menu=menu, errors=errors)

if __name__ == "__main__":
    print(json.dumps(run(json.load(sys.stdin)), ensure_ascii=False))
```

- [ ] **Step 2: Smoke-test the transform locally with NATIVE-style input**

Run:
```bash
python -c "import json,subprocess; ics=open('tests/fixtures/sample.ics',encoding='utf-8').read(); menu=json.load(open('tests/fixtures/menuDay_served.json',encoding='utf-8')); inp=json.dumps({'IDX_0':menu,'IDX_1':ics}); print(subprocess.run(['python','src/transform.py'],input=inp,text=True,capture_output=True).stdout)"
```
Expected: a JSON object with `calendar`, `bus`, `menu`, `meta` keys; `menu.served` true. (Bus may be empty depending on current time — acceptable.)

- [ ] **Step 3: Decide NATIVE vs HYBRID and update README**

Run `trmnlp serve` (full setup in Task 8). Configure two polling URLs (menu + iCal). Observe whether `input["IDX_1"]` contains the iCal text in the rendered preview/logs.
- If yes → NATIVE. In `README.md`, set "decided mode = **NATIVE**".
- If the `.ics` body is dropped → HYBRID. Set "decided mode = **HYBRID**" and rely on `ICAL_URL` env var (already handled in `_get_ical_text`).

Edit `README.md` to replace `<NATIVE|HYBRID>` with the chosen value.

- [ ] **Step 4: Create `src/settings.yml`**

```yaml
---
name: Tableau de bord
refresh_interval: 900
strategy: polling
polling_verb: get
polling_url: |
  https://rncuqer6baza2pzhumplpf24da0enxcg.lambda-url.eu-west-3.on.aws/satellite/ivawb/menuDay?startDate={{ today }}&endDate={{ today }}
  {{ ical_url }}
serverless_language: python
custom_fields:
  - keyname: ical_url
    field_type: string
    name: URL iCal privée Google
    description: Lien .ics secret de ton agenda Google
```

> If Task 7 Step 3 chose HYBRID, remove the second polling line (`{{ ical_url }}`) and instead pass the iCal URL to the transform via the `ICAL_URL` env var (set in `.trmnlp.yml` for dev, and in TRMNL's plugin env for prod).

- [ ] **Step 5: Create `.trmnlp.yml.example`**

```yaml
---
transform_runtime: enabled
serverless_language: python
custom_fields:
  ical_url: "https://calendar.google.com/calendar/ical/REPLACE_ME/private-XXXX/basic.ics"
variables:
  today: "2026-05-18"
# HYBRID mode only:
# env:
#   ICAL_URL: "https://calendar.google.com/calendar/ical/REPLACE_ME/private-XXXX/basic.ics"
```

- [ ] **Step 6: Commit**

```bash
git add src/transform.py src/settings.yml .trmnlp.yml.example README.md
git commit -m "feat: trmnlp entrypoint, polling settings, dev config template"
```

---

## Task 8: Liquid templates (full layout + shared)

**Files:**
- Create: `src/shared.liquid`
- Create: `src/full.liquid`
- Create: `.trmnlp.yml` (local, gitignored — real iCal URL for preview)

- [ ] **Step 1: Create `.trmnlp.yml` for local preview**

Copy `.trmnlp.yml.example` to `.trmnlp.yml` and paste the real private iCal URL into `custom_fields.ical_url`. Set `variables.today` to today's date in `YYYY-MM-DD`.

> This file is gitignored (Task 0). It must never be committed.

- [ ] **Step 2: Create `src/shared.liquid` (styles + macros)**

```liquid
{% comment %} Shared styles + macros for the dashboard, sized for TRMNL X 1872x1404 {% endcomment %}
<style>
  .dash { width:100%; height:100%; display:flex; flex-direction:column;
          font-family:'Helvetica Neue',Arial,sans-serif; color:#000; }
  .dash-head { display:flex; justify-content:space-between; align-items:baseline;
               padding:18px 28px; border-bottom:5px solid #000; }
  .dash-head h1 { font-size:38px; font-weight:800; margin:0; text-transform:uppercase; letter-spacing:2px; }
  .dash-head .date { font-size:30px; font-weight:600; }
  .dash-body { flex:1; display:flex; }
  .col-left { flex:1; display:flex; flex-direction:column; border-right:4px solid #000; }
  .col-right { flex:1.4; padding:20px 28px; }
  .panel { padding:20px 28px; }
  .panel + .panel { border-top:4px solid #000; }
  .title { font-weight:800; font-size:26px; text-transform:uppercase; letter-spacing:1px;
           border-bottom:3px solid #000; padding-bottom:8px; margin-bottom:16px; }
  .bus-row { display:flex; align-items:flex-start; gap:18px; margin-bottom:22px; }
  .badge { border:3px solid #000; font-weight:800; font-size:34px; padding:2px 18px; border-radius:8px; min-width:60px; text-align:center; }
  .bus-dir { font-size:24px; font-weight:600; }
  .bus-stop { font-size:20px; color:#333; }
  .bus-time { font-size:46px; font-weight:800; line-height:1.1; }
  .bus-after { font-size:20px; color:#333; }
  .row { font-size:26px; line-height:1.5; }
  .muted { color:#555; }
  .strong { font-weight:700; }
  .pill { display:inline-block; border:2px solid #000; border-radius:14px; padding:1px 12px; font-size:18px; font-weight:700; margin-right:6px; }
</style>
```

- [ ] **Step 3: Create `src/full.liquid`**

```liquid
{% include 'shared' %}
<div class="dash">
  <div class="dash-head">
    <h1>Tableau de bord</h1>
    <span class="date">{{ "now" | date: "%a. %d %b" }}</span>
  </div>
  <div class="dash-body">

    <div class="col-left">
      <div class="panel">
        <div class="title">Prochains bus</div>
        {% for b in bus %}
          <div class="bus-row">
            <span class="badge">{{ b.line }}</span>
            <div>
              <div class="bus-dir">→ {{ b.direction }}</div>
              <div class="bus-stop">Arrêt {{ b.stop }}</div>
              {% if b.next %}
                <div class="bus-time">{{ b.next }}</div>
                {% if b.following.size > 0 %}
                  <div class="bus-after">puis {{ b.following | join: " · " }}</div>
                {% endif %}
              {% else %}
                <div class="bus-after">Plus de bus aujourd'hui</div>
              {% endif %}
            </div>
          </div>
        {% endfor %}
      </div>

      <div class="panel">
        <div class="title">Menu du jour</div>
        {% if menu.served %}
          {% for c in menu.courses %}
            <div class="row">
              <span class="muted">{{ c.type }}</span> · {{ c.name }}
              {% for l in c.labels %}<span class="pill">{{ l }}</span>{% endfor %}
            </div>
          {% endfor %}
        {% else %}
          <div class="row muted">Pas de service aujourd'hui</div>
        {% endif %}
      </div>
    </div>

    <div class="col-right">
      <div class="title">Agenda — semaine</div>
      {% for day in calendar.days %}
        <div class="row">
          <span class="strong">{{ day.label }}</span>
          {% if day.events.size > 0 %}
            ·
            {% for e in day.events %}
              {% if e.time %}{{ e.time }} {% endif %}{{ e.title }}{% unless forloop.last %} · {% endunless %}
            {% endfor %}
          {% else %}
            · <span class="muted">Rien de prévu</span>
          {% endif %}
        </div>
      {% endfor %}
    </div>

  </div>
</div>
```

- [ ] **Step 4: Run trmnlp preview**

Run: `trmnlp serve` (or `bin/trmnlp serve` if vendored).
Open http://localhost:4567 and confirm the full layout renders with real data (agenda right, bus + menu left).

- [ ] **Step 5: Confirm PNG render at TRMNL X resolution**

In the preview, switch to PNG/full render. Verify text is legible and the 2-column layout holds at 1872×1404. Adjust font sizes in `shared.liquid` if needed and re-check.

- [ ] **Step 6: Commit (templates only — never `.trmnlp.yml`)**

```bash
git add src/shared.liquid src/full.liquid
git commit -m "feat: full-screen Liquid layout for TRMNL X"
```

---

## Task 9: README, end-to-end check, finalize

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Flesh out `README.md`**

```markdown
## Setup

1. `python -m pip install -r requirements.txt`
2. Generate bus data: `python bin/build_bus_data.py` (re-run when STGA schedules change, e.g. each school year).
3. Copy `.trmnlp.yml.example` → `.trmnlp.yml`, paste your private Google iCal URL into `custom_fields.ical_url`.
4. `trmnlp serve` → open http://localhost:4567

## Tests

`python -m pytest`

## Deploying

`trmnlp login` then `trmnlp push`. In TRMNL, set the `ical_url` custom field
(and, in HYBRID mode, the `ICAL_URL` plugin env var).

## Data sources

- Calendar: private Google iCal URL.
- Bus: STGA / Möbius GTFS (transport.data.gouv.fr), lines 9 & 3, pre-filtered to
  `src/bus_schedule.json`.
- Menu: Meridio canteen API (Cuisine Centrale de Saint Yrieix, code `ivawb`).
```

- [ ] **Step 2: Run the full test suite one final time**

Run: `python -m pytest -q`
Expected: all green.

- [ ] **Step 3: Verify no secrets are tracked**

Run: `git status --porcelain && git ls-files | grep -E "trmnlp.yml$" || echo "OK: .trmnlp.yml not tracked"`
Expected: `.trmnlp.yml` is NOT listed by `git ls-files`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: complete setup, deploy, and data-source notes"
```

---

## Self-Review notes (addressed)

- **Spec coverage:** calendar (Task 5), bus pre-proc + runtime (Tasks 2–3), menu (Task 4), aggregation + graceful degradation (Task 6), polling architecture + iCal mode (Tasks 1, 7), full layout 1872×1404 (Task 8), secrets handling (Tasks 0, 8, 9), tests with edge cases (each task). ✔
- **Open spec question (iCal over polling):** explicitly spiked in Task 1 and resolved in Task 7; code paths for both NATIVE and HYBRID are written, not deferred. ✔
- **Type consistency:** `next_departures` returns `{line,direction,stop,next,following}` (Tasks 3, 6, 8); `shape` returns `{date,served,courses[{type,name,labels}]}` (Tasks 4, 6, 8); `parse_ical` returns `{days[{date,weekday,label,events[{title,time,all_day}]}]}` (Tasks 5, 8); `aggregate` returns `{calendar,bus,menu,meta}` (Tasks 6, 7, 8). ✔
- **Out of scope (v1):** GTFS-RT, half/quadrant layouts, portrait, grayscale, PDF menu, OAuth. ✔
