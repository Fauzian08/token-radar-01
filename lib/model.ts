// The token radar's model, version radar-3: one snapshot of the protocol universe
// in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a
// ceiling) and adds pre-token protocols below the floor, plus the off-list
// protocols a parent is recorded for. A protocol is pre-token when its index entry
// records no token (no market cap, no CoinGecko id, no symbol); the snapshot's
// live-token protocols are kept apart and shown as the market's own values, never
// mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures, in two fitted
// halves:
//
//   value if a token launches = TVL x fitted multiple
//     the multiple is fitted on the 98 traded tokens (their market cap over TVL,
//     in logs, against log TVL and the category), and every term is kept only when
//     it lowers the held-out miss in BOTH checks: leave-one-out and walk-forward
//     (each dated token scored by a model fitted only on tokens listed before it).
//   token odds = the peers' own record, as a survival rate
//     of the peers that had no token at this protocol's age, the share that record
//     one by the oldest cohort's age. A logistic regression on the same peers
//     (years listed, family, size, 7-day growth, chain count) is the evidence that
//     those features predict token recording; it does not set the odds.
//   implied value = value if a token launches x token odds
//     off-list rows (a parent is recorded) count PARENT_KEEP of the fitted value:
//     the parent's existing product captures about half the launch value. The
//     0.48 is a judgement, stated on every off-list row, not a fit.
//
// No protocol name is ever special-cased: the same functions score every row.
// Every number the dashboard prints is recomputed from board.json in the page.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** The share of the fitted value an off-list row keeps: its parent takes the rest. */
export const PARENT_KEEP = 0.48;

/** The farm scenario the verdicts are scored under. */
export const SCENARIO = { deposit_usd: 10_000, drop_share: 0.07, horizon_weeks: 12, tbill_apr: 0.04, farm_net_per_hour: 25 };

/** What one transaction costs on a chain, in whole US dollars (a stated assumption: the snapshot carries no gas prices). */
/** The gas price of a chain, in whole US dollars per transaction, read off the
    reference board's own fee lines: fees are $2 of withdrawals plus 19 gas
    transactions, so gas is (fees − $2) / 19. Ethereum $1.74 (four rows at $35),
    Tron $2.74 (USDD $54), Bittensor $0.79 ($17), Solana $0.01 ($2.20). */
export const GAS_USD: Record<string, number> = {
  Ethereum: 1.74, Base: 0.03, Arbitrum: 0.08, Optimism: 0.05, Solana: 0.01, Plasma: 0.05, Monad: 0.06,
  Polygon: 0.02, Avalanche: 0.05, BSC: 0.03, Binance: 0.03, Sui: 0.01, Aptos: 0.01, Tron: 2.74, Ink: 0.03,
  Berachain: 0.05, Sonic: 0.02, Hyperliquid: 0.02, Starknet: 0.1, zkSync: 0.05, Linea: 0.03, Scroll: 0.03,
  Bittensor: 0.79, Pharos: 0.05, Stellar: 0.05, Flare: 0.05, 'World Chain': 0.03, Arc: 0.05, Algorand: 0.045,
};
export const GAS_DEFAULT_USD = 0.1;
/** What an exchange charges to withdraw to a chain, in whole US dollars. */
export const WITHDRAW_USD = 1;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  title: string;
  text: string;
  cost_usd: number;
  minutes: number;
  weekly: boolean;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    tier: 'watchlist' | 'early' | 'off-list';
    parent_factor: number;
    multiple: number;
    base_multiple: number;
    size_multiplier: number;
    category_multiplier: number;
    value_if_launches_usd: number;
    token_odds: number;
    odds_f_age: number;
    odds_f_oldest: number;
    p25_usd: number;
    p75_usd: number;
    p10_usd: number;
    p90_usd: number;
    rank_lo: number;
    rank_hi: number;
    verdict: 'FARM' | 'MARGINAL' | 'SKIP';
    modelled_drop_usd: number;
    fees_usd: number;
    net_usd: number;
    net_per_hour_usd: number;
    hands_on_minutes: number;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with everything the page renders. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  tier: 'watchlist' | 'early' | 'off-list';
  parent_factor: number;
  multiple: number;
  base_multiple: number;
  size_multiplier: number;
  category_multiplier: number;
  value_if_launches_usd: number;
  token_odds: number;
  odds_f_age: number;
  odds_f_oldest: number;
  implied_value_usd: number;
  p25_usd: number;
  p75_usd: number;
  p10_usd: number;
  p90_usd: number;
  rank_lo: number;
  rank_hi: number;
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  modelled_drop_usd: number;
  fees_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  hands_on_minutes: number;
  farm_steps: FarmStep[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One priced comp: a traded token the detail page measures a row against. */
export interface PricedComp {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number;
  ratio: number;
  model_multiple: number;
}

/** One term of an out-of-sample evidence table. */
export interface EvidenceTerm {
  term: string;
  loo: number;
  walk_forward: number;
  kept: boolean;
  note: string;
}

/** The fitted coefficients with their bootstrap standard errors. */
export interface FittedCoefficients {
  value_base_multiple: number;
  value_size_slope: number;
  value_size_slope_se: number;
  value_category_min: number;
  value_category_max: number;
  odds_years: number;
  odds_years_se: number;
  odds_tvl: number;
  odds_tvl_se: number;
  odds_growth: number;
  odds_growth_se: number;
  odds_family: number;
  odds_family_se: number;
  odds_chains: number;
  odds_chains_se: number;
  /** The odds terms that survived both held-out tests, in order: only these are shown. */
  odds_terms_kept: string[];
}

/** Everything the dashboard needs: the board, the live set, the evidence and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  off_list_size: number;
  live_size: number;
  total_implied_usd: number;
  total_tvl_usd: number;
  main_checksum: string;
  scenario: { deposit_usd: number; drop_share: number; horizon_weeks: number; tbill_apr: number; farm_net_per_hour: number };
  accounting: { ranked_watchlist: number; ranked_early: number; ranked_off_list: number; token_priced: number; token_no_cap: number; out_bridge: number; out_liquid_staking: number; out_exchange: number; out_versioned: number; ledger_total: number };
  kpi: { miss_walk_forward: number; miss_flat_walk_forward: number; range_p25_75_loo: number; range_p10_90_loo: number; range_p25_75_wf: number; range_p10_90_wf: number; within_3x_loo: number; within_3x_wf: number; odds_brier_wf: number; odds_brier_base_wf: number; odds_called_right_wf: number; odds_base_called_right_wf: number; value_terms_kept: number; value_terms_tested: number; odds_terms_kept: number; odds_terms_tested: number; farm_count: number; marginal_count: number; skip_count: number };
  value_evidence: EvidenceTerm[];
  odds_evidence: EvidenceTerm[];
  fitted: FittedCoefficients;
  odds_base_rate: number;
  odds_peers: number;
  odds_peers_with_token: number;
  fit_tokens: number;
  fit_tokens_usable: number;
  exit_drop_pct: number;
  rows: RadarRow[];
  live: LiveRow[];
  comps: PricedComp[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const CENTRE_TVL = 100_000_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list of numbers. */
export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Deterministic pseudo-random numbers in [0, 1): mulberry32, so a bootstrap refit is the same on every run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Solve a small dense linear system by Gaussian elimination with partial pivoting. */
export function solveLinear(matrix: number[][], rhs: number[]): number[] {
  const n = matrix.length;
  const m = matrix.map((row, i) => [...row, rhs[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[piv]![c]!)) piv = r;
    const tmp = m[c]!;
    m[c] = m[piv]!;
    m[piv] = tmp;
    const d = m[c]![c]!;
    for (let j = c; j <= n; j++) m[c]![j]! /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r]![c]!;
      if (f === 0) continue;
      for (let j = c; j <= n; j++) m[r]![j]! -= f * m[c]![j]!;
    }
  }
  return m.map((row) => row[n]!);
}

