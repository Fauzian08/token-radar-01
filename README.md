# Launch Radar

[![Rank](https://make.fun/badge/token-radar-01/Fauzian08/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![Reward](https://make.fun/badge/token-radar-01/Fauzian08/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)
[![Competition](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)

Pre-token protocols, valued from their own record: implied value = TVL × fitted
multiple (the value if a token launches) × token odds (from how long peers ran
before recording one). Model radar-3, built from the sealed DefiLlama snapshot
of 2026-11-14. No network, no live prices.

## What it scores

198 protocols: the 40 on the watchlist, 138 early ones below the $50M floor, and
20 off-list ones recorded by a parent protocol. The other 560 snapshot protocols
are accounted for, not dropped silently: 110 traded tokens are priced comps, 306
have no usable market cap, and 144 are out (bridge, liquid staking, exchange,
versioned/wrapped). The dashboard prints the full ledger and re-checks it in the
browser.

## The model, in one paragraph

Value is fitted on the 88 traded tokens with a positive market cap: log(mcap/TVL)
on log TVL, with category and other terms kept only if they lower the held-out
miss in both leave-one-out and walk-forward tests (tokens listed earlier price
those listed later). Token odds are a survival estimate: the chance a protocol
records a token given it has run this long without one, from 437 peers; a logistic
regression on age, size, growth, pre-token siblings and chains is shown as
evidence, not used for the headline odds. Every row carries a bootstrap range
(P25–P75, P10–P90) and a rank range from 200 refits. Farm economics use a $10,000
deposit, a 7.0% drop share and a 12-week horizon by default; the deposit at
risk is the plan size capped at 0.02% of TVL, and FARM needs net above the same
deposit in a 4% T-bill and at least $25/hour of hands-on time. Off-list rows carry a stated ×0.48 parent
haircut: the parent's existing product is assumed to capture about half of a
launch's value. That assumption is printed on every off-list row, because the
snapshot cannot prove it.

## Run it

```sh
node main.ts --input /input/snapshot.json --output /output
```

Writes `board.json` (198 rows), `data.js` (everything the dashboard renders),
`dashboard/` (the static page: `index.html`, `app.css`, `app.js`), `screenshots/`
and `dossier.json`, written last. Running it twice over the same snapshot
produces byte-identical output.

## Files

- `main.ts` — CLI: read the snapshot, score it, write the board, dashboard and dossier.
- `lib/model.ts` — the model: accounting partition, value fit, odds, farm economics, bootstrap.
- `dashboard/` — the board. Open `dashboard/index.html` with `data.js` next to it.
- `vendor/makefun-board.ts` — the vendored dossier builder (kit copy).
- `screenshots/` — board, protocol detail, FARM filter.
