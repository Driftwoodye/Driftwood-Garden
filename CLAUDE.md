# Driftwood Garden

A single-file static catalogue app (`index.html`) for tracking plants, seeds,
bulbs, and a wishlist. `index.html` has no build step or server-side code
and reads only from the local CSV files
(`plants.csv`, `seeds.csv`, `seeds-extra.csv`, `bulbs.csv`, `wishlist.csv`,
`images.csv`) — it never fetches Google Sheets directly, live in the
browser (that path was slow and depended on a third-party CORS proxy).

The Google Sheet is the editor; the CSVs are the data source `index.html`
reads. `.github/workflows/sync-google-sheet.yml` runs
`scripts/sync-sheet.mjs` on a schedule (and via `workflow_dispatch` /
`repository_dispatch`) to pull each tab through the public gviz CSV export
(`/gviz/tq?tqx=out:csv&sheet=`, server-side so no CORS proxy is needed)
and commit the resulting CSVs back to the repo. Do not reintroduce a live
Google Sheets fetch (gviz, `/export?format=csv`, a CORS proxy, etc.) into
`index.html` — edit the sheet and let the sync workflow update the CSVs.

## Auto-matched images (`commons-cache.json`)

Records without a manual entry in `images.csv` get an auto-matched
historic illustration from Wikimedia Commons (with a Biodiversity
Heritage Library fallback), scored to prefer engravings/plates over
modern photos — see `HISTORIC_TERMS`/`MODERN_TERMS`/`scoreCommonsPage` in
`index.html`. The match for each scientific name is pre-computed by
`scripts/build-commons-cache.mjs` and written to `commons-cache.json`
(committed to the repo), which `index.html` loads at startup and checks
before ever querying Commons live — this keeps the chosen image
consistent for every visitor instead of each browser re-running the
search and potentially landing on a different result.
`.github/workflows/build-commons-cache.yml` runs the script weekly (and
via `workflow_dispatch`) and commits the file if it changed. The script
only fetches names not already present in the cache (pass `--force` to
refetch everything) and never records a network error as a "no match" —
only a genuinely empty search result is cached that way — so a bad
run doesn't permanently poison an entry.

## plants.csv columns

`plants.csv` has these columns only:

- Plant ID
- Scientific name
- Family
- Common name EN
- Common name DE
- Common name PT
- Status
- Original geographical provenance
- Source / acquired
- Current location
- Wikipedia

The following fields do **not** exist in `plants.csv` (they were removed and must not be re-added or referenced in `index.html` for the `plants` type): Difficulty rating, Future location, Plant form, Pot size, Light, Water, Soil / substrate, Notes.

Other CSVs (`wishlist.csv`, `seeds.csv`, `bulbs.csv`) still have their own versions of some of these fields (e.g. wishlist's `Light needs`, `Water needs`, `Soil / substrate`) — those are unrelated and should stay as-is.

## index.html structure

- `maps` (per catalogue type) maps internal keys to CSV column names. `maps.plants` must only reference the columns above.
- `fieldLabels` supplies display labels used first for the `plants` type in the modal.
- `transform()` builds each row object only from the keys present in `maps[type]`, so removing a key from `maps.plants` removes it everywhere (cards, modal, filters) for plants.

## Modal behavior

Clicking a card opens a detail modal (`renderModal` in `index.html`). The
modal body renders every populated field on the record except a fixed
exclusion list — see the `Object.entries(x).forEach(...)` skip check in
`renderModal`.

The following fields are **never shown in the modal body**, on any tab
(Plants, Seeds, Bulbs, Wishlist), because they already appear in the card
header (and modal header) and would be redundant to repeat:

- Scientific name (`name` — labeled "Catalog name" on the Bulbs tab)
- Common name EN (`common`)
- Common name DE (`commonDe`)
- Common name PT (`commonPt`)

Note: on the Bulbs tab, `scientific` is a separate field (the bulb's actual
scientific name, distinct from the catalog/trade `name`) and is not part of
this exclusion — it still renders in the modal body.