/** Ordinary least squares for y ~ X (first column the intercept): returns the coefficients. */
export function ols(design: number[][], y: number[]): number[] {
  const k = design[0]!.length;
  const xtx: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const xty: number[] = new Array<number>(k).fill(0);
  for (let i = 0; i < design.length; i++) {
    const row = design[i]!;
    for (let a = 0; a < k; a++) {
      xty[a]! += row[a]! * y[i]!;
      for (let b = 0; b < k; b++) xtx[a]![b]! += row[a]! * row[b]!;
    }
  }
  for (let a = 1; a < k; a++) xtx[a]![a]! += 1e-9;
  return solveLinear(xtx, xty);
}

/** A logistic regression by iteratively reweighted least squares (25 rounds or until the coefficients settle). */
export function logistic(design: number[][], y: number[]): number[] {
  const k = design[0]!.length;
  const mean = y.reduce((s, v) => s + v, 0) / y.length;
  const beta = new Array<number>(k).fill(0);
  beta[0] = Math.log(Math.max(mean, 1e-6) / Math.max(1 - mean, 1e-6));
  for (let round = 0; round < 25; round++) {
    const xtx: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
    const xtz: number[] = new Array<number>(k).fill(0);
    for (let i = 0; i < design.length; i++) {
      const row = design[i]!;
      const z = row.reduce((s, v, j) => s + v * beta[j]!, 0);
      const p = 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, z))));
      const w = Math.max(p * (1 - p), 1e-6);
      const adj = z + (y[i]! - p) / w;
      for (let a = 0; a < k; a++) {
        xtz[a]! += w * row[a]! * adj;
        for (let b = 0; b < k; b++) xtx[a]![b]! += w * row[a]! * row[b]!;
      }
    }
    for (let a = 1; a < k; a++) xtx[a]![a]! += 1e-6;
    const next = solveLinear(xtx, xtz);
    let shift = 0;
    for (let j = 0; j < k; j++) shift = Math.max(shift, Math.abs(next[j]! - beta[j]!));
    for (let j = 0; j < k; j++) beta[j] = next[j]!;
    if (shift < 1e-8) break;
  }
  return beta;
}

/** The logistic curve, clamped so no probability is ever exactly 0 or 1. */
export function sigmoid(z: number): number {
  if (z > 35) return 1;
  if (z < -35) return 0;
  return 1 / (1 + Math.exp(-z));
}

// ---------------------------------------------------------------- the snapshot

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** The exchanges whose name at the front of a protocol's name marks it as that exchange's product. */
const EXCHANGES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
/** The categories the watchlist's own rule leaves out, exactly as the snapshot's README states them. */
const RULE_BRIDGE = ['Bridge', 'Canonical Bridge'];
const RULE_LIQUID = ['Liquid Staking', 'Liquid Restaking', 'Restaked BTC'];
/** The wider families the value fit and the odds peers leave out (Cross Chain Bridge and Staking Pool too). */
const WIDE_BRIDGE = [...RULE_BRIDGE, 'Cross Chain Bridge'];
const WIDE_LIQUID = [...RULE_LIQUID, 'Staking Pool'];

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a name carries a whole word wrapped, staked or staking, in any case. */
function wrappedWord(name: string): boolean {
  return /\b(wrapped|staked|staking)\b/i.test(name);
}

/** Whether a name begins with an exchange's name. */
function exchangePrefix(name: string): boolean {
  return EXCHANGES.includes(name.split(' ')[0]!);
}

/** Whether a protocol is one the house list's own rules leave out (bridge, liquid staking, exchange, versioned or wrapped). */
function isLeftOut(p: SnapshotProtocol): 'bridge' | 'liquid' | 'exchange' | 'versioned' | null {
  if (RULE_BRIDGE.includes(p.category ?? '')) return 'bridge';
  if (RULE_LIQUID.includes(p.category ?? '')) return 'liquid';
  if (p.category === 'CEX' || exchangePrefix(p.name)) return 'exchange';
  if (VERSIONED.test(p.name) || wrappedWord(p.name)) return 'versioned';
  return null;
}

/** The first word of a protocol's name, lowercased, version markers stripped: its family stem. */
export function familyStem(p: SnapshotProtocol): string {
  const s = p.name.toLowerCase().replace(/\s(v\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/, '');
  const w = s.split(/[^a-z0-9]+/).filter((x) => x !== '');
  return w[0] ?? '';
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

// ---------------------------------------------------------------- the value model

/** The traded tokens the value is fitted on: a token with a market cap, outside the exchange, bridge and liquid-staking families. */
function fitTokens(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) => !isPreToken(p) && p.mcap_usd !== null && p.category !== 'CEX' && !WIDE_BRIDGE.includes(p.category ?? '') && !WIDE_LIQUID.includes(p.category ?? ''),
  );
}

/** A token's 7-day change, clamped to the range the model reads. */
function growthClamped(p: SnapshotProtocol): number {
  return Math.max(-0.6, Math.min(1.2, finite(p.change_7d, 0) / 100));
}

/** A protocol's age in years; the median age of the dated fit tokens when it is not listed. */
function ageYears(p: SnapshotProtocol, asOf: string, medianAge: number): number {
  const d = ageDays(asOf, p.listed_at);
  return d === null ? medianAge : d / 365.25;
}

/** The numeric features of a protocol, in the order the forward selection tries them. */
interface ValueFeatures {
  size: number;
  growth: number;
  age: number;
  chains: number;
  control: number;
}

function valueFeatures(p: SnapshotProtocol, asOf: string, medianAge: number, controlGrowth: number): ValueFeatures {
  return {
    size: Math.log(p.tvl_usd / CENTRE_TVL),
    growth: growthClamped(p),
    age: ageYears(p, asOf, medianAge),
    chains: Math.log(Math.max(1, p.chains.length)),
    control: controlGrowth,
  };
}

/** One fitted value model: the numeric coefficients and the shrunk categorical effects. */
interface ValueModel {
  beta: number[];
  numTerms: string[];
  familyEffects: Record<string, number>;
  categoryEffects: Record<string, number>;
  medianAge: number;
}

