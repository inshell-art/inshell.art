# Cloudflare Web Analytics

## Candidate scope and release boundary

The Home-only native loader is a local candidate, not a deployed or activated
installation. Collection stays off by default and on preview. Source and local
fixture checks do not establish provider configuration, regional processing,
live transport, or report qualification. Publication, deployment and live
activation require their separate reviews and approvals.

The eligible document is exactly `https://inshell.art/`, without a query or
fragment. Its referrer must be empty or that same exact Home URL. PATH,
THOUGHT, gallery/detail pages, Docs, identifiers, APIs, authentication, retired
PUB/feed paths and other same-document routes are excluded. Do not broaden
this scope by copying an older potential route allowlist.

Home's ordinary departures are full-document anchors. The loader uses the
official `https://static.cloudflareinsights.com/beacon.min.js` module once,
with `spa: false` and a `no-referrer` SDK request. Before insertion, the
eligible document gets the accepted origin-only `strict-origin` referrer
meta policy. Noneligible documents retain their existing header policy.
This does not claim to prevent arbitrary URL changes made by extensions or
other code, and does not turn native SDK handlers into cancellable handlers.

## Independent configuration and runtime gates

All of the following are required; a token or geographic marker alone is
insufficient:

- Production build/runtime and `VITE_DEPLOY_ENV=production` on the exact
  canonical Home URL.
- `VITE_CLOUDFLARE_WEB_ANALYTICS_ENABLED=true`.
- `VITE_CLOUDFLARE_WEB_ANALYTICS_POLICY=home-document-v1`, configured only
  after OPS qualifies the exact selected installation, native Manual mode,
  absence of competing automatic injection and document lifecycle.
- A valid public `VITE_CLOUDFLARE_WEB_ANALYTICS_SITE_TAG` for reporting and
  `VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN` for the beacon. They are different
  identifier classes; matching string shape does not prove their pairing.
- One server-issued eligible marker, readable browser preferences, no browser
  exclusion, safe actual URL/referrer and no known automation.

Neither the enabled switch nor the policy attestation defaults to on. These
public values are build inputs, not private account credentials. The candidate
contains no real site identifiers and does not configure a provider account.

The existing Pages workflow defaults its `home_measurement` dispatch input to
`off`. A future `qualified-home-v1` request must target `main` and Home (or all),
with the independently reviewed repository variable
`INSHELL_HOME_MEASUREMENT_QUALIFIED=home-document-v1`, a reporting site tag and
a public Home beacon token. Invalid requests fail before build/publication,
not silently fall back to OFF. The Home token variable is
`VITE_CLOUDFLARE_WEB_ANALYTICS_HOME_TOKEN`, with the existing generic token
variable as a compatibility fallback. No variable value is changed by this
candidate. Staging, ordinary CI, standalone and nested THOUGHT stay OFF.
The artifact checker has distinct OFF and `--qualified-home` modes; the latter
checks configuration, not live qualification, and still requires nested builds
OFF. A future routine deployment must select its intended measurement mode
explicitly; the default deliberately does not preserve activation implicitly.

Pages middleware derives only an `eligible`/`off` marker from the original
trusted `request.cf.country`. Headers, query parameters and asset responses
cannot substitute for it. Missing, unknown or malformed country values fail
closed. The denied countries are AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, DE,
GR, HU, IS, IE, IT, LV, LI, LT, LU, MT, NL, NO, PL, PT, RO, SK, SI, ES,
SE, CH and GB. This is a technical policy, not a legal eligibility claim or
proof of where measurement data is processed. App-shell responses are private,
no-store; inherited shared-cache headers are removed.

## Browser exclusion and document lifetime

Privacy stays a quiet, closed-by-default entry. It writes only the existing
`inshell.ga4.excluded.v1` exclusion key and checks the written value. Earlier
Google Analytics consent is not permission for another collector. Unreadable
preferences block loading; saved works, authentication and functional storage
are independent and are not cleared.
If the preference cannot be saved, exclusion cannot be guaranteed: a reload
may qualify again if storage remains readable and the old value is unexcluded.

Removing an exclusion does not start measurement in the existing document.
If the native loader was installed, exclusion, unreadable preferences or an
observed unsafe URL change locks that document and reloads it. A final public
Home beacon may occur during navigation or reload. Removing a script element
is not a supported cancellation mechanism. Home does not use a History API
interceptor; arbitrary external `pushState` changes remain outside this narrow
ordinary-navigation qualification.

## Checks and recovery

Enabled-branch local checks must use fixtures or the retained pinned SDK with
all uploads intercepted before navigation. Do not fetch or execute a fresh
live SDK, send a beacon, query a private provider account, or run paid Agent
canaries as part of these checks. Retain failed checks and their limits rather
than replacing them with a passing label.

Recovery is application-specific: restore the exact checked Inshell OFF
release/configuration. The native registration is shared with active Pulse
Projects. Do not use shared Disable, token rotation, automatic injection or
another provider setting as an Inshell rollback; that could stop Pulse.
Historical releases that restore retired collectors are not default rollback
targets. Refresh the selected recovery identity before any authorized release.

Reports must use the exact selected site, hostname and Home path filters. Tiny
or empty samples do not establish an outage, zero visitors, or useful Web
Vitals. Optional measurement is separate from hosting/security services; no
new tracker, fingerprinting, event identity or consent popup is introduced.
