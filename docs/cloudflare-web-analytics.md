# Cloudflare Web Analytics

## Runtime Beacon

`static.cloudflareinsights.com/beacon.min.js` is Cloudflare's browser beacon loader for Web Analytics. The frontend loads it only when a public `VITE_CLOUDFLARE_WEB_ANALYTICS_*` site token is present in the production build.

`VITE_*` values are public because Vite bakes them into client JavaScript. Treat these as site identifiers, not secrets.

## Token Types

Use different names for different token classes:

- `VITE_CLOUDFLARE_WEB_ANALYTICS_HOME_TOKEN`: public site token for the home/PATH bundle.
- `VITE_CLOUDFLARE_WEB_ANALYTICS_THOUGHT_TOKEN`: public site token for the THOUGHT/gallery bundle.
- `INSHELL_CLOUDFLARE_WEB_ANALYTICS_READ_TOKEN`: private Cloudflare API token for reading RUM/Web Analytics site metadata.

Do not reuse Pages deploy, KV, Access, or Account Settings Write tokens for Web Analytics API reads. A token that can edit account settings can still return `403` from `/rum/site_info/list` if it lacks RUM/Web Analytics metadata read access.

Check the private API token with:

```bash
pnpm run check:web-analytics-token
```

The checker reads `CLOUDFLARE_ACCOUNT_ID` and `INSHELL_CLOUDFLARE_WEB_ANALYTICS_READ_TOKEN` from the shell or the private operator env file at `~/.inshell-secrets/inshell-sepolia.env`. It never prints token values.

## Interpreting Poor Metrics

Cloudflare Web Analytics can show poor Web Vitals from tiny samples. First separate low-sample noise from persistent problems:

- Filter by hostname: `inshell.art`, `gallery.inshell.art`, `thought.inshell.art`, and `sepolia.inshell.art`.
- Filter by route: `/`, `/path`, `/gallery`, `/thought/<id>`, `/pulse`, `/color-font`.
- Compare desktop/mobile and country/network slices before treating a single red card as product-wide.

If poor cards persist, the likely frontend causes are:

- Large SVG/canvas first render on home/PATH and gallery/detail pages.
- Chain-read/API waits before the user sees useful cached content.
- Font loading or layout shift from late terminal-font measurement.
- Wallet/RPC initialization work running before first paint.

Concrete fixes should stay local to frontend behavior:

- Keep fixed layout boxes for canvas/SVG areas.
- Render cached API snapshots before live refresh.
- Defer noncritical wallet/RPC work until user intent.
- Preload or stabilize the terminal font.
- Keep source/feed pages static and avoid app-shell fallbacks for generated artifacts.

Do not add new third-party telemetry to solve this. Cloudflare Web Analytics is the only analytics surface currently approved for this repo.
