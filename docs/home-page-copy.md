# inshell.art Main Page Copy Deck

Source scope: `apps/home/src/App.tsx`, `apps/home/src/components/AuctionCanvas.tsx`, `apps/home/src/components/HeaderWalletCTA.tsx`, `apps/home/src/components/Movements.tsx`, `apps/home/src/components/Footer/Footer.tsx`, `apps/home/src/components/PulsePage.tsx`, `apps/home/src/components/ColorFontPage.tsx`.

Purpose: handoff list for copy polishing. Keep placeholders such as `{price}`, `{symbol}`, `{time}`, `{network}`, `{hash}`, `{reason}`, and `{error}` unless the implementation changes too.

## Brand / Primary Surface

| Area | Current copy | Notes |
| --- | --- | --- |
| Main title | `$PATH` | Top-left page title. |
| SVG aria label | `Pulse auction curve` | Assistive label for the auction canvas SVG. |
| X-axis label | `time →` | Bottom-left axis label. |
| Y-axis label | `price ({symbol}) ↑` | Bottom-right axis label, e.g. `price (ETH) ↑`. |

## Header CTA Labels

| State | Current copy | Notes |
| --- | --- | --- |
| Connect wallet | `[ connect ]` | CTA button text is rendered inside brackets. |
| Unlock wallet | `[ unlock ]` | Wallet exists but account is unavailable/locked. |
| Switch network | `[ switch ]` | Wrong network. |
| Mint available | `[ mint ]` | First click opens local review panel. |
| Review ready | `[ confirm ]` | Second click opens wallet. |
| Wallet signing | `[ signing ]` | Disabled while wallet signature request is open. |
| Tx pending | `[ pending ]` | Click opens tx in explorer if hash exists. |
| Tx failed | `[ retry ]` | Retries mint flow. |

## Header Wallet Dot / Menu

| Area | Current copy | Notes |
| --- | --- | --- |
| Dot tooltip, disconnected | `wallet not connected` | Title/aria label fallback. |
| Dot tooltip, connected | `{shortAddress} · {network}` | Example: `0x1234...abcd · Sepolia`. |
| Menu field label | `address` | Wallet menu. |
| Menu field label | `network` | Wallet menu. |
| Menu action | `copy address` | Copies connected address. |
| Menu action | `open in explorer` | Opens account explorer page. |
| Menu action | `last tx` | Opens last transaction. |
| Menu action | `disconnect` | Disconnects wallet. |
| Network label | `Sepolia` | Resolved from chain. |
| Network label | `Mainnet` | Resolved from chain. |
| Network label | `Local Devnet` | Resolved from chain. |
| Network label fallback | `unknown network` | Unknown wallet network. |

## Mint Review Panel

Shown after first `[ mint ]` click, before wallet opens.

| Area | Current copy | Notes |
| --- | --- | --- |
| Panel title | `review before wallet` | Local preflight review. |
| Row label | `current ask` | Shows quoted auction price. |
| Row label | `tx value` | Shows native ETH value if native payment, otherwise `0 ETH`. |
| Row label | `max bid` | Shows contract bid parameter. |
| Note, approval required | `wallet step 1 approves {symbol}; step 2 submits max bid.` | ERC20 approval path. |
| Note, no approval required | `wallet opens next. final charge can be lower at execution.` | Native payment or enough allowance. |

## Persistent Notices Under CTA