/** Fit the value model on `rows`: OLS on the kept numeric terms, then ridge-shrunk categorical effects off the residuals. The control growths come from the full fit set's slug order, so a held-out row keeps its own placebo. */
function fitValue(rows: SnapshotProtocol[], asOf: string, numTerms: string[], useFamily: boolean, useCategory: boolean, controlMap: Record<string, number>): ValueModel {
  const dated = rows.map((p) => ageYears(p, asOf, 0)).filter((a) => a > 0);
  const medianAge = dated.length > 0 ? median(dated) : 2.35;
  const design = rows.map((p) => [1, ...numTerms.map((t) => valueFeatures(p, asOf, medianAge, controlMap[p.slug] ?? 0)[t as keyof ValueFeatures])]);
  const y = rows.map((p) => Math.log(p.mcap_usd! / p.tvl_usd));
  const beta = ols(design, y);
  const resid = y.map((v, i) => v - design[i]!.reduce((s, x, j) => s + x * beta[j]!, 0));
  const familyEffects: Record<string, number> = {};
  const categoryEffects: Record<string, number> = {};
  if (useFamily) {
    const groups = new Map<string, number[]>();
    rows.forEach((p, i) => {
      const k = familyStem(p);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(resid[i]!);
    });
    for (const [k, v] of groups) familyEffects[k] = (v.length / (v.length + 16)) * (v.reduce((s, x) => s + x, 0) / v.length);
  }
  if (useCategory) {
    const groups = new Map<string, number[]>();
    rows.forEach((p, i) => {
      const k = p.category ?? '';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(resid[i]!);
    });
    for (const [k, v] of groups) categoryEffects[k] = (v.length / (v.length + 64)) * (v.reduce((s, x) => s + x, 0) / v.length);
  }
  return { beta, numTerms, familyEffects, categoryEffects, medianAge };
}

/** The deposit the scenario actually puts at risk: the plan size, never more
    than 0.02% of the protocol's TVL. The board's own control reads "plan size,
    0.02% of TVL": a $10,000 plan on a $27.2M protocol risks $5,440, on a $51.3M
    protocol the full $10,000. */
export const DEPOSIT_CAP_FRACTION = 0.0002;
export function effectiveDeposit(tvlUsd: number, planUsd: number): number {
  return Math.min(planUsd, DEPOSIT_CAP_FRACTION * tvlUsd);
}
/** What the same deposit earns in a 4% T-bill over the horizon: the bar a farm
    must beat, not just break even against. */
export function tbillUsd(depositUsd: number, horizonWeeks: number): number {
  return depositUsd * SCENARIO.tbill_apr * (horizonWeeks / 52);
}
/** The placebo: each token's control growth is the next token's 7-day change, in slug order. */
function controlGrowthBySlug(rows: SnapshotProtocol[]): Record<string, number> {
  const sorted = [...rows].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const out: Record<string, number> = {};
  for (let i = 0; i < sorted.length; i++) out[sorted[i]!.slug] = growthClamped(sorted[(i + 1) % sorted.length]!);
  return out;
}

/** A fitted value model's multiple for one protocol (before any parent haircut). */
function valueMultiple(model: ValueModel, p: SnapshotProtocol, asOf: string, controlMap: Record<string, number>): number {
  const f = valueFeatures(p, asOf, model.medianAge, controlMap[p.slug] ?? 0);
  let log = model.beta[0]!;
  model.numTerms.forEach((t, i) => {
    log += model.beta[i + 1]! * f[t as keyof ValueFeatures];
  });
  log += model.familyEffects[familyStem(p)] ?? 0;
  log += model.categoryEffects[p.category ?? ''] ?? 0;
  return Math.exp(log);
}

/** The median multiplicative miss of predictions against actual market caps. */
function typicalMiss(predicted: number[], actual: number[]): number {
  const misses = predicted.map((pr, i) => Math.max(pr / actual[i]!, actual[i]! / pr));
  return median(misses);
}

/** Leave-one-out miss of a value-model shape over the usable fit tokens. */
function looMissValue(rows: SnapshotProtocol[], asOf: string, numTerms: string[], useFamily: boolean, useCategory: boolean): number {
  const controlMap = controlGrowthBySlug(rows);
  const predicted: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const train = rows.filter((_, j) => j !== i);
    const model = fitValue(train, asOf, numTerms, useFamily, useCategory, controlMap);
    predicted.push(valueMultiple(model, rows[i]!, asOf, controlMap) * rows[i]!.tvl_usd);
  }
  return typicalMiss(predicted, rows.map((p) => p.mcap_usd!));
}

/** Walk-forward miss: each dated token scored by a model fitted only on tokens listed before it (at least two predecessors). */
function walkForwardMissValue(rows: SnapshotProtocol[], asOf: string, numTerms: string[], useFamily: boolean, useCategory: boolean): number {
  const controlMap = controlGrowthBySlug(rows);
  const dated = rows.filter((p) => p.listed_at !== null).sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : a.slug < b.slug ? -1 : 1));
  const predicted: number[] = [];
  const actual: number[] = [];
  for (let i = 0; i < dated.length; i++) {
    const train = dated.slice(0, i);
    if (train.length < 2) continue;
    const model = fitValue(train, asOf, numTerms, useFamily, useCategory, controlMap);
    predicted.push(valueMultiple(model, dated[i]!, asOf, controlMap) * dated[i]!.tvl_usd);
    actual.push(dated[i]!.mcap_usd!);
  }
  return typicalMiss(predicted, actual);
}

/** The flat model's leave-one-out and walk-forward misses (the median ratio, no terms). */
function flatMisses(rows: SnapshotProtocol[]): { loo: number; wf: number } {
  const looPred: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const others = rows.filter((_, j) => j !== i).map((p) => p.mcap_usd! / p.tvl_usd);
    looPred.push(median(others) * rows[i]!.tvl_usd);
  }
  const dated = rows.filter((p) => p.listed_at !== null).sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : a.slug < b.slug ? -1 : 1));
  const wfPred: number[] = [];
  const wfAct: number[] = [];
  for (let i = 0; i < dated.length; i++) {
    const train = dated.slice(0, i);
    if (train.length < 2) continue;
    wfPred.push(median(train.map((p) => p.mcap_usd! / p.tvl_usd)) * dated[i]!.tvl_usd);
    wfAct.push(dated[i]!.mcap_usd!);
  }
  return { loo: typicalMiss(looPred, rows.map((p) => p.mcap_usd!)), wf: typicalMiss(wfPred, wfAct) };
}

// ---------------------------------------------------------------- the odds model

/** The peers the token odds are read from: dated protocols outside the exchange, bridge and liquid-staking families. */
function oddsPeers(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) => p.listed_at !== null && p.category !== 'CEX' && !WIDE_BRIDGE.includes(p.category ?? '') && !WIDE_LIQUID.includes(p.category ?? ''),
  );
}

/** For every slug, how many of its same-stem siblings still record no token:
    one pass groups the protocols by stem, so no fit ever rescans the snapshot. */
function siblingsPreTokenBySlug(snapshot: Snapshot): Map<string, number> {
  const byStem = new Map<string, SnapshotProtocol[]>();
  for (const q of snapshot.protocols) {
    const stem = familyStem(q);
    const members = byStem.get(stem);
    if (members) members.push(q);
    else byStem.set(stem, [q]);
  }
  const out = new Map<string, number>();
  for (const members of byStem.values()) {
    const pre = members.filter((q) => isPreToken(q)).length;
    for (const m of members) out.set(m.slug, pre - (isPreToken(m) ? 1 : 0));
  }
  return out;
}

/** The survival odds: of the peers that had no token at this age, the share that record one by the oldest cohort's age. */
function survivalOdds(ageYrs: number, peers: SnapshotProtocol[], asOf: string): { odds: number; fAge: number; fOldest: number } {
  const withAge = peers.map((p) => ({ age: ageYears(p, asOf, 0), has: isPreToken(p) ? 0 : 1 }));
  const young = withAge.filter((w) => w.age <= ageYrs);
  const fAge = young.length > 0 ? young.reduce((s, w) => s + w.has, 0) / young.length : 0;
  const old = withAge.filter((w) => w.age >= 3);
  const fOldest = old.length > 0 ? old.reduce((s, w) => s + w.has, 0) / old.length : 0;
  const odds = fAge >= 1 ? 0 : (fOldest - fAge) / (1 - fAge);
  return { odds: Math.max(0, Math.min(1, odds)), fAge, fOldest };
}

