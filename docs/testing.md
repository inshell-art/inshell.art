# Testing inshell.art

## Quick checks

- `npm run test:fast`
  - Runs the smallest unit-test subset (math + curve).

## Unit suite

- `npm run test:unit`
  - Runs all Jest unit tests (UI + fixtures).
  - Includes Cloudflare function-route unit coverage for cache/RPC routes such as
    `chainCacheFunction.test.ts` and `ethRpcFunction.test.ts`.

## Full local check

- `npm run check`
  - Lint + type-check + unit tests.

## Production gate

- `pnpm run check:production`
  - Validates Cloudflare Pages deploy surface, security headers, redirects, dev-server binding, Sepolia release artifacts, imported ABI JSON, lint, type-check, unit tests, both app builds, and whitespace diff.

## Cloudflare API route smoke

- `pnpm run smoke:api-routes -- --scope home --home-base https://staging.inshell-art.pages.dev`
  - Checks live home Pages bindings for `/api/path-rpc`, `/api/pulse-auction`, and `/api/path-tokens`.
- `pnpm run smoke:api-routes -- --scope thought --thought-base https://staging.thought-inshell-art.pages.dev`
  - Checks live THOUGHT Pages bindings for `/api/path-rpc`, `/api/thought-rpc`, `/api/thought-preview`, `/api/thought-gallery`, and `/api/path-tokens`.

These smoke checks run after Cloudflare Pages deploys in `deploy-pages.yml` so env/binding drift is caught by the deployment, not by a wallet or browser session.

## Cloudflare Web Analytics token check

- `pnpm run check:web-analytics-token`
  - Reads the private operator env file and verifies the Cloudflare token can read RUM/Web Analytics site metadata.
  - This validates the private API token only. It is separate from the public `VITE_CLOUDFLARE_WEB_ANALYTICS_*` site token shipped in frontend bundles.

## E2E (optional)

- `BASE_URL=https://your-env.example pnpm run e2e:staging`
- `BASE_URL=https://your-env.example pnpm run e2e:prod`

## Notes

- `npm run test` is the raw Jest command (same as unit suite, but without a fixed file list).
