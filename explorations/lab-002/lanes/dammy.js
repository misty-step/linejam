// DAMMY lane — dense operator-console craft applied to the room frame.
// Intent: Sam is running the show, not just waiting in it. Every screen is
// read as a console the host operates — identity, roster, and utility
// controls live in fixed, always-legible chrome zones (a rail, a ticker, a
// dock), never inside a scrolling list, so the whole capability set is one
// glance away at any party size. Three distinct chrome topologies:
//   DAMMY-1  Channel Rail   — persistent vertical icon rail + channel-strip roster
//   DAMMY-2  Status Board   — fused ticker + progressive-disclosure toolset
//   DAMMY-3  Console Dock   — no top bar; one bottom dock carries everything
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  function esc(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  // Player identity color rotates through real theme tokens only — never a
  // hand-picked hex. Semantic tokens borrowed purely as categorical accents.
  const IDENT_TOKENS = [
    '--color-primary',
    '--color-info',
    '--color-success',
    '--color-warning',
    '--color-error',
    '--color-focus-ring',
    '--color-primary-hover',
    '--color-text-secondary',
  ];
  function identColor(stableId, allIds) {
    return `var(${IDENT_TOKENS[allIds.indexOf(stableId) % IDENT_TOKENS.length]})`;
  }
  function roleTag(p) {
    if (p.host) return 'HOST';
    if (p.isBot) return 'AI';
    if (p.isAway) return 'AWAY';
    return '';
  }
  function pluralS(n) {
    return n === 1 ? '' : 's';
  }
  function countBots(players) {
    return players.filter((p) => p.isBot).length;
  }
  // Law 2: word slots grow with their word — typed words render as chips
  // sized to their own text; only the remaining count renders as an empty
  // placeholder. Shared across all three DAMMY options (a fixed law, not a
  // structural axis this lane varies).
  function wordChips(cls, w) {
    const filled = w.currentWords
      .map((word) => `<span class="${cls}-chip-filled">${esc(word)}</span>`)
      .join('');
    const empty = Array.from({ length: Math.max(0, w.targetWordCount - w.currentWords.length) })
      .map(() => `<span class="${cls}-chip-empty"></span>`)
      .join('');
    return filled + empty;
  }

  /* ============================================================
   * DAMMY-1 — Channel Rail
   * A persistent 56px vertical icon rail (identity + invite + help + menu)
   * frees the main column from ever needing a boxed top bar. Roster reads
   * as a dense channel strip: numbered rows, tabular, one line each. The
   * bottom transport bar fuses primary CTA + one secondary control into a
   * single 56px-tall row, reused verbatim (same grammar) on Write and Recap.
   * ============================================================ */
  function d1Rail() {
    return `
      <div class="d1-rail">
        <button class="d1-code-chip" type="button" aria-label="Room code PL UM">
          <span>PL</span><span>UM</span>
        </button>
        <div class="d1-rail-gap"></div>
        <button class="d1-rail-btn" type="button" aria-label="Invite players">+</button>
        <button class="d1-rail-btn" type="button" aria-label="How to play">?</button>
        <button class="d1-rail-btn" type="button" aria-label="More options">&#8942;</button>
      </div>`;
  }
  function d1Header(kicker, status) {
    return `
      <div class="d1-header">
        <span class="d1-header-kicker">${esc(kicker)}</span>
        <span class="d1-header-status">${esc(status)}</span>
      </div>`;
  }
  function d1Row(p, i, allIds) {
    return `
      <div class="d1-row">
        <span class="d1-idx">${String(i + 1).padStart(2, '0')}</span>
        <span class="d1-dot" style="background:${p.isBot ? 'transparent' : identColor(p.stableId, allIds)};border-color:${identColor(p.stableId, allIds)}"></span>
        <span class="d1-name">${esc(p.name)}${p.isAway ? ' <em>away</em>' : ''}</span>
        <span class="d1-tag ${p.host ? 'd1-tag-host' : ''}">${roleTag(p)}</span>
      </div>`;
  }
  function d1Lobby(sizeKey) {
    return function (el, corpus) {
      const players = corpus.players[sizeKey];
      const allIds = players.map((p) => p.stableId);
      const needsMore = Math.max(0, 2 - players.length);
      const canStart = players.length >= 2;
      const bots = countBots(players);
      const isHost = true;
      el.innerHTML = `
        ${d1Rail()}
        <div class="d1-main">
          ${d1Header('LOBBY', needsMore > 0 ? `Need ${needsMore} more player${pluralS(needsMore)}` : `${players.length} players ready`)}
          <div class="d1-content">
            <div class="d1-hero">
              <p class="d1-hero-kicker">Share this code</p>
              <p class="d1-hero-code">${esc(corpus.roomCodeFormatted)}</p>
            </div>
            <div class="d1-roster">
              ${players.map((p, i) => d1Row(p, i, allIds)).join('')}
            </div>
            <div class="d1-tools">
              <div class="d1-qr" aria-hidden="true">QR</div>
              <div class="d1-tools-actions">
                <button class="d1-btn-ghost" type="button">Open join link</button>
                ${isHost && bots < 3 && players.length < 8 ? `<button class="d1-btn-ghost" type="button">Add a bot (${bots}/3)</button>` : ''}
                ${isHost ? `<button class="d1-btn-ghost" type="button">Present room</button>` : ''}
              </div>
            </div>
          </div>
          <div class="d1-transport">
            ${
              isHost
                ? `<button class="d1-btn-primary" type="button" ${canStart ? '' : 'disabled'}>${canStart ? 'Start Linejam' : `Need ${needsMore} more`}</button>
                   <button class="d1-btn-icon" type="button" aria-label="Close room">&times;</button>`
                : `<button class="d1-btn-primary" type="button" disabled>Waiting for host</button>
                   <button class="d1-btn-icon" type="button" aria-label="Leave room">&times;</button>`
            }
          </div>
        </div>`;
    };
  }
  function d1Write(el, corpus) {
    const w = corpus.writing;
    el.innerHTML = `
      ${d1Rail()}
      <div class="d1-main">
        ${d1Header(`ROUND ${w.round}/${w.totalRounds}`, `${w.targetWordCount} word${pluralS(w.targetWordCount)} this round`)}
        <div class="d1-content">
          <p class="d1-received-kicker">Received line</p>
          <p class="d1-received-line">${esc(w.previousLineText)}</p>
          <div class="d1-canvas">
            <div class="d1-slots">${wordChips('d1', w)}</div>
            <p class="d1-charcount">${w.currentWords.join(' ').length}/500 characters</p>
          </div>
        </div>
        <div class="d1-transport">
          <button class="d1-btn-primary" type="button">Submit</button>
        </div>
      </div>`;
  }
  function d1Recap(el, corpus) {
    const poems = corpus.recapPoems;
    const fav = corpus.recapPoems.find((p) => p.isFavorite);
    el.innerHTML = `
      ${d1Rail()}
      <div class="d1-main">
        ${d1Header('RECAP', `${poems.length} poems revealed`)}
        <div class="d1-content">
          ${
            fav
              ? `<div class="d1-fav">
            <p class="d1-fav-kicker">&#9733; Room favorite &middot; ${corpus.favoriteLeaderCount} heart${pluralS(corpus.favoriteLeaderCount)}</p>
            <p class="d1-fav-line">&ldquo;${esc(fav.preview)}&rdquo;</p>
            <p class="d1-fav-reader">${esc(fav.reader)}</p>
          </div>`
              : ''
          }
          <div class="d1-poem-grid">
            ${poems
              .map(
                (p, i) => `
              <div class="d1-poem-card">
                <p class="d1-poem-meta">${String(i + 1).padStart(2, '0')} &middot; ${esc(p.reader)}</p>
                <p class="d1-poem-preview">&ldquo;${esc(p.preview)}&rdquo;</p>
              </div>`
              )
              .join('')}
          </div>
        </div>
        <div class="d1-transport d1-transport-recap">
          <button class="d1-btn-primary d1-btn-wide" type="button">Start Next Round</button>
          <button class="d1-btn-outline" type="button">Lobby</button>
          <button class="d1-btn-icon" type="button" aria-label="Share the set">&#8593;</button>
        </div>
      </div>`;
  }

  window.LANE_SPECS['DAMMY-1'] = {
    lane: 'dammy',
    title: 'Channel Rail',
    move: 'A persistent 56px vertical icon rail replaces the boxed top bar entirely, and the roster reads as a numbered channel strip; one 56px transport row at the bottom carries primary + one secondary control on every screen, including the new Recap action zone.',
    css: `
      .opt-DAMMY-1 { height:100%; display:flex; flex-direction:row; background:var(--color-background); color:var(--color-text-primary); -webkit-font-smoothing:antialiased; }
      .opt-DAMMY-1 button { font-family:inherit; border:none; background:none; padding:0; margin:0; cursor:pointer; }
      .opt-DAMMY-1 button:disabled { cursor:default; opacity:0.55; }

      .opt-DAMMY-1 .d1-rail { flex:none; width:56px; height:100%; display:flex; flex-direction:column; align-items:center; padding:var(--space-2) 0; gap:8px; background:var(--color-surface); border-right:1px solid var(--color-border-subtle); }
      .opt-DAMMY-1 .d1-code-chip { display:flex; flex-direction:column; align-items:center; line-height:var(--leading-tight); font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; letter-spacing:var(--tracking-wide); color:var(--color-primary); width:40px; height:40px; justify-content:center; border-radius:var(--radius-md); border:1px solid var(--color-border); }
      .opt-DAMMY-1 .d1-rail-gap { flex:1; min-height:4px; }
      .opt-DAMMY-1 .d1-rail-btn { width:40px; height:40px; border-radius:var(--radius-md); border:1px solid var(--color-border); color:var(--color-text-secondary); font-size:var(--text-md); font-weight:600; display:flex; align-items:center; justify-content:center; }
      .opt-DAMMY-1 .d1-rail-btn:active { background:var(--color-surface-hover); }

      .opt-DAMMY-1 .d1-main { flex:1; min-width:0; height:100%; display:flex; flex-direction:column; }

      .opt-DAMMY-1 .d1-header { flex:none; display:flex; align-items:baseline; justify-content:space-between; gap:8px; padding:10px 12px; border-bottom:1px solid var(--color-border-subtle); }
      .opt-DAMMY-1 .d1-header-kicker { font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; letter-spacing:var(--tracking-wider); color:var(--color-text-muted); flex:none; }
      .opt-DAMMY-1 .d1-header-status { font-family:var(--font-sans); font-size:var(--text-sm); font-weight:600; color:var(--color-text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:right; min-width:0; }

      .opt-DAMMY-1 .d1-content { flex:1; min-height:0; overflow-y:auto; padding:var(--space-2) 12px; display:flex; flex-direction:column; justify-content:safe center; gap:var(--space-2); }

      .opt-DAMMY-1 .d1-hero { text-align:center; padding:6px 0 4px; }
      .opt-DAMMY-1 .d1-hero-kicker { font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; letter-spacing:var(--tracking-wider); text-transform:uppercase; color:var(--color-text-muted); margin:0 0 2px; }
      .opt-DAMMY-1 .d1-hero-code { font-family:var(--font-display); font-weight:500; font-size:var(--text-3xl); letter-spacing:var(--tracking-tight); line-height:var(--leading-tight); margin:0; color:var(--color-text-primary); }

      .opt-DAMMY-1 .d1-roster { display:flex; flex-direction:column; border-top:1px solid var(--color-border-subtle); }
      .opt-DAMMY-1 .d1-row { display:grid; grid-template-columns:20px 8px 1fr auto; align-items:center; gap:8px; padding:7px 2px; border-bottom:1px solid var(--color-border-subtle); min-height:22px; }
      .opt-DAMMY-1 .d1-idx { font-family:var(--font-mono); font-size:var(--text-xs); color:var(--color-text-muted); }
      .opt-DAMMY-1 .d1-dot { width:8px; height:8px; border-radius:var(--radius-full); border:2px solid; }
      .opt-DAMMY-1 .d1-name { font-family:var(--font-sans); font-size:var(--text-sm); font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .opt-DAMMY-1 .d1-name em { font-style:normal; font-size:var(--text-xs); color:var(--color-text-muted); margin-left:4px; }
      .opt-DAMMY-1 .d1-tag { font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; letter-spacing:var(--tracking-wide); color:var(--color-text-muted); }
      .opt-DAMMY-1 .d1-tag-host { color:var(--color-primary); }

      .opt-DAMMY-1 .d1-tools { display:flex; gap:10px; align-items:flex-start; padding-top:2px; }
      .opt-DAMMY-1 .d1-qr { flex:none; width:60px; height:60px; border-radius:var(--radius-md); border:1px solid var(--color-border); background:repeating-conic-gradient(var(--color-text-primary) 0% 25%, var(--color-surface) 0% 50%) 0 0/12px 12px; display:flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; color:var(--color-surface); }
      .opt-DAMMY-1 .d1-tools-actions { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }
      .opt-DAMMY-1 .d1-btn-ghost { text-align:left; font-family:var(--font-sans); font-size:var(--text-xs); font-weight:600; color:var(--color-text-secondary); padding:6px 8px; border-radius:var(--radius-sm); border:1px solid var(--color-border-subtle); }

      .opt-DAMMY-1 .d1-received-kicker { font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; letter-spacing:var(--tracking-wide); text-transform:uppercase; color:var(--color-primary); margin:4px 0 4px; }
      .opt-DAMMY-1 .d1-received-line { font-family:var(--font-display); font-style:italic; font-weight:500; font-size:var(--text-xl); line-height:var(--leading-tight); color:var(--color-text-secondary); margin:0 0 var(--space-3); }
      .opt-DAMMY-1 .d1-canvas { border-top:1px solid var(--color-border-subtle); padding-top:var(--space-3); }
      .opt-DAMMY-1 .d1-slots { display:flex; flex-wrap:wrap; gap:8px; }
      .opt-DAMMY-1 .d1-chip-filled { display:inline-flex; align-items:center; font-family:var(--font-display); font-weight:500; font-size:var(--text-lg); padding:4px 12px; border-radius:var(--radius-full); background:var(--color-muted); border:1px solid var(--color-border); color:var(--color-text-primary); }
      .opt-DAMMY-1 .d1-chip-empty { width:32px; height:32px; border:2px dashed var(--color-border); border-radius:var(--radius-sm); }
      .opt-DAMMY-1 .d1-charcount { font-family:var(--font-mono); font-size:var(--text-xs); color:var(--color-text-muted); margin:10px 0 0; }

      .opt-DAMMY-1 .d1-fav { border:1px solid var(--color-primary); border-radius:var(--radius-md); padding:var(--space-2); }
      .opt-DAMMY-1 .d1-fav-kicker { font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; text-transform:uppercase; letter-spacing:var(--tracking-wide); color:var(--color-primary); margin:0 0 4px; }
      .opt-DAMMY-1 .d1-fav-line { font-family:var(--font-display); font-style:italic; font-weight:500; font-size:var(--text-md); line-height:var(--leading-normal); margin:0; }
      .opt-DAMMY-1 .d1-fav-reader { font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; text-transform:uppercase; color:var(--color-text-muted); margin:4px 0 0; }
      .opt-DAMMY-1 .d1-poem-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      .opt-DAMMY-1 .d1-poem-card { border:1px solid var(--color-border-subtle); border-radius:var(--radius-sm); padding:8px; }
      .opt-DAMMY-1 .d1-poem-meta { font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; text-transform:uppercase; color:var(--color-text-muted); margin:0 0 4px; }
      .opt-DAMMY-1 .d1-poem-preview { font-family:var(--font-display); font-style:italic; font-size:var(--text-sm); line-height:var(--leading-normal); margin:0; color:var(--color-text-secondary); }

      .opt-DAMMY-1 .d1-transport { flex:none; display:flex; gap:8px; padding:8px 12px; border-top:1px solid var(--color-border-subtle); box-shadow:var(--shadow-lg); }
      .opt-DAMMY-1 .d1-btn-primary { flex:1; min-width:0; height:48px; border-radius:var(--radius-md); background:var(--color-primary); color:var(--color-text-inverse); font-family:var(--font-sans); font-size:var(--text-md); font-weight:600; }
      .opt-DAMMY-1 .d1-btn-primary:active:not(:disabled) { background:var(--color-primary-active); }
      .opt-DAMMY-1 .d1-btn-icon { flex:none; width:48px; height:48px; border-radius:var(--radius-md); border:1px solid var(--color-border); color:var(--color-text-secondary); font-size:var(--text-lg); }
      .opt-DAMMY-1 .d1-transport-recap .d1-btn-primary { flex:1.6; }
      .opt-DAMMY-1 .d1-btn-outline { flex:1; min-width:0; height:48px; border-radius:var(--radius-md); border:1px solid var(--color-primary); color:var(--color-primary); font-family:var(--font-sans); font-size:var(--text-sm); font-weight:600; }
    `,
    screens: {
      'lobby-low': d1Lobby('low'),
      'lobby-mid': d1Lobby('mid'),
      'lobby-max': d1Lobby('max'),
      write: d1Write,
      'recap-mid': d1Recap,
    },
  };

  /* ============================================================
   * DAMMY-2 — Status Board
   * One fused ticker (code + live status + two utility icons) replaces the
   * boxed chrome bar. Roster reads as a token cluster, densifying its own
   * chip size at 8 players. Room tools (QR / link / bot / present) live
   * behind a native <details> disclosure — visible on demand, never taking
   * space by default. A two-tier CTA zone (primary + secondary link row)
   * repeats verbatim across Lobby, Write, and Recap.
   * ============================================================ */
  function d2Ticker(status) {
    return `
      <div class="d2-ticker">
        <span class="d2-ticker-code">PL UM</span>
        <span class="d2-ticker-status">${esc(status)}</span>
        <div class="d2-ticker-actions">
          <button class="d2-ticker-btn" type="button" aria-label="How to play">?</button>
          <button class="d2-ticker-btn" type="button" aria-label="More options">&#8942;</button>
        </div>
      </div>`;
  }
  function d2Chip(p, allIds, dense) {
    const color = identColor(p.stableId, allIds);
    return `
      <span class="d2-chip ${p.host ? 'd2-chip-host' : ''} ${p.isAway ? 'd2-chip-away' : ''} ${dense ? 'd2-chip-dense' : ''}">
        <span class="d2-chip-dot" style="background:${p.isBot ? 'transparent' : color};border-color:${color}"></span>
        ${p.host ? '<span class="d2-chip-star">&#9733;</span>' : ''}
        ${esc(p.name)}${p.isBot ? '<sup>AI</sup>' : ''}
      </span>`;
  }
  function d2Lobby(sizeKey) {
    return function (el, corpus) {
      const players = corpus.players[sizeKey];
      const allIds = players.map((p) => p.stableId);
      const needsMore = Math.max(0, 2 - players.length);
      const canStart = players.length >= 2;
      const bots = countBots(players);
      const dense = players.length > 6;
      const isHost = true;
      el.innerHTML = `
        <div class="d2-board-wrap">
          ${d2Ticker(needsMore > 0 ? `Need ${needsMore} more player${pluralS(needsMore)}` : `${players.length} players ready`)}
          <div class="d2-board">
            <div class="d2-hero">
              <p class="d2-hero-kicker">Share this code</p>
              <p class="d2-hero-headline">${esc(corpus.roomCodeFormatted)}</p>
              <p class="d2-hero-sub">${needsMore > 0 ? 'Waiting on friends to join.' : 'Start when you are ready.'}</p>
            </div>
            <div class="d2-roster">
              ${players.map((p) => d2Chip(p, allIds, dense)).join('')}
            </div>
            <details class="d2-tools">
              <summary>Room tools</summary>
              <div class="d2-tools-body">
                <div class="d2-tools-row">
                  <div class="d2-qr" aria-hidden="true">QR</div>
                  <div class="d2-tools-col">
                    <button class="d2-tools-btn" type="button">Open join link</button>
                    ${isHost && bots < 3 && players.length < 8 ? `<button class="d2-tools-btn" type="button">Add a bot (${bots}/3)</button>` : ''}
                    ${isHost ? `<button class="d2-tools-btn" type="button">Present room</button>` : ''}
                  </div>
                </div>
              </div>
            </details>
          </div>
          <div class="d2-cta-zone">
            ${
              isHost
                ? `<button class="d2-cta-primary" type="button" ${canStart ? '' : 'disabled'}>${canStart ? 'Start Linejam' : `Need ${needsMore} more player${pluralS(needsMore)}`}</button>
                   <div class="d2-cta-secondary-row"><button class="d2-cta-link" type="button">Close room</button></div>`
                : `<button class="d2-cta-primary" type="button" disabled>Waiting for host</button>
                   <div class="d2-cta-secondary-row"><button class="d2-cta-link" type="button">Leave room</button></div>`
            }
          </div>
        </div>`;
    };
  }
  function d2Write(el, corpus) {
    const w = corpus.writing;
    el.innerHTML = `
      <div class="d2-board-wrap">
        ${d2Ticker(`Round ${w.round} of ${w.totalRounds} &middot; ${w.targetWordCount} words`)}
        <div class="d2-board">
          <div class="d2-hero">
            <p class="d2-hero-kicker">Received line</p>
            <p class="d2-hero-headline d2-hero-headline-write">${esc(w.previousLineText)}</p>
          </div>
          <div class="d2-canvas">
            <div class="d2-slots">${wordChips('d2', w)}</div>
            <p class="d2-charcount">${w.currentWords.join(' ').length}/500 characters</p>
          </div>
        </div>
        <div class="d2-cta-zone">
          <button class="d2-cta-primary" type="button">Submit</button>
        </div>
      </div>`;
  }
  function d2Recap(el, corpus) {
    const poems = corpus.recapPoems;
    const fav = corpus.recapPoems.find((p) => p.isFavorite);
    el.innerHTML = `
      <div class="d2-board-wrap">
        ${d2Ticker(`Recap &middot; ${poems.length} poems ready`)}
        <div class="d2-board">
          ${
            fav
              ? `<div class="d2-hero d2-hero-fav">
            <div class="d2-fav-row">
              <p class="d2-hero-kicker">&#9829; Room favorite</p>
              <span class="d2-fav-hearts">${corpus.favoriteLeaderCount} heart${pluralS(corpus.favoriteLeaderCount)}</span>
            </div>
            <p class="d2-hero-headline d2-hero-headline-write">&ldquo;${esc(fav.preview)}&rdquo;</p>
            <p class="d2-hero-sub">Read by ${esc(fav.reader)}</p>
          </div>`
              : ''
          }
          <details class="d2-tools">
            <summary>Read all poems (${poems.length})</summary>
            <div class="d2-tools-body">
              <div class="d2-poem-list">
                ${poems
                  .map(
                    (p, i) => `
                  <div class="d2-poem-row">
                    <span class="d2-poem-meta">${String(i + 1).padStart(2, '0')} &middot; ${esc(p.reader)}</span>
                    <span class="d2-poem-preview">&ldquo;${esc(p.preview)}&rdquo;</span>
                  </div>`
                  )
                  .join('')}
              </div>
            </div>
          </details>
        </div>
        <div class="d2-cta-zone">
          <button class="d2-cta-primary" type="button">Start Next Round</button>
          <div class="d2-cta-secondary-row">
            <button class="d2-cta-link" type="button">Back to Lobby</button>
            <button class="d2-cta-link" type="button">Share the set</button>
          </div>
        </div>
      </div>`;
  }

  window.LANE_SPECS['DAMMY-2'] = {
    lane: 'dammy',
    title: 'Status Board',
    move: 'The top bar collapses into a single-line status ticker, the roster becomes a wrapping token cluster that densifies at 8 players, and secondary controls (QR, invite link, bot, present) live behind a native <details> disclosure so they never cost vertical space until asked for.',
    css: `
      .opt-DAMMY-2 { height:100%; display:flex; flex-direction:column; background:var(--color-background); color:var(--color-text-primary); font-family:var(--font-sans); -webkit-font-smoothing:antialiased; }
      .opt-DAMMY-2 button { font-family:inherit; border:none; background:none; padding:0; margin:0; cursor:pointer; }
      .opt-DAMMY-2 button:disabled { cursor:default; opacity:0.55; }
      .opt-DAMMY-2 .d2-board-wrap { height:100%; display:flex; flex-direction:column; }

      .opt-DAMMY-2 .d2-ticker { flex:none; display:flex; align-items:center; gap:10px; padding:10px 12px; border-bottom:1px solid var(--color-border-subtle); background:var(--color-surface); }
      .opt-DAMMY-2 .d2-ticker-code { flex:none; font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; letter-spacing:var(--tracking-wider); color:var(--color-primary); }
      .opt-DAMMY-2 .d2-ticker-status { flex:1; min-width:0; font-size:var(--text-sm); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .opt-DAMMY-2 .d2-ticker-actions { flex:none; display:flex; gap:6px; }
      .opt-DAMMY-2 .d2-ticker-btn { width:32px; height:32px; border-radius:var(--radius-md); border:1px solid var(--color-border); color:var(--color-text-secondary); font-size:var(--text-sm); font-weight:600; display:flex; align-items:center; justify-content:center; }

      .opt-DAMMY-2 .d2-board { flex:1; min-height:0; overflow-y:auto; padding:var(--space-3) 14px; display:flex; flex-direction:column; justify-content:safe center; gap:var(--space-3); }

      .opt-DAMMY-2 .d2-hero-kicker { font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; text-transform:uppercase; letter-spacing:var(--tracking-wide); color:var(--color-text-muted); margin:0 0 4px; }
      .opt-DAMMY-2 .d2-hero-headline { font-family:var(--font-display); font-weight:500; font-size:var(--text-3xl); letter-spacing:var(--tracking-tight); line-height:var(--leading-tight); margin:0; }
      .opt-DAMMY-2 .d2-hero-headline-write { font-style:italic; font-size:var(--text-lg); line-height:var(--leading-normal); color:var(--color-text-secondary); letter-spacing:var(--tracking-normal); }
      .opt-DAMMY-2 .d2-hero-sub { font-size:var(--text-sm); color:var(--color-text-secondary); margin:6px 0 0; }
      .opt-DAMMY-2 .d2-fav-row { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .opt-DAMMY-2 .d2-fav-row .d2-hero-kicker { margin:0; color:var(--color-primary); }
      .opt-DAMMY-2 .d2-fav-hearts { flex:none; font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; color:var(--color-primary); background:var(--color-muted); border:1px solid var(--color-border-subtle); border-radius:var(--radius-full); padding:2px 9px; }

      .opt-DAMMY-2 .d2-roster { display:flex; flex-wrap:wrap; gap:6px; }
      .opt-DAMMY-2 .d2-chip { display:inline-flex; align-items:center; gap:5px; padding:5px 10px 5px 6px; border-radius:var(--radius-full); background:var(--color-muted); border:1px solid var(--color-border-subtle); font-size:var(--text-xs); font-weight:600; }
      .opt-DAMMY-2 .d2-chip-dense { padding:3px 8px 3px 5px; font-size:var(--text-xs); }
      .opt-DAMMY-2 .d2-chip-host { border-color:var(--color-primary); }
      .opt-DAMMY-2 .d2-chip-away { opacity:0.6; }
      .opt-DAMMY-2 .d2-chip-dot { width:7px; height:7px; border-radius:var(--radius-full); border:2px solid; }
      .opt-DAMMY-2 .d2-chip-star { color:var(--color-primary); font-size:9px; }
      .opt-DAMMY-2 .d2-chip sup { font-family:var(--font-mono); font-size:8px; color:var(--color-text-muted); margin-left:1px; }

      .opt-DAMMY-2 .d2-tools { border:1px solid var(--color-border-subtle); border-radius:var(--radius-md); background:var(--color-surface); }
      .opt-DAMMY-2 .d2-tools summary { padding:10px 12px; font-size:var(--text-sm); font-weight:600; cursor:pointer; list-style:none; display:flex; align-items:center; justify-content:space-between; }
      .opt-DAMMY-2 .d2-tools summary::-webkit-details-marker { display:none; }
      .opt-DAMMY-2 .d2-tools summary::after { content:'\\25BE'; color:var(--color-text-muted); font-size:var(--text-xs); }
      .opt-DAMMY-2 .d2-tools[open] summary::after { content:'\\25B4'; }
      .opt-DAMMY-2 .d2-tools-body { padding:0 12px 12px; }
      .opt-DAMMY-2 .d2-tools-row { display:flex; gap:10px; }
      .opt-DAMMY-2 .d2-qr { flex:none; width:56px; height:56px; border-radius:var(--radius-md); border:1px solid var(--color-border); background:repeating-conic-gradient(var(--color-text-primary) 0% 25%, var(--color-surface) 0% 50%) 0 0/12px 12px; }
      .opt-DAMMY-2 .d2-tools-col { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }
      .opt-DAMMY-2 .d2-tools-btn { text-align:left; font-size:var(--text-xs); font-weight:600; color:var(--color-text-secondary); padding:6px 8px; border-radius:var(--radius-sm); background:var(--color-muted); }
      .opt-DAMMY-2 .d2-poem-list { display:flex; flex-direction:column; gap:8px; }
      .opt-DAMMY-2 .d2-poem-row { display:flex; flex-direction:column; gap:2px; padding-bottom:8px; border-bottom:1px solid var(--color-border-subtle); }
      .opt-DAMMY-2 .d2-poem-row:last-child { border-bottom:none; padding-bottom:0; }
      .opt-DAMMY-2 .d2-poem-meta { font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; text-transform:uppercase; color:var(--color-text-muted); }
      .opt-DAMMY-2 .d2-poem-preview { font-family:var(--font-display); font-style:italic; font-size:var(--text-sm); color:var(--color-text-secondary); }

      .opt-DAMMY-2 .d2-canvas { border-top:1px solid var(--color-border-subtle); padding-top:var(--space-3); }
      .opt-DAMMY-2 .d2-slots { display:flex; flex-wrap:wrap; gap:8px; }
      .opt-DAMMY-2 .d2-chip-filled { display:inline-flex; align-items:center; font-family:var(--font-display); font-weight:500; font-size:var(--text-lg); padding:4px 12px; border-radius:var(--radius-full); background:var(--color-muted); border:1px solid var(--color-border); }
      .opt-DAMMY-2 .d2-chip-empty { width:32px; height:32px; border:2px dashed var(--color-border); border-radius:var(--radius-sm); }
      .opt-DAMMY-2 .d2-charcount { font-family:var(--font-mono); font-size:var(--text-xs); color:var(--color-text-muted); margin:10px 0 0; }

      .opt-DAMMY-2 .d2-cta-zone { flex:none; padding:10px 14px 14px; border-top:1px solid var(--color-border-subtle); background:var(--color-surface); box-shadow:var(--shadow-lg); }
      .opt-DAMMY-2 .d2-cta-primary { width:100%; height:48px; border-radius:var(--radius-md); background:var(--color-primary); color:var(--color-text-inverse); font-size:var(--text-md); font-weight:600; }
      .opt-DAMMY-2 .d2-cta-primary:active:not(:disabled) { background:var(--color-primary-active); }
      .opt-DAMMY-2 .d2-cta-secondary-row { display:flex; justify-content:center; gap:var(--space-3); margin-top:8px; }
      .opt-DAMMY-2 .d2-cta-link { font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; text-transform:uppercase; letter-spacing:var(--tracking-wide); color:var(--color-text-muted); }
    `,
    screens: {
      'lobby-low': d2Lobby('low'),
      'lobby-mid': d2Lobby('mid'),
      'lobby-max': d2Lobby('max'),
      write: d2Write,
      'recap-mid': d2Recap,
    },
  };

  /* ============================================================
   * DAMMY-3 — Console Dock
   * No top bar at all: identity shrinks to a small floating corner badge
   * and every utility control (invite/help/menu, or share/sound/lobby on
   * Recap) relocates into the same bottom dock as the primary CTA, as a
   * slim two-row console. The stage above is uninterrupted for hero content
   * and a roster card grid that re-proportions itself at 1/5/8 players.
   * ============================================================ */
  function d3Badge() {
    return `<div class="d3-badge">PL UM</div>`;
  }
  function d3Dock(primaryHtml, utilityHtml) {
    return `
      <div class="d3-dock">
        <div class="d3-dock-utility">${utilityHtml}</div>
        <div class="d3-dock-primary">${primaryHtml}</div>
      </div>`;
  }
  function d3RosterLow(corpus) {
    const p = corpus.players.low[0];
    return `
      <div class="d3-invite-card">
        <p class="d3-invite-kicker">Waiting on friends</p>
        <p class="d3-invite-code">${esc(corpus.roomCodeFormatted)}</p>
        <p class="d3-invite-sub">${esc(p.name)} is in. Share the code to fill the room.</p>
      </div>`;
  }
  function d3Roster(players, allIds, dense) {
    return `
      <div class="d3-grid ${dense ? 'd3-grid-dense' : ''}">
        ${players
          .map((p) => {
            const color = identColor(p.stableId, allIds);
            return `
            <div class="d3-card ${p.host ? 'd3-card-host' : ''} ${p.isAway ? 'd3-card-away' : ''}" style="--ident:${color}">
              <span class="d3-card-dot" style="background:${p.isBot ? 'transparent' : color}"></span>
              <span class="d3-card-name">${esc(p.name)}</span>
              <span class="d3-card-role">${roleTag(p)}</span>
            </div>`;
          })
          .join('')}
      </div>`;
  }
  function d3Lobby(sizeKey) {
    return function (el, corpus) {
      const players = corpus.players[sizeKey];
      const allIds = players.map((p) => p.stableId);
      const needsMore = Math.max(0, 2 - players.length);
      const canStart = players.length >= 2;
      const bots = countBots(players);
      const dense = players.length > 6;
      const isHost = true;
      el.innerHTML = `
        ${d3Badge()}
        <div class="d3-stage">
          <p class="d3-stage-status">${needsMore > 0 ? `Need ${needsMore} more player${pluralS(needsMore)}` : `${players.length} players ready`}</p>
          ${sizeKey === 'low' ? d3RosterLow(corpus) : d3Roster(players, allIds, dense)}
          ${
            sizeKey !== 'low'
              ? `<div class="d3-hint">
                  ${isHost && bots < 3 && players.length < 8 ? `Add a bot (${bots}/3) or ` : ''}present the room from the dock below.
                </div>`
              : ''
          }
        </div>
        ${d3Dock(
          isHost
            ? `<button class="d3-btn-primary" type="button" ${canStart ? '' : 'disabled'}>${canStart ? 'Start Linejam' : `Need ${needsMore} more`}</button>`
            : `<button class="d3-btn-primary" type="button" disabled>Waiting for host</button>`,
          `
            <button class="d3-util-btn" type="button" aria-label="Invite players">Invite</button>
            <button class="d3-util-btn" type="button" aria-label="Add a bot">Bot</button>
            <button class="d3-util-btn" type="button" aria-label="Present room">Present</button>
            <button class="d3-util-btn d3-util-icon" type="button" aria-label="How to play">?</button>
          `
        )}`;
    };
  }
  function d3Write(el, corpus) {
    const w = corpus.writing;
    el.innerHTML = `
      ${d3Badge()}
      <div class="d3-stage">
        <p class="d3-stage-status">Round ${w.round} of ${w.totalRounds} &middot; ${w.targetWordCount} word${pluralS(w.targetWordCount)}</p>
        <p class="d3-received-kicker">Received line</p>
        <p class="d3-received-line">${esc(w.previousLineText)}</p>
        <div class="d3-canvas">
          <div class="d3-slots">${wordChips('d3', w)}</div>
          <p class="d3-charcount">${w.currentWords.join(' ').length}/500 characters</p>
        </div>
      </div>
      ${d3Dock(
        `<button class="d3-btn-primary" type="button">Submit</button>`,
        `<button class="d3-util-btn" type="button" aria-label="How to play">Help</button>
         <button class="d3-util-btn d3-util-icon" type="button" aria-label="More options">&#8942;</button>`
      )}`;
  }
  function d3Recap(el, corpus) {
    const poems = corpus.recapPoems;
    const fav = corpus.recapPoems.find((p) => p.isFavorite);
    el.innerHTML = `
      ${d3Badge()}
      <div class="d3-stage">
        <p class="d3-stage-status">Recap &middot; ${poems.length} poems revealed</p>
        ${
          fav
            ? `<div class="d3-fav-card">
          <p class="d3-fav-kicker">&#9733; Room favorite &middot; ${corpus.favoriteLeaderCount} heart${pluralS(corpus.favoriteLeaderCount)}</p>
          <p class="d3-fav-line">&ldquo;${esc(fav.preview)}&rdquo;</p>
          <p class="d3-fav-reader">${esc(fav.reader)}</p>
        </div>`
            : ''
        }
        <div class="d3-poem-cards">
          ${poems
            .map(
              (p, i) => `
            <div class="d3-poem-card">
              <span class="d3-poem-meta">${String(i + 1).padStart(2, '0')} &middot; ${esc(p.reader)}</span>
              <span class="d3-poem-preview">&ldquo;${esc(p.preview)}&rdquo;</span>
            </div>`
            )
            .join('')}
        </div>
      </div>
      ${d3Dock(
        `<button class="d3-btn-primary" type="button">Start Next Round</button>`,
        `<button class="d3-util-btn" type="button" aria-label="Back to lobby">Lobby</button>
         <button class="d3-util-btn" type="button" aria-label="Share the set">Share</button>
         <button class="d3-util-btn d3-util-icon" type="button" aria-label="Sound">&#9835;</button>`
      )}`;
  }

  window.LANE_SPECS['DAMMY-3'] = {
    lane: 'dammy',
    title: 'Console Dock',
    move: 'The top bar is deleted outright; identity shrinks to a floating corner badge, and every utility control relocates into the same bottom dock as the primary CTA as a two-row console, leaving the entire stage above free for a roster card grid that reshapes itself at 1, 5, and 8 players.',
    css: `
      .opt-DAMMY-3 { height:100%; position:relative; display:flex; flex-direction:column; background:var(--color-background); color:var(--color-text-primary); font-family:var(--font-sans); -webkit-font-smoothing:antialiased; }
      .opt-DAMMY-3 button { font-family:inherit; border:none; background:none; padding:0; margin:0; cursor:pointer; }
      .opt-DAMMY-3 button:disabled { cursor:default; opacity:0.55; }

      .opt-DAMMY-3 .d3-badge { position:absolute; top:10px; left:10px; z-index:2; font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; letter-spacing:var(--tracking-wider); color:var(--color-primary); background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-full); padding:6px 10px; box-shadow:var(--shadow-sm); }

      .opt-DAMMY-3 .d3-stage { flex:1; min-height:0; overflow-y:auto; padding:44px 14px 12px; display:flex; flex-direction:column; justify-content:safe center; gap:var(--space-2); }
      .opt-DAMMY-3 .d3-stage-status { text-align:center; font-size:var(--text-sm); font-weight:600; color:var(--color-text-secondary); margin:0 0 4px; }

      .opt-DAMMY-3 .d3-invite-card { text-align:center; border:1px solid var(--color-border-subtle); border-radius:var(--radius-lg); padding:var(--space-4) var(--space-3); background:var(--color-surface); }
      .opt-DAMMY-3 .d3-invite-kicker { font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; text-transform:uppercase; letter-spacing:var(--tracking-wide); color:var(--color-text-muted); margin:0 0 8px; }
      .opt-DAMMY-3 .d3-invite-code { font-family:var(--font-display); font-weight:500; font-size:var(--text-4xl); letter-spacing:var(--tracking-tight); line-height:var(--leading-tight); margin:0; }
      .opt-DAMMY-3 .d3-invite-sub { font-size:var(--text-sm); color:var(--color-text-secondary); margin:10px 0 0; }

      .opt-DAMMY-3 .d3-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      .opt-DAMMY-3 .d3-card { display:flex; flex-direction:column; gap:2px; padding:10px; border-radius:var(--radius-md); border:1px solid var(--color-border-subtle); background:var(--color-surface); border-left:3px solid transparent; }
      .opt-DAMMY-3 .d3-card-host { border-left-color:var(--color-primary); }
      .opt-DAMMY-3 .d3-card-away { opacity:0.6; }
      .opt-DAMMY-3 .d3-card-dot { width:8px; height:8px; border-radius:var(--radius-full); background:var(--ident); }
      .opt-DAMMY-3 .d3-card-name { font-size:var(--text-sm); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .opt-DAMMY-3 .d3-card-role { font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; letter-spacing:var(--tracking-wide); color:var(--color-text-muted); }
      .opt-DAMMY-3 .d3-grid-dense .d3-card { padding:7px 10px; }
      .opt-DAMMY-3 .d3-grid-dense .d3-card-name { font-size:var(--text-xs); }
      .opt-DAMMY-3 .d3-hint { text-align:center; font-size:var(--text-xs); color:var(--color-text-muted); margin:2px 0 0; }

      .opt-DAMMY-3 .d3-received-kicker { font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; text-transform:uppercase; letter-spacing:var(--tracking-wide); color:var(--color-primary); margin:8px 0 4px; }
      .opt-DAMMY-3 .d3-received-line { font-family:var(--font-display); font-style:italic; font-weight:500; font-size:var(--text-xl); line-height:var(--leading-tight); color:var(--color-text-secondary); margin:0 0 var(--space-3); }
      .opt-DAMMY-3 .d3-canvas { border-top:1px solid var(--color-border-subtle); padding-top:var(--space-3); }
      .opt-DAMMY-3 .d3-slots { display:flex; flex-wrap:wrap; gap:8px; }
      .opt-DAMMY-3 .d3-chip-filled { display:inline-flex; align-items:center; font-family:var(--font-display); font-weight:500; font-size:var(--text-lg); padding:4px 12px; border-radius:var(--radius-full); background:var(--color-muted); border:1px solid var(--color-border); }
      .opt-DAMMY-3 .d3-chip-empty { width:32px; height:32px; border:2px dashed var(--color-border); border-radius:var(--radius-sm); }
      .opt-DAMMY-3 .d3-charcount { font-family:var(--font-mono); font-size:var(--text-xs); color:var(--color-text-muted); margin:10px 0 0; }

      .opt-DAMMY-3 .d3-fav-card { border:1px solid var(--color-primary); border-radius:var(--radius-lg); padding:var(--space-2); }
      .opt-DAMMY-3 .d3-fav-kicker { font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; text-transform:uppercase; letter-spacing:var(--tracking-wide); color:var(--color-primary); margin:0 0 4px; }
      .opt-DAMMY-3 .d3-fav-line { font-family:var(--font-display); font-style:italic; font-weight:500; font-size:var(--text-md); line-height:var(--leading-normal); margin:0; }
      .opt-DAMMY-3 .d3-fav-reader { font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; text-transform:uppercase; color:var(--color-text-muted); margin:4px 0 0; }
      .opt-DAMMY-3 .d3-poem-cards { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      .opt-DAMMY-3 .d3-poem-card { display:flex; flex-direction:column; gap:4px; border:1px solid var(--color-border-subtle); border-radius:var(--radius-sm); padding:8px; background:var(--color-surface); }
      .opt-DAMMY-3 .d3-poem-meta { font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; text-transform:uppercase; color:var(--color-text-muted); }
      .opt-DAMMY-3 .d3-poem-preview { font-family:var(--font-display); font-style:italic; font-size:var(--text-sm); line-height:var(--leading-normal); color:var(--color-text-secondary); }

      .opt-DAMMY-3 .d3-dock { flex:none; display:flex; flex-direction:column; gap:8px; padding:8px 14px 12px; border-top:1px solid var(--color-border-subtle); background:var(--color-surface); box-shadow:var(--shadow-lg); }
      .opt-DAMMY-3 .d3-dock-utility { display:flex; gap:6px; }
      .opt-DAMMY-3 .d3-util-btn { flex:1; min-width:0; height:36px; border-radius:var(--radius-md); border:1px solid var(--color-border); font-size:var(--text-xs); font-weight:600; color:var(--color-text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .opt-DAMMY-3 .d3-util-icon { flex:none; width:36px; }
      .opt-DAMMY-3 .d3-dock-primary { display:flex; }
      .opt-DAMMY-3 .d3-btn-primary { flex:1; height:48px; border-radius:var(--radius-md); background:var(--color-primary); color:var(--color-text-inverse); font-size:var(--text-md); font-weight:600; }
      .opt-DAMMY-3 .d3-btn-primary:active:not(:disabled) { background:var(--color-primary-active); }
    `,
    screens: {
      'lobby-low': d3Lobby('low'),
      'lobby-mid': d3Lobby('mid'),
      'lobby-max': d3Lobby('max'),
      write: d3Write,
      'recap-mid': d3Recap,
    },
  };
})();
