#!/usr/bin/env node
// Non-destructive Drive folder -> existing image CSVs indexer.
// Runs AFTER sync-sheet.mjs downloads the source-of-truth Google Sheet CSVs.
// Never deletes rows, invents plant records, or changes the site's HTML.
import { readFile, writeFile } from 'node:fs/promises';

const PHOTO_FOLDER_ID = '1T2w5LrEQMzS_-dVsM8mI-ksPP2ZEsSLc';
const ILLUSTRATION_FOLDER_ID = '1aL2GJrV4YFHzFp99rlq7i4nOkkyHRIDA';
const IMAGE_EXT = /\.(?:jpe?g|png|webp|gif)$/i;

function parseCsv(input) {
  const rows = []; let row = [], value = '', quoted = false;
  const text = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(value); value = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(value); if (row.some(x => x.trim())) rows.push(row);
      row = []; value = '';
    } else { value += c; }
  }
  row.push(value); if (row.some(x => x.trim())) rows.push(row);
  if (quoted) throw new Error('Unclosed CSV quote');
  return rows;
}
function serializeCsv(rows) {
  return rows.map(row => row.map(cell => '"' + String(cell ?? '').replace(/"/g, '""') + '"').join(',')).join('\n') + '\n';
}
function norm(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
function speciesKey(value) {
  return norm(value).replace(/\s+['"].*$/, '').trim();
}
function stem(filename) {
  return String(filename).replace(IMAGE_EXT, '').replace(/\s*\(\d+\)$/, '').trim();
}
function driveId(url) {
  const s = String(url ?? '');
  return s.match(/(?:\/d\/|[?&]id=)([a-zA-Z0-9_-]{20,})/)?.[1] ?? '';
}
async function listPublicFolder(folderId, apiKey) {
  const files = []; let pageToken = '';
  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', "'" + folderId + "' in parents and trashed = false");
    url.searchParams.set('fields', 'nextPageToken,incompleteSearch,files(id,name,mimeType,modifiedTime)');
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set('key', apiKey);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 450);
      throw new Error('Google Drive listing failed (' + response.status + '): ' + body);
    }
    const page = await response.json();
    if (page.incompleteSearch) throw new Error('Google Drive returned an incomplete folder listing');
    files.push(...(page.files ?? []));
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
  return files.filter(f => f.id && IMAGE_EXT.test(f.name ?? '') && String(f.mimeType ?? '').startsWith('image/'))
    .sort((a, b) => String(b.modifiedTime ?? '').localeCompare(String(a.modifiedTime ?? '')) || a.name.localeCompare(b.name));
}
async function loadCsv(path) { return parseCsv(await readFile(path, 'utf8')); }
function col(header, name) {
  const i = header.indexOf(name);
  if (i < 0) throw new Error('Expected column missing: ' + name);
  return i;
}
function catalog(rows, nameColumn, idColumn) {
  const [head, ...items] = rows;
  const nameIdx = col(head, nameColumn), idIdx = col(head, idColumn);
  return items.filter(r => r[idIdx] && r[nameIdx])
    .map(r => ({ name: r[nameIdx], id: r[idIdx], idField: idColumn, base: speciesKey(r[nameIdx]) }));
}
function findPlant(filename, plants) {
  const key = norm(stem(filename));
  // Prefer an owned plant, then a seed lot, bulb or wishlist item.
  const exact = plants.filter(p => norm(p.name) === key);
  if (exact.length) return exact[0];
  const species = plants.filter(p => p.base === key);
  return species.length ? species[0] : null;
}
function addToRows(csv, fileList, records, kind) {
  const header = csv[0];
  const index = Object.fromEntries(['Scientific name', 'Plant ID', 'Bulb Lot ID', 'Seed Lot ID', 'Wishlist ID',
    'Image URL', 'Image type', 'Author', 'License', 'Source URL', 'Primary', 'Notes']
      .map(name => [name, col(header, name)]));
  const existingIds = new Set(csv.slice(1).map(r => driveId(r[index['Image URL']])).filter(Boolean));
  const liveIds = new Set(fileList.map(f => f.id));
  let added = 0, replaced = 0, skipped = 0;
  const srcField = kind === 'photos' ? 'Photograph' : 'Botanical illustration';
  for (const file of fileList) {
    if (existingIds.has(file.id)) continue;
    const plant = findPlant(file.name, records);
    if (!plant) { skipped++; console.warn('Unmatched ' + kind + ': ' + file.name); continue; }
    const url = 'https://lh3.googleusercontent.com/d/' + file.id;
    const source = 'https://drive.google.com/file/d/' + file.id + '/view';
    // If a file was replaced in Drive, retain the manually curated metadata.
    const stale = csv.slice(1).find(r =>
      r[index[plant.idField]] === plant.id &&
      (kind === 'photos' ? /photograph/i : /illustration/i).test(r[index['Image type']] ?? '') &&
      driveId(r[index['Image URL']]) && !liveIds.has(driveId(r[index['Image URL']]))
    );
    if (stale) {
      existingIds.delete(driveId(stale[index['Image URL']]));
      stale[index['Image URL']] = url;
      stale[index['Source URL']] = source;
      existingIds.add(file.id);
      replaced++;
      continue;
    }
    const row = Array(header.length).fill('');
    row[index['Scientific name']] = plant.name;
    row[index[plant.idField]] = plant.id;
    row[index['Image URL']] = url;
    row[index['Image type']] = srcField;
    row[index['Source URL']] = source;
    row[index['Primary']] = kind === 'photos' ? 'Yes' : 'No';
    row[index['Notes']] = 'Auto-linked from Driftwood Garden Drive folder; check image attribution/rights.';
    csv.push(row);
    existingIds.add(file.id);
    added++;
  }
  return { added, replaced, skipped };
}
export async function syncDriveImages(apiKey) {
  if (!apiKey) {
    console.log('Drive image folder sync inactive: GOOGLE_DRIVE_API_KEY secret has not been configured.');
    return;
  }
  const [photos, illustrations] = await Promise.all([
    listPublicFolder(PHOTO_FOLDER_ID, apiKey),
    listPublicFolder(ILLUSTRATION_FOLDER_ID, apiKey),
  ]);
  console.log('Drive scan: ' + photos.length + ' photographs; ' + illustrations.length + ' illustrations.');
  // Never overwrite the spreadsheet-sourced CSVs if an unexpectedly empty result arrives.
  if (!photos.length || !illustrations.length) throw new Error('Unexpected empty Drive folder scan; keeping existing CSVs unchanged.');
  const plants = catalog(await loadCsv('plants.csv'), 'Scientific name', 'Plant ID');
  const seeds = catalog(await loadCsv('seeds.csv'), 'Scientific name', 'Seed Lot ID');
  const wishlist = catalog(await loadCsv('wishlist.csv'), 'Scientific name', 'Wishlist ID');
  const bulbs = catalog(await loadCsv('bulbs.csv'), 'Scientific name', 'Bulb Lot ID');
  const illustrationTargets = [...plants, ...seeds, ...bulbs, ...wishlist];
  const imagesCsv = await loadCsv('images.csv');
  const illustrationsCsv = await loadCsv('illustrations.csv');
  const photoResult = addToRows(imagesCsv, photos, plants, 'photos');
  const illustrationResult = addToRows(illustrationsCsv, illustrations, illustrationTargets, 'illustrations');
  if (photoResult.added || photoResult.replaced) await writeFile('images.csv', serializeCsv(imagesCsv), 'utf8');
  if (illustrationResult.added || illustrationResult.replaced) await writeFile('illustrations.csv', serializeCsv(illustrationsCsv), 'utf8');
  console.log('Drive index changes:', { photos: photoResult, illustrations: illustrationResult });
}
