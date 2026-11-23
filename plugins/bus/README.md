# Plugin: bus

Next departures for my bus lines (Möbius network, Angoulême): for each line,
its stop, the next departure and the two following ones.

- **Views:** `full` only (v1).
- **Framework:** pinned to 3.4.7 in `src/settings.yml`.
- **Source:** Möbius static GTFS, pre-processed into a timetable, with the
  next departures computed at refresh (see `docs/superpowers/plans/`). Not
  wired yet: `polling_url` is empty.
- **Preview:** `npm run dev`, then `/bus/full` (`?fixture=empty`, `?bits=1`).
- **Deploy:** paste `src/full.liquid` into the plugin's markup editor on
  trmnl.com.

## Payload contract

| Key          | Type                                              | Notes                                   |
| ------------ | ------------------------------------------------- | --------------------------------------- |
| `updated_at` | string                                            | Pre-formatted time of the computation, "08:04". |
| `lines`      | `{ number, headsign, stop, departures[] }[]`      | One entry per followed line.            |
| `lines[].departures` | string[]                                  | "HH:MM", ascending; only the first 3 are shown. May be empty. |

Fixtures: `fixtures/default.json` (two lines), `fixtures/empty.json` (no line).
