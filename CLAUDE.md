# Driftwood Garden

A static HTML catalogue (`index.html`) that reads several CSV files client-side: `plants.csv`, `seeds.csv`, `seeds-extra.csv`, `bulbs.csv`, `wishlist.csv`, `images.csv`.

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
