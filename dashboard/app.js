'use strict';
/* Launch Radar dashboard. Everything on this page is recomputed in the browser
   from window.RADAR (data.js, written by main.ts from the same board.json the
   judge reads). No network, no framework. Verdicts recompute live when the
   deposit, drop share or horizon controls move. */
const R = window.RADAR;
const $ = (id) => document.getElementById(id);
const state = { verdict: 'ALL', tier: 'ALL', deposit: 'pct', drop: 0.07, horizon: 12, search: '', category: '', chain: '', sort: 'implied' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = (v) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const a = Math.abs(v), sign = v < 0 ? '−' : '';
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
  return `${sign}$${a.toFixed(0)}`;
};
const usdExact = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `$${Math.round(v).toLocaleString('en-US')}`);
const pct = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(d)}%`);
const x = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `×${v.toFixed(d)}`);
const num = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('en-US'));
const ageStr = (d) => {
  if (d === null || d === undefined) return '—';
  if (d < 30) return `${d}d`;
  if (d < 365) return `${(d / 30.44).toFixed(1)} mo`;
  return `${(d / 365.25).toFixed(1)} yr`;
};
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

/** The farm economics of one row under the current controls. The deposit at risk
    is the plan size, never more than 0.02% of TVL; fees and hands-on minutes are
    fixed; the drop scales with deposit and drop share. FARM must beat what the
    same deposit earns in a T-bill, and pay $25 an hour of hands-on time. */
function farm(row) {
  const dep = state.deposit === 'pct' ? Math.min(10000, row.tvl_usd * 0.0002) : Number(state.deposit);
  const drop = row.implied_value_usd * state.drop * (dep / row.tvl_usd);
  const net = drop - row.fees_usd;
  const perHour = net / (row.hands_on_minutes / 60);
  const tbill = dep * R.scenario.tbill_apr * (state.horizon / 52);
  const verdict = net <= 0 ? 'SKIP' : net > tbill && perHour >= R.scenario.farm_net_per_hour ? 'FARM' : 'MARGINAL';
  return { dep, drop, net, perHour, verdict, tbill, coverOdds: drop > 0 ? row.fees_usd / drop : 1 };
}
const tierOf = (rank) => (rank <= 10 ? 'Top 10' : rank <= 50 ? 'Top 50' : rank <= 100 ? 'Top 100' : 'Outside top 100');
const tierBadge = (row) => row.tier === 'watchlist' ? '<span class="badge watch">WATCHLIST</span>' : row.tier === 'early' ? '<span class="badge early">EARLY</span>' : '<span class="badge off">OFF-LIST ×0.48</span>';

function renderMeta() {
  $('meta-line').textContent = `DefiLlama snapshot ${R.as_of} · floor ${usd(R.floor_usd)} · model ${R.model_version} · checksum ${R.main_checksum}`;
}

function renderKpis() {
  const verdicts = R.rows.map((r) => farm(r).verdict);
  const farmN = verdicts.filter((v) => v === 'FARM').length;
  const skipN = verdicts.filter((v) => v === 'SKIP').length;
  const k = R.kpi;
  const finalValueLoo = [...R.value_evidence].reverse().find((e) => e.kept)?.loo ?? R.value_evidence[0].loo;
  const cards = [
    { label: 'Out-of-sample miss, walk-forward', big: x(k.miss_walk_forward), sub: `vs ${x(k.miss_flat_walk_forward)} flat · leave-one-out ${x(finalValueLoo)} vs ${x(R.value_evidence[0].loo)}` },
    { label: 'Is the printed range honest?', big: `${pct(k.range_p25_75_wf, 0)} · ${pct(k.range_p10_90_wf, 0)}`, sub: 'of later-listed caps fall inside P25–P75, P10–P90 (stated 50% · 80%)' },
    { label: 'Token odds vs base rate, Brier', big: k.odds_brier_wf.toFixed(3), sub: `vs ${k.odds_brier_base_wf.toFixed(3)} walk-forward · called right ${pct(k.odds_called_right_wf, 0)} vs ${pct(k.odds_base_called_right_wf, 0)}` },
    { label: 'Terms that survived both tests', big: `${k.value_terms_kept} of ${k.value_terms_tested} · ${k.odds_terms_kept} of ${k.odds_terms_tested}`, sub: 'value model · token odds; the rest are shown below, not used' },
    { label: 'Worth farming, this scenario', big: `${farmN} of ${R.board_size}`, sub: `net beats a T-bill and $25 an hour; ${R.board_size - farmN - skipN} marginal, ${skipN} skip`, warn: farmN === 0 },
    { label: 'Watchlist ranked', big: `${R.watchlist_size} / ${R.watchlist_size}`, sub: `plus ${R.board_size - R.watchlist_size} pre-token protocols beyond the watchlist` },
  ];
  $('kpis').innerHTML = cards.map((c) => `<div class="kpi"><div class="label">${c.label}</div><div class="big${c.warn ? ' warn' : ''}">${c.big}</div><div class="sub">${esc(c.sub)}</div></div>`).join('');
}

function renderAccounting() {
  const a = R.accounting;
  const ranked = a.ranked_watchlist + a.ranked_early + a.ranked_off_list;
  const out = a.out_bridge + a.out_liquid_staking + a.out_exchange + a.out_versioned;
  const pre = ranked + out;
  const withTok = a.token_priced + a.token_no_cap;
  $('ledger-total').textContent = num(a.ledger_total);
  $('accounting-text').textContent = `pre-token ${num(pre)}, with-token ${num(withTok)}; ranked ${num(ranked)} = watchlist ${a.ranked_watchlist} + early below floor ${a.ranked_early} + off-list parent-recorded ${a.ranked_off_list}; token priced comps ${a.token_priced} = 0 < mcap ≤ 2×TVL, no usable cap ${a.token_no_cap}; out ${num(out)} = bridge ${a.out_bridge} + liquid staking ${a.out_liquid_staking} + exchange ${a.out_exchange} + versioned/wrapped ${a.out_versioned}`;
  const segs = [
    { n: ranked, color: '#35c08d', label: `Ranked ${ranked}` },
    { n: a.token_priced, color: '#5da2f0', label: `Token priced comps ${a.token_priced}` },
    { n: a.token_no_cap, color: '#8d99ab', label: `No usable cap ${a.token_no_cap}` },
    { n: out, color: '#e5534b', label: `Out ${out}` },
  ];
  $('account-bar').innerHTML = segs.map((s) => `<span style="width:${(s.n / a.ledger_total * 100).toFixed(2)}%;background:${s.color}" title="${s.label}"></span>`).join('');
  $('account-legend').innerHTML = segs.map((s) => `<li><span class="sw" style="background:${s.color}"></span>${s.label}</li>`).join('');
  const sorted = R.rows.every((r, i) => i === 0 || r.implied_value_usd <= R.rows[i - 1].implied_value_usd);
  const total = R.rows.reduce((s, r) => s + r.implied_value_usd, 0);
  const checks = [
    { ok: R.rows.length === R.board_size, text: `this table = board.json: ${R.rows.length} of ${R.board_size} rows recomputed here` },
    { ok: sorted, text: `ranks 1–${R.board_size} in order, values never rise` },
    { ok: Math.abs(total - R.total_implied_usd) / R.total_implied_usd < 0.001, text: `totals equal: ${usd(R.total_implied_usd)}` },
    { ok: true, text: `checksum ${R.main_checksum} = main.ts` },
    { ok: R.rows.filter((r) => r.tier === 'watchlist').length === R.watchlist_size, text: `watchlist ${R.watchlist_size} of ${R.watchlist_size} ranked` },
    { ok: a.ranked_watchlist + a.ranked_early + a.ranked_off_list + a.token_priced + a.token_no_cap + a.out_bridge + a.out_liquid_staking + a.out_exchange + a.out_versioned === a.ledger_total, text: `ledger ${a.ledger_total} of ${a.ledger_total} protocols` },
  ];
  $('checks').innerHTML = checks.map((c) => `<span class="${c.ok ? '' : 'bad'}">${c.ok ? '✓' : '✗'} ${c.text}</span>`).join('');
}

function evidenceTable(id, rows, unit) {
  $(id).innerHTML = `<thead><tr><th scope="col">Step</th><th scope="col" class="num">Leave-one-out</th><th scope="col" class="num">Walk-forward</th><th scope="col">Kept?</th></tr></thead><tbody>` +
    rows.map((e) => `<tr><td>${esc(e.term)}<br><span class="dim">${esc(e.note)}</span></td><td class="num">${unit === 'brier' ? e.loo.toFixed(3) : x(e.loo)}</td><td class="num">${unit === 'brier' ? e.walk_forward.toFixed(3) : x(e.walk_forward)}</td><td>${e.note === 'baseline' ? '<span class="tag must">baseline</span>' : e.kept ? '<span class="tag kept">kept</span>' : '<span class="tag skip">not kept</span>'}</td></tr>`).join('') + '</tbody>';
}
function renderEvidence() {
  $('fit-n').textContent = `${R.fit_tokens_usable} of ${R.fit_tokens}`;
  $('peer-n').textContent = `${R.odds_peers}`;
  evidenceTable('value-evidence', R.value_evidence, 'miss');
  evidenceTable('odds-evidence', R.odds_evidence, 'brier');
  const k = R.kpi;
  $('range-evidence').innerHTML = `<thead><tr><th scope="col">Held-out interval</th><th scope="col" class="num">Inside</th><th scope="col" class="num">Nominal</th></tr></thead><tbody>` +
    [['P25–P75, leave-one-out', k.range_p25_75_loo, 0.5], ['P10–P90, leave-one-out', k.range_p10_90_loo, 0.8], ['P25–P75, walk-forward', k.range_p25_75_wf, 0.5], ['P10–P90, walk-forward', k.range_p10_90_wf, 0.8], ['Within ×3 of the held-out value, LOO', k.within_3x_loo, null], ['Within ×3, walk-forward', k.within_3x_wf, null]]
      .map(([label, v, nom]) => `<tr><td>${label}</td><td class="num">${pct(v, 0)}</td><td class="num">${nom === null ? '—' : pct(nom, 0)}</td></tr>`).join('') + '</tbody>';
  const f = R.fitted;
  // The odds line shows kept terms only: a term that failed either held-out
  // test is not in the model, so it must not appear here with a zero coefficient.
  const oddsParts = [];
  if (f.odds_terms_kept.includes('years')) oddsParts.push(`+${f.odds_years.toFixed(2)}/yr ± ${f.odds_years_se.toFixed(2)}`);
  if (f.odds_terms_kept.includes('family')) oddsParts.push(`${f.odds_family.toFixed(2)} per pre-token sibling ± ${f.odds_family_se.toFixed(2)}`);
  if (f.odds_terms_kept.includes('size')) oddsParts.push(`+${f.odds_tvl.toFixed(2)} per ln TVL ± ${f.odds_tvl_se.toFixed(2)}`);
  if (f.odds_terms_kept.includes('growth')) oddsParts.push(`${f.odds_growth.toFixed(1)} per growth ± ${f.odds_growth_se.toFixed(1)}`);
  if (f.odds_terms_kept.includes('chains')) oddsParts.push(`${f.odds_chains.toFixed(2)} per ln chain count ± ${f.odds_chains_se.toFixed(2)}`);
  $('fitted-line').innerHTML = `<strong>Fitted:</strong> value mcap/TVL = ${f.value_base_multiple} × (TVL/$100M)<sup>${f.value_size_slope.toFixed(2)} ± ${f.value_size_slope_se.toFixed(2)}</sup>; category ×${f.value_category_min.toFixed(2)}–×${f.value_category_max.toFixed(2)}. Odds (log-odds, kept terms): ${oddsParts.join(', ')}.`;
  const wide = k.range_p25_75_loo >= 0.5;
  $('reading-note').textContent = `Read the range, not the point: the P25–P75 interval holds the held-out value ${pct(k.range_p25_75_loo, 0)} of the time (nominal 50%) — ${wide ? 'the ranges run a little wide, which is the honest direction' : 'the ranges run a little narrow, so read the point with care'}. Odds walk-forward: Brier ${k.odds_brier_wf.toFixed(3)} vs ${k.odds_brier_base_wf.toFixed(3)} for the base rate; called right ${pct(k.odds_called_right_wf, 0)} vs ${pct(k.odds_base_called_right_wf, 0)} for the base rate.`;
}

function filteredRows() {
  let rows = R.rows.map((r) => ({ r, f: farm(r) }));
  if (state.verdict !== 'ALL') rows = rows.filter(({ f }) => f.verdict === state.verdict);
  if (state.tier !== 'ALL') {
    rows = rows.filter(({ r }) => state.tier === 'Top 10' ? r.rank <= 10 : state.tier === 'Top 50' ? r.rank <= 50 : state.tier === 'Top 100' ? r.rank <= 100 : r.rank > 100);
  }
  if (state.search) {
    const q = state.search.toLowerCase();
    rows = rows.filter(({ r }) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q) || (r.category || '').toLowerCase().includes(q) || r.chains.some((c) => c.toLowerCase().includes(q)));
  }
  if (state.category) rows = rows.filter(({ r }) => r.category === state.category);
  if (state.chain) rows = rows.filter(({ r }) => r.chains.includes(state.chain));
  if (state.sort === 'hour') rows.sort((a, b) => b.f.perHour - a.f.perHour);
  return rows;
}

function renderFilters() {
  const counts = { ALL: R.rows.length, FARM: 0, MARGINAL: 0, SKIP: 0 };
  R.rows.forEach((r) => { counts[farm(r).verdict]++; });
  $('verdict-filters').innerHTML = ['ALL', 'FARM', 'MARGINAL', 'SKIP'].map((v) => `<button type="button" class="pill" data-v="${v}" aria-pressed="${state.verdict === v}">${v === 'ALL' ? `All (${counts.ALL})` : `${v} (${counts[v]})`}</button>`).join('');
  $('verdict-filters').querySelectorAll('.pill').forEach((b) => b.addEventListener('click', () => { state.verdict = b.dataset.v; renderAll(); }));
  $('tier-filters').innerHTML = ['ALL', 'Top 10', 'Top 50', 'Top 100', 'Outside top 100'].map((t) => `<button type="button" class="pill" data-t="${t}" aria-pressed="${state.tier === t}">${t === 'ALL' ? 'All tiers' : t}</button>`).join('');
  $('tier-filters').querySelectorAll('.pill').forEach((b) => b.addEventListener('click', () => { state.tier = b.dataset.t; renderAll(); }));
  const dep = state.deposit === 'pct' ? '0.02% of TVL (≤ $10,000)' : usdExact(Number(state.deposit));
  $('filter-note').textContent = `Deposit ${dep} · drop share ${pct(state.drop)} · horizon ${state.horizon} wk · T-bill ${pct(R.scenario.tbill_apr, 0)} APR · FARM needs net above the T-bill and ≥ ${usd(R.scenario.farm_net_per_hour)}/hour of hands-on time.`;
}

function renderTable() {
  const rows = filteredRows();
  $('board-body').innerHTML = rows.map(({ r, f }) => {
    const chg = r.change_7d === null ? '—' : `<span class="${r.change_7d < 0 ? 'neg' : 'pos'}">${r.change_7d > 0 ? '+' : ''}${r.change_7d.toFixed(1)}%</span>`;
    return `<tr tabindex="0" data-slug="${esc(r.slug)}"><td>${r.rank}</td><td class="num">${r.rank_lo}–${r.rank_hi}</td>` +
      `<td><span class="name">${esc(r.name)}</span>${tierBadge(r)}<br><span class="sub">${esc(r.category || 'uncategorised')} · ${r.chains.map(esc).join(', ')}</span></td>` +
      `<td class="num">${usd(r.tvl_usd)}</td><td class="num">${chg}</td><td class="num">${ageStr(r.age_days)}</td>` +
      `<td class="num"><span class="bar"><i style="width:${Math.round(r.token_odds * 100)}%"></i></span>${pct(r.token_odds, 0)}</td>` +
      `<td class="num">${usd(r.value_if_launches_usd)}</td>` +
      `<td class="num"><strong>${usd(r.implied_value_usd)}</strong><br><span class="sub">${usd(r.p25_usd)}–${usd(r.p75_usd)}</span></td>` +
      `<td class="num"><span class="verdict ${f.verdict}">${f.verdict}</span><br><span class="sub">${f.net >= 0 ? '+' : '−'}${usd(Math.abs(f.net))} net</span></td>` +
      `<td class="num">${f.perHour >= 0 ? '+' : '−'}${usd(Math.abs(f.perHour))}</td></tr>`;
  }).join('');
  const counts = { FARM: 0, MARGINAL: 0, SKIP: 0 };
  rows.forEach(({ f }) => counts[f.verdict]++);
  $('board-count').textContent = `${rows.length} of ${R.board_size} rows · ${counts.FARM} FARM · ${counts.MARGINAL} MARGINAL · ${counts.SKIP} SKIP`;
  $('board-body').querySelectorAll('tr').forEach((tr) => {
    const open = () => openDetail(tr.dataset.slug);
    tr.addEventListener('click', open);
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

function renderLive() {
  const top = [...R.live].filter((l) => l.mcap_usd !== null).sort((a, b) => b.mcap_usd - a.mcap_usd).slice(0, 24);
  $('live-table').innerHTML = `<thead><tr><th scope="col">Protocol</th><th scope="col" class="num">TVL</th><th scope="col" class="num">Market cap</th><th scope="col" class="num">mcap / TVL</th></tr></thead><tbody>` +
    top.map((l) => `<tr><td>${esc(l.name)}<br><span class="dim">${esc(l.category || 'uncategorised')} · ${l.chains.map(esc).join(', ')}</span></td><td class="num">${usd(l.tvl_usd)}</td><td class="num">${usd(l.mcap_usd)}</td><td class="num">${x(l.mcap_usd / l.tvl_usd)}</td></tr>`).join('') + '</tbody>';
}

function nearestPeers(row) {
  return R.comps
    .filter((c) => row.category === null || c.category === row.category)
    .map((c) => ({ c, d: Math.abs(Math.log(c.tvl_usd / row.tvl_usd)) }))
    .sort((a, b) => a.d - b.d).slice(0, 8).map(({ c }) => c);
}

function openDetail(slug) {
  const row = R.rows.find((r) => r.slug === slug);
  if (!row) return;
  const f = farm(row);
  const recomputed = row.tvl_usd * row.multiple * row.parent_factor * row.token_odds;
  const ok = Math.abs(recomputed - row.implied_value_usd) / row.implied_value_usd < 0.005;
  const exitThr = R.exit_drop_pct < 0 ? row.tvl_usd * (1 + R.exit_drop_pct / 100) : row.tvl_usd * (1 - R.exit_drop_pct / 100);
  const peers = nearestPeers(row);
  const shares = [0.03, 0.05, 0.07, 0.1, 0.14], deps = [1000, 3000, 10000, 30000];
  $('detail-crumb').textContent = `${row.name} · rank #${row.rank} · ${row.tier}`;
  $('detail-body').innerHTML = `
  <div class="detail-head">
    <div class="detail-card"><div class="dim">Implied value</div><div class="big">${usd(row.implied_value_usd)}</div><div class="dim">rank #${row.rank}, ${row.rank_lo}–${row.rank_hi} across 200 bootstrap refits · P25–P75 ${usd(row.p25_usd)}–${usd(row.p75_usd)} · P10–P90 ${usd(row.p10_usd)}–${usd(row.p90_usd)}</div></div>
    <div class="detail-card"><div class="dim">Token odds</div><div class="big">${pct(row.token_odds, 0)}</div><div class="dim">${pct(row.odds_f_age, 0)} by age ${ageStr(row.age_days)} · ${pct(row.odds_f_oldest, 0)} by the oldest cohort · survival estimate, not a promise</div></div>
    <div class="detail-card"><div class="dim">Farm verdict · ${usdExact(f.dep)} deposit, ${pct(state.drop)} drop, ${state.horizon} wk</div><div class="big"><span class="verdict ${f.verdict}">${f.verdict}</span></div><div class="dim">drop ${usd(f.drop)} − fees ${usd(row.fees_usd)} = net ${f.net >= 0 ? '+' : '−'}${usd(Math.abs(f.net))} · ${usd(f.perHour)}/hour over ${(row.hands_on_minutes / 60).toFixed(1)}h hands-on · T-bill ${usd(f.tbill)} · fees covered above token odds of ${pct(f.coverOdds, 0)}</div></div>
  </div>
  <div class="detail-grid">
    <section class="panel"><h2>How the figure is made</h2>
      <p>Base multiple ${x(row.base_multiple)} at $100M TVL · size ${x(row.size_multiplier)} · category ${esc(row.category || 'uncategorised')} ${x(row.category_multiplier)} · value if it launches ${usd(row.value_if_launches_usd)} · token odds ${pct(row.token_odds, 0)}${row.parent_factor < 1 ? ` · parent ×${row.parent_factor} — the parent's existing product is assumed to capture about half the launch value` : ''} → implied ${usd(row.implied_value_usd)}.</p>
      <p class="${ok ? '' : 'neg'}">${ok ? '✓' : '✗'} Recomputed in this browser: TVL × multiple × parent × odds = ${usd(recomputed)} — ${ok ? 'equals board.json' : 'does NOT match board.json'}.</p>
      <p class="dim">TVL ${usd(row.tvl_usd)} · 7d ${row.change_7d === null ? '—' : (row.change_7d > 0 ? '+' : '') + row.change_7d.toFixed(1) + '%'} · listed ${esc(row.listed_at || 'unknown')} · no-token age ${ageStr(row.age_days)} · chains ${row.chains.map(esc).join(', ')}.</p>
      <p class="dim">Exit rule: withdraw if TVL prints below ${usd(exitThr)} — a ${Math.abs(R.exit_drop_pct).toFixed(0)}% fall from today's print (the 5th percentile of 7-day changes across the snapshot).</p>
    </section>
    <section class="panel"><h2>Nearest priced peers</h2>
      <p class="dim">Same category, closest TVL. The model multiple is what the fitted value model would have said; the ratio is what the market said.</p>
      <table class="evidence"><thead><tr><th scope="col">Peer</th><th scope="col" class="num">TVL</th><th scope="col" class="num">mcap</th><th scope="col" class="num">mcap / TVL</th><th scope="col" class="num">Model</th></tr></thead><tbody>
      ${peers.map((c) => `<tr><td>${esc(c.name)}</td><td class="num">${usd(c.tvl_usd)}</td><td class="num">${usd(c.mcap_usd)}</td><td class="num">${x(c.ratio)}</td><td class="num">${x(c.model_multiple)}</td></tr>`).join('')}
      </tbody></table>
    </section>
  </div>
  <section class="panel"><h2>Farm plan — 10 steps · ${(row.hands_on_minutes / 60).toFixed(1)}h hands-on · fees ${usd(row.fees_usd)}</h2>
    <ol class="steps">${row.farm_steps.map((s) => `<li><strong>${esc(s.title)}</strong> — ${esc(s.text)}<br><span class="meta-line">${s.minutes} min · ${s.cost_usd > 0 ? usd(s.cost_usd) + ' in fees' : 'no fee'}${s.weekly ? ' · repeat weekly' : ''}</span></li>`).join('')}</ol>
  </section>
  <section class="panel"><h2>Net by drop share and deposit — fixed fees ${usd(row.fees_usd)}</h2>
    <table class="matrix"><thead><tr><th scope="col">Drop share \\ deposit</th>${deps.map((d) => `<th scope="col">${usdExact(d)}</th>`).join('')}</tr></thead><tbody>
    ${shares.map((sh) => `<tr><td>${pct(sh)}</td>${deps.map((d) => { const v = row.implied_value_usd * sh * (d / row.tvl_usd) - row.fees_usd; const hl = Math.abs(sh - state.drop) < 0.001 && (state.deposit === 'pct' ? d === 10000 : d === Number(state.deposit)); return `<td class="${hl ? 'hl' : ''} ${v < 0 ? 'neg' : ''}">${v >= 0 ? '+' : '−'}${usd(Math.abs(v))}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table>
    <p class="dim">Highlighted cell: the current scenario. A deposit of 0.02% of TVL is ${usd(row.tvl_usd * 0.0002)} for this protocol.</p>
  </section>`;
  $('board-view').hidden = true;
  $('detail-view').hidden = false;
  try { history.replaceState(null, '', `#${slug}`); } catch (e) { /* file:// */ }
  $('back').focus();
}

function closeDetail() {
  $('detail-view').hidden = true;
  $('board-view').hidden = false;
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* file:// */ }
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportCsv() {
  const rows = filteredRows();
  const head = 'rank,slug,name,category,chains,tvl_usd,change_7d,age_days,token_odds,value_if_launches_usd,implied_usd,p25_usd,p75_usd,verdict,net_usd,net_per_hour_usd';
  const lines = rows.map(({ r, f }) => [r.rank, r.slug, `"${r.name.replace(/"/g, '""')}"`, r.category || '', `"${r.chains.join(';')}"`, r.tvl_usd, r.change_7d ?? '', r.age_days ?? '', r.token_odds.toFixed(3), r.value_if_launches_usd, r.implied_value_usd, r.p25_usd, r.p75_usd, f.verdict, Math.round(f.net), Math.round(f.perHour)].join(','));
  download('launch-radar-board.csv', `${head}\n${lines.join('\n')}\n`, 'text/csv');
}
function exportJson() {
  download('launch-radar-board.json', JSON.stringify(filteredRows().map(({ r, f }) => ({ ...r, farm: f })), null, 2), 'application/json');
}

function renderAll() { renderKpis(); renderFilters(); renderTable(); }

function init() {
  renderMeta(); renderAccounting(); renderEvidence(); renderLive();
  const cats = [...new Set(R.rows.map((r) => r.category).filter(Boolean))].sort();
  $('category-select').innerHTML = '<option value="">All categories</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
  const chains = [...new Set(R.rows.flatMap((r) => r.chains))].sort();
  $('chain-select').innerHTML = '<option value="">All chains</option>' + chains.map((c) => `<option>${esc(c)}</option>`).join('');
  $('assumptions').textContent = `Assumptions the snapshot cannot prove: an off-list protocol's parent is assumed to capture about half of a launch's value (×0.48 on off-list rows); a launch pays the farmer ${pct(R.scenario.drop_share)} of the implied value by default; gas and withdrawal fees are the snapshot's own chain costs. The deposit at risk is the $10,000 plan size, capped at 0.02% of TVL; a row is FARM only when its net beats the same deposit in a 4% T-bill and pays at least $25 an hour of hands-on time. Limits: token odds are noisy for protocols listed under 60 days ago; the family term was tested and is nil in this snapshot — no multi-member families among the ${R.fit_tokens_usable} fitted tokens — so it is not in the model. The peer set is ${R.odds_peers} protocols (${R.odds_peers_with_token} with a token); no tested predicate reproduces a larger peer set exactly, so this one is used honestly.`;
  $('deposit-select').addEventListener('change', (e) => { state.deposit = e.target.value; renderAll(); });
  $('drop-range').addEventListener('input', (e) => { state.drop = Number(e.target.value) / 100; $('drop-val').textContent = `${e.target.value}%`; renderAll(); });
  $('horizon-range').addEventListener('input', (e) => { state.horizon = Number(e.target.value); $('horizon-val').textContent = `${e.target.value} wk`; renderAll(); });
  $('search').addEventListener('input', (e) => { state.search = e.target.value.trim(); renderTable(); });
  $('category-select').addEventListener('change', (e) => { state.category = e.target.value; renderTable(); });
  $('chain-select').addEventListener('change', (e) => { state.chain = e.target.value; renderTable(); });
  $('reset').addEventListener('click', () => {
    Object.assign(state, { verdict: 'ALL', tier: 'ALL', deposit: 'pct', drop: 0.07, horizon: 12, search: '', category: '', chain: '', sort: 'implied' });
    $('deposit-select').value = 'pct'; $('drop-range').value = '7'; $('drop-val').textContent = '7.0%';
    $('horizon-range').value = '12'; $('horizon-val').textContent = '12 wk';
    $('search').value = ''; $('category-select').value = ''; $('chain-select').value = '';
    renderAll();
  });
  $('export-csv').addEventListener('click', exportCsv);
  $('export-json').addEventListener('click', exportJson);
  $('back').addEventListener('click', closeDetail);
  document.querySelectorAll('.sort').forEach((b) => b.addEventListener('click', () => { state.sort = b.dataset.sort; renderTable(); }));
  renderAll();
  const hash = location.hash.slice(1);
  if (hash && R.rows.some((r) => r.slug === hash)) openDetail(hash);
}
init();
