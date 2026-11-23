# Plugin: agenda

My week at a glance: today plus the next six days, with each day's events.

- **Views:** `full` only (v1).
- **Framework:** pinned to 3.4.7 in `src/settings.yml`.
- **Source:** private Google Calendar iCal feed, parsed by a transform
  (recurrences included, 7-day rolling window; see `docs/superpowers/`). Not
  wired yet: `polling_url` is empty. The iCal URL is a secret: it lives in the
  plugin's settings on trmnl.com, never in this repo.
- **Preview:** `npm run dev`, then `/agenda/full` (`?fixture=empty`, `?bits=1`).
- **Deploy:** paste `src/full.liquid` into the plugin's markup editor on
  trmnl.com.

## Payload contract

| Key          | Type                                        | Notes                                         |
| ------------ | ------------------------------------------- | --------------------------------------------- |
| `week_label` | string                                      | Pre-formatted, e.g. "18 – 24 mai".            |
| `days`       | `{ label, date, today, events[] }[]`        | 7 entries, today first. `label` "LUN", `date` "18". |
| `days[].events` | `{ time, title }[]`                      | Sorted by time. `time` "HH:MM", or `""` for an all-day event. May be empty. |

Fixtures: `fixtures/default.json` (a normal week, with an all-day event),
`fixtures/empty.json` (nothing planned).
