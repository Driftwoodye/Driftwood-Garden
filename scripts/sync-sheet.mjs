#!/usr/bin/env node
// Pulls each tab of the Driftwood Garden Google Sheet via the public gviz
// CSV export and writes it out as the corresponding CSV file in the repo
// root. The sheet must be shared as "Anyone with the link can view".
import { writeFile } from 'node:fs/promises';

const SHEET_ID = '1p5tigHIaBZ8XJZ1AXoa6PmPJSXAGroNoeif6Q_xMhlY';

const TABS = {
  Plants: 'plants.csv',
  Seeds: 'seeds.csv',
  Bulbs: 'bulbs.csv',
  Wishlist: 'wishlist.csv',
  Images: 'images.csv',
};

async function fetchTab(tab) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch tab "${tab}": ${res.status} ${await res.text()}`);
  }
  return res.text();
}

for (const [tab, file] of Object.entries(TABS)) {
  const csv = await fetchTab(tab);
  await writeFile(file, csv, 'utf8');
  console.log(`Wrote ${file} (${csv.split('\n').length} lines)`);
}