| Condition | Current copy | Notes |
| --- | --- | --- |
| Before open / mint blocked | `Auction opens in {duration}.` | Falls back to `Auction opens soon.` if duration unavailable. |
| No protocol release / mint blocked | `Protocol release not loaded.` | Also used as blocked mint toast. |
| Loading auction / mint blocked | `Loading auction state.` | Auction loading guard. |
| Wallet signing approve | `Wallet open: approve {symbol} (1/2).` | Awaiting signature. |
| Wallet signing bid | `Wallet open: confirm mint (2/2).` | Awaiting signature. |
| Approval submitted | `Approval submitted (1/2).` | Tx pending. |
| Bid submitted | `Mint pending (2/2).` | Tx pending. |
| Account invalid | `Account needs upgrade or activation.` | Invalid signature-length path. |
| User cancelled | `Wallet request cancelled.` | User rejected/refused signature. |
| RPC busy | `RPC busy. Retry.` | Network/fetch failure. |
| RPC read failed | `RPC read failed.` | RPC read/preflight failure. |
| Insufficient at execution | `Insufficient {symbol} at execution.` | Balance changed between quote and execution. |
| Generic mint failure | `Mint failed.` | Generic tx failure. |
| No wallet | `No supported wallet found.` | No injected/WalletConnect provider. |
| Wrong network | `{network} only.` | Example: `Sepolia only.` or `PATH Local only.` |
| Loading preflight | `Checking mint state...` | Preflight pending. |
| Insufficient balance | `Need {ask}; have {balance}.` | Example: `Need 0.3 ETH; have 0.1 ETH.` |
| Approval required | `Approve {symbol} (1/2).` | ERC20 allowance too low. |

## Toasts / Temporary Notices

| Event | Current copy | Notes |
| --- | --- | --- |
| Pending wallet request | `Finish the pending wallet request.` | Connect request already pending. |
| No wallet on connect | `No supported wallet found.` | Connect failure. |
| Connect failed | `Wallet connection failed.` | Generic connect failure. |
| Switch failed | `Switch to {network} in wallet.` | Network switch request failed or was refused. |
| Tx submitted | `Submitted: {shortHash}.` | Example: `Submitted: 0x1234…abcd.` |
| Tx confirmed | `Confirmed.` | Tx receipt received. |
| Mint detected | `Minted $PATH #{tokenId}.` | Bid event found after tx confirmation. |
| Copied address | `Copied.` | Wallet address copied. |
| Disconnected | `Disconnected.` | Wallet disconnected. |

## Auction Status Screens

| State | Current copy | Notes |
| --- | --- | --- |
| No deployment line 1 | `No PATH deployment loaded.` | No FE release loaded. |
| No deployment line 2 | `Protocol release not loaded.` | No FE release loaded. |
| No deployment line 3 | `Deploy PATH, export the FE release, then sync inshell.art.` | Operator guidance. |
| Before open line 1 | `Auction opens at {time} UTC.` | `{time}` is UTC timestamp. |
| Before open line 2 | `Opens in {duration}.` | Fallback below. |
| Before open line 2 fallback | `Waiting for first eligible block.` | If countdown unavailable. |
| Before open line 3 | `First bid can land at or after open time.` | Block-timestamp explanation. |
| Open, no bids line 1 | `Auction is open.` | Open but no minted tokens. |
| Open, no bids line 2 | `Waiting for first bid.` | Open but no minted tokens. |
| Open, no bids line 3 | `Opening ask: {price} {symbol}` | Contract opening ask. |
| Open, no bids line 4 | `Current ask: {price} {symbol}` | Live current price. |
| Missing deploy block line 1 | `No bids loaded.` | Cannot backfill. |
| Missing deploy block line 2 | `Set VITE_PULSE_AUCTION_DEPLOY_BLOCK to backfill history.` | Operator guidance. |
| No bids loaded line 1 | `No bids loaded.` | General empty state. |
| No bids loaded line 2 | `Check deploy block and RPC.` | Operator guidance. |
| Loading | `loading curve...` | ASCII dots. |
| Core error | `curve error: {error}` | Raw error text follows. |
| Curve unavailable | `curve unavailable: {reason}` | Reason examples below. |
| No curve fallback | `curve not ready` | No linked curve and no reason. |

## Curve Unavailable Reasons

These are internal reason strings mapped before being surfaced in `curve unavailable: {reason}`.

| Internal reason | Display copy |
| --- | --- |
| `invalid k/pts` | `invalid curve constants` |
| `k/pts nan` | `curve constants not finite` |
| `non-positive k/pts` | `curve constants must be positive` |
| `invalid open time` | `invalid open time` |
| `invalid opening curve` | `invalid opening curve` |
| `invalid bid time` | `invalid bid time` |
| `invalid premium` | `invalid time premium` |
| `invalid half-life` | `invalid half-life` |
| `sale price nan` | `sale price not finite` |
| `no bids` | `no bids` |

