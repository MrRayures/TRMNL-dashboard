# Plugin data: host it ourselves when we can

Plugins poll **our own copy** of their data rather than a third-party API,
whenever the data does not need to be live. TRMNL then keeps working if the
source is down or changes, and the payload is trimmed to what the plugin uses.

| Data | Where | Refresh |
| ---- | ----- | ------- |
| Public, changes on a schedule (menu, bus timetables) | `data` branch, GitHub Pages: `https://mrrayures.github.io/TRMNL-dashboard/<file>.json` | `.github/workflows/sync-data.yml` (weekly), or by hand for yearly data |
| Private (birthdays, personal calendars) | Never in this repo or on Pages: a private source TRMNL polls directly (secret iCal URL, …) | at the source |
| Live (agenda) | the source API, polled by TRMNL | TRMNL refresh rate |

## Rules

- The repository **and** the Pages site are public: only public data goes on
  the `data` branch. Never personal data, secrets or private URLs.
- One sync script per plugin in `scripts/sync/<plugin>.mjs`, Node built-ins
  only. It writes the trimmed file; the workflow commits it to `data` only if
  it changed.
- A failed or empty fetch must **not** overwrite the previous file: throw, the
  workflow fails, the last good data stays online.
- Keep the source's shape (trimmed): the transform must accept both our copy
  and the raw API. A test checks that the trimmed data renders the same.
- The `data` branch is written by the workflow only; never by hand, never
  merged into `main`.
- Secret URLs (private iCal, tokens) go in TRMNL only, in a `password` Form
  Field, never in `settings.yml`.
- TRMNL polling only accepts JSON. For anything else (iCal, CSV, HTML): the
  Static strategy (`{}`) and a serverless `async run(input)` that fetches the
  source itself, reading the URL from the form field in `input`. On failure,
  return the empty state with a reason, never the URL or the error message.
