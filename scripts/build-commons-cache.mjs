#!/usr/bin/env node
// Pre-computes the best historic-illustration match on Wikimedia Commons (with a
// Biodiversity Heritage Library fallback) for every scientific name in the catalogue
// CSVs, and writes the result to commons-cache.json. index.html loads that file at
// startup so every visitor sees the same auto-matched image instead of each browser
// running its own live query — Commons' search ranking isn't guaranteed to return
// results in the same order run to run, which is what caused the auto-match to flip
// between a botanical plate and a random photo across page loads.
//
// Names already present in commons-cache.json are left untouched (pass --force to
// re-fetch everything), so a chosen match stays stable until the cache file is
// explicitly refreshed.
import { readFile, writeFile } from 'node:fs/promises';

const CSV_FILES = { plants: 'plants.csv', seeds: 'seeds.csv', bulbs: 'bulbs.csv', wishlist: 'wishlist.csv' };
const CACHE_FILE = 'commons-cache.json';

const HISTORIC_TERMS = ['engraving', 'lithograph', 'plate', 'botanical magazine', 'bot. mag', 'curtis', 'köhler', 'koehler', 'redouté', 'redoute', 'flora danica', 'hortus eystettensis', 'icones', 'monograph', 'tab.', 'bhl', 'biodiversity heritage', 'addisonia', 'watercolour', 'watercolor', 'illustration', 'drawing', 'print', 'woodcut', 'copperplate', 'manuscript', 'historical', 'antique', 'vintage', 'herbarium'];
const MODERN_TERMS = ['img_', 'dsc_', 'photograph', 'photo by'];
const WORD_BOUNDARY_TERMS = ['plate', 'print'];
const BHL_API_KEY = '', BHL_PAGE_CHECK_LIMIT = 8, BHL_ILLUSTRATION_TYPES = /illustration|plate|image|figure/i;