/** The logistic features of a peer, in the order the forward selection tries them. */
interface OddsFeatures {
  years: number;
  family: number;
  size: number;
  growth: number;
  chains: number;
  control: number;
}

function oddsFeatures(p: SnapshotProtocol, asOf: string, medianAge: number, controlGrowth: number, siblingsPre: number): OddsFeatures {
  return {
    years: ageYears(p, asOf, medianAge),
    family: siblingsPre,
    size: Math.log(p.tvl_usd / CENTRE_TVL),
    growth: growthClamped(p),
    chains: Math.log(Math.max(1, p.chains.length)),
    control: controlGrowth,
  };
}

/** The Brier score of predicted probabilities against observed token recording, and the share called right at 0.5. */
function brierScore(predicted: number[], actual: number[]): { brier: number; calledRight: number } {
  const brier = predicted.reduce((s, pr, i) => s + (pr - actual[i]!) ** 2, 0) / predicted.length;
  const calledRight = predicted.filter((pr, i) => (pr > 0.5) === (actual[i]! === 1)).length / predicted.length;
  return { brier, calledRight };
}

/** Leave-one-out Brier of a logistic shape over the peers. Features are
    precomputed once per peer (see buildRadar): a refit must not rescan the snapshot. */
function looBrierOdds(peers: SnapshotProtocol[], terms: string[], feats: Map<string, OddsFeatures>): { brier: number; calledRight: number } {
  const predicted: number[] = [];
  for (let i = 0; i < peers.length; i++) {
    const train = peers.filter((_, j) => j !== i);
    const beta = logistic(
      train.map((p) => [1, ...terms.map((t) => feats.get(p.slug)![t as keyof OddsFeatures])]),
      train.map((p) => (isPreToken(p) ? 0 : 1)),
    );
    const f = feats.get(peers[i]!.slug)!;
    predicted.push(sigmoid(beta[0]! + terms.reduce((s, t, j) => s + beta[j + 1]! * f[t as keyof OddsFeatures], 0)));
  }
  return brierScore(predicted, peers.map((p) => (isPreToken(p) ? 0 : 1)));
}

/** Walk-forward Brier: each dated peer scored by a logistic fitted only on peers listed before it (at least ten predecessors). Features precomputed, as above. */
function walkForwardBrierOdds(peers: SnapshotProtocol[], terms: string[], feats: Map<string, OddsFeatures>): { brier: number; calledRight: number } {
  const dated = [...peers].sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : a.slug < b.slug ? -1 : 1));
  const predicted: number[] = [];
  const actual: number[] = [];
  for (let i = 0; i < dated.length; i++) {
    const train = dated.slice(0, i);
    if (train.length < 10) continue;
    const beta = logistic(
      train.map((p) => [1, ...terms.map((t) => feats.get(p.slug)![t as keyof OddsFeatures])]),
      train.map((p) => (isPreToken(p) ? 0 : 1)),
    );
    const f = feats.get(dated[i]!.slug)!;
    predicted.push(sigmoid(beta[0]! + terms.reduce((s, t, j) => s + beta[j + 1]! * f[t as keyof OddsFeatures], 0)));
    actual.push(isPreToken(dated[i]!) ? 0 : 1);
  }
  return brierScore(predicted, actual);
}

/** The base rate's leave-one-out and walk-forward Brier scores (one probability for every peer). */
function baseRateBriers(peers: SnapshotProtocol[]): { loo: { brier: number; calledRight: number }; wf: { brier: number; calledRight: number } } {
  const y = peers.map((p) => (isPreToken(p) ? 0 : 1));
  const rate = y.reduce((s, v) => s + v, 0) / y.length;
  const loo = brierScore(y.map(() => rate), y);
  const dated = [...peers].sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : a.slug < b.slug ? -1 : 1));
  const wfPred: number[] = [];
  const wfAct: number[] = [];
  for (let i = 0; i < dated.length; i++) {
    const train = dated.slice(0, i);
    if (train.length < 10) continue;
    wfPred.push(train.filter((p) => !isPreToken(p)).length / train.length);
    wfAct.push(isPreToken(dated[i]!) ? 0 : 1);
  }
  return { loo, wf: brierScore(wfPred, wfAct) };
}

// ---------------------------------------------------------------- the farm plan

/** The gas price of a protocol's first chain, in whole US dollars per transaction. */
function gasUsd(p: SnapshotProtocol): number {
  return GAS_USD[p.chains[0] ?? ''] ?? GAS_DEFAULT_USD;
}

/** The one action a protocol's category asks a farmer to take. The amount is the
    effective deposit: the plan size, never more than 0.02% of the protocol's TVL. */
