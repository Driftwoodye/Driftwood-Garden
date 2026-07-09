const SHEET_ID = '1p5tigHIaBZ8XJZ1AXoa6PmPJSXAGroNoeif6Q_xMhlY';
const ALLOWED_SHEETS = new Set(['Plants', 'Seeds', 'Bulbs', 'Wishlist', 'Images']);

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const sheet = url.searchParams.get('sheet');
    if (!sheet || !ALLOWED_SHEETS.has(sheet)) {
      return new Response('Missing or invalid "sheet" parameter', {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&sheet=${encodeURIComponent(sheet)}`;
    const res = await fetch(sheetUrl, { redirect: 'follow' });
    if (!res.ok) {
      return new Response(`Upstream fetch failed: ${res.status}`, {
        status: 502,
        headers: corsHeaders(),
      });
    }

    const body = await res.text();
    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  },
};