function clean(v) { return (v ?? '').toString().trim(); }
function stripHtml(s) { return clean(s).replace(/<[^>]*>/g, '').trim(); }
function baseName(n) { return clean(n).replace(/\s+['"].*?['"].*$/, '').replace(/\s+cv\..*$/i, '').replace(/\s+var\..*$/i, '').trim(); }
function termHits(hay, t) { return WORD_BOUNDARY_TERMS.includes(t) ? new RegExp('\\b' + t + '\\b').test(hay) : hay.includes(t); }

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quote && next === '"') { cell += '"'; i++; }
    else if (ch === '"') { quote = !quote; }
    else if (ch === ',' && !quote) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quote) { if (ch === '\r' && next === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter(r => r.some(c => clean(c)));
}

function toObjects(text) {
  const m = parseCSV(text || ''), h = (m[0] || []).map(x => clean(x).replace(/^﻿/, ''));
  return m.slice(1).map(r => { const o = {}; h.forEach((k, i) => o[k] = r[i] ?? ''); return o; });
}

function scoreCommonsPage(title, meta) {
  const cats = (meta.Categories && meta.Categories.value) || '', desc = (meta.ImageDescription && meta.ImageDescription.value) || '', obj = (meta.ObjectName && meta.ObjectName.value) || '', hay = (title + ' ' + cats + ' ' + desc + ' ' + obj).toLowerCase();
  let score = 0;
  HISTORIC_TERMS.forEach(t => { if (termHits(hay, t)) score += 10; });
  MODERN_TERMS.forEach(t => { if (termHits(hay, t)) score -= 8; });
  const dateStr = (meta.DateTimeOriginal && meta.DateTimeOriginal.value) || (meta.DateTime && meta.DateTime.value) || '', ym = dateStr.match(/(1[4-9]\d{2}|20[0-2]\d)/);
  if (ym) { const y = +ym[0]; if (y < 1900) score += 20; else if (y < 1950) score += 10; else if (y < 1980) score += 3; }
  return score;
}

function isRenderableFile(title) { return /\.(jpe?g|png|gif|webp)$/i.test(clean(title)); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function commonsSearch(query, limit, attempt = 1) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=' + limit + '&gsrsearch=' + encodeURIComponent(query) + '&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=900';
  const res = await fetch(url);
  if (res.status === 429 && attempt <= 5) {
    const retryAfter = Number(res.headers.get('retry-after')) || 0;
    await sleep(Math.max(retryAfter * 1000, attempt * 2000));
    return commonsSearch(query, limit, attempt + 1);
  }
  if (!res.ok) throw new Error('commons ' + res.status);
  const j = await res.json();
  return Object.values((j.query && j.query.pages) || {}).filter(p => p.imageinfo && p.imageinfo[0] && isRenderableFile(p.title));
}

function bestCommonsPage(pages) {
  let best = null, bestScore = -Infinity;
  pages.forEach(p => { const info = p.imageinfo[0], meta = info.extmetadata || {}, s = scoreCommonsPage(p.title, meta); if (s > bestScore) { bestScore = s; best = { p, info, meta, score: s }; } });
  return best;
}

// Unlike the client-side copy of this logic in index.html, network errors here are
// allowed to propagate (not swallowed into a null "no match") — main() relies on that
// to avoid permanently caching a rate limit or timeout as "no illustration found".
async function fetchCommonsImageRaw(name) {
  if (!name) return null;
  const base = baseName(name),
    historicQ = n => '"' + n + '" (illustration OR engraving OR "botanical plate" OR lithograph OR flora OR hortus)',
    categoryQ = n => 'incategory:"' + n + ' - botanical illustrations"';
  const attempts = [categoryQ(name), historicQ(name), name];
  if (base && base !== name) attempts.push(categoryQ(base), historicQ(base), base);
  let overallBest = null;
  for (const q of attempts) {
    const pages = await commonsSearch(q, 12);
    if (!pages.length) continue;
    const best = bestCommonsPage(pages);
    if (!best) continue;
    if (!overallBest || best.score > overallBest.score) overallBest = best;
    if (best.score > 0) return best;
  }
  return overallBest;
}

function commonsImageFromBest(best) {
  if (!best) return null;
  const { p, info, meta } = best, full = info.url, card = info.thumburl || full;
  return { full, card, thumb: card, type: 'Auto-matched (Wikimedia Commons)', author: stripHtml((meta.Artist && meta.Artist.value) || ''), license: stripHtml((meta.LicenseShortName && meta.LicenseShortName.value) || ''), source: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(p.title.replace(/ /g, '_')), notes: stripHtml((meta.ImageDescription && meta.ImageDescription.value) || '').slice(0, 240), primary: true, order: 0, auto: true };
}

async function bhlApi(op, params) {
  const qs = new URLSearchParams(Object.assign({ op, format: 'json', apikey: BHL_API_KEY }, params));
  const res = await fetch('https://www.biodiversitylibrary.org/api3?' + qs.toString());
  if (!res.ok) throw new Error('bhl ' + res.status);
  const j = await res.json();
  return j.Status === 'ok' ? j.Result : null;
}

async function fetchBhlImage(name) {
  if (!BHL_API_KEY || !name) return null;
  try {
    const results = await bhlApi('NameSearch', { name, searchtype: 'F' });
    if (!results || !results.length) return null;
    const occurrences = [];
    results.forEach(r => (r.Occurrences || []).forEach(o => { if (o.PageID) occurrences.push(o); }));
    for (const occ of occurrences.slice(0, BHL_PAGE_CHECK_LIMIT)) {
      const pages = await bhlApi('GetPageMetadata', { pageid: occ.PageID, ocr: 'f', names: 'f', parts: 'f' }), page = pages && pages[0], types = (page && page.PageTypes) || [];
      if (types.some(t => BHL_ILLUSTRATION_TYPES.test(t))) return occ.PageID;
    }
    return null;
  } catch (e) {
    console.warn('BHL lookup failed for', name, e.message);
    return null;
  }
}

function bhlImageFromPageId(pageId) {
  if (!pageId) return null;
  const full = 'https://www.biodiversitylibrary.org/pageimage/' + pageId, thumb = 'https://www.biodiversitylibrary.org/pagethumb/' + pageId + '?width=900';
  return { full, card: thumb, thumb, type: 'Auto-matched (Biodiversity Heritage Library)', author: '', license: 'Public domain (BHL scan)', source: 'https://www.biodiversitylibrary.org/page/' + pageId, notes: '', primary: true, order: 0, auto: true };
}

async function findAutoImage(name) {
  name = clean(name);
  if (!name) return null;
  const base = baseName(name), commonsBest = await fetchCommonsImageRaw(name);
  if (commonsBest && commonsBest.score > 0) return commonsImageFromBest(commonsBest);
  let bhlPageId = await fetchBhlImage(name);
  if (!bhlPageId && base && base !== name) bhlPageId = await fetchBhlImage(base);
  if (bhlPageId) return bhlImageFromPageId(bhlPageId);
  if (commonsBest) return commonsImageFromBest(commonsBest);
  return null;
}

async function collectNames() {
  const names = new Set();
  for (const [type, file] of Object.entries(CSV_FILES)) {
    let text;
    try { text = await readFile(file, 'utf8'); } catch { continue; }
    for (const row of toObjects(text)) {
      const scientific = clean(row['Scientific name']);
      const name = scientific || (type === 'bulbs' ? clean(row['Catalog name']) : '');
      if (name) names.add(name);
    }
  }
  return [...names].sort();
}

async function main() {
  const force = process.argv.includes('--force');
  const names = await collectNames();
  let cache = {};
  if (!force) {
    try { cache = JSON.parse(await readFile(CACHE_FILE, 'utf8')); } catch { /* first run */ }
  }

  const queue = names.filter(n => !Object.prototype.hasOwnProperty.call(cache, n));
  console.log(names.length + ' names in catalogue, ' + queue.length + ' to fetch.');

  let failed = 0;
  for (const name of queue) {
    try {
      const img = await findAutoImage(name);
      cache[name] = img;
      console.log((img ? 'matched' : 'no match') + ': ' + name);
    } catch (e) {
      // Leave the name out of the cache on a fetch/network error (e.g. a 429 that
      // survived retries) so the next run retries it instead of permanently
      // recording a false "no illustration found".
      failed++;
      console.warn('error (will retry next run): ' + name + ' — ' + e.message);
    }
    await sleep(400);
  }

  const sorted = Object.fromEntries(Object.keys(cache).sort((a, b) => a.localeCompare(b)).map(k => [k, cache[k]]));
  await writeFile(CACHE_FILE, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  console.log('Wrote ' + CACHE_FILE + ' (' + Object.keys(sorted).length + ' entries, ' + failed + ' left for next run)');
}

main();
