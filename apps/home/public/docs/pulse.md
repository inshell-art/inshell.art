# Pulse

> Pulse turns public timing into the issue price for each new $PATH.

- Group: Works and participation
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/pulse
- Documentation version: 2026-08-16
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Overview

- Authority: artist-editorial, app-documentation, contract-release

[$PATH](https://inshell.art/docs/path) is the permission token; Pulse is the serial mechanism that prices and issues the next public token. They are not interchangeable names.

Pulse runs one live epoch, one current ask, and one next token at a time. A successful bid closes the epoch, records the sale, issues the corresponding $PATH, and starts the next epoch.

Pulse shapes the ask over time. A successful bid closes the current epoch and starts the next one. The next ask is raised by an initial premium. Between sales, the ask decays toward the floor. Equivalently, premium decays toward zero. Settlement samples the ask at sale time.

The pump uses a price-time scale to turn the elapsed time before a sale into the next epoch's initial premium. The drop follows ask(t) = floor + premium(t), with ask(t) = b + ⌊k / (t - a)⌋. Every sale becomes another point in the visible history.

[Inshell](https://inshell.art/docs/inshell) frames Pulse as a mathematical canvas and a crowd instrument: each bid becomes a public point and sets the next beat. The curve and its parameters are exposed because the mechanism is part of the work, not an investment promise.

The price shown in the App is a live read, not a reservation. The [wallet](https://inshell.art/docs/wallet-local-data) flow reads the ask again before submission. If the price moves outside the approved maximum, retry to read and submit the current ask.

This is the Desmos sketch behind Pulse. It is not implementation code.

## Pulse pump and drop equations

- Authority: artist-editorial

```text
pump

PTS = price-time scale
elapsed time = sale time - previous curve start
initial premium = elapsed time × PTS
next floor = last price
next ask = next floor + initial premium


drop

premium(t) = ask(t) - floor
ask(t) = floor + premium(t)
ask(t) = b + ⌊k / (t - a)⌋
(t - a) × (ask(t) - b) ≈ k

b = floor
k = curve constant
a = anchor time
```

## A serial auction

- Authority: artist-editorial, contract-release

Pulse has one current epoch and one next public $PATH at a time. Participants are not choosing among parallel lots. The successful bid closes the visible curve, issues its $PATH, and establishes the starting conditions for the following curve.

This serial structure makes the history legible: every sale is both an ending and the input to what comes next.

## The pump

- Authority: contract-release

The time between the previous curve start and the successful sale is multiplied by the price-time scale. That result becomes the next epoch's initial premium. The next floor is the last sale price, so waiting before a sale affects the height from which the following ask begins.

- A longer elapsed interval produces a larger initial premium when the price-time scale is fixed.
- The premium is added to the new floor; it is not the full next ask by itself.
- The sale price becomes public history and the next floor at the same transition.

## The drop

- Authority: app-documentation, contract-release

During an open epoch, the premium follows the published inverse curve and approaches zero. The ask therefore approaches the floor without silently changing the floor. The App draws that same relationship as a time-price field.

The chart uses half-life units to make curves with different real-time durations visually comparable. Tooltips convert those units back into elapsed or ago time for the current epoch.

## A quote is not a reservation

- Authority: app-documentation, contract-release

1. Read the current ask and active payment asset from the contract-backed App state.
2. Open the local review panel and inspect the maximum charge before the wallet opens.
3. Let the mint flow read the ask again immediately before submission.
4. Confirm only if the wallet request matches the expected network, contract, and maximum value.
5. If the ask moved beyond the approved maximum, retry with a fresh read instead of treating the earlier quote as guaranteed.

## Price ceiling and settlement

- Authority: app-documentation, contract-release

The wallet transaction supplies a maximum acceptable price, not a promise to pay that entire amount. Pulse samples the live ask when the transaction executes. The bid succeeds only when that ask is within the submitted ceiling.

On a successful ETH bid, the auction sends the exact ask to the treasury and refunds surplus value to the bidder. The sale closes the current epoch, records its settlement, and begins the next epoch. The adapter then translates that settlement into $PATH delivery; Pulse itself remains independent of the NFT it prices.

- Maximum price: the bidder's slippage ceiling.
- Settlement price: the live ask accepted by the contract.
- Value supplied: must cover the ask; unused value is refunded.
- Delivery: PathPulseAdapter turns the settled auction result into $PATH issuance.

> A submitted transaction is not a completed sale. Read the receipt, events, and resulting contract state before presenting $PATH as issued.

## Mechanism as artwork

- Authority: artist-editorial, app-documentation

Pulse exposes its curve, parameters, sale dots, and current point because the mechanism is part of the artistic surface. Each bid becomes a beat in a public rhythm: acting, waiting, and the crowd's changing tempo remain visible rather than being reduced to a private checkout flow.

As one participatory system in Inshell's practice, Pulse makes collective timing and choice available for inspection. The curve records action; neither price nor timing measures inward progress or establishes possession of truth.

> This framing describes the work. It is not an investment promise, a price forecast, or a claim that participation will produce financial return.


## Links

- [open live Pulse parameters](https://inshell.art/pulse?raw=1)
- [open original Desmos sketch](https://www.desmos.com/calculator/1d89f93d21)
- [view Pulse source](https://github.com/inshell-art/pulse)
