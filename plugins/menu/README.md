# Plugin: menu

Today's canteen menu (Cuisine Centrale de Saint Yrieix): lunch courses plus the
afternoon snack.

- **Views:** `full` only (v1).
- **Framework:** pinned to 3.4.7 in `src/settings.yml`.
- **Source:** Meridio `menuDay` API, to be shaped by a transform (see
  `docs/superpowers/plans/`). Not wired yet: `polling_url` is empty.
- **Preview:** `npm run dev`, then `/menu/full` (`?fixture=empty`, `?bits=1`).
- **Deploy:** paste `src/full.liquid` (and `src/shared.liquid` when non-empty)
  into the plugin's markup editor on trmnl.com.

## Payload contract

| Key          | Type                         | Notes                                |
| ------------ | ---------------------------- | ------------------------------------ |
| `service`    | boolean                      | `false` on days with no lunch.       |
| `date_label` | string                       | Pre-formatted, e.g. "Lundi 18 mai".  |
| `lunch`      | `{ dish, name, labels[] }[]` | Ordered as served.                   |
| `snack`      | `{ dish, name, labels[] }[]` | May be empty.                        |

Fixtures: `fixtures/default.json` (normal day), `fixtures/empty.json` (no
service).
