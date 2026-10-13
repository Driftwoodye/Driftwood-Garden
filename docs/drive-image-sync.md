# Automatic Drive image indexing

The site's existing Google Sheets -> CSV synchronization stays in place.
Every 15 minutes, GitHub Actions runs `scripts/sync-sheet.mjs`, which pulls
all six catalogue tabs from the editing spreadsheet. Afterwards,
`scripts/sync-drive-images.mjs` optionally searches the *public* image folders
and adds new image references to the generated CSVs.

## One-time activation

1. In Google Cloud Console, enable the **Google Drive API** for a project.
2. Under **APIs & Services > Credentials**, create an API key. Restrict it to
   the **Google Drive API**. Do not put the key into the website or the repo.
3. Add the key as an Actions repository secret named `GOOGLE_DRIVE_API_KEY`:
   https://github.com/Driftwoodye/Driftwood-Garden/settings/secrets/actions
4. Optionally start `Sync Google Sheet to CSVs` in the GitHub Actions tab
   using **Run workflow**; otherwise the existing 15-minute schedule will do it.

Folders used:
- Photographs: https://drive.google.com/drive/folders/1T2w5LrEQMzS_-dVsM8mI-ksPP2ZEsSLc
- Illustrations: `DG - illustrations` subfolder (ID `1aL2GJrV4YFHzFp99rlq7i4nOkkyHRIDA`).

Both folders must stay shared for public reading (and individual pictures
must also be readable by visitors). The images themselves stay in Google Drive;
only URLs are indexed in the site CSVs.

## Filename matching and safeguards

- Use the species' scientific name as the filename, e.g. `Operculicarya pachypus.jpg`.
- Botanical illustrations belong in `DG - illustrations`; photographs go
  in the parent pictures folder.
- The indexer matches a full scientific name first, or a base species name
  where the catalogue entry includes a cultivar.
- For photos, only plants in `plants.csv` are candidates.
- For illustrations, plant, seed, bulb and wishlist items can be candidates.
- Unmatched images are **skipped and logged**, never incorrectly assigned.
- Existing records and attribution are retained. Replaced Drive files are
  relinked where their previous file is no longer in the public folder.
- Existing images are never deleted. If the API key is missing, the Sheets
  sync works as before; the Drive augmentation is skipped.
- The site `index.html` is unchanged.

**Important:** entries inserted automatically into `images.csv` or
`illustrations.csv` are part of the generated website data. They are not
written back to the Google Sheet. The script repeats its additions after
each Sheets sync. If you want to curate author/licence information, add
it to the corresponding row in the **Google Sheet**, not the generated CSV.

The current site's backup snapshot is retained in the GitHub branch
`backup/image-sync-before-fix-2026-10-13`.