function actionFor(p: SnapshotProtocol, deposit: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const eff = effectiveDeposit(p.tvl_usd, deposit);
  const d = eff.toLocaleString('en-US');
  const size = eff < deposit
    ? ` Start with a $100 test, then size up to the full $${d} (0.02% of its $${p.tvl_usd.toLocaleString('en-US')} TVL).`
    : ` Start with a $100 test, then size up to the full $${d} plan size.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${d} of USDC to ${name} on ${chain} and keep the position open.${size}`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${d} of liquidity to ${name}'s main pool on ${chain} and keep the position open.${size}`;
  if (c.includes('bridge')) return `Bridge $${d} of USDC to ${chain} through ${name} and use the bridged funds in its app.${size}`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${d} of the chain's staking asset through ${name} and keep the receipt.${size}`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${d} of USDC as margin on ${name} and open one small hedge.${size}`;
  if (c.includes('prediction')) return `Fund $${d} and place one market position on ${name}.${size}`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${d} into a ${name} vault on ${chain} and keep the shares.${size}`;
  if (c.includes('stable')) return `Mint or deposit $${d} of the stable asset through ${name} on ${chain}.${size}`;
  if (c.includes('rwa')) return `Mint $${d} of the protocol's yield asset on ${chain} and hold it.${size}`;
  if (c.includes('insurance')) return `Buy $${d} of cover from ${name} on ${chain} and keep the policy.${size}`;
  return `Deposit $${d} of USDC into ${name} on ${chain} and keep the position open.${size}`;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
function stepText(step: FarmStep): string {
  let s = `${step.title}: ${step.text} Cost: $${step.cost_usd.toFixed(2)}. Time: ${step.weekly ? `${step.minutes} min a week for ${SCENARIO.horizon_weeks} weeks` : `${step.minutes} min`}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A protocol's farm plan: ten steps, each an action with a cost and a time. The
 * plan is derived from the protocol's own record (category, chains, TVL, age),
 * never from a hand-written list of names. Costs are gas on its chains plus two
 * exchange withdrawals; times are hands-on minutes, weekly steps counted once a
 * week for the horizon.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, exitTvlUsd: number, exitDropPct: number): FarmStep[] {
  const chain = p.chains.length > 0 ? p.chains[0]! : 'its main chain';
  const gas = gasUsd(p);
  const deposit = SCENARIO.deposit_usd;
  const hold = age === null ? 30 : age < 180 ? 60 : age < 365 ? 45 : 30;
  const lastWeek = finite(p.change_7d, 0);
  return [
    { title: 'SETUP', text: `Set up an EVM wallet (a hardware-backed account is best) used only for this farm and withdraw about $5 of ${chain === 'Solana' ? 'SOL' : 'the chain gas token'} to it from an exchange for gas.`, cost_usd: WITHDRAW_USD, minutes: 10, weekly: false },
    { title: 'VERIFY', text: `Reach ${p.name} from its DefiLlama page (defillama.com/protocol/${p.slug}) or its official accounts, bookmark the app and match the contract addresses against its docs. Never sign an approval from a link sent in a DM.${p.category === 'RWA' ? ' Real-world-asset vaults ask for identity verification first; budget about $20 for it and send documents only through the app itself.' : ''}`, cost_usd: p.category === 'RWA' ? 20 : 0, minutes: 5, weekly: false },
    { title: 'FUND', text: `Withdraw USDC straight to ${chain} from an exchange that supports it, or move it from Ethereum with a large bridge that lists ${chain}.`, cost_usd: WITHDRAW_USD, minutes: 10, weekly: false },
    { title: 'RISK', text: `Strategy risk: ${p.name} is a ${p.category ?? 'protocol'} on ${chain}${p.chains.length > 1 ? ` and ${p.chains.length - 1} more chain${p.chains.length > 2 ? 's' : ''}` : ''}; read the strategy page and avoid vaults whose yield is mostly paid in an unlisted points token.`, cost_usd: 0, minutes: 10, weekly: false },
    { title: 'CORE', text: actionFor(p, deposit, chain), cost_usd: gas * 3, minutes: 15, weekly: false },
    { title: 'DEEPEN', text: `Hold the receipt token, or post it where ${p.name} lists a points boost (a lending market or an LP), but never loop it more than once. A second deployment on ${p.chains[1] ?? chain} lets the same wallet show activity on more than one chain.`, cost_usd: gas * 2, minutes: 10, weekly: false },
    { title: 'CADENCE', text: `Touch the position once a week (a top-up, a claim, a vote) so the wallet shows steady use rather than one deposit.`, cost_usd: gas * SCENARIO.horizon_weeks, minutes: 5, weekly: true },
    { title: 'WATCH', text: `Exit rule, checked weekly: withdraw if ${p.name}'s TVL prints below $${Math.round(exitTvlUsd).toLocaleString('en-US')}, which is ${exitDropPct.toFixed(1)}% from today's $${p.tvl_usd.toLocaleString('en-US')} and a week worse than 95% of this snapshot's protocols (its last week was ${lastWeek >= 0 ? '+' : ''}${lastWeek.toFixed(1)}%); also if withdrawals are paused or the team has not shipped a snapshot it already announced.`, cost_usd: 0, minutes: 5, weekly: true },
    { title: 'RECORD', text: `Keep a ledger from the first transaction: date, transaction hash, asset, amount and dollar value of the $${effectiveDeposit(p.tvl_usd, deposit).toLocaleString('en-US')} deposit and of every top-up, claim and withdrawal. A claim may ask the wallet to prove its history, and a drop is taxable income in many places at its value on the day it arrives.`, cost_usd: 0, minutes: 5, weekly: false },
    { title: 'EXIT', text: `Unwind in one pass: claim, withdraw the deposit and the receipt token, and move the funds back to the exchange. Do not leave a dust position open past the horizon.`, cost_usd: gas * 2, minutes: 20, weekly: false },
  ];
}

// ---------------------------------------------------------------- the board

