# Token Radar — Build the best token launch radar

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![Rank](https://make.fun/badge/token-radar-01/Fauzian08/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![Reward](https://make.fun/badge/token-radar-01/Fauzian08/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

A token launch radar built from a frozen DefiLlama snapshot (2026-11-14). It ranks the
protocols that record no token — and are not a wrapped, staked or bridged product of a
token that already trades — by what their launch would be worth, and shows a reader how
to farm each one.

## The model (radar-2)

- **Implied value** = TVL × category multiple × growth multiplier × maturity multiplier
  × chain-breadth multiplier. The category multiple is the median market-cap/TVL of the
  live-token protocols in the same category, shrunk toward the global median and clamped
  to 0.05–1.00 — read off the snapshot's own live market, never set by hand.
- **Launch likelihood** (0–100) is a second signal from TVL size, 7-day growth, age with
  no token and chain breadth. It never reorders the board.
- **Board**: all 40 watchlist protocols plus every other protocol that passes the same
  exclusion rule — 198 rows. Live-token protocols are set aside with their market caps.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

`main.ts` (Node 22, standard library only) reads the sealed snapshot, writes
`board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output
directory. It runs twice and writes the same bytes both times.

## Files

- `main.ts` — entrypoint
- `lib/model.ts` — the radar-2 model, the board and the farm plans
- `vendor/makefun-board.ts` — make.fun's dossier library (vendored from the kit)
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js` (no network)
- `screenshots/` — the board, a protocol detail view and a filtered view
