# Testing inshell.art

## Quick checks

- `npm run test:fast`
  - Runs the smallest unit-test subset (math + curve).

## Unit suite

- `npm run test:unit`
  - Runs all Jest unit tests (UI + fixtures).

## Full local check

- `npm run check`
  - Lint + type-check + unit tests.

## E2E (optional)

- `BASE_URL=https://your-env.example pnpm run e2e:staging`
- `BASE_URL=https://your-env.example pnpm run e2e:prod`

## Notes

- `npm run test` is the raw Jest command (same as unit suite, but without a fixed file list).