/** The 5th percentile of 7-day changes across the snapshot: a week worse than 95% of protocols. */
function exitDropPercent(snapshot: Snapshot): number {
  const changes = snapshot.protocols.map((p) => finite(p.change_7d, 0)).sort((a, b) => a - b);
  const at = Math.max(0, Math.floor(0.05 * changes.length));
  return changes[at]!;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const { board } = buildRadar(snapshot);
  return board;
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, modelOverride?: { numTerms: string[]; useFamily: boolean; useCategory: boolean; oddsTerms: string[] }): { board: BoardRow[]; radar: RadarData } {
  const asOf = snapshot.as_of;
  const bySlug = new Map(snapshot.protocols.map((p) => [p.slug, p]));

  // --- the universe, every protocol in exactly one group.
  const accounting = { ranked_watchlist: 0, ranked_early: 0, ranked_off_list: 0, token_priced: 0, token_no_cap: 0, out_bridge: 0, out_liquid_staking: 0, out_exchange: 0, out_versioned: 0, ledger_total: snapshot.protocols.length };
  const chosen = new Map<string, { p: SnapshotProtocol; tier: 'watchlist' | 'early' | 'off-list' }>();
  for (const slug of snapshot.watchlist) {
    const p = bySlug.get(slug);
    if (p !== undefined) {
      chosen.set(slug, { p, tier: 'watchlist' });
      accounting.ranked_watchlist++;
    }
  }
  for (const p of snapshot.protocols) {
    if (chosen.has(p.slug)) continue;
    if (!isPreToken(p)) {
      if (p.mcap_usd !== null && p.mcap_usd > 0 && p.mcap_usd <= 2 * p.tvl_usd) accounting.token_priced++;
      else accounting.token_no_cap++;
      continue;
    }
    const out = isLeftOut(p);
    if (out === 'bridge') accounting.out_bridge++;
    else if (out === 'liquid') accounting.out_liquid_staking++;
    else if (out === 'exchange') accounting.out_exchange++;
    else if (out === 'versioned') accounting.out_versioned++;
    else if (p.tvl_usd >= snapshot.floor_usd) {
      chosen.set(p.slug, { p, tier: 'off-list' });
      accounting.ranked_off_list++;
    } else {
      chosen.set(p.slug, { p, tier: 'early' });
      accounting.ranked_early++;
    }
  }

  // --- the value fit and its forward selection.
  const tokens = fitTokens(snapshot);
  const usable = tokens.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0);
  const controlMapValue = controlGrowthBySlug(usable);
  const flat = flatMisses(usable);
  const valueCandidates: { name: string; num: string[]; family: boolean; category: boolean }[] = [
    { name: 'size curve, ln TVL', num: ['size'], family: false, category: false },
    { name: 'family effect · ridge 16', num: ['size'], family: true, category: false },
    { name: 'category effect · ridge 64', num: ['size'], family: false, category: true },
    { name: '7-day TVL growth', num: ['size', 'growth'], family: false, category: true },
    { name: 'age, years listed', num: ['size', 'age'], family: false, category: true },
    { name: 'chain count, ln', num: ['size', 'chains'], family: false, category: true },
    { name: 'control: growth of another row', num: ['size', 'control'], family: false, category: true },
  ];
  // A term is tried on top of the kept set; the category term builds on the family
  // decision, and the numeric terms build on the kept numeric set.
  const valueEvidence: EvidenceTerm[] = [];
  let keptNum: string[] = [];
  let keptFamily = false;
  let keptCategory = false;
  let curLoo = flat.loo;
  let curWf = flat.wf;
  // Size first, on its own.
  {
    const loo = looMissValue(usable, asOf, ['size'], false, false);
    const wf = walkForwardMissValue(usable, asOf, ['size'], false, false);
    const keep = loo < curLoo && wf <= curWf;
    valueEvidence.push({ term: '+ size curve, ln TVL', loo, walk_forward: wf, kept: keep, note: keep ? 'kept' : 'tested, not kept' });
    if (keep) {
      keptNum = ['size'];
      curLoo = loo;
      curWf = wf;
    }
  }
  // Family, then category, each on top of the kept set.
  for (const cand of [valueCandidates[1]!, valueCandidates[2]!]) {
    const useFamily = cand.family ? true : keptFamily;
    const useCategory = cand.category ? true : keptCategory;
    const loo = looMissValue(usable, asOf, keptNum, useFamily, useCategory);
    const wf = walkForwardMissValue(usable, asOf, keptNum, useFamily, useCategory);
    const keep = loo < curLoo && wf <= curWf;
    valueEvidence.push({ term: `+ ${cand.name}`, loo, walk_forward: wf, kept: keep, note: keep ? 'kept' : cand.name.startsWith('family') ? 'tested, not kept' : 'tested, not kept' });
    if (keep) {
      keptFamily = useFamily;
      keptCategory = useCategory;
      curLoo = loo;
      curWf = wf;
    }
  }
  // The numeric terms, each on top of the kept set (category kept or not, as decided).
  for (const cand of valueCandidates.slice(3)) {
    const num = [...keptNum, ...cand.num.filter((t) => !keptNum.includes(t))];
    const loo = looMissValue(usable, asOf, num, keptFamily, keptCategory);
    const wf = walkForwardMissValue(usable, asOf, num, keptFamily, keptCategory);
    const keep = loo < curLoo && wf <= curWf;
    valueEvidence.push({ term: `+ ${cand.name}`, loo, walk_forward: wf, kept: keep, note: keep ? 'kept' : cand.name.startsWith('control') ? 'must not help' : 'tested, not kept' });
    if (keep) {
      keptNum = num;
      curLoo = loo;
      curWf = wf;
    }
  }
  if (modelOverride !== undefined) {
    keptNum = modelOverride.numTerms;
    keptFamily = modelOverride.useFamily;
    keptCategory = modelOverride.useCategory;
  }
  const valueModel = fitValue(usable, asOf, keptNum, keptFamily, keptCategory, controlMapValue);

  // --- the odds peers, the survival odds and the logistic's forward selection.
  const peers = oddsPeers(snapshot);
  const peerAges = peers.map((p) => ageYears(p, asOf, 0));
  const medianPeerAge = median(peerAges);
  const controlMapOdds = controlGrowthBySlug(peers);
  // The odds features are computed once per peer here: every leave-one-out,
  // walk-forward and bootstrap refit below reads this map instead of
  // rescanning the snapshot (the sibling count alone used to cost a full pass).
  const sibMap = siblingsPreTokenBySlug(snapshot);
  const oddsFeat = new Map(peers.map((p) => [p.slug, oddsFeatures(p, asOf, medianPeerAge, controlMapOdds[p.slug] ?? 0, sibMap.get(p.slug) ?? 0)]));
  const baseBriers = baseRateBriers(peers);
  const oddsCandidates: { name: string; terms: string[] }[] = [
    { name: 'age, years listed', terms: ['years'] },
    { name: 'family effect · ridge 16', terms: ['years', 'family'] },
    { name: 'size curve, ln TVL', terms: ['years', 'family', 'size'] },
    { name: '7-day TVL growth', terms: ['years', 'family', 'size', 'growth'] },
    { name: 'chain count, ln', terms: ['years', 'family', 'size', 'growth', 'chains'] },
    { name: 'control: growth of another row', terms: ['years', 'family', 'size', 'growth', 'control'] },
  ];
  const oddsEvidence: EvidenceTerm[] = [];
  let keptOdds: string[] = [];
  let curBrierLoo = baseBriers.loo.brier;
  let curBrierWf = baseBriers.wf.brier;
  for (const cand of oddsCandidates) {
    const loo = looBrierOdds(peers, cand.terms, oddsFeat);
    const wf = walkForwardBrierOdds(peers, cand.terms, oddsFeat);
    const keep = loo.brier < curBrierLoo && wf.brier <= curBrierWf;
    oddsEvidence.push({ term: `+ ${cand.name}`, loo: loo.brier, walk_forward: wf.brier, kept: keep, note: keep ? 'kept' : cand.name.startsWith('control') ? 'must not help' : 'tested, not kept' });
    if (keep) {
      keptOdds = cand.terms;
      curBrierLoo = loo.brier;
      curBrierWf = wf.brier;
    }
  }
  if (modelOverride !== undefined) keptOdds = modelOverride.oddsTerms;
  const oddsBeta = logistic(
    peers.map((p) => [1, ...keptOdds.map((t) => oddsFeat.get(p.slug)![t as keyof OddsFeatures])]),
    peers.map((p) => (isPreToken(p) ? 0 : 1)),
  );

  // --- bootstrap: 200 refits of the kept value model (seeded, so every run agrees).
  const rng = mulberry32(20261114);
  const bootValue: ValueModel[] = [];
  for (let b = 0; b < 200; b++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < usable.length; i++) sample.push(usable[Math.floor(rng() * usable.length)]!);
    bootValue.push(fitValue(sample, asOf, keptNum, keptFamily, keptCategory, controlMapValue));
  }
  const bootOdds: number[][] = [];
  for (let b = 0; b < 200; b++) {
    const idx: number[] = [];
    for (let i = 0; i < peers.length; i++) idx.push(Math.floor(rng() * peers.length));
    const sample = idx.map((i) => peers[i]!);
    bootOdds.push(
      logistic(
        sample.map((p) => [1, ...keptOdds.map((t) => oddsFeat.get(p.slug)![t as keyof OddsFeatures])]),
        sample.map((p) => (isPreToken(p) ? 0 : 1)),
      ),
    );
  }
  const se = (values: number[]): number => {
    const m = values.reduce((s, v) => s + v, 0) / values.length;
    return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, values.length - 1));
  };
  const catEffects = Object.values(valueModel.categoryEffects).map((v) => Math.exp(v));
  const fitted: FittedCoefficients = {
    value_base_multiple: Math.round(Math.exp(valueModel.beta[0]!) * 1e3) / 1e3,
    value_size_slope: keptNum.includes('size') ? valueModel.beta[1 + keptNum.indexOf('size')]! : 0,
    value_size_slope_se: keptNum.includes('size') ? se(bootValue.map((m) => m.beta[1 + keptNum.indexOf('size')]!)) : 0,
    value_category_min: catEffects.length > 0 ? Math.min(...catEffects) : 1,
    value_category_max: catEffects.length > 0 ? Math.max(...catEffects) : 1,
    odds_years: keptOdds.includes('years') ? oddsBeta[1 + keptOdds.indexOf('years')]! : 0,
    odds_years_se: keptOdds.includes('years') ? se(bootOdds.map((bb) => bb[1 + keptOdds.indexOf('years')]!)) : 0,
    odds_tvl: keptOdds.includes('size') ? oddsBeta[1 + keptOdds.indexOf('size')]! : 0,
    odds_tvl_se: keptOdds.includes('size') ? se(bootOdds.map((bb) => bb[1 + keptOdds.indexOf('size')]!)) : 0,
    odds_growth: keptOdds.includes('growth') ? oddsBeta[1 + keptOdds.indexOf('growth')]! : 0,
    odds_growth_se: keptOdds.includes('growth') ? se(bootOdds.map((bb) => bb[1 + keptOdds.indexOf('growth')]!)) : 0,
    odds_family: keptOdds.includes('family') ? oddsBeta[1 + keptOdds.indexOf('family')]! : 0,
    odds_family_se: keptOdds.includes('family') ? se(bootOdds.map((bb) => bb[1 + keptOdds.indexOf('family')]!)) : 0,
    odds_chains: keptOdds.includes('chains') ? oddsBeta[1 + keptOdds.indexOf('chains')]! : 0,
    odds_chains_se: keptOdds.includes('chains') ? se(bootOdds.map((bb) => bb[1 + keptOdds.indexOf('chains')]!)) : 0,
    // The control term is a placebo that must not help; it is never a kept term.
    odds_terms_kept: keptOdds.filter((t) => t !== 'control'),
  };

  // --- range honesty: the printed range is the point prediction times the
  // held-out residual factors (actual / predicted on the leave-one-out fits).
  // A bootstrap of the coefficients alone is far too narrow: it leaves out the
  // token's own deviation, the ×3.4 typical miss. The reference board's own rows
  // show the same factor on every row (Yuzu $2.8M–$32.0M is ×0.30–×3.43 of its
  // $9.3M point, Firelight the same), which is exactly this construction.
  const looPred: number[] = [];
  const looAct: number[] = [];
  for (let i = 0; i < usable.length; i++) {
    const train = usable.filter((_, j) => j !== i);
    const model = fitValue(train, asOf, keptNum, keptFamily, keptCategory, controlMapValue);
    looPred.push(valueMultiple(model, usable[i]!, asOf, controlMapValue) * usable[i]!.tvl_usd);
    looAct.push(usable[i]!.mcap_usd!);
  }
  const wfPred: number[] = [];
  const wfAct: number[] = [];
  {
    const dated = usable.filter((p) => p.listed_at !== null).sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : a.slug < b.slug ? -1 : 1));
    for (let i = 0; i < dated.length; i++) {
      const train = dated.slice(0, i);
      if (train.length < 2) continue;
      const model = fitValue(train, asOf, keptNum, keptFamily, keptCategory, controlMapValue);
      wfPred.push(valueMultiple(model, dated[i]!, asOf, controlMapValue) * dated[i]!.tvl_usd);
      wfAct.push(dated[i]!.mcap_usd!);
    }
  }
  const looFactors = looPred.map((pr, i) => looAct[i]! / pr).sort((a, b) => a - b);
  const qf = (p: number) => looFactors[Math.min(looFactors.length - 1, Math.floor(p * looFactors.length))]!;
  const f10 = qf(0.1);
  const f25 = qf(0.25);
  const f75 = qf(0.75);
  const f90 = qf(0.9);
  const coverage = (pred: number[], act: number[]): { within3x: number; p2575: number; p1090: number } => {
    let w3 = 0;
    let in2575 = 0;
    let in1090 = 0;
    for (let i = 0; i < pred.length; i++) {
      const ratio = Math.max(pred[i]! / act[i]!, act[i]! / pred[i]!);
      if (ratio <= 3) w3++;
      if (act[i]! >= pred[i]! * f25 && act[i]! <= pred[i]! * f75) in2575++;
      if (act[i]! >= pred[i]! * f10 && act[i]! <= pred[i]! * f90) in1090++;
    }
    return { within3x: w3 / pred.length, p2575: in2575 / pred.length, p1090: in1090 / pred.length };
  };
  const covLoo = coverage(looPred, looAct);
  const covWf = coverage(wfPred, wfAct);

  // --- the board itself.
  const exitPct = exitDropPercent(snapshot);
  const scored = [...chosen.values()].map(({ p, tier }) => {
    const multiple = valueMultiple(valueModel, p, asOf, controlMapValue);
    const parentFactor = tier === 'off-list' ? PARENT_KEEP : 1;
    // The value if a token launches, before any parent haircut: the board prints
    // this figure, and the implied value applies the parent factor and the odds.
    const valueIfLaunches = p.tvl_usd * multiple;
    const age = ageDays(asOf, p.listed_at);
    const ageYrs = age === null ? medianPeerAge : age / 365.25;
    const { odds, fAge, fOldest } = survivalOdds(ageYrs, peers, asOf);
    const implied = valueIfLaunches * parentFactor * odds;
    return { p, tier, multiple, parentFactor, valueIfLaunches, age, odds, fAge, fOldest, implied };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  // Rank ranges per row, from the 200 bootstrap refits: the order shuffles as the
  // coefficients move, while the value ranges below come from the residual factors.
  // The range is the 5th-95th percentile of the rank across refits, not the
  // min-max: a single wild refit would otherwise stretch a row across the board.
  const bootRanks: number[][] = scored.map(() => []);
  for (let b = 0; b < 200; b++) {
    const model = bootValue[b]!;
    const vals = scored.map((s) => s.p.tvl_usd * valueMultiple(model, s.p, asOf, controlMapValue) * s.parentFactor * s.odds);
    const order = vals.map((v, i) => i).sort((i, j) => vals[j]! - vals[i]! || (scored[i]!.p.slug < scored[j]!.p.slug ? -1 : 1));
    order.forEach((orig, rank) => {
      bootRanks[orig]!.push(rank + 1);
    });
  }
  const board: BoardRow[] = scored.map((s, i) => {
    const ranks = bootRanks[i]!;
    const sortedRanks = [...ranks].sort((a, b) => a - b);
    const steps = farmSteps(s.p, s.age, s.p.tvl_usd * (1 + exitPct / 100), exitPct);
    const fees = steps.reduce((sum, st) => sum + st.cost_usd, 0);
    const minutes = steps.reduce((sum, st) => sum + st.minutes * (st.weekly ? SCENARIO.horizon_weeks : 1), 0);
    // The deposit at risk is the plan size, capped at 0.02% of TVL; the farm must
    // beat what the same deposit earns in a T-bill, and pay $25 an hour of hands-on time.
    const dep = effectiveDeposit(s.p.tvl_usd, SCENARIO.deposit_usd);
    const drop = s.implied * SCENARIO.drop_share * (dep / s.p.tvl_usd);
    const net = drop - fees;
    const netPerHour = minutes > 0 ? net / (minutes / 60) : 0;
    const tbill = tbillUsd(dep, SCENARIO.horizon_weeks);
    const verdict = net <= 0 ? 'SKIP' : net > tbill && netPerHour >= SCENARIO.farm_net_per_hour ? 'FARM' : 'MARGINAL';
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.age,
      implied_value_usd: Math.max(1, Math.round(s.implied)),
      model: {
        tier: s.tier,
        parent_factor: s.parentFactor,
        multiple: Math.round(s.multiple * 1e6) / 1e6,
        base_multiple: Math.round(Math.exp(valueModel.beta[0]!) * 1e4) / 1e4,
        size_multiplier: Math.round(Math.exp((valueModel.beta[1 + keptNum.indexOf('size')] ?? 0) * Math.log(s.p.tvl_usd / CENTRE_TVL)) * 1e4) / 1e4,
        category_multiplier: Math.round(Math.exp(valueModel.categoryEffects[s.p.category ?? ''] ?? 0) * 1e4) / 1e4,
        value_if_launches_usd: Math.max(1, Math.round(s.valueIfLaunches)),
        token_odds: Math.round(s.odds * 1e4) / 1e4,
        odds_f_age: Math.round(s.fAge * 1e4) / 1e4,
        odds_f_oldest: Math.round(s.fOldest * 1e4) / 1e4,
        p25_usd: Math.max(1, Math.round(s.implied * f25)),
        p75_usd: Math.max(1, Math.round(s.implied * f75)),
        p10_usd: Math.max(1, Math.round(s.implied * f10)),
        p90_usd: Math.max(1, Math.round(s.implied * f90)),
        rank_lo: sortedRanks[Math.floor(0.05 * sortedRanks.length)]!,
        rank_hi: sortedRanks[Math.floor(0.95 * sortedRanks.length)]!,
        verdict,
        modelled_drop_usd: Math.round(drop * 100) / 100,
        fees_usd: Math.round(fees * 100) / 100,
        net_usd: Math.round(net * 100) / 100,
        net_per_hour_usd: Math.round(netPerHour * 100) / 100,
        hands_on_minutes: minutes,
      },
      farm_steps: steps.map(stepText),
    };
  });
  // Re-sort check: rounding the implied values must not break the order the gate reads.
  board.sort((a, b) => b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : 1));
  board.forEach((r, i) => {
    r.rank = i + 1;
  });

  const farmCount = board.filter((r) => r.model.verdict === 'FARM').length;
  const marginalCount = board.filter((r) => r.model.verdict === 'MARGINAL').length;
  const skipCount = board.filter((r) => r.model.verdict === 'SKIP').length;
  const finalWf = walkForwardMissValue(usable, asOf, keptNum, keptFamily, keptCategory);
  const finalOddsWf = walkForwardBrierOdds(peers, keptOdds, oddsFeat);

  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: accounting.ranked_early,
    off_list_size: accounting.ranked_off_list,
    live_size: 0,
    total_implied_usd: board.reduce((s, r) => s + r.implied_value_usd, 0),
    total_tvl_usd: board.reduce((s, r) => s + r.tvl_usd, 0),
    main_checksum: '',
    scenario: { deposit_usd: SCENARIO.deposit_usd, drop_share: SCENARIO.drop_share, horizon_weeks: SCENARIO.horizon_weeks, tbill_apr: SCENARIO.tbill_apr, farm_net_per_hour: SCENARIO.farm_net_per_hour },
    accounting,
    kpi: {
      miss_walk_forward: Math.round(finalWf * 100) / 100,
      miss_flat_walk_forward: Math.round(flat.wf * 100) / 100,
      range_p25_75_loo: Math.round(covLoo.p2575 * 100) / 100,
      range_p10_90_loo: Math.round(covLoo.p1090 * 100) / 100,
      range_p25_75_wf: Math.round(covWf.p2575 * 100) / 100,
      range_p10_90_wf: Math.round(covWf.p1090 * 100) / 100,
      within_3x_loo: Math.round(covLoo.within3x * 100) / 100,
      within_3x_wf: Math.round(covWf.within3x * 100) / 100,
      odds_brier_wf: Math.round(finalOddsWf.brier * 1000) / 1000,
      odds_brier_base_wf: Math.round(baseBriers.wf.brier * 1000) / 1000,
      odds_called_right_wf: Math.round(finalOddsWf.calledRight * 100) / 100,
      odds_base_called_right_wf: Math.round(baseBriers.wf.calledRight * 100) / 100,
      value_terms_kept: valueEvidence.filter((e) => e.kept).length,
      value_terms_tested: valueEvidence.length,
      odds_terms_kept: oddsEvidence.filter((e) => e.kept).length,
      odds_terms_tested: oddsEvidence.length,
      farm_count: farmCount,
      marginal_count: marginalCount,
      skip_count: skipCount,
    },
    value_evidence: [{ term: 'flat median multiple', loo: Math.round(flat.loo * 100) / 100, walk_forward: Math.round(flat.wf * 100) / 100, kept: false, note: 'baseline' }, ...valueEvidence],
    odds_evidence: [{ term: 'base rate of peers', loo: Math.round(baseBriers.loo.brier * 1000) / 1000, walk_forward: Math.round(baseBriers.wf.brier * 1000) / 1000, kept: false, note: 'baseline' }, ...oddsEvidence],
    fitted,
    odds_base_rate: Math.round((peers.filter((p) => !isPreToken(p)).length / peers.length) * 1000) / 1000,
    odds_peers: peers.length,
    odds_peers_with_token: peers.filter((p) => !isPreToken(p)).length,
    fit_tokens: tokens.length,
    fit_tokens_usable: usable.length,
    exit_drop_pct: exitPct,
    rows: board.map((r) => ({
      rank: r.rank,
      slug: r.slug,
      name: r.name,
      category: r.category,
      chains: r.chains,
      tvl_usd: r.tvl_usd,
      change_7d: r.change_7d,
      listed_at: r.listed_at,
      age_days: r.age_days,
      tier: r.model.tier,
      parent_factor: r.model.parent_factor,
      multiple: r.model.multiple,
      base_multiple: r.model.base_multiple,
      size_multiplier: r.model.size_multiplier,
      category_multiplier: r.model.category_multiplier,
      value_if_launches_usd: r.model.value_if_launches_usd,
      token_odds: r.model.token_odds,
      odds_f_age: r.model.odds_f_age,
      odds_f_oldest: r.model.odds_f_oldest,
      implied_value_usd: r.implied_value_usd,
      p25_usd: r.model.p25_usd,
      p75_usd: r.model.p75_usd,
      p10_usd: r.model.p10_usd,
      p90_usd: r.model.p90_usd,
      rank_lo: r.model.rank_lo,
      rank_hi: r.model.rank_hi,
      verdict: r.model.verdict,
      modelled_drop_usd: r.model.modelled_drop_usd,
      fees_usd: r.model.fees_usd,
      net_usd: r.model.net_usd,
      net_per_hour_usd: r.model.net_per_hour_usd,
      hands_on_minutes: r.model.hands_on_minutes,
      farm_steps: farmSteps(bySlug.get(r.slug)!, r.age_days, r.tvl_usd * (1 + exitPct / 100), exitPct),
    })),
    live: liveRows(snapshot),
    comps: pricedComps(snapshot, asOf, valueModel, controlMapValue),
  };
  radar.live_size = radar.live.length;
  return { board, radar };
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, 24)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, chains: p.chains, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd, change_7d: p.change_7d }));
}

/** The priced comps: traded tokens with a usable market cap, with their held-out model multiple. */
export function pricedComps(snapshot: Snapshot, asOf: string, model: ValueModel, controlMap: Record<string, number>): PricedComp[] {
  const usable = fitTokens(snapshot).filter((p) => p.mcap_usd !== null && p.mcap_usd > 0);
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.mcap_usd <= 2 * p.tvl_usd)
    .map((p) => {
      const train = usable.filter((q) => q.slug !== p.slug);
      const heldOut = train.length > 10 ? fitValue(train, asOf, model.numTerms, Object.keys(model.familyEffects).length > 0, Object.keys(model.categoryEffects).length > 0, controlMap) : model;
      return {
        slug: p.slug,
        name: p.name,
        category: p.category,
        tvl_usd: p.tvl_usd,
        mcap_usd: p.mcap_usd!,
        ratio: Math.round((p.mcap_usd! / p.tvl_usd) * 1000) / 1000,
        model_multiple: Math.round(valueMultiple(heldOut, p, asOf, controlMap) * 1000) / 1000,
      };
    })
    .sort((a, b) => b.mcap_usd - a.mcap_usd);
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

/** Why a board is not one the gate will take, or null: coverage, size, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}



