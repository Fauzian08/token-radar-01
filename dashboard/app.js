// Token Radar's dashboard (radar-2). It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, the filters, the top picks, a per-protocol detail
// view with the model's own inputs, and the methodology. No network: every byte it shows
// is in data.js. State lives in the URL hash, so a view is a link: #p=<slug> opens a
// protocol, #category=<name> filters to it.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tvl: 'all', band: 'all', watch: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function bandClass(band) {
    if (band === 'Strong watch') return 'strong';
    if (band === 'Watch') return 'watch';
    if (band === 'Early') return 'early';
    return 'long';
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('band')) state.band = params.get('band');
    if (params.get('tvl')) state.tvl = params.get('tvl');
    if (params.get('watch') === '1') state.watch = true;
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('sort')) state.sort = params.get('sort');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.band !== 'all') params.set('band', state.band);
    if (state.tvl !== 'all') params.set('tvl', state.tvl);
    if (state.watch) params.set('watch', '1');
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function inTvlBand(r) {
    if (state.tvl === 'all') return true;
    if (state.tvl === 'b1') return r.tvl_usd >= 1e9;
    if (state.tvl === 'b100') return r.tvl_usd >= 1e8 && r.tvl_usd < 1e9;
    if (state.tvl === 'b50') return r.tvl_usd >= 5e7 && r.tvl_usd < 1e8;
    return r.tvl_usd < 5e7;
  }
  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (state.band !== 'all' && r.likelihood_band !== state.band) return false;
      if (state.watch && !r.watchlist) return false;
      if (!inTvlBand(r)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'likelihood') { av = a.likelihood_score; bv = b.likelihood_score; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    var below = DATA.board_size - DATA.watchlist_size;
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL that records no token and is not a wrapped, staked or bridged product. The radar adds ' + below + ' more pre-token protocols that pass the same rule, below the floor and above it. Implied value is a model, not a promise — and "records no token" is not proof a token does not exist.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Top implied value' }), el('b', { text: fmtUsd(DATA.rows[0] ? DATA.rows[0].implied_value_usd : 0) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  // One line of evidence per top pick, built from its own figures: no name is hand-picked.
  function reasonFor(r) {
    var bits = [];
    bits.push(fmtUsd(r.tvl_usd) + ' TVL');
    bits.push(fmtPct(r.change_7d) + ' 7d');
    bits.push((r.chains || []).length + (r.chains && r.chains.length === 1 ? ' chain' : ' chains'));
    bits.push(fmtAge(r.age_days) + ' with no token');
    return bits.join(' · ');
  }

  function picks() {
    var top = DATA.rows.slice(0, 10);
    return el('section', { class: 'picks' },
      el('h2', { text: 'Top 10 to watch' }),
      el('p', { class: 'sub', text: 'The strongest implied values on the board. Select one for its model breakdown and farm plan.' }),
      el('div', { class: 'pick-grid' }, top.map(function (r) {
        return el('button', { type: 'button', class: 'pick', onclick: function () { openDetail(r.slug); } },
          el('span', { class: 'rank', text: '#' + r.rank }),
          el('b', { text: r.name }),
          el('span', { class: 'val num', text: fmtUsd(r.implied_value_usd) }),
          el('span', { class: 'why', text: reasonFor(r) })
        );
      }))
    );
  }

  function selectField(id, label, options, value, onChange) {
    var select = el('select', { id: id, 'aria-label': label },
      options.map(function (o) { return el('option', { value: o[0], text: o[1], selected: o[0] === value ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { onChange(select.value); writeHash(); render(); });
    return el('div', { class: 'field' }, el('label', { for: id, text: label }), select);
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    var watch = el('label', { class: 'check' },
      el('input', { type: 'checkbox', checked: state.watch ? 'checked' : null, onchange: function (e) { state.watch = e.target.checked; writeHash(); render(); } }),
      'Watchlist only'
    );
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      selectField('category', 'Category', [['all', 'All categories']].concat(categories.map(function (c) { return [c, c]; })), state.category, function (v) { state.category = v; }),
      selectField('chain', 'Chain', [['all', 'All chains']].concat(chains.map(function (c) { return [c, c]; })), state.chain, function (v) { state.chain = v; }),
      selectField('tvl', 'TVL band', [['all', 'Any TVL'], ['b1', '$1B and up'], ['b100', '$100M – $1B'], ['b50', '$50M – $100M'], ['b0', 'Under $50M']], state.tvl, function (v) { state.tvl = v; }),
      selectField('band', 'Likelihood', [['all', 'Any likelihood'], ['Strong watch', 'Strong watch'], ['Watch', 'Watch'], ['Early', 'Early'], ['Long shot', 'Long shot']], state.band, function (v) { state.band = v; }),
      selectField('sort', 'Sort by', [['implied', 'Implied value'], ['likelihood', 'Likelihood'], ['tvl', 'TVL'], ['growth', '7d growth'], ['age', 'Age'], ['name', 'Name']], state.sort, function (v) { state.sort = v; state.dir = -1; }),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      watch,
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another filter to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.band = 'all'; state.tvl = 'all'; state.watch = false; writeHash(); render(); } })
      ));
    }
    var max = 0;
    list.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', null, r.name, r.watchlist ? el('span', { class: 'badge watch', text: 'WATCHLIST' }) : null),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'chip ' + bandClass(r.likelihood_band), text: r.likelihood_score + ' · ' + r.likelihood_band }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model, its likelihood and its farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            sortHeader('likelihood', 'Likelihood')
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking — and their market-cap/TVL ratios are what price the board.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var multRows = DATA.multiples.slice(0, 12).map(function (x) {
      return el('tr', null,
        el('td', { text: x.category }),
        el('td', { class: 'num', text: String(x.live_n) }),
        el('td', { class: 'num', text: String(x.median_mcap_tvl) }),
        el('td', { class: 'num', text: String(x.multiple) })
      );
    });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'One function scores every protocol from the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x category_multiple x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x (1 + 0.02 x min(chains - 1, 10)) )'
      ),
      el('p', { class: 'sub', text: 'The category multiple is the median market-cap/TVL of the live-token protocols in that category, shrunk toward the global median of ' + m.global_median_mcap_tvl + ' with five pseudo-protocols and clamped to 0.05–1.00. Each live ratio is winsorized to 0.02–2.00 first, so one small protocol whose token trades far above its TVL cannot set a category\u2019s price. A category with no live protocols takes the global median. Age is the time since the protocol was first listed — the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days.' }),
      el('h3', { text: 'Category multiples from the live market' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'mult-table' },
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Live protocols' }), el('th', { scope: 'col', text: 'Median mcap/TVL' }), el('th', { scope: 'col', text: 'Multiple used' }))),
          el('tbody', null, multRows)
        )
      ),
      el('p', { class: 'note sub', text: 'Limits: the snapshot is frozen at ' + DATA.as_of + ' and says nothing about whether or when a token launches; a protocol that records no token may still have one its DefiLlama record does not carry. Farm plans are generic steps from category, chain, TVL and age — check the protocol itself before moving funds.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  // The farm plan is derived in the page from the row's own figures, the same derivation
  // main.ts writes to board.json: category, chains, TVL and age decide the action, the
  // capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Lend $' + capital + ' of USDC on ' + name + ' on ' + chain + ' and leave the supply in place.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Add $' + capital + ' of liquidity to the main pool of ' + name + ' on ' + chain + ' and leave the position in place.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk') >= 0) return 'Place $' + capital + ' into a ' + name + ' vault on ' + chain + ' and hold the vault shares.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis') >= 0) return 'Post $' + capital + ' of USDC as margin on ' + name + ' and open a single small hedged trade.';
    if (c.indexOf('prediction') >= 0) return 'Put $' + capital + ' behind one prediction-market position on ' + name + '.';
    if (c.indexOf('stable') >= 0) return 'Mint or hold $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of the yield-bearing asset ' + name + ' issues on ' + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Take $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy live.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + ' of the chain asset through ' + name + ' and keep the staking receipt.';
    if (c.indexOf('bridge') >= 0) return 'Move $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and put the bridged funds to work in its app.';
    return 'Put $' + capital + ' of USDC to work in ' + name + ' on ' + chain + ' and leave the position in place.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + ' Hold the position and check the protocol\'s own page.';
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    return [
      { text: 'Set aside a fresh wallet for this farm alone, fund it with only what you plan to use, and store its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Do one qualifying action every week, like a deposit, a borrow, a swap or a vote, so the wallet stays visibly active.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Keep the position open for at least ' + hold + ' days, so it is counted in more than one snapshot of activity.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "When you check for a claim, open the protocol's own points or rewards page from its official site and never pay anyone to claim for you.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Keep a farm log with the wallet, the dates and every transaction, so you can repeat the position or unwind it cleanly.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var mult = DATA.multiples.filter(function (x) { return x.category === (row.category || 'Other'); })[0];
    var multNote = mult
      ? 'Median live ' + (row.category || 'Other') + ' mcap/TVL ' + mult.median_mcap_tvl + ' over ' + mult.live_n + ' live protocols, shrunk toward the global median.'
      : 'No live protocols in this category: the global median ' + DATA.model.global_median_mcap_tvl + ' is used.';
    // What the value would be if seven-day growth stalled to zero: the same product with a 1.00 growth multiplier.
    var stalled = Math.max(1, Math.round(row.implied_value_usd / (row.growth_multiplier || 1)));
    var like = row.likelihood;
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? ' · on the watchlist' : '') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Category multiple' }), el('b', { class: 'num', text: String(row.multiple) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Chain breadth multiplier' }), el('b', { class: 'num', text: String(row.breadth_multiplier) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: multNote }),
      el('p', { class: 'sub', text: 'If seven-day growth stalled to zero, the same product would be worth about ' + fmtUsd(stalled) + '. This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Launch likelihood: ' + row.likelihood_score + ' · ' + row.likelihood_band }),
      el('div', { class: 'bars' },
        [['Size (TVL)', like.size], ['Growth (7d)', like.growth], ['Maturity (age)', like.maturity], ['Chain breadth', like.breadth]].map(function (pair) {
          return el('div', { class: 'row' },
            el('span', { text: pair[0] }),
            el('div', { class: 'track' }, el('i', { style: 'width:' + Math.round(pair[1] * 100) + '%' })),
            el('span', { class: 'num', text: String(Math.round(pair[1] * 100)) })
          );
        })
      ),
      el('p', { class: 'sub', text: 'Weights: size 35%, growth 25%, maturity 25%, breadth 15%. A separate signal from implied value: it never reorders the board.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function footer() {
    return el('p', { class: 'foot', text: 'Source: ' + DATA.source + '. Snapshot frozen ' + DATA.as_of + '. Implied values and farm plans are this radar\u2019s own model, computed from the snapshot alone; they are not a prediction that a token launches, or when.' });
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    if (state.tab === 'pre-token') shell.appendChild(picks());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    shell.appendChild(footer());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
