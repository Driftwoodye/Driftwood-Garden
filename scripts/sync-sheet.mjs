#!/usr/bin/env node
// Pulls each tab of the Driftwood Garden Google Sheet via the Sheets API
// and writes it out as the corresponding CSV file in the repo root.
import { writeFile } from 'node:fs/promises';

const SHEET_ID = '1p5tigHIaBZ8XJZ1AXoa6PmPJSXAGroNoeif6Q_xMhlY';
const API_KEY = process.env.GOOGLE_API_KEY;

const TABS = {
  Plants: 'plants.csv',
  Seeds: 'seeds.csv',
  Bulbs: 'bulbs.csv',
  Wishlist: 'wishlist.csv',
  Images: 'images.csv',
};

if (!API_KEY) {
  console.error('GOOGLE_API_KEY environment variable is required');
  process.exit(1);
}

function csvField(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function rowsToCsv(rows) {
  return rows.map(row => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}

async function fetchTab(tab) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(tab)}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch tab "${tab}": ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.values || [];
}

for (const [tab, file] of Object.entries(TABS)) {
  const rows = await fetchTab(tab);
  await writeFile(file, rowsToCsv(rows), 'utf8');
  console.log(`Wrote ${file} (${rows.length} rows)`);
}
