// BRUT lane — Industrial Brutalism & Tactical Telemetry (leon-brutalist-skill).
// Swiss industrial print (light/Kenya) x tactical CRT terminal (dark/Aloud) —
// ONE structural spine wearing both substrates via the theme tokens already
// on .screen-root. No border-radius anywhere (90-degree corners only), one
// accent color (var(--color-primary): rust-red in Kenya, phosphor-amber in
// Aloud), hairline-rule compartmentalization instead of card shadows, and
// monospace (var(--font-mono) = JetBrains Mono) carrying every telemetry
// label. Three genuinely different structural grammars:
//   BRUT-1 SWISS MANIFEST — flat exposure, everything visible, no disclosure.
//   BRUT-2 TACTICAL HUD   — chrome + hero fused into one instrument panel.
//   BRUT-3 LEDGER GRID    — literal CSS Grid dossier/table, gap:1px hairlines.
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  function esc(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }
  function callsign(i) {
    return 'P-' + String(i + 1).padStart(2, '0');
  }
  function lobbyMeta(players) {
    const needsMore = Math.max(0, 2 - players.length);
    const canStart = players.length >= 2;
    const botCount = players.filter((p) => p.isBot).length;
    return { needsMore, canStart, botCount };
  }
  function statusTag(p) {
    if (p.host) return { text: 'HOST', cls: 'host' };
    if (p.isAway) return { text: 'AWAY', cls: 'away' };
    if (p.isBot) return { text: 'AI', cls: 'bot' };
    return { text: 'READY', cls: '' };
  }

  // =========================================================================
  // BRUT-1 — SWISS MANIFEST: flat, unforgiving grid; nothing tucked away.
  // =========================================================================
  function b1Chrome(statusLabel, statusText, roomCode) {
    return `
      <div class="b1-chrome">
        <div class="b1-chrome-top">
          <span class="b1-chrome-tag">LINEJAM // ROOM <b>${esc(roomCode)}</b></span>
          <div class="b1-chrome-actions">
            <button class="b1-icon-btn b1-invite" type="button">Invite</button>
            <button class="b1-icon-btn" type="button" aria-label="How to play">?</button>
            <button class="b1-icon-btn" type="button" aria-label="More options">&#8942;</button>
          </div>
        </div>
        <div class="b1-status-bar">
          <span class="b1-status-label">[ ${esc(statusLabel)} ]</span>
          <span class="b1-status-text">${esc(statusText)}</span>
        </div>
      </div>`;
  }

  function b1PlayerRow(p, i) {
    const tag = statusTag(p);
    return `
      <div class="b1-row">
        <span class="b1-row-idx">${String(i + 1).padStart(2, '0')}</span>
        <span class="b1-row-name">${esc(p.name)}</span>
        <div class="b1-row-tags">
          ${p.isBot ? '<span class="b1-chip">AI</span>' : ''}
          ${p.host ? '<span class="b1-chip b1-chip-host">HOST</span>' : ''}
          ${p.isAway ? '<span class="b1-chip b1-chip-away">AWAY</span>' : ''}
        </div>
      </div>`;
  }

  function b1LobbyScreen(sizeKey) {
    return function (el, corpus) {
      const players = corpus.players[sizeKey];
      const meta = lobbyMeta(players);
      const statusLabel = 'STATUS';
      const statusText =
        meta.needsMore > 0
          ? `NEED ${meta.needsMore} MORE PLAYER${meta.needsMore === 1 ? '' : 'S'}`
          : `${players.length} PLAYERS READY`;
      el.innerHTML = `
        ${b1Chrome(statusLabel, statusText, corpus.roomCodeFormatted)}
        <div class="b1-body">
          <div class="b1-hero">
            <p class="b1-hero-label">Share this code</p>
            <p class="b1-hero-code">${esc(corpus.roomCodeFormatted)}</p>
          </div>
          <div class="b1-roster">
            ${players.map((p, i) => b1PlayerRow(p, i)).join('')}
          </div>
          <div class="b1-tools">
            <button class="b1-tool-btn" type="button">Show QR</button>
            <button class="b1-tool-btn" type="button">Open join link</button>
            ${meta.botCount < 3 && players.length < 8 ? `<button class="b1-tool-btn" type="button">Add a bot (${meta.botCount}/3)</button>` : '<span></span>'}
            <button class="b1-tool-btn" type="button">Present room</button>
          </div>
        </div>
        <div class="b1-action">
          <button class="b1-cta" type="button" ${meta.canStart ? '' : 'disabled'}>${meta.canStart ? 'Start Linejam' : `Need ${meta.needsMore} more player${meta.needsMore === 1 ? '' : 's'}`}</button>
          <button class="b1-secondary" type="button">Close room</button>
        </div>`;
    };
  }

  function b1WriteScreen(el, corpus) {
    const w = corpus.writing;
    el.innerHTML = `
      ${b1Chrome('ROUND', `${w.round} / ${w.totalRounds} \u00b7 ${w.targetWordCount} WORDS`, corpus.roomCodeFormatted)}
      <div class="b1-body">
        <div class="b1-track">
          ${Array.from({ length: w.totalRounds })
            .map((_, i) => `<span class="b1-track-seg ${i < w.round ? 'done' : ''} ${i === w.round - 1 ? 'now' : ''}"></span>`)
            .join('')}
        </div>
        <div class="b1-received">
          <p class="b1-received-label">Received line</p>
          <p class="b1-received-line">${esc(w.previousLineText)}</p>
        </div>
        <div class="b1-canvas">
          <div class="b1-chips">
            ${w.currentWords.map((word) => `<span class="b1-chip-word">${esc(word)}</span>`).join('')}
            ${Array.from({ length: Math.max(0, w.targetWordCount - w.currentWords.length) })
              .map(() => '<span class="b1-chip-empty"></span>')
              .join('')}
          </div>
          <p class="b1-charcount">12 / 500 characters</p>
        </div>
      </div>
      <div class="b1-action">
        <button class="b1-cta" type="button">Submit</button>
      </div>`;
  }

  function b1RecapScreen(el, corpus) {
    const fav = corpus.recapPoems.find((p) => p.isFavorite);
    el.innerHTML = `
      ${b1Chrome('STATUS', 'SESSION COMPLETE', corpus.roomCodeFormatted)}
      <div class="b1-body">
        <p class="b1-recap-meta">${corpus.recapPoems.length} poems &#47;&#47; 5 poets &#47;&#47; all read aloud</p>
        <div class="b1-favorite">
          <p class="b1-fav-label"><span class="b1-fav-glyph">&#9819;&#9829;</span> Room Favorite &#183; ${corpus.favoriteLeaderCount} Heart${corpus.favoriteLeaderCount === 1 ? '' : 's'}</p>
          <a class="b1-fav-line" href="#">&#8220;${esc(fav.preview)}&#8221;</a>
          <p class="b1-fav-reader">Read by ${esc(fav.reader)}</p>
        </div>
        <div class="b1-poems">
          ${corpus.recapPoems
            .map(
              (p, i) => `
            <div class="b1-poem-row">
              <span class="b1-poem-idx">${String(i + 1).padStart(2, '0')}</span>
              <div class="b1-poem-text">
                <p class="b1-poem-preview">&#8220;${esc(p.preview)}&#8221;</p>
                <p class="b1-poem-reader">Read by ${esc(p.reader)}</p>
              </div>
            </div>`
            )
            .join('')}
        </div>
      </div>
      <div class="b1-action">
        <div class="b1-recap-ctas">
          <button class="b1-cta b1-cta-grid" type="button">Start Next Round</button>
          <button class="b1-secondary b1-secondary-grid" type="button">Back to Lobby</button>
        </div>
        <div class="b1-recap-footer">
          <button class="b1-ghost-link" type="button">Share the whole set</button>
          <button class="b1-ghost-link" type="button">Exit Room</button>
        </div>
      </div>`;
  }

  window.LANE_SPECS['BRUT-1'] = {
    lane: 'brut',
    title: 'Swiss Manifest',
    move: 'Flat Swiss-print exposure: every control stays on the surface at once (labeled buttons, not icons; a numbered ledger roster with horizontal rules; a 2x2 tool grid) instead of tucking secondary actions into menus — the industrial-print half of the skill, committed to zero disclosure.',
    css: `
      .opt-BRUT-1 { height: 100%; display: flex; flex-direction: column; background: var(--color-background); color: var(--color-text-primary); font-family: var(--font-sans); overflow: hidden; }
      .opt-BRUT-1 * { border-radius: 0 !important; }
      .opt-BRUT-1 .b1-chrome { flex: none; border-bottom: 2px solid var(--color-text-primary); }
      .opt-BRUT-1 .b1-chrome-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--color-border); }
      .opt-BRUT-1 .b1-chrome-tag { font: 700 9.5px/1.3 var(--font-mono); letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--color-text-muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .opt-BRUT-1 .b1-chrome-tag b { color: var(--color-text-primary); }
      .opt-BRUT-1 .b1-chrome-actions { flex: none; display: flex; gap: 5px; }
      .opt-BRUT-1 .b1-icon-btn { width: 30px; height: 30px; border: 1px solid var(--color-text-primary); background: var(--color-surface); color: var(--color-text-primary); font: 700 12px/1 var(--font-mono); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
      .opt-BRUT-1 .b1-icon-btn.b1-invite { width: auto; padding: 0 10px; font: 700 9.5px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; background: var(--color-primary); color: var(--color-text-inverse); border-color: var(--color-primary); }
      .opt-BRUT-1 .b1-status-bar { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 7px 12px 8px; }
      .opt-BRUT-1 .b1-status-label { flex: none; font: 700 8.5px/1 var(--font-mono); letter-spacing: var(--tracking-wider); color: var(--color-primary); }
      .opt-BRUT-1 .b1-status-text { font: 700 13.5px/1.15 var(--font-sans); letter-spacing: var(--tracking-tight); text-transform: uppercase; text-align: right; }
      .opt-BRUT-1 .b1-body { flex: 1; min-height: 0; overflow: hidden; padding: 0 12px; display: flex; flex-direction: column; }
      .opt-BRUT-1 .b1-hero { flex: none; text-align: center; padding: 12px 0 10px; border-bottom: 1px solid var(--color-border); }
      .opt-BRUT-1 .b1-hero-label { margin: 0 0 4px; font: 700 8.5px/1 var(--font-mono); letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--color-text-muted); }
      .opt-BRUT-1 .b1-hero-code { margin: 0; font: 700 clamp(34px, 13vw, 48px)/0.95 var(--font-sans); letter-spacing: var(--tracking-tighter); }
      .opt-BRUT-1 .b1-roster { flex: none; border-top: 1px solid var(--color-text-primary); margin-top: 2px; }
      .opt-BRUT-1 .b1-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--color-border); }
      .opt-BRUT-1 .b1-row-idx { flex: none; width: 18px; font: 700 10px/1 var(--font-mono); color: var(--color-text-muted); }
      .opt-BRUT-1 .b1-row-name { flex: 1; min-width: 0; font: 600 13.5px/1.2 var(--font-sans); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .opt-BRUT-1 .b1-row-tags { flex: none; display: flex; gap: 3px; }
      .opt-BRUT-1 .b1-chip { font: 700 8px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; border: 1px solid var(--color-border); padding: 3px 4px; color: var(--color-text-muted); }
      .opt-BRUT-1 .b1-chip-host { border-color: var(--color-primary); color: var(--color-primary); }
      .opt-BRUT-1 .b1-chip-away { border-color: var(--color-warning); color: var(--color-warning); }
      .opt-BRUT-1 .b1-tools { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin: 8px 0; }
      .opt-BRUT-1 .b1-tool-btn { border: 1px solid var(--color-text-primary); background: var(--color-surface); color: var(--color-text-primary); font: 700 9.5px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; padding: 8px 4px; text-align: center; cursor: pointer; }
      .opt-BRUT-1 .b1-action { flex: none; border-top: 2px solid var(--color-text-primary); padding: 10px 12px 12px; background: var(--color-surface); box-shadow: var(--shadow-lg); }
      .opt-BRUT-1 .b1-cta { width: 100%; height: 48px; font: 700 12.5px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; background: var(--color-primary); color: var(--color-text-inverse); border: none; cursor: pointer; }
      .opt-BRUT-1 .b1-cta:disabled { background: var(--color-muted); color: var(--color-text-muted); }
      .opt-BRUT-1 .b1-secondary { width: 100%; height: 36px; margin-top: 6px; background: transparent; border: 1px solid var(--color-border); color: var(--color-text-secondary); font: 700 9.5px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; cursor: pointer; }
      .opt-BRUT-1 .b1-track { flex: none; display: flex; gap: 3px; margin: 12px 0; }
      .opt-BRUT-1 .b1-track-seg { flex: 1; height: 6px; background: var(--color-border); }
      .opt-BRUT-1 .b1-track-seg.done { background: var(--color-text-muted); }
      .opt-BRUT-1 .b1-track-seg.now { background: var(--color-primary); }
      .opt-BRUT-1 .b1-received { flex: none; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; margin-bottom: 12px; }
      .opt-BRUT-1 .b1-received-label { margin: 0 0 8px; font: 700 8.5px/1 var(--font-mono); letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--color-primary); }
      .opt-BRUT-1 .b1-received-line { margin: 0; font: italic 400 22px/1.35 var(--font-display); color: var(--color-text-secondary); }
      .opt-BRUT-1 .b1-canvas { flex: none; }
      .opt-BRUT-1 .b1-chips { display: flex; flex-wrap: wrap; gap: 8px; min-height: 40px; align-items: center; }
      .opt-BRUT-1 .b1-chip-word { font: 700 20px/1 var(--font-sans); padding: 8px 10px; border: 2px solid var(--color-primary); color: var(--color-text-primary); }
      .opt-BRUT-1 .b1-chip-empty { width: 34px; height: 34px; border: 2px dashed var(--color-border); }
      .opt-BRUT-1 .b1-charcount { margin: 10px 0 0; font: 10px/1 var(--font-mono); color: var(--color-text-muted); }
      .opt-BRUT-1 .b1-recap-meta { flex: none; margin: 10px 0 8px; font: 700 9.5px/1.3 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--color-text-muted); border-bottom: 1px solid var(--color-text-primary); padding-bottom: 8px; }
      .opt-BRUT-1 .b1-favorite { flex: none; margin: 0 0 8px; padding: 9px 0; border-top: 2px solid var(--color-primary); border-bottom: 2px solid var(--color-primary); }
      .opt-BRUT-1 .b1-fav-label { display: flex; align-items: center; gap: 5px; margin: 0 0 5px; font: 700 8.5px/1 var(--font-mono); letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--color-primary); }
      .opt-BRUT-1 .b1-fav-glyph { font-size: 11px; line-height: 1; }
      .opt-BRUT-1 .b1-fav-line { display: block; margin: 0 0 4px; font: 700 17px/1.15 var(--font-sans); letter-spacing: var(--tracking-tight); text-transform: uppercase; color: var(--color-text-primary); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .opt-BRUT-1 .b1-fav-reader { margin: 0; font: 700 8.5px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--color-text-muted); }
      .opt-BRUT-1 .b1-poems { flex: 1; min-height: 0; overflow: hidden; }
      .opt-BRUT-1 .b1-poem-row { display: flex; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--color-border); }
      .opt-BRUT-1 .b1-poem-idx { flex: none; width: 18px; font: 700 10px/1.4 var(--font-mono); color: var(--color-text-muted); }
      .opt-BRUT-1 .b1-poem-text { flex: 1; min-width: 0; }
      .opt-BRUT-1 .b1-poem-preview { margin: 0; font: italic 400 13.5px/1.3 var(--font-display); }
      .opt-BRUT-1 .b1-poem-reader { margin: 3px 0 0; font: 700 8.5px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--color-text-muted); }
      .opt-BRUT-1 .b1-recap-ctas { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .opt-BRUT-1 .b1-cta-grid, .opt-BRUT-1 .b1-secondary-grid { margin-top: 0; height: 44px; }
      .opt-BRUT-1 .b1-recap-footer { display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; }
      .opt-BRUT-1 .b1-ghost-link { background: none; border: none; padding: 4px 0; color: var(--color-text-muted); font: 700 9.5px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; text-decoration: underline; cursor: pointer; }
    `,
    screens: {
      'lobby-low': b1LobbyScreen('low'),
      'lobby-mid': b1LobbyScreen('mid'),
      'lobby-max': b1LobbyScreen('max'),
      write: b1WriteScreen,
      'recap-mid': b1RecapScreen,
    },
  };

  // =========================================================================
  // BRUT-2 — TACTICAL HUD: chrome and hero fused into one instrument panel;
  // secondary tools sit in a compact switch rail, not a separate hero block.
  // =========================================================================
  function b2Ticks() {
    return `
      <span class="b2-tick tl"></span><span class="b2-tick tr"></span>
      <span class="b2-tick bl"></span><span class="b2-tick br"></span>`;
  }

  function b2Hud(codeOrTitle, statusText, roomCode) {
    return `
      <div class="b2-hud">
        ${b2Ticks()}
        <div class="b2-hud-top">
          <span class="b2-hud-id">UNIT &#47;&#47; ROOM ${esc(roomCode)}</span>
          <div class="b2-hud-actions">
            <button class="b2-mini-btn" type="button" aria-label="Invite">&#8599;</button>
            <button class="b2-mini-btn" type="button" aria-label="How to play">?</button>
            <button class="b2-mini-btn" type="button" aria-label="More options">&#8942;</button>
          </div>
        </div>
        <p class="b2-hud-code">${codeOrTitle}</p>
        <div class="b2-hud-status"><span class="b2-dot"></span>${esc(statusText)}</div>
      </div>`;
  }

  function b2ListRow(label, name, code, cls) {
    return `
      <div class="b2-list-row">
        <span class="b2-callsign">${label}</span>
        <span class="b2-list-name">${esc(name)}</span>
        <span class="b2-status-code ${cls}">${code}</span>
      </div>`;
  }

  function b2LobbyScreen(sizeKey) {
    return function (el, corpus) {
      const players = corpus.players[sizeKey];
      const meta = lobbyMeta(players);
      const statusText =
        meta.needsMore > 0
          ? `NEED ${meta.needsMore} MORE PLAYER${meta.needsMore === 1 ? '' : 'S'}`
          : `${players.length} PLAYERS READY`;
      el.innerHTML = `
        ${b2Hud(esc(corpus.roomCodeFormatted), statusText, corpus.roomCodeFormatted)}
        <div class="b2-rail">
          <button class="b2-rail-btn" type="button">QR</button>
          <button class="b2-rail-btn" type="button">Link</button>
          ${meta.botCount < 3 && players.length < 8 ? `<button class="b2-rail-btn" type="button">Bot ${meta.botCount}/3</button>` : ''}
          <button class="b2-rail-btn" type="button">Present</button>
        </div>
        <div class="b2-body">
          <div class="b2-list-head">
            <span style="width:38px;flex:none;">ID</span>
            <span style="flex:1;">CALLSIGN</span>
            <span>STATUS</span>
          </div>
          <div class="b2-list">
            ${players
              .map((p, i) => {
                const tag = statusTag(p);
                return b2ListRow(callsign(i), p.name, tag.text, tag.cls);
              })
              .join('')}
          </div>
        </div>
        <div class="b2-action">
          <button class="b2-cta" type="button" ${meta.canStart ? '' : 'disabled'}>${meta.canStart ? 'Start Linejam' : `Need ${meta.needsMore} more player${meta.needsMore === 1 ? '' : 's'}`}</button>
          <button class="b2-secondary" type="button">Close room</button>
        </div>`;
    };
  }

  function b2WriteScreen(el, corpus) {
    const w = corpus.writing;
    el.innerHTML = `
      ${b2Hud(`RND ${w.round}&#47;${w.totalRounds}`, `${w.targetWordCount} WORD LINE IN PROGRESS`, corpus.roomCodeFormatted)}
      <div class="b2-body b2-write-body">
        <p class="b2-incoming-label">[ INCOMING LINE ]</p>
        <p class="b2-incoming-line">${esc(w.previousLineText)}</p>
        <div class="b2-canvas">
          <div class="b2-chips">
            ${w.currentWords.map((word) => `<span class="b2-chip-word">${esc(word)}</span>`).join('')}
            ${Array.from({ length: Math.max(0, w.targetWordCount - w.currentWords.length) })
              .map(() => '<span class="b2-chip-empty"></span>')
              .join('')}
          </div>
          <p class="b2-charcount">12&#47;500 CHARS</p>
        </div>
      </div>
      <div class="b2-action">
        <button class="b2-cta" type="button">Submit</button>
      </div>`;
  }

  function b2RecapScreen(el, corpus) {
    const fav = corpus.recapPoems.find((p) => p.isFavorite);
    el.innerHTML = `
      ${b2Hud('SESSION', 'ALL POEMS REVEALED', corpus.roomCodeFormatted)}
      <div class="b2-body">
        <div class="b2-favorite">
          <p class="b2-fav-label"><span class="b2-dot"></span> ROOM FAVORITE &#47;&#47; ${corpus.favoriteLeaderCount} HEART${corpus.favoriteLeaderCount === 1 ? '' : 'S'}</p>
          <a class="b2-fav-line" href="#">&#8220;${esc(fav.preview)}&#8221;</a>
          <p class="b2-fav-reader">${esc(fav.reader)}</p>
        </div>
        <div class="b2-list-head">
          <span style="width:38px;flex:none;">ID</span>
          <span style="flex:1;">READER &#47; LINE</span>
        </div>
        <div class="b2-list b2-poem-list">
          ${corpus.recapPoems
            .map(
              (p, i) => `
            <div class="b2-list-row b2-poem-row">
              <span class="b2-callsign">${callsign(i)}</span>
              <div class="b2-poem-text">
                <p class="b2-poem-preview">&#8220;${esc(p.preview)}&#8221;</p>
                <p class="b2-poem-reader">${esc(p.reader)}</p>
              </div>
            </div>`
            )
            .join('')}
        </div>
      </div>
      <div class="b2-action">
        <button class="b2-cta" type="button">Start Next Round</button>
        <button class="b2-secondary" type="button">Back to Lobby</button>
      </div>`;
  }

  window.LANE_SPECS['BRUT-2'] = {
    lane: 'brut',
    title: 'Tactical HUD',
    move: 'Fuse the sticky chrome bar and the hero room code into one bordered instrument panel with corner tick marks; secondary controls become a compact switch rail instead of a card grid, and the roster becomes a two-column manifest of callsigns + status codes — the CRT-terminal half of the skill.',
    css: `
      .opt-BRUT-2 { height: 100%; display: flex; flex-direction: column; background: var(--color-background); color: var(--color-text-primary); font-family: var(--font-mono); overflow: hidden; position: relative; }
      .opt-BRUT-2 * { border-radius: 0 !important; }
      .opt-BRUT-2::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, transparent, transparent 3px, color-mix(in srgb, var(--color-foreground) 4%, transparent) 3px, color-mix(in srgb, var(--color-foreground) 4%, transparent) 4px); z-index: 5; }
      .opt-BRUT-2 .b2-hud { flex: none; position: relative; margin: 10px 10px 0; padding: 10px 12px 12px; border: 1px solid var(--color-primary); background: var(--color-surface); }
      .opt-BRUT-2 .b2-tick { position: absolute; width: 9px; height: 9px; }
      .opt-BRUT-2 .b2-tick.tl { top: -1px; left: -1px; border-top: 2px solid var(--color-primary); border-left: 2px solid var(--color-primary); }
      .opt-BRUT-2 .b2-tick.tr { top: -1px; right: -1px; border-top: 2px solid var(--color-primary); border-right: 2px solid var(--color-primary); }
      .opt-BRUT-2 .b2-tick.bl { bottom: -1px; left: -1px; border-bottom: 2px solid var(--color-primary); border-left: 2px solid var(--color-primary); }
      .opt-BRUT-2 .b2-tick.br { bottom: -1px; right: -1px; border-bottom: 2px solid var(--color-primary); border-right: 2px solid var(--color-primary); }
      .opt-BRUT-2 .b2-hud-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
      .opt-BRUT-2 .b2-hud-id { font: 700 8.5px/1 var(--font-mono); letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
      .opt-BRUT-2 .b2-hud-actions { flex: none; display: flex; gap: 4px; }
      .opt-BRUT-2 .b2-mini-btn { width: 24px; height: 24px; border: 1px solid var(--color-border); background: transparent; color: var(--color-text-secondary); font: 700 10px/1 var(--font-mono); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
      .opt-BRUT-2 .b2-hud-code { margin: 0 0 6px; font: 700 clamp(30px, 11.5vw, 42px)/1 var(--font-sans); letter-spacing: var(--tracking-tighter); }
      .opt-BRUT-2 .b2-hud-status { display: flex; align-items: center; gap: 6px; font: 700 10.5px/1.3 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--color-primary); }
      .opt-BRUT-2 .b2-dot { width: 6px; height: 6px; flex: none; background: var(--color-primary); }
      .opt-BRUT-2 .b2-rail { flex: none; display: flex; gap: 5px; padding: 8px 10px; }
      .opt-BRUT-2 .b2-rail-btn { flex: 1; border: 1px solid var(--color-border); background: transparent; color: var(--color-text-secondary); font: 700 8.5px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; padding: 7px 3px; text-align: center; cursor: pointer; }
      .opt-BRUT-2 .b2-body { flex: 1; min-height: 0; overflow: hidden; padding: 0 10px; display: flex; flex-direction: column; }
      .opt-BRUT-2 .b2-list-head { flex: none; display: flex; gap: 6px; font: 700 8px/1 var(--font-mono); letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--color-text-muted); padding: 5px 4px; border-bottom: 1px solid var(--color-text-primary); }
      .opt-BRUT-2 .b2-favorite { flex: none; margin-bottom: 6px; padding: 7px 8px; border: 1px solid var(--color-primary); background: color-mix(in srgb, var(--color-primary) 8%, transparent); }
      .opt-BRUT-2 .b2-fav-label { display: flex; align-items: center; gap: 5px; margin: 0 0 5px; font: 700 8px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--color-primary); }
      .opt-BRUT-2 .b2-fav-line { display: block; margin: 0 0 4px; font: italic 400 13px/1.3 var(--font-display); color: var(--color-text-primary); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .opt-BRUT-2 .b2-fav-reader { margin: 0; font: 700 8px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--color-text-muted); }
      .opt-BRUT-2 .b2-list { flex: none; }
      .opt-BRUT-2 .b2-list-row { display: flex; align-items: center; gap: 6px; padding: 6px 4px; border-bottom: 1px solid var(--color-border); }
      .opt-BRUT-2 .b2-callsign { flex: none; width: 38px; font: 700 10px/1 var(--font-mono); color: var(--color-primary); }
      .opt-BRUT-2 .b2-list-name { flex: 1; min-width: 0; font: 600 12.5px/1.2 var(--font-sans); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .opt-BRUT-2 .b2-status-code { flex: none; font: 700 8px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--color-text-muted); }
      .opt-BRUT-2 .b2-status-code.host { color: var(--color-primary); }
      .opt-BRUT-2 .b2-status-code.away { color: var(--color-warning); }
      .opt-BRUT-2 .b2-action { flex: none; border-top: 1px solid var(--color-primary); padding: 10px; background: var(--color-surface); box-shadow: var(--shadow-md); position: relative; z-index: 6; }
      .opt-BRUT-2 .b2-cta { width: 100%; height: 46px; background: var(--color-primary); color: var(--color-text-inverse); border: none; font: 700 11.5px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; cursor: pointer; }
      .opt-BRUT-2 .b2-cta:disabled { background: var(--color-muted); color: var(--color-text-muted); }
      .opt-BRUT-2 .b2-secondary { width: 100%; height: 32px; margin-top: 6px; background: transparent; border: 1px solid var(--color-border); color: var(--color-text-muted); font: 700 8.5px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; cursor: pointer; }
      .opt-BRUT-2 .b2-write-body { padding-top: 10px; }
      .opt-BRUT-2 .b2-incoming-label { flex: none; margin: 0 0 8px; font: 700 8.5px/1 var(--font-mono); letter-spacing: var(--tracking-wider); color: var(--color-primary); }
      .opt-BRUT-2 .b2-incoming-line { flex: none; margin: 0 0 14px; padding-bottom: 12px; border-bottom: 1px solid var(--color-border); font: italic 400 19px/1.35 var(--font-display); color: var(--color-text-secondary); }
      .opt-BRUT-2 .b2-canvas { flex: none; }
      .opt-BRUT-2 .b2-chips { display: flex; flex-wrap: wrap; gap: 7px; min-height: 36px; align-items: center; }
      .opt-BRUT-2 .b2-chip-word { font: 700 17px/1 var(--font-sans); padding: 7px 9px; border: 2px solid var(--color-primary); }
      .opt-BRUT-2 .b2-chip-empty { width: 30px; height: 30px; border: 2px dashed var(--color-border); }
      .opt-BRUT-2 .b2-charcount { margin: 10px 0 0; font: 9.5px/1 var(--font-mono); color: var(--color-text-muted); letter-spacing: var(--tracking-wide); }
      .opt-BRUT-2 .b2-poem-list { flex: 1; min-height: 0; overflow: hidden; }
      .opt-BRUT-2 .b2-poem-row { align-items: flex-start; padding: 6px 4px; }
      .opt-BRUT-2 .b2-poem-text { flex: 1; min-width: 0; }
      .opt-BRUT-2 .b2-poem-preview { margin: 0; font: italic 400 12.5px/1.3 var(--font-display); color: var(--color-text-primary); }
      .opt-BRUT-2 .b2-poem-reader { margin: 3px 0 0; font: 700 8px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--color-text-muted); }
    `,
    screens: {
      'lobby-low': b2LobbyScreen('low'),
      'lobby-mid': b2LobbyScreen('mid'),
      'lobby-max': b2LobbyScreen('max'),
      write: b2WriteScreen,
      'recap-mid': b2RecapScreen,
    },
  };

  // =========================================================================
  // BRUT-3 — LEDGER GRID: a literal CSS Grid dossier. gap:1px hairlines via
  // background/foreground contrast (skill directive #1), a letterhead block,
  // a real columned table, and a boxed authorization footer.
  // =========================================================================
  function b3Letterhead(subtitle, roomCode) {
    return `
      <div class="b3-letterhead">
        <div class="b3-lh-title">LINEJAM<br><b>${esc(subtitle)}</b></div>
        <div class="b3-lh-code">
          <p class="b3-lh-code-label">Room code</p>
          <p class="b3-lh-code-val">${esc(roomCode)}</p>
        </div>
      </div>
      <div class="b3-status-row">
        <span class="b3-status-row-tag">[ DOSSIER &#47;&#47; SHARE ${esc(roomCode)} TO JOIN ]</span>
        <div class="b3-icons">
          <button class="b3-icon-sm" type="button" aria-label="Invite">&#8599;</button>
          <button class="b3-icon-sm" type="button" aria-label="How to play">?</button>
          <button class="b3-icon-sm" type="button" aria-label="More options">&#8942;</button>
        </div>
      </div>`;
  }

  function b3LobbyScreen(sizeKey) {
    return function (el, corpus) {
      const players = corpus.players[sizeKey];
      const meta = lobbyMeta(players);
      const statusText =
        meta.needsMore > 0
          ? `NEED ${meta.needsMore} MORE PLAYER${meta.needsMore === 1 ? '' : 'S'}`
          : `${players.length}/8 PLAYERS READY`;
      el.innerHTML = `
        ${b3Letterhead(statusText, corpus.roomCodeFormatted)}
        <div class="b3-body">
          <div class="b3-table">
            <div class="b3-th">ID</div><div class="b3-th">CALLSIGN</div><div class="b3-th">STATUS</div>
            ${players
              .map((p, i) => {
                const tag = statusTag(p);
                return `
                <div class="b3-cell-idx">${callsign(i)}</div>
                <div>${esc(p.name)}</div>
                <div class="b3-cell-status ${tag.cls}">${tag.text}</div>`;
              })
              .join('')}
          </div>
          <div class="b3-tools">
            <button type="button">QR code</button>
            <button type="button">Join link</button>
            ${meta.botCount < 3 && players.length < 8 ? `<button type="button">Bot ${meta.botCount}&#47;3</button>` : '<span></span>'}
          </div>
        </div>
        <div class="b3-authblock">
          <button class="b3-cta" type="button" ${meta.canStart ? '' : 'disabled'}>${meta.canStart ? 'Start Linejam' : `Need ${meta.needsMore} more player${meta.needsMore === 1 ? '' : 's'}`}</button>
          <button class="b3-secondary" type="button">Close room</button>
        </div>`;
    };
  }

  function b3WriteScreen(el, corpus) {
    const w = corpus.writing;
    el.innerHTML = `
      ${b3Letterhead(`ROUND ${w.round}/${w.totalRounds} // ${w.targetWordCount}-WORD LINE`, corpus.roomCodeFormatted)}
      <div class="b3-body">
        <div class="b3-received-block">
          <p class="b3-received-label">RECEIVED LINE</p>
          <p class="b3-received-line">${esc(w.previousLineText)}</p>
        </div>
        <div class="b3-canvas">
          <div class="b3-chips">
            ${w.currentWords.map((word) => `<span class="b3-chip-word">${esc(word)}</span>`).join('')}
            ${Array.from({ length: Math.max(0, w.targetWordCount - w.currentWords.length) })
              .map(() => '<span class="b3-chip-empty"></span>')
              .join('')}
          </div>
          <p class="b3-charcount">12&#47;500 CHARACTERS</p>
        </div>
      </div>
      <div class="b3-authblock">
        <button class="b3-cta" type="button">Submit</button>
      </div>`;
  }

  function b3RecapScreen(el, corpus) {
    const fav = corpus.recapPoems.find((p) => p.isFavorite);
    el.innerHTML = `
      ${b3Letterhead('SESSION COMPLETE', corpus.roomCodeFormatted)}
      <div class="b3-body">
        <div class="b3-fav-block">
          <div class="b3-fav-label">ROOM FAVORITE &#183; ${corpus.favoriteLeaderCount} HEART${corpus.favoriteLeaderCount === 1 ? '' : 'S'}</div>
          <div class="b3-fav-idx">&#9819;&#9829;</div>
          <div class="b3-fav-line"><a href="#">&#8220;${esc(fav.preview)}&#8221;</a></div>
          <div class="b3-fav-reader">${esc(fav.reader)}</div>
        </div>
        <div class="b3-table b3-poem-table">
          <div class="b3-th">ID</div><div class="b3-th">LINE</div><div class="b3-th">READER</div>
          ${corpus.recapPoems
            .map(
              (p, i) => `
            <div class="b3-cell-idx">${callsign(i)}</div>
            <div class="b3-cell-poem">&#8220;${esc(p.preview)}&#8221;</div>
            <div class="b3-cell-status">${esc(p.reader)}</div>`
            )
            .join('')}
        </div>
      </div>
      <div class="b3-authblock">
        <div class="b3-recap-ctas">
          <button class="b3-cta b3-cta-grid" type="button">Start Next Round</button>
          <button class="b3-secondary b3-secondary-grid" type="button">Back to Lobby</button>
        </div>
      </div>`;
  }

  window.LANE_SPECS['BRUT-3'] = {
    lane: 'brut',
    title: 'Ledger Grid',
    move: 'Render the whole room as a literal CSS Grid dossier: a two-column letterhead block, a real columned table (ID / callsign / status) with gap:1px hairline dividers instead of individual borders, and a boxed "authorization" footer standing in for the action zone — the most document-like of the three.',
    css: `
      .opt-BRUT-3 { height: 100%; display: flex; flex-direction: column; background: var(--color-background); color: var(--color-text-primary); font-family: var(--font-sans); overflow: hidden; }
      .opt-BRUT-3 * { border-radius: 0 !important; }
      .opt-BRUT-3 .b3-letterhead { flex: none; display: grid; grid-template-columns: 1fr auto; gap: 1px; background: var(--color-border); border-bottom: 2px solid var(--color-text-primary); }
      .opt-BRUT-3 .b3-letterhead > div { background: var(--color-surface); padding: 9px 12px; }
      .opt-BRUT-3 .b3-lh-title { font: 700 9px/1.5 var(--font-mono); letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--color-text-muted); }
      .opt-BRUT-3 .b3-lh-title b { color: var(--color-text-primary); }
      .opt-BRUT-3 .b3-lh-code { text-align: right; }
      .opt-BRUT-3 .b3-lh-code-label { margin: 0 0 3px; font: 700 7.5px/1 var(--font-mono); letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--color-text-muted); }
      .opt-BRUT-3 .b3-lh-code-val { margin: 0; font: 700 21px/1 var(--font-sans); letter-spacing: var(--tracking-tight); }
      .opt-BRUT-3 .b3-status-row { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 12px; border-bottom: 1px solid var(--color-border); background: var(--color-muted); }
      .opt-BRUT-3 .b3-status-row-tag { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 8.5px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--color-primary); }
      .opt-BRUT-3 .b3-icons { flex: none; display: flex; gap: 4px; }
      .opt-BRUT-3 .b3-icon-sm { width: 24px; height: 24px; border: 1px solid var(--color-text-primary); background: var(--color-surface); font: 700 10px/1 var(--font-mono); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
      .opt-BRUT-3 .b3-body { flex: 1; min-height: 0; overflow: hidden; padding: 8px 12px; display: flex; flex-direction: column; }
      .opt-BRUT-3 .b3-table { flex: none; display: grid; grid-template-columns: 30px 1fr auto; gap: 1px; background: var(--color-border); border: 1px solid var(--color-text-primary); align-content: start; }
      .opt-BRUT-3 .b3-table > div { background: var(--color-surface); padding: 5px 6px; font: 600 11px/1.25 var(--font-sans); display: flex; align-items: center; }
      .opt-BRUT-3 .b3-table .b3-th { background: var(--color-text-primary); color: var(--color-text-inverse); font: 700 7.5px/1 var(--font-mono); letter-spacing: var(--tracking-wider); text-transform: uppercase; padding: 5px 6px; }
      .opt-BRUT-3 .b3-cell-idx { font: 700 9.5px/1.25 var(--font-mono); color: var(--color-text-muted); }
      .opt-BRUT-3 .b3-cell-status { font: 700 8px/1.25 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--color-text-muted); justify-content: flex-end; text-align: right; }
      .opt-BRUT-3 .b3-cell-status.host { color: var(--color-primary); }
      .opt-BRUT-3 .b3-cell-status.away { color: var(--color-warning); }
      .opt-BRUT-3 .b3-fav-block { flex: none; display: grid; grid-template-columns: 30px 1fr auto; gap: 1px; background: var(--color-border); border: 2px solid var(--color-primary); margin-bottom: 8px; }
      .opt-BRUT-3 .b3-fav-block > div { background: var(--color-surface); padding: 5px 6px; display: flex; align-items: center; min-width: 0; }
      .opt-BRUT-3 .b3-fav-label { grid-column: 1 / -1; background: var(--color-primary); color: var(--color-text-inverse); font: 700 7.5px/1 var(--font-mono); letter-spacing: var(--tracking-wider); text-transform: uppercase; }
      .opt-BRUT-3 .b3-fav-idx { font-size: 11px; }
      .opt-BRUT-3 .b3-fav-line a { display: block; width: 100%; font: italic 400 11.5px/1.3 var(--font-display); color: var(--color-text-primary); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .opt-BRUT-3 .b3-fav-reader { font: 700 8px/1.25 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--color-text-muted); justify-content: flex-end; text-align: right; }
      .opt-BRUT-3 .b3-tools { flex: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--color-border); border: 1px solid var(--color-border); margin-top: 8px; }
      .opt-BRUT-3 .b3-tools > button { background: var(--color-surface); border: none; font: 700 8.5px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; padding: 8px 4px; color: var(--color-text-primary); cursor: pointer; }
      .opt-BRUT-3 .b3-authblock { flex: none; margin: 8px 12px 12px; border: 2px solid var(--color-text-primary); padding: 12px 10px 10px; position: relative; }
      .opt-BRUT-3 .b3-authblock::before { content: '[ AUTHORIZATION ]'; position: absolute; top: -8px; left: 8px; background: var(--color-background); padding: 0 5px; font: 700 7.5px/1 var(--font-mono); letter-spacing: var(--tracking-wider); color: var(--color-text-muted); }
      .opt-BRUT-3 .b3-cta { width: 100%; height: 46px; background: var(--color-primary); color: var(--color-text-inverse); border: none; font: 700 11.5px/1 var(--font-sans); letter-spacing: var(--tracking-tight); text-transform: uppercase; cursor: pointer; }
      .opt-BRUT-3 .b3-cta:disabled { background: var(--color-muted); color: var(--color-text-muted); }
      .opt-BRUT-3 .b3-secondary { width: 100%; height: 32px; margin-top: 6px; background: transparent; border: 1px solid var(--color-border); color: var(--color-text-secondary); font: 700 8.5px/1 var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; cursor: pointer; }
      .opt-BRUT-3 .b3-recap-ctas { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .opt-BRUT-3 .b3-cta-grid, .opt-BRUT-3 .b3-secondary-grid { margin-top: 0; height: 42px; }
      .opt-BRUT-3 .b3-received-block { flex: none; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--color-border); }
      .opt-BRUT-3 .b3-received-label { margin: 0 0 8px; font: 700 8px/1 var(--font-mono); letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--color-primary); }
      .opt-BRUT-3 .b3-received-line { margin: 0; font: italic 400 20px/1.35 var(--font-display); color: var(--color-text-secondary); }
      .opt-BRUT-3 .b3-canvas { flex: none; }
      .opt-BRUT-3 .b3-chips { display: flex; flex-wrap: wrap; gap: 7px; min-height: 38px; align-items: center; }
      .opt-BRUT-3 .b3-chip-word { font: 700 18px/1 var(--font-sans); padding: 7px 9px; border: 2px solid var(--color-primary); }
      .opt-BRUT-3 .b3-chip-empty { width: 32px; height: 32px; border: 2px dashed var(--color-border); }
      .opt-BRUT-3 .b3-charcount { margin: 10px 0 0; font: 9.5px/1 var(--font-mono); color: var(--color-text-muted); }
      .opt-BRUT-3 .b3-poem-table { grid-template-columns: 30px 1fr auto; }
      .opt-BRUT-3 .b3-cell-poem { font: italic 400 11.5px/1.3 var(--font-display); }
    `,
    screens: {
      'lobby-low': b3LobbyScreen('low'),
      'lobby-mid': b3LobbyScreen('mid'),
      'lobby-max': b3LobbyScreen('max'),
      write: b3WriteScreen,
      'recap-mid': b3RecapScreen,
    },
  };
})();
