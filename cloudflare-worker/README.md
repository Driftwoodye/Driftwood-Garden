# Sheet proxy worker

Fetches the Driftwood Garden Google Sheet as CSV and re-serves it with
CORS headers, since `docs.google.com` does not send
`Access-Control-Allow-Origin` and browsers block the direct fetch from
`index.html`.

## Deploy

```
cd cloudflare-worker
npx wrangler deploy
```

This publishes to `https://driftwood-garden-sheet-proxy.<your-subdomain>.workers.dev`
(first run will prompt you to log in to Cloudflare).

## Wire it up

After deploying, copy the printed worker URL and set `SHEET_PROXY_URL` in
`index.html` to it, e.g.:

```js
const SHEET_PROXY_URL = 'https://driftwood-garden-sheet-proxy.YOUR-SUBDOMAIN.workers.dev';
```

## Usage

`GET <worker-url>?sheet=Plants` (also accepts `Seeds`, `Bulbs`, `Wishlist`,
`Images`) returns that tab as CSV.
