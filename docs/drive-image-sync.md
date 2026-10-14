# Automatic Google Drive image synchronization

**Active. No API key or manual CSV editing is required for new images.**

The existing Google Sheet remains the editor for catalogue data. The site
reads CSV files committed to GitHub. GitHub Actions downloads the six
Google Sheet tabs, scans the two public Drive folders, associates new files
with catalogued plants by their scientific name, and updates the image CSVs.

The workflow is scheduled every 15 minutes. GitHub Actions scheduled jobs
may run later than requested, so this is **periodic automatic polling**,
not an immediate Drive upload event.

## Where to upload

- Personal photographs: https://drive.google.com/drive/folders/1T2w5LrEQMzS_-dVsM8mI-ksPP2ZEsSLc
- Botanical illustrations: https://drive.google.com/drive/folders/1aL2GJrV4YFHzFp99rlq7i4nOkkyHRIDA

Keep both folders and individual images publicly readable: “Anyone with
the link — Viewer”. The site displays the images from Drive; the actual
image files are not copied into GitHub.

## Filenames

Use the scientific name, with spaces or underscores. For example:

- `Operculicarya pachypus.jpg`
- `Operculicarya pachypus (2).jpg`
- `Operculicarya pachypus (3).jpg`
- `Rhododendron_indicum_'Hoki'.jpg`
- `Chamaecyparis_obtusa_'Nana Gracilis'.jpg`

A species-only filename can associate with a single owned cultivar,
where there is no ambiguity. Unrecognised filenames are logged and
skipped instead of being attached to the wrong plant.

The plant must already be present in the catalogue; uploading an image
does not create a plant. Photographs are matched to the Plants tab.
Illustrations may also be associated with Seeds, Bulbs, or Wishlist.

Multiple files for the same species are supported. Photos and illustrations
are displayed in the corresponding card and in its detail gallery.

## Automatic processing

Workflow: https://github.com/Driftwoodye/Driftwood-Garden/actions/workflows/sync-google-sheet.yml

- Every scheduled run fetches the latest Sheets data and finds Drive image
  files automatically through the public embedded folder view.
- The importer identifies each picture by Drive file ID, so it does not
  create duplicates across scheduled runs.
- It retains previously linked photographs and illustrations and updates
  stale Drive IDs when a picture is replaced.
- A missing or incomplete folder listing causes a workflow error, rather
  than deleting existing site records.
- The public folder view is an **unofficial Google interface**. If Google
  changes it, the sync may require maintenance. An optional restricted
  Google Drive API key can be set as the GitHub Actions secret
  `GOOGLE_DRIVE_API_KEY` for use of Google's documented API.
- Image metadata and author/licence fields should be curated in the
  Images/Illustrations tabs in Google Sheets. The importer does not
  automatically determine whether an illustration has reuse permission.

## Testing and restoration

On 14 October 2026 a push-triggered sync successfully discovered the three
new illustrations (Chamaecyparis, Hibiscus, and Rhododendron), and a second
scheduled run succeeded with no additional Git changes (repeat-run check).

The core website `index.html` is unchanged. A snapshot of the original
GitHub state is preserved at:
https://github.com/Driftwoodye/Driftwood-Garden/tree/backup/image-sync-before-fix-2026-10-13