## Curve Tooltips

### Sale Dot Tooltip

| Area | Current copy | Notes |
| --- | --- | --- |
| Title | `sale #{epoch}` | Sale/token number. |
| Field | `price` | Sale price. |
| Field | `bidder` | Shortened bidder address. |
| Field | `time` | Local timestamp. |
| Note | `mints one $PATH and starts the next curve` | Sale effect. |

### Opening Ask Tooltip

| Area | Current copy | Notes |
| --- | --- | --- |
| Title | `opening ask` | First ask point. |
| Field | `price` | Opening ask price. |
| Field | `time` | Local timestamp. |
| Note | `ask when the auction opens` | Opening ask explanation. |

### Curve Start Ask Tooltip

| Area | Current copy | Notes |
| --- | --- | --- |
| Title | `curve start ask` | Ask point at start of a curve after a sale. |
| Field | `price` | Ask price. |
| Field | `floor b` | Floor component. |
| Field | `time premium` | Time premium component. |
| Note | `price = floor b + time premium` | Composition formula. |

### Opening Floor Tooltip

| Area | Current copy | Notes |
| --- | --- | --- |
| Title | `opening floor` | Floor at auction open. |
| Field | `price` | Opening floor price. |
| Field | `time` | Local timestamp. |
| Note | `floor when the auction opens` | Opening floor explanation. |

### Current / Curve Point Tooltip

| Area | Current copy | Notes |
| --- | --- | --- |
| Title | `current ask` | Now dot. |
| Title fallback | `ask` | Generic curve point. |
| Field | `price` | Price at point. |
| Field | `above floor` | Price above floor. |
| Field | `age` | Time distance from now. |
| Field | `t½` | Half-life duration. |
| Field | `u(t½)` | Half-life units. |
| Field | `1 t½ drop` | Price drop over one half-life unit from point. |
| Field | `time` | Local timestamp. |
| Formula | `y = k/(t-a)+b` | Current formula label. |
| Param | `k = {value}` | Formula parameter. |
| Param | `a = {value}` | Formula parameter. |
| Param | `b = {value}` | Formula parameter. |

### Time Premium Tooltip

| Area | Current copy | Notes |
| --- | --- | --- |
| Title | `time premium` | Vertical pump line between sale and next ask. |
| Field | `amount` | Premium amount. |
| Field | `duration` | Time duration. |
| Field | `PTS` | Premium-per-second value. |
| Note | `amount = duration × PTS` | Uses multiplication sign. |

## Hero / Movement Links

| Area | Current copy | Notes |
| --- | --- | --- |
| Movement label | `THOUGHT` | Link opens local THOUGHT app in the same window. |
| Movement year | `in 2026` | Appears above THOUGHT. |
| Movement label | `WILL` | Non-link. |
| Movement year | `in 2027` | Appears above WILL. |
| Movement label | `AWA!` | Non-link. |
| Movement year | `in 2028` | Appears above AWA!. |
| Aria label | `Movements` | Assistive label. |

## Footer Links

Footer renders square glyphs visually; text appears in tooltips/aria labels.

| Link | Current label / tooltip | Aria label | Notes |
| --- | --- | --- | --- |
| Pulse | `pulse` | `Open Pulse primitive page` | Opens `/pulse` in a new tab. |
| Color font | `color font` | `Open Color Font primitive page` | Opens `/color-font` in a new tab. |
| Telegram | `telegram` | `Open Telegram announcements channel` | Only rendered if Telegram URL env var is valid; visual is `■■`. |
| X | `X` | `Open X` | Visual square derived from label length. |
| GitHub | `github` | `Open GitHub` | Visual squares are derived from label length. |

## Primitive Pages

