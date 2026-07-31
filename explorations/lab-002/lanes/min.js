// MIN lane — Premium Utilitarian Minimalism (leon-minimalist-skill): warm
// monochrome, editorial serif/sans/mono contrast, hairline dividers instead
// of cards, zero shadows, tight negative tracking on serif display type,
// pill badges reserved for real status, "+/-" accordion glyphs for
// disclosure. All color/type/space/radius values are the real Linejam
// tokens on .screen-root — the skill's own hex/font examples are read as
// *role* guidance (near-black solid CTA, ultra-light-gray hairlines, muted
// pastel status chips) and translated onto whichever token already plays
// that role in each theme, never re-hardcoded.
//
// Three structurally distinct bets on where the hero/chrome/roster mass
// goes:
//   MIN-1  Ledger    — room code stays a dominant editorial masthead;
//                      roster reads as hairline-ruled name/badge rows;
//                      secondary controls fold behind one "+" accordion
//                      trigger, collapsed by default.
//   MIN-2  Index      — hero merges into the chrome headline (one line, no
//                      separate hero block); roster is a numbered
//                      contents-page list; CTA is one flat full-width bar.
//   MIN-3  Flatline    — chrome compresses to a single micro status line;
//                      the roster is a wrapped run of underline-tag names
//                      (the single largest mass on screen); secondary
//                      controls reduce to bare monospace metadata tokens.
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  function esc(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  function roleWord(p) {
    if (p.host) return 'Host';
    if (p.isBot) return 'AI';
    if (p.isAway) return 'Away';
    return '';
  }

  function statusCopy(players) {
    const needsMore = Math.max(0, 2 - players.length);
    return {
      needsMore,
      canStart: players.length >= 2,
      title:
        needsMore > 0
          ? `Need ${needsMore} more player${needsMore === 1 ? '' : 's'}`
          : `${players.length} players ready`,
    };
  }

  // Status badge: color is a scarce resource — solid primary fill marks the
  // one truly semantic role (Host); everything else is a muted neutral
  // pill. Never a rainbow per-player palette.
  function badge(prefix, p) {
    const role = roleWord(p);
    if (!role) return '';
    const cls = p.host ? `${prefix}-badge-host` : `${prefix}-badge-muted`;
    return `<span class="${prefix}-badge ${cls}">${esc(role)}</span>`;
  }

  // =========================================================================
  // MIN-1 — Ledger
  // =========================================================================
  (function () {
    const P = 'm1';

    function chrome(kicker) {
      return `
        <header class="${P}-chrome">
          <div class="${P}-chrome-row">
            <p class="${P}-kicker">${esc(kicker)}</p>
            <button class="${P}-fold" type="button" aria-label="More options">More <span aria-hidden="true">+</span></button>
          </div>
        </header>`;
    }

    function hero(code) {
      return `
        <div class="${P}-hero">
          <p class="${P}-hero-label">Room</p>
          <p class="${P}-hero-code">${esc(code)}</p>
        </div>`;
    }

    function playerRow(p) {
      return `
        <li class="${P}-row">
          <span class="${P}-row-name">${esc(p.name)}</span>
          ${badge(P, p)}
        </li>`;
    }

    function foldStrip(players, isHost) {
      const bots = players.filter((p) => p.isBot).length;
      return `
        <div class="${P}-strip">
          <a class="${P}-strip-link" href="#">Invite link</a>
          <a class="${P}-strip-link" href="#">QR code</a>
          ${
            isHost
              ? `<a class="${P}-strip-link" href="#">Add a bot (${bots}/3)</a>
                 <a class="${P}-strip-link" href="#">Present room</a>`
              : ''
          }
        </div>`;
    }

    function lobby(sizeKey) {
      return function (el, corpus) {
        const players = corpus.players[sizeKey];
        const s = statusCopy(players);
        const isHost = true;
        el.innerHTML = `
          <div class="${P}-root">
            ${chrome(s.title)}
            <div class="${P}-scroll">
              ${hero(corpus.roomCodeFormatted)}
              <p class="${P}-sub">Share the code to start.</p>
              <ul class="${P}-roster">
                ${players.map(playerRow).join('')}
              </ul>
              ${foldStrip(players, isHost)}
            </div>
            <div class="${P}-action">
              ${
                isHost
                  ? `<button class="${P}-cta" ${s.canStart ? '' : 'disabled'} type="button">${s.canStart ? 'Start Linejam' : s.title}</button>
                     <a class="${P}-link" href="#">Close room</a>`
                  : `<button class="${P}-cta ${P}-cta-wait" disabled type="button">Waiting for host</button>
                     <a class="${P}-link" href="#">Leave room</a>`
              }
            </div>
          </div>`;
      };
    }

    function write(el, corpus) {
      const w = corpus.writing;
      el.innerHTML = `
        <div class="${P}-root">
          ${chrome(`Round ${w.round} of ${w.totalRounds}`)}
          <div class="${P}-scroll">
            <p class="${P}-sub">${esc(w.targetWordCount)}-word line · received</p>
            <p class="${P}-received">${esc(w.previousLineText)}</p>
            <div class="${P}-chips">
              ${w.currentWords.map((word) => `<span class="${P}-chip">${esc(word)}</span>`).join('')}
              ${Array.from({ length: w.targetWordCount - w.currentWords.length })
                .map(() => `<span class="${P}-chip ${P}-chip-empty"></span>`)
                .join('')}
            </div>
          </div>
          <div class="${P}-action">
            <button class="${P}-cta" type="button">Submit</button>
          </div>
        </div>`;
    }

    function recap(el, corpus) {
      const fav = corpus.recapPoems.find((p) => p.isFavorite)
      el.innerHTML = `
        <div class="${P}-root">
          ${chrome('Session complete')}
          <div class="${P}-scroll">
            <p class="${P}-sub">${corpus.recapPoems.length} poems · every line, ${corpus.recapPoems.length} poets.</p>
            <div class="${P}-fav">
              <p class="${P}-fav-label">Room favorite · ${corpus.favoriteLeaderCount} hearts</p>
              <p class="${P}-fav-line">&ldquo;${esc(fav.preview)}&rdquo;</p>
              <p class="${P}-fav-reader">${esc(fav.reader)}</p>
            </div>
            <ul class="${P}-poems">
              ${corpus.recapPoems
                .map(
                  (p, i) => `
                <li class="${P}-poem">
                  <span class="${P}-poem-num">${String(i + 1).padStart(2, '0')}</span>
                  <span class="${P}-poem-preview">${esc(p.preview)}</span>
                  <span class="${P}-poem-reader">${esc(p.reader)}</span>
                </li>`
                )
                .join('')}
            </ul>
          </div>
          <div class="${P}-action ${P}-action-recap">
            <button class="${P}-cta" type="button">Start Next Round</button>
            <a class="${P}-link" href="#">Back to Lobby</a>
          </div>
        </div>`;
    }

    window.LANE_SPECS['MIN-1'] = {
      lane: 'min',
      title: 'Ledger',
      move: 'Room code stays a plain editorial masthead; roster reads as hairline-ruled name/badge rows; every secondary control (invite, QR, bots, present) folds behind one "+" accordion trigger, collapsed by default, so the roster is the only dense element on screen.',
      css: `
        .opt-MIN-1 { color: var(--color-text-primary); background: var(--color-background); font-family: var(--font-sans); }
        .opt-MIN-1 .${P}-root { width: 100%; height: 100%; display: flex; flex-direction: column; }
        .opt-MIN-1 .${P}-chrome { flex: none; padding: var(--space-2) var(--space-3) var(--space-1); }
        .opt-MIN-1 .${P}-chrome-row { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
        .opt-MIN-1 .${P}-kicker { margin: 0; font: 600 var(--text-xs)/var(--leading-tight) var(--font-sans); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--color-text-secondary); }
        .opt-MIN-1 .${P}-fold { flex: none; display: flex; align-items: center; gap: 4px; border: none; background: none; padding: 0; font: 600 var(--text-xs)/1 var(--font-sans); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--color-text-secondary); cursor: pointer; }
        .opt-MIN-1 .${P}-fold span { font: 600 var(--text-sm)/1 var(--font-mono); }
        .opt-MIN-1 .${P}-scroll { flex: 1 1 auto; min-height: 0; padding: 0 var(--space-3); display: flex; flex-direction: column; }
        .opt-MIN-1 .${P}-hero { flex: none; padding: var(--space-1) 0 var(--space-2); border-bottom: 1px solid var(--color-border); }
        .opt-MIN-1 .${P}-hero-label { margin: 0 0 2px; font: 500 var(--text-xs)/1 var(--font-sans); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: var(--tracking-wider); }
        .opt-MIN-1 .${P}-hero-code { margin: 0; font: 400 var(--text-3xl)/var(--leading-tight) var(--font-display); letter-spacing: var(--tracking-tighter); color: var(--color-text-primary); }
        .opt-MIN-1 .${P}-sub { flex: none; margin: var(--space-2) 0 var(--space-1); font: 400 var(--text-sm)/var(--leading-normal) var(--font-sans); color: var(--color-text-secondary); }
        .opt-MIN-1 .${P}-roster { flex: none; list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--color-border); }
        .opt-MIN-1 .${P}-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid var(--color-border-subtle); gap: var(--space-2); }
        .opt-MIN-1 .${P}-row-name { font: 400 var(--text-base)/var(--leading-tight) var(--font-sans); color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .opt-MIN-1 .${P}-badge { flex: none; font: 600 var(--text-xs)/1 var(--font-sans); text-transform: uppercase; letter-spacing: var(--tracking-wide); padding: 2px 8px; border-radius: var(--radius-full); }
        .opt-MIN-1 .${P}-badge-host { background: var(--color-primary); color: var(--color-text-inverse); }
        .opt-MIN-1 .${P}-badge-muted { background: var(--color-muted); color: var(--color-text-secondary); }
        .opt-MIN-1 .${P}-strip { flex: none; padding: var(--space-2) 0; display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: baseline; }
        .opt-MIN-1 .${P}-strip-link { font: 400 var(--text-xs)/1 var(--font-sans); color: var(--color-text-secondary); text-decoration: underline; text-underline-offset: 2px; }
        .opt-MIN-1 .${P}-action { flex: none; padding: var(--space-2) var(--space-3) var(--space-3); border-top: 1px solid var(--color-border); display: flex; flex-direction: column; gap: var(--space-1); }
        .opt-MIN-1 .${P}-action-recap { flex-direction: row; align-items: center; justify-content: space-between; gap: var(--space-3); }
        .opt-MIN-1 .${P}-cta { width: 100%; min-height: 44px; border: none; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-text-inverse); font: 600 var(--text-base)/1 var(--font-sans); cursor: pointer; }
        .opt-MIN-1 .${P}-cta:disabled { background: var(--color-muted); color: var(--color-text-muted); }
        .opt-MIN-1 .${P}-action-recap .${P}-cta { width: auto; flex: 1 1 auto; padding: 0 var(--space-3); }
        .opt-MIN-1 .${P}-link { text-align: center; font: 500 var(--text-sm)/1 var(--font-sans); color: var(--color-text-secondary); text-decoration: underline; text-underline-offset: 2px; padding: 6px 0; }
        .opt-MIN-1 .${P}-action-recap .${P}-link { flex: none; padding: 0; }
        .opt-MIN-1 .${P}-received { margin: 0 0 var(--space-2); font: 400 var(--text-xl)/var(--leading-tight) var(--font-display); letter-spacing: var(--tracking-tight); color: var(--color-text-primary); }
        .opt-MIN-1 .${P}-chips { flex: none; display: flex; flex-wrap: wrap; gap: 8px; padding-top: var(--space-1); border-top: 1px solid var(--color-border); }
        .opt-MIN-1 .${P}-chip { display: inline-block; padding: 6px 2px; border-bottom: 2px solid var(--color-primary); font: 500 var(--text-lg)/1 var(--font-sans); color: var(--color-text-primary); min-width: 28px; text-align: center; }
        .opt-MIN-1 .${P}-chip-empty { min-width: 40px; border-bottom-color: var(--color-border); }
        .opt-MIN-1 .${P}-fav { flex: none; padding: var(--space-2) 0; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); margin-bottom: var(--space-1); }
        .opt-MIN-1 .${P}-fav-label { margin: 0 0 4px; font: 600 var(--text-xs)/1 var(--font-sans); color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: var(--tracking-wide); }
        .opt-MIN-1 .${P}-fav-line { margin: 0; font: 400 var(--text-md)/var(--leading-tight) var(--font-display); letter-spacing: var(--tracking-tight); color: var(--color-text-primary); }
        .opt-MIN-1 .${P}-fav-reader { margin: 4px 0 0; font: 400 var(--text-xs)/1 var(--font-sans); color: var(--color-text-muted); }
        .opt-MIN-1 .${P}-poems { flex: 1 1 auto; min-height: 0; list-style: none; margin: 0; padding: 0; overflow: hidden; }
        .opt-MIN-1 .${P}-poem { display: flex; align-items: baseline; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--color-border-subtle); }
        .opt-MIN-1 .${P}-poem-num { flex: none; font: 500 var(--text-xs)/1 var(--font-mono); color: var(--color-text-muted); }
        .opt-MIN-1 .${P}-poem-preview { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 400 var(--text-sm)/var(--leading-tight) var(--font-sans); color: var(--color-text-primary); }
        .opt-MIN-1 .${P}-poem-reader { flex: none; font: 400 var(--text-xs)/1 var(--font-sans); color: var(--color-text-muted); }
      `,
      screens: {
        'lobby-low': lobby('low'),
        'lobby-mid': lobby('mid'),
        'lobby-max': lobby('max'),
        write,
        'recap-mid': recap,
      },
    };
  })();

  // =========================================================================
  // MIN-2 — Index
  // =========================================================================
  (function () {
    const P = 'm2';

    function chrome(headline, meta) {
      return `
        <header class="${P}-chrome">
          <div class="${P}-chrome-top">
            <h1 class="${P}-headline">${esc(headline)}</h1>
            <button class="${P}-fold" type="button" aria-label="More options">&#8942;</button>
          </div>
          ${meta ? `<p class="${P}-meta">${esc(meta)}</p>` : ''}
        </header>`;
    }

    function playerRow(p, i) {
      return `
        <li class="${P}-row">
          <span class="${P}-row-n">${String(i + 1).padStart(2, '0')}</span>
          <span class="${P}-row-name${p.isBot ? ` ${P}-row-bot` : ''}">${esc(p.name)}</span>
          ${badge(P, p)}
        </li>`;
    }

    function lobby(sizeKey) {
      return function (el, corpus) {
        const players = corpus.players[sizeKey];
        const s = statusCopy(players);
        const isHost = true;
        const bots = players.filter((p) => p.isBot).length;
        el.innerHTML = `
          <div class="${P}-root">
            ${chrome(`${corpus.roomCodeFormatted} · ${s.title}`, s.needsMore > 0 ? 'Share the code with your table.' : 'Start when everyone is in.')}
            <ol class="${P}-roster">
              ${players.map(playerRow).join('')}
            </ol>
            <div class="${P}-toolrow">
              <a class="${P}-tool" href="#">Invite</a>
              <a class="${P}-tool" href="#">QR</a>
              ${isHost ? `<a class="${P}-tool" href="#">Add bot (${bots}/3)</a>` : ''}
              ${isHost ? `<a class="${P}-tool" href="#">Present</a>` : ''}
            </div>
            <div class="${P}-action">
              ${
                isHost
                  ? `<button class="${P}-cta" ${s.canStart ? '' : 'disabled'} type="button">${s.canStart ? 'Start Linejam' : s.title}</button>`
                  : `<button class="${P}-cta ${P}-cta-wait" disabled type="button">Waiting for host</button>`
              }
            </div>
          </div>`;
      };
    }

    function write(el, corpus) {
      const w = corpus.writing;
      el.innerHTML = `
        <div class="${P}-root">
          ${chrome(`Round ${w.round} of ${w.totalRounds} · ${w.targetWordCount} words`, '')}
          <div class="${P}-write-body">
            <p class="${P}-received-label">Received line</p>
            <p class="${P}-received">${esc(w.previousLineText)}</p>
            <div class="${P}-chips">
              ${w.currentWords.map((word, i) => `<span class="${P}-chip">${String(i + 1).padStart(2, '0')} ${esc(word)}</span>`).join('')}
              ${Array.from({ length: w.targetWordCount - w.currentWords.length })
                .map((_, i) => `<span class="${P}-chip ${P}-chip-empty">${String(w.currentWords.length + i + 1).padStart(2, '0')}</span>`)
                .join('')}
            </div>
          </div>
          <div class="${P}-action">
            <button class="${P}-cta" type="button">Submit</button>
          </div>
        </div>`;
    }

    function recap(el, corpus) {
      const fav = corpus.recapPoems.find((p) => p.isFavorite)
      el.innerHTML = `
        <div class="${P}-root">
          ${chrome('Session complete', `${corpus.recapPoems.length} poems, read aloud by ${corpus.recapPoems.length} poets.`)}
          <div class="${P}-recap-body">
            <p class="${P}-fav-label">Room favorite · ${corpus.favoriteLeaderCount} hearts</p>
            <p class="${P}-fav-line">&ldquo;${esc(fav.preview)}&rdquo; — ${esc(fav.reader)}</p>
            <ol class="${P}-poems">
              ${corpus.recapPoems
                .map(
                  (p) => `
                <li class="${P}-poem">
                  <span class="${P}-poem-reader">${esc(p.reader)}</span>
                  <span class="${P}-poem-preview">${esc(p.preview)}</span>
                </li>`
                )
                .join('')}
            </ol>
          </div>
          <div class="${P}-action ${P}-action-split">
            <button class="${P}-cta" type="button">Start Next Round</button>
            <button class="${P}-cta ${P}-cta-outline" type="button">Back to Lobby</button>
          </div>
        </div>`;
    }

    window.LANE_SPECS['MIN-2'] = {
      lane: 'min',
      title: 'Index',
      move: 'Hero merges straight into the chrome headline (code + status share one line, no separate hero block); the roster renders as a numbered contents-page list with pill badges reserved for Host/AI/Away; the CTA is one flat full-width bar with zero secondary button.',
      css: `
        .opt-MIN-2 { color: var(--color-text-primary); background: var(--color-background); font-family: var(--font-sans); }
        .opt-MIN-2 .${P}-root { width: 100%; height: 100%; display: flex; flex-direction: column; }
        .opt-MIN-2 .${P}-chrome { flex: none; padding: var(--space-3) var(--space-3) var(--space-2); border-bottom: 1px solid var(--color-border); }
        .opt-MIN-2 .${P}-chrome-top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-2); }
        .opt-MIN-2 .${P}-headline { margin: 0; font: 400 var(--text-xl)/var(--leading-tight) var(--font-display); letter-spacing: var(--tracking-tight); color: var(--color-text-primary); }
        .opt-MIN-2 .${P}-fold { flex: none; width: 28px; height: 28px; border: 1px solid var(--color-border); border-radius: var(--radius-full); background: none; color: var(--color-text-secondary); font: 600 var(--text-sm)/1 var(--font-mono); cursor: pointer; }
        .opt-MIN-2 .${P}-meta { margin: 6px 0 0; font: 400 var(--text-sm)/var(--leading-normal) var(--font-sans); color: var(--color-text-secondary); }
        .opt-MIN-2 .${P}-roster { flex: 1 1 auto; min-height: 0; list-style: none; margin: 0; padding: var(--space-1) var(--space-3) 0; overflow: hidden; }
        .opt-MIN-2 .${P}-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--color-border-subtle); }
        .opt-MIN-2 .${P}-row-n { flex: none; width: 18px; font: 500 var(--text-xs)/1 var(--font-mono); color: var(--color-text-muted); }
        .opt-MIN-2 .${P}-row-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 400 var(--text-base)/var(--leading-tight) var(--font-sans); color: var(--color-text-primary); }
        .opt-MIN-2 .${P}-row-bot { font-style: italic; }
        .opt-MIN-2 .${P}-badge { flex: none; font: 600 var(--text-xs)/1 var(--font-sans); text-transform: uppercase; letter-spacing: var(--tracking-wide); padding: 2px 8px; border-radius: var(--radius-full); }
        .opt-MIN-2 .${P}-badge-host { background: var(--color-primary); color: var(--color-text-inverse); }
        .opt-MIN-2 .${P}-badge-muted { background: var(--color-muted); color: var(--color-text-secondary); }
        .opt-MIN-2 .${P}-toolrow { flex: none; display: flex; flex-wrap: wrap; gap: var(--space-2); padding: var(--space-1) var(--space-3) var(--space-2); border-top: 1px solid var(--color-border); }
        .opt-MIN-2 .${P}-tool { font: 500 var(--text-xs)/1 var(--font-sans); color: var(--color-text-secondary); text-decoration: underline; text-underline-offset: 2px; }
        .opt-MIN-2 .${P}-action { flex: none; padding: var(--space-2) var(--space-3) var(--space-3); }
        .opt-MIN-2 .${P}-action-split { display: flex; gap: var(--space-2); }
        .opt-MIN-2 .${P}-cta { flex: 1 1 auto; width: 100%; min-height: 44px; border: none; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-text-inverse); font: 600 var(--text-base)/1 var(--font-sans); cursor: pointer; }
        .opt-MIN-2 .${P}-cta:disabled { background: var(--color-muted); color: var(--color-text-muted); }
        .opt-MIN-2 .${P}-cta-outline { background: none; border: 1px solid var(--color-border); color: var(--color-text-primary); }
        .opt-MIN-2 .${P}-write-body { flex: 1 1 auto; min-height: 0; padding: var(--space-3); display: flex; flex-direction: column; overflow: hidden; }
        .opt-MIN-2 .${P}-received-label { margin: 0 0 4px; font: 500 var(--text-xs)/1 var(--font-sans); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: var(--tracking-wider); }
        .opt-MIN-2 .${P}-received { margin: 0 0 var(--space-3); font: 400 var(--text-2xl)/var(--leading-tight) var(--font-display); letter-spacing: var(--tracking-tight); color: var(--color-text-primary); }
        .opt-MIN-2 .${P}-chips { flex: none; display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: auto; padding-top: var(--space-2); border-top: 1px solid var(--color-border); }
        .opt-MIN-2 .${P}-chip { display: inline-flex; align-items: center; gap: 4px; padding: 6px 2px; border-bottom: 2px solid var(--color-primary); font: 500 var(--text-lg)/1 var(--font-sans); color: var(--color-text-primary); }
        .opt-MIN-2 .${P}-chip-empty { color: var(--color-text-muted); border-bottom-color: var(--color-border); font: 500 var(--text-xs)/1 var(--font-mono); min-width: 32px; justify-content: center; }
        .opt-MIN-2 .${P}-recap-body { flex: 1 1 auto; min-height: 0; padding: var(--space-2) var(--space-3) 0; display: flex; flex-direction: column; overflow: hidden; }
        .opt-MIN-2 .${P}-fav-label { margin: 0 0 4px; font: 600 var(--text-xs)/1 var(--font-sans); color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: var(--tracking-wide); }
        .opt-MIN-2 .${P}-fav-line { margin: 0 0 var(--space-2); padding-bottom: var(--space-2); border-bottom: 1px solid var(--color-border); font: 400 var(--text-md)/var(--leading-tight) var(--font-display); letter-spacing: var(--tracking-tight); color: var(--color-text-primary); }
        .opt-MIN-2 .${P}-poems { flex: 1 1 auto; min-height: 0; list-style: none; margin: 0; padding: 0; overflow: hidden; counter-reset: poem; }
        .opt-MIN-2 .${P}-poem { counter-increment: poem; display: flex; align-items: baseline; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--color-border-subtle); }
        .opt-MIN-2 .${P}-poem::before { content: counter(poem, decimal-leading-zero); flex: none; width: 18px; font: 500 var(--text-xs)/1 var(--font-mono); color: var(--color-text-muted); }
        .opt-MIN-2 .${P}-poem-reader { flex: none; width: 52px; font: 600 var(--text-xs)/var(--leading-tight) var(--font-sans); color: var(--color-text-primary); }
        .opt-MIN-2 .${P}-poem-preview { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 400 var(--text-sm)/var(--leading-tight) var(--font-sans); color: var(--color-text-secondary); }
      `,
      screens: {
        'lobby-low': lobby('low'),
        'lobby-mid': lobby('mid'),
        'lobby-max': lobby('max'),
        write,
        'recap-mid': recap,
      },
    };
  })();

  // =========================================================================
  // MIN-3 — Flatline
  // =========================================================================
  (function () {
    const P = 'm3';

    function chrome(status) {
      return `
        <header class="${P}-chrome">
          <p class="${P}-status">${esc(status)}</p>
          <button class="${P}-fold" type="button" aria-label="More options">&#8942;</button>
        </header>`;
    }

    function tag(p) {
      const role = roleWord(p);
      return `<span class="${P}-tag${p.isBot ? ` ${P}-tag-bot` : ''}${p.isAway ? ` ${P}-tag-away` : ''}">${esc(p.name)}${role ? `<i>${esc(role)}</i>` : ''}</span>`;
    }

    function lobby(sizeKey) {
      return function (el, corpus) {
        const players = corpus.players[sizeKey];
        const s = statusCopy(players);
        const isHost = true;
        el.innerHTML = `
          <div class="${P}-root">
            ${chrome(`${corpus.roomCodeFormatted} · ${s.title}`)}
            <div class="${P}-body">
              <div class="${P}-tags">
                ${players.map(tag).join('')}
              </div>
              <div class="${P}-meta-row">
                <a class="${P}-meta-item" href="#">Invite</a>
                <a class="${P}-meta-item" href="#">QR</a>
                ${isHost ? `<a class="${P}-meta-item" href="#">Add bot</a>` : ''}
                ${isHost ? `<a class="${P}-meta-item" href="#">Present</a>` : ''}
              </div>
            </div>
            <div class="${P}-action">
              ${
                isHost
                  ? `<button class="${P}-cta" ${s.canStart ? '' : 'disabled'} type="button">${s.canStart ? 'Start Linejam' : s.title}</button>`
                  : `<button class="${P}-cta ${P}-cta-wait" disabled type="button">Waiting for host</button>`
              }
            </div>
          </div>`;
      };
    }

    function write(el, corpus) {
      const w = corpus.writing;
      el.innerHTML = `
        <div class="${P}-root">
          ${chrome(`Round ${w.round}/${w.totalRounds} · ${w.targetWordCount} words · received a line`)}
          <div class="${P}-body ${P}-write-body">
            <p class="${P}-received">${esc(w.previousLineText)}</p>
            <div class="${P}-chips">
              ${w.currentWords.map((word) => `<span class="${P}-chip">${esc(word)}</span>`).join('')}
              ${Array.from({ length: w.targetWordCount - w.currentWords.length })
                .map(() => `<span class="${P}-chip ${P}-chip-empty"></span>`)
                .join('')}
            </div>
          </div>
          <div class="${P}-action">
            <button class="${P}-cta" type="button">Submit</button>
          </div>
        </div>`;
    }

    function recap(el, corpus) {
      const fav = corpus.recapPoems.find((p) => p.isFavorite)
      el.innerHTML = `
        <div class="${P}-root">
          ${chrome(`Session complete · ${corpus.recapPoems.length} poems`)}
          <div class="${P}-body ${P}-recap-body">
            <p class="${P}-fav-line">&ldquo;${esc(fav.preview)}&rdquo; <i>— ${esc(fav.reader)}, room favorite &middot; ${corpus.favoriteLeaderCount} hearts</i></p>
            <ul class="${P}-poems">
              ${corpus.recapPoems
                .map(
                  (p) => `<li class="${P}-poem"><b>${esc(p.reader)}</b> ${esc(p.preview)}</li>`
                )
                .join('')}
            </ul>
          </div>
          <div class="${P}-action ${P}-action-split">
            <button class="${P}-cta" type="button">Start Next Round</button>
            <button class="${P}-cta ${P}-cta-outline" type="button">Back to Lobby</button>
          </div>
        </div>`;
    }

    window.LANE_SPECS['MIN-3'] = {
      lane: 'min',
      title: 'Flatline',
      move: 'Chrome compresses to one micro status line, no hero at all; the player roster is the single largest mass on screen, set as a wrapped run of underline-tag names instead of rows; secondary controls reduce to bare monospace metadata tokens inline with the roster.',
      css: `
        .opt-MIN-3 { color: var(--color-text-primary); background: var(--color-background); font-family: var(--font-sans); }
        .opt-MIN-3 .${P}-root { width: 100%; height: 100%; display: flex; flex-direction: column; }
        .opt-MIN-3 .${P}-chrome { flex: none; display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border); }
        .opt-MIN-3 .${P}-status { margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 var(--text-sm)/var(--leading-tight) var(--font-sans); letter-spacing: var(--tracking-tight); color: var(--color-text-primary); }
        .opt-MIN-3 .${P}-fold { flex: none; border: none; background: none; padding: 0 0 0 var(--space-2); font: 600 var(--text-base)/1 var(--font-mono); color: var(--color-text-secondary); cursor: pointer; }
        .opt-MIN-3 .${P}-body { flex: 1 1 auto; min-height: 0; padding: var(--space-3); display: flex; flex-direction: column; overflow: hidden; }
        .opt-MIN-3 .${P}-tags { flex: 1 1 auto; min-height: 0; overflow: hidden; display: flex; flex-wrap: wrap; align-content: flex-start; gap: var(--space-2) var(--space-3); }
        .opt-MIN-3 .${P}-tag { font: 400 var(--text-lg)/var(--leading-tight) var(--font-display); letter-spacing: var(--tracking-tight); color: var(--color-text-primary); border-bottom: 2px solid var(--color-border); padding-bottom: 2px; }
        .opt-MIN-3 .${P}-tag i { display: block; font: 500 var(--text-xs)/1 var(--font-sans); font-style: normal; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: var(--tracking-wide); margin-top: 2px; }
        .opt-MIN-3 .${P}-tag-bot { border-bottom-color: var(--color-text-muted); }
        .opt-MIN-3 .${P}-tag-away { color: var(--color-text-muted); }
        .opt-MIN-3 .${P}-meta-row { flex: none; display: flex; gap: var(--space-3); padding-top: var(--space-2); margin-top: var(--space-2); border-top: 1px solid var(--color-border); }
        .opt-MIN-3 .${P}-meta-item { font: 500 var(--text-xs)/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--color-text-secondary); text-decoration: none; }
        .opt-MIN-3 .${P}-action { flex: none; padding: var(--space-2) var(--space-3) var(--space-3); }
        .opt-MIN-3 .${P}-action-split { display: flex; gap: var(--space-2); }
        .opt-MIN-3 .${P}-cta { flex: 1 1 auto; width: 100%; min-height: 44px; border: none; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-text-inverse); font: 600 var(--text-base)/1 var(--font-sans); cursor: pointer; }
        .opt-MIN-3 .${P}-cta:disabled { background: var(--color-muted); color: var(--color-text-muted); }
        .opt-MIN-3 .${P}-cta-outline { background: none; border: 1px solid var(--color-border); color: var(--color-text-primary); }
        .opt-MIN-3 .${P}-write-body { justify-content: center; gap: var(--space-3); }
        .opt-MIN-3 .${P}-received { margin: 0; font: 400 var(--text-2xl)/var(--leading-tight) var(--font-display); letter-spacing: var(--tracking-tight); color: var(--color-text-primary); }
        .opt-MIN-3 .${P}-chips { flex: none; display: flex; flex-wrap: wrap; gap: 10px; }
        .opt-MIN-3 .${P}-chip { display: inline-block; padding: 6px 4px; border-bottom: 2px solid var(--color-primary); font: 500 var(--text-xl)/1 var(--font-sans); color: var(--color-text-primary); min-width: 32px; text-align: center; }
        .opt-MIN-3 .${P}-chip-empty { min-width: 46px; border-bottom-color: var(--color-border); }
        .opt-MIN-3 .${P}-recap-body { gap: var(--space-2); }
        .opt-MIN-3 .${P}-fav-line { flex: none; margin: 0 0 var(--space-2); padding-bottom: var(--space-2); border-bottom: 1px solid var(--color-border); font: 400 var(--text-md)/var(--leading-tight) var(--font-display); letter-spacing: var(--tracking-tight); color: var(--color-text-primary); }
        .opt-MIN-3 .${P}-fav-line i { font-style: normal; font: 400 var(--text-xs)/1 var(--font-sans); color: var(--color-text-muted); }
        .opt-MIN-3 .${P}-poems { flex: 1 1 auto; min-height: 0; margin: 0; padding: 0; list-style: none; overflow: hidden; }
        .opt-MIN-3 .${P}-poem { padding: 6px 0; border-bottom: 1px solid var(--color-border-subtle); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 400 var(--text-sm)/var(--leading-tight) var(--font-sans); color: var(--color-text-secondary); }
        .opt-MIN-3 .${P}-poem b { font-weight: 600; color: var(--color-text-primary); margin-right: 6px; }
      `,
      screens: {
        'lobby-low': lobby('low'),
        'lobby-mid': lobby('mid'),
        'lobby-max': lobby('max'),
        write,
        'recap-mid': recap,
      },
    };
  })();
})();
