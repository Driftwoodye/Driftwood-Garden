# Driftwood Garden

A single-file static catalogue app (`index.html`) for tracking plants, seeds,
bulbs, and a wishlist. Data is loaded client-side from CSV files
(`plants.csv`, `seeds.csv`, `seeds-extra.csv`, `bulbs.csv`, `wishlist.csv`,
`images.csv`); there is no build step or server-side code.

## plants.csv columns

`plants.csv` has these columns only:

- Plant ID
- Scientific name
- Family
- Common name EN
- Common name DE
- Common name PT
- Status
- Source
- Current location
- Wikipedia

The `Source` column merges the former `Original geographical provenance` and
`Source / acquired` columns into a single free-text field (their values
combined, separated by `; `). It is labelled "Origin / source" in the modal.

The following fields do **not** exist in `plants.csv` (they were removed and must not be re-added or referenced in `index.html` for the `plants` type): Difficulty rating, Future location, Plant form, Pot size, Light, Water, Soil / substrate, Notes, Original geographical provenance, Source / acquired (as separate columns — see `Source` above).

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