| Route | Area | Current copy | Notes |
| --- | --- | --- | --- |
| `/pulse` | Title | `pulse` | Primitive page heading. |
| `/pulse` | Subtitle | `An original pricing sketch for a decentralized automatic auction.` | Primitive page subtitle. |
| `/pulse` | Body | `Pulse is the pricing primitive behind the current $PATH auction.` | Primitive page body copy. |
| `/pulse` | Body | `A sale pumps the ask upward.` | Primitive page body copy. |
| `/pulse` | Body | `Silence lets the ask drop.` | Primitive page body copy. |
| `/pulse` | Body | `During the drop phase, time and price follow an offset constant-product curve.` | Primitive page body copy. |
| `/pulse` | Body | `The hammer price is sampled at settlement time.` | Primitive page body copy. |
| `/pulse` | Formula | `xy = k` | Primitive pricing sketch. |
| `/pulse` | Formula | `f(x) = k / (x - a) + b` | Primitive pricing sketch. |
| `/pulse` | Note | `This is not implementation code.` | Primitive page note. |
| `/pulse` | Note | `It preserves the primitive pricing shape before implementation.` | Primitive page note. |
| `/pulse` | Link | `Open original Desmos sketch ↗` | Opens external Desmos sketch. |
| `/pulse` | Link | `View source ↗` | Opens Pulse repository if configured. |
| `/color-font` | Title | `color font` | Primitive page heading. |
| `/color-font` | Subtitle | `Contract-defined A-Z color glyph system.` | Primitive page subtitle. |
| `/color-font` | Warning | `onchain source unavailable.` | Shown when the page renders the bundled fallback. |
| `/color-font` | Warning | `showing bundled mirror copy.` | Shown when the page renders the bundled fallback. |
| `/color-font` | Field label | `loaded from` | Current data path for the rendered mapping. |
| `/color-font` | Field label | `authority` | Deployed authority for the mapping, or unavailable in fallback. |
| `/color-font` | Field label | `id` | Color font metadata. |
| `/color-font` | Field label | `version` | Color font metadata. |
| `/color-font` | Field label | `format` | Color font metadata. |
| `/color-font` | Field label | `hash` | Color font metadata. |
| `/color-font` | Field label | `mirror` | Readable inshell.art mirror reference. |
| `/color-font` | Link | `Open raw mapping ↗` | Opens a blob document from the currently loaded mapping data. |
| `/color-font` | Link | `View mirror ↗` | Opens the color font mapping file in the inshell.art source mirror, not the authority. |
| `/color-font` | Status | `source: ThoughtNFT.colorFontData()` | Used when contract/RPC data loads. |
| `/color-font` | Status | `source: frontend mirror fallback` | Used only with fallback warning. |
| `/color-font` | Status | `onchain: unavailable` | Used only with fallback warning. |
| `/color-font` | Status | `mirror: inshell.art color font mirror` | Secondary source mirror line. |

## Error Boundary

| Area | Current copy | Notes |
| --- | --- | --- |
| Error title | `page error` | React error boundary. |
| Error body | `{error.message}` | Raw error message. |

## Debug Panel Copy

Only visible when dev/debug UI is available and opened.

| Area | Current copy |
| --- | --- |
| Toggle | `debug` |
| Field | `override` |
| Button | `reset` |
| Field | `cta` |
| Field | `notice` |
| Field | `toasts` |
| CTA option | `auto` |
| CTA option | `connect` |
| CTA option | `unlock` |
| CTA option | `switch` |
| CTA option | `mint` |
| CTA option | `mint disabled` |
| CTA option | `sign` |
| CTA option | `pending` |
| CTA option | `retry` |
| Notice option | `none` |
| Notice option | `no wallet` |
| Notice option | `wallet locked` |
| Notice option | `wrong network` |
| Notice option | `rpc error` |
| Notice option | `insufficient` |
| Notice option | `approval` |
| Notice option | `minting` |
| Notice option | `invalid signature` |
| Notice option | `user refused` |
| Notice option | `invalid block id` |
| Notice option | `overflow` |
| Notice option | `generic` |
| Toast button | `copied` |
| Toast button | `submitted` |
| Toast button | `confirmed` |
| Toast button | `disconnected` |
| Debug note | `Overrides affect UI only. Use auto to return to live data. CTA or notice overrides drive wallet/tx state and lock related selectors.` |
