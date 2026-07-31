// SWISS lane — Swiss International Style: 12-unit grid discipline, opacity-
// based hierarchy (never a second hue), one accent (var(--color-primary))
// used only at varying opacity, rectilinear structural elements (radius-sm
// at most), and generous token-driven whitespace as structure. Three
// structurally distinct systems for composing chrome + hero + roster +
// action zone, all rendered through the real Linejam tokens.
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  function esc(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  function initials(name) {
    return esc(String(name).trim().charAt(0).toUpperCase());
  }

  // Shared lobby-state derivation (min party size 2, room cap 8, max bots 3)
  // — real product rules, not corpus text, so every option computes them
  // identically from the same players array.
  function lobbyState(corpus, sizeKey) {
    const players = corpus.players[sizeKey];
    const minPlayers = 2;
    const needsMore = Math.max(0, minPlayers - players.length);
    const canStart = players.length >= minPlayers;
    const bots = players.filter((p) => p.isBot).length;
    const canAddBot = bots < 3 && players.length < 8;
    const title =
      needsMore > 0
        ? `Need ${needsMore} more player${needsMore === 1 ? '' : 's'}`
        : `${players.length} players ready`;
    const sub =
      needsMore > 0
        ? `Share ${corpus.roomCodeFormatted} to start.`
        : `Start when you\u2019re ready.`;
    return { players, needsMore, canStart, bots, canAddBot, title, sub };
  }

  // ==========================================================================
  // SWISS-1 — Module Grid: chrome + content laid out as numbered index
  // sections divided by hairlines; roster is a tabular index list.
  // ==========================================================================

  function s1Chrome(code, title, sub) {
    return `
      <div class="s1-chrome">
        <div class="s1-cell s1-code">${esc(code)}</div>
        <div class="s1-cell s1-title-cell">
          <p class="s1-title">${esc(title)}</p>
          ${sub ? `<p class="s1-sub">${esc(sub)}</p>` : ''}
        </div>
        <button class="s1-cell s1-icon" type="button">Invite</button>
        <button class="s1-cell s1-icon" type="button" aria-label="How to play">?</button>
        <button class="s1-cell s1-icon" type="button" aria-label="More options">&#8942;</button>
      </div>`;
  }

  function s1PlayerRow(p, i) {
    return `
      <li class="s1-row">
        <span class="s1-row-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="s1-row-name">${esc(p.name)}</span>
        <span class="s1-row-tags">
          ${p.host ? '<b class="s1-tag s1-tag-accent">Host</b>' : ''}
          ${p.isBot ? '<b class="s1-tag">AI</b>' : ''}
          ${p.isAway ? '<b class="s1-tag s1-tag-muted">Away</b>' : ''}
        </span>
      </li>`;
  }

  function s1Lobby(sizeKey) {
    return function (el, corpus) {
      const st = lobbyState(corpus, sizeKey);
      el.innerHTML = `
        ${s1Chrome(corpus.roomCodeFormatted, st.title, st.sub)}
        <div class="s1-body">
          <div class="s1-section">
            <p class="s1-index">00 &#8212; Share code</p>
            <p class="s1-code">${esc(corpus.roomCodeFormatted)}</p>
          </div>
          <div class="s1-section s1-section-roster">
            <p class="s1-index">01 &#8212; Players (${st.players.length})</p>
            <ul class="s1-roster" data-scroll-exempt="8-player roster scrolls internally at max party size; hero, controls, and action zone stay always visible">
              ${st.players.map((p, i) => s1PlayerRow(p, i)).join('')}
            </ul>
          </div>
          <div class="s1-section">
            <p class="s1-index">02 &#8212; Room controls</p>
            <div class="s1-controls-grid">
              <div class="s1-qr" aria-hidden="true">QR</div>
              <div class="s1-controls-stack">
                <a class="s1-link" href="#">Open join link</a>
                ${st.canAddBot ? `<button class="s1-btn-outline" type="button">Add a bot (${st.bots}/3)</button>` : ''}
                <button class="s1-btn-outline" type="button">Present room</button>
              </div>
            </div>
          </div>
        </div>
        <div class="s1-action">
          <p class="s1-action-status">${esc(st.canStart ? `${st.players.length} ready to play.` : `Need ${st.needsMore} more player${st.needsMore === 1 ? '' : 's'}.`)}</p>
          <div class="s1-action-row">
            <button class="s1-cta" type="button" ${st.canStart ? '' : 'disabled'}>Start</button>
            <button class="s1-secondary" type="button">Close room</button>
          </div>
        </div>`;
    };
  }

  function s1Write(el, corpus) {
    const w = corpus.writing;
    const empty = Math.max(0, w.targetWordCount - w.currentWords.length);
    el.innerHTML = `
      ${s1Chrome(corpus.roomCodeFormatted, `Round ${w.round} of ${w.totalRounds}`, `${w.targetWordCount} word line`)}
      <div class="s1-body">
        <div class="s1-section">
          <p class="s1-index">00 &#8212; Received line</p>
          <p class="s1-received">\u201C${esc(w.previousLineText)}\u201D</p>
        </div>
        <div class="s1-section">
          <p class="s1-index">01 &#8212; Your words (${w.currentWords.length} / ${w.targetWordCount})</p>
          <div class="s1-chips">
            ${w.currentWords.map((word) => `<span class="s1-chip s1-chip-filled">${esc(word)}</span>`).join('')}
            ${Array.from({ length: empty })
              .map(() => '<span class="s1-chip s1-chip-empty" aria-hidden="true"></span>')
              .join('')}
          </div>
          <p class="s1-charcount">12 / 500 characters</p>
        </div>
      </div>
      <div class="s1-action">
        <p class="s1-action-status">Submit when your line is ready.</p>
        <div class="s1-action-row">
          <button class="s1-cta" type="button">Submit</button>
        </div>
      </div>`;
  }

  function s1Recap(el, corpus) {
    const fav = corpus.recapPoems.find((p) => p.isFavorite);
    el.innerHTML = `
      ${s1Chrome(corpus.roomCodeFormatted, 'All poems revealed', '')}
      <div class="s1-body">
        <div class="s1-section">
          <p class="s1-index">00 &#8212; Session complete</p>
          <p class="s1-recap-body">Replay the set below, then start another round or head back to the lobby.</p>
        </div>
        <div class="s1-section">
          <p class="s1-index s1-index-accent">01 &#8212; Room favorite \u00B7 ${corpus.favoriteLeaderCount} heart${corpus.favoriteLeaderCount === 1 ? '' : 's'}</p>
          <div class="s1-favorite">
            <p class="s1-fav-preview">\u201C${esc(fav.preview)}\u201D</p>
            <p class="s1-fav-reader">Read by ${esc(fav.reader)}</p>
          </div>
        </div>
        <div class="s1-section">
          <p class="s1-index">02 &#8212; Poems (${corpus.recapPoems.length})</p>
          ${corpus.recapPoems
            .map(
              (p, i) => `
            <div class="s1-poem-row">
              <p class="s1-poem-meta">${String(i + 1).padStart(2, '0')} \u00B7 ${esc(p.reader)}</p>
              <p class="s1-poem-preview">\u201C${esc(p.preview)}\u201D</p>
            </div>`
            )
            .join('')}
        </div>
      </div>
      <div class="s1-action">
        <p class="s1-action-status">Play another round, or head back to the lobby.</p>
        <div class="s1-action-row">
          <button class="s1-cta" type="button">Start</button>
          <button class="s1-secondary" type="button">Lobby</button>
        </div>
        <p class="s1-exit">Exit room</p>
      </div>`;
  }

  window.LANE_SPECS['SWISS-1'] = {
    lane: 'swiss',
    title: 'Module Grid',
    move: 'Chrome, hero, roster, and controls render as numbered index sections divided by hairlines on one accent at varying opacity — a visible module grid instead of padded cards.',
    css: `
      .opt-SWISS-1 { height: 100%; display: flex; flex-direction: column; overflow: hidden; background: var(--color-background); color: var(--color-text-primary); font-family: var(--font-sans); }
      .opt-SWISS-1 button { font-family: var(--font-sans); }
      .opt-SWISS-1 button:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
      .opt-SWISS-1 .s1-chrome { flex: none; display: flex; align-items: stretch; border-bottom: 1px solid var(--color-border); background: var(--color-surface); }
      .opt-SWISS-1 .s1-cell { display: flex; align-items: center; }
      .opt-SWISS-1 .s1-code { flex: none; padding: var(--space-2); font-family: var(--font-mono); font-weight: 700; font-size: var(--text-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-secondary); border-right: 1px solid var(--color-border); }
      .opt-SWISS-1 .s1-title-cell { flex: 1; min-width: 0; padding: var(--space-2); flex-direction: column; align-items: flex-start; justify-content: center; }
      .opt-SWISS-1 .s1-title { margin: 0; font-weight: 600; font-size: var(--text-sm); line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
      .opt-SWISS-1 .s1-sub { margin: 2px 0 0; font-weight: 400; font-size: var(--text-xs); line-height: 1.2; color: color-mix(in srgb, var(--color-text-primary) 60%, transparent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
      .opt-SWISS-1 .s1-icon { flex: none; min-width: var(--space-5); padding: 0 var(--space-2); font-weight: 600; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.02em; background: transparent; border: none; border-left: 1px solid var(--color-border); color: var(--color-text-secondary); cursor: pointer; justify-content: center; }
      .opt-SWISS-1 .s1-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .opt-SWISS-1 .s1-section { padding: var(--space-3) var(--space-3) var(--space-2); border-top: 1px solid var(--color-border-subtle); }
      .opt-SWISS-1 .s1-section:first-child { border-top: none; }
      .opt-SWISS-1 .s1-section-roster { flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .opt-SWISS-1 .s1-index { margin: 0 0 var(--space-2); font-family: var(--font-mono); font-weight: 700; font-size: var(--text-xs); letter-spacing: 0.1em; text-transform: uppercase; color: color-mix(in srgb, var(--color-text-primary) 45%, transparent); }
      .opt-SWISS-1 .s1-index-accent { color: var(--color-primary); }
      .opt-SWISS-1 .s1-code.s1-cell { border-right: 1px solid var(--color-border); }
      .opt-SWISS-1 p.s1-code { margin: 0; font-family: var(--font-display); font-weight: 500; font-size: var(--text-2xl); line-height: 1; letter-spacing: 0.08em; }
      .opt-SWISS-1 .s1-roster { flex: 1; min-height: 0; overflow-y: auto; list-style: none; margin: 0; padding: 0; }
      .opt-SWISS-1 .s1-row { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-1) 0; border-bottom: 1px solid var(--color-border-subtle); }
      .opt-SWISS-1 .s1-row:last-child { border-bottom: none; }
      .opt-SWISS-1 .s1-row-num { flex: none; width: 1.6em; font-family: var(--font-mono); font-weight: 600; font-size: var(--text-xs); font-variant-numeric: tabular-nums; color: color-mix(in srgb, var(--color-text-primary) 40%, transparent); }
      .opt-SWISS-1 .s1-row-name { flex: 1; min-width: 0; font-weight: 500; font-size: var(--text-sm); line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .opt-SWISS-1 .s1-row-tags { flex: none; display: flex; gap: var(--space-1); }
      .opt-SWISS-1 .s1-tag { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-xs); letter-spacing: 0.06em; text-transform: uppercase; padding: 2px var(--space-1); border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: color-mix(in srgb, var(--color-text-primary) 55%, transparent); }
      .opt-SWISS-1 .s1-tag-accent { border-color: var(--color-primary); color: var(--color-primary); }
      .opt-SWISS-1 .s1-tag-muted { color: color-mix(in srgb, var(--color-text-primary) 38%, transparent); }
      .opt-SWISS-1 .s1-controls-grid { display: flex; gap: var(--space-2); align-items: flex-start; }
      .opt-SWISS-1 .s1-qr { flex: none; width: var(--space-6); height: var(--space-6); border: 1px solid var(--color-border); display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-weight: 700; font-size: var(--text-xs); color: color-mix(in srgb, var(--color-text-primary) 50%, transparent); background: repeating-conic-gradient(color-mix(in srgb, var(--color-text-primary) 65%, transparent) 0% 25%, transparent 0% 50%) 0 0 / 8px 8px; }
      .opt-SWISS-1 .s1-controls-stack { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-1); }
      .opt-SWISS-1 .s1-link { font-weight: 500; font-size: var(--text-xs); color: var(--color-primary); text-decoration: underline; }
      .opt-SWISS-1 .s1-btn-outline { width: 100%; text-align: left; padding: var(--space-1) var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: transparent; color: var(--color-text-primary); font-weight: 600; font-size: var(--text-xs); letter-spacing: 0.02em; text-transform: uppercase; cursor: pointer; }
      .opt-SWISS-1 .s1-action { flex: none; padding: var(--space-3); border-top: 1px solid var(--color-border); background: var(--color-surface); }
      .opt-SWISS-1 .s1-action-status { margin: 0 0 var(--space-2); font-weight: 500; font-size: var(--text-xs); color: color-mix(in srgb, var(--color-text-primary) 60%, transparent); }
      .opt-SWISS-1 .s1-action-row { display: flex; gap: var(--space-2); }
      .opt-SWISS-1 .s1-cta { flex: 1; min-height: 44px; border: 1px solid var(--color-primary); border-radius: var(--radius-sm); background: var(--color-primary); color: var(--color-text-inverse); font-weight: 600; font-size: var(--text-sm); letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; }
      .opt-SWISS-1 .s1-cta:disabled { background: color-mix(in srgb, var(--color-primary) 25%, var(--color-surface)); border-color: color-mix(in srgb, var(--color-primary) 25%, var(--color-surface)); color: color-mix(in srgb, var(--color-text-inverse) 70%, transparent); cursor: not-allowed; }
      .opt-SWISS-1 .s1-secondary { flex: none; min-height: 44px; padding: 0 var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: transparent; color: var(--color-text-primary); font-weight: 600; font-size: var(--text-xs); letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; }
      .opt-SWISS-1 .s1-received { margin: 0; font-family: var(--font-display); font-style: italic; font-weight: 500; font-size: var(--text-lg); line-height: 1.4; color: var(--color-text-secondary); }
      .opt-SWISS-1 .s1-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: var(--space-2) 0; }
      .opt-SWISS-1 .s1-chip { display: inline-flex; align-items: center; justify-content: center; padding: var(--space-1) var(--space-2); font-family: var(--font-display); font-weight: 500; font-size: var(--text-base); border-radius: var(--radius-sm); }
      .opt-SWISS-1 .s1-chip-filled { border: 1px solid var(--color-primary); background: color-mix(in srgb, var(--color-primary) 10%, transparent); }
      .opt-SWISS-1 .s1-chip-empty { min-width: 2.75em; min-height: 1.2em; border: 1px dashed var(--color-border); }
      .opt-SWISS-1 .s1-charcount { margin: 0; font-family: var(--font-mono); font-weight: 500; font-size: var(--text-xs); font-variant-numeric: tabular-nums; color: color-mix(in srgb, var(--color-text-primary) 45%, transparent); }
      .opt-SWISS-1 .s1-recap-body { margin: 0; font-weight: 400; font-size: var(--text-sm); line-height: 1.5; color: var(--color-text-secondary); max-width: 32ch; }
      .opt-SWISS-1 .s1-poem-row { display: flex; flex-direction: column; gap: 2px; padding: var(--space-1) 0; border-bottom: 1px solid var(--color-border-subtle); }
      .opt-SWISS-1 .s1-poem-row:last-child { border-bottom: none; }
      .opt-SWISS-1 .s1-poem-meta { margin: 0; font-family: var(--font-mono); font-weight: 700; font-size: var(--text-xs); letter-spacing: 0.04em; text-transform: uppercase; color: color-mix(in srgb, var(--color-text-primary) 45%, transparent); }
      .opt-SWISS-1 .s1-poem-preview { margin: 0; font-family: var(--font-display); font-style: italic; font-weight: 500; font-size: var(--text-sm); line-height: 1.3; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .opt-SWISS-1 .s1-favorite { display: flex; flex-direction: column; gap: 2px; }
      .opt-SWISS-1 .s1-fav-preview { margin: 0; font-family: var(--font-display); font-style: italic; font-weight: 500; font-size: var(--text-sm); line-height: 1.3; color: var(--color-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .opt-SWISS-1 .s1-fav-reader { margin: 2px 0 0; font-family: var(--font-mono); font-weight: 700; font-size: var(--text-xs); letter-spacing: 0.04em; text-transform: uppercase; color: color-mix(in srgb, var(--color-text-primary) 55%, transparent); }
      .opt-SWISS-1 .s1-exit { margin: var(--space-2) 0 0; text-align: center; font-family: var(--font-mono); font-weight: 600; font-size: var(--text-xs); letter-spacing: 0.06em; text-transform: uppercase; color: color-mix(in srgb, var(--color-text-primary) 40%, transparent); }
      @media (prefers-reduced-motion: no-preference) {
        .opt-SWISS-1 button { transition: background var(--duration-fast) var(--ease-theme), border-color var(--duration-fast) var(--ease-theme); }
      }
    `,
    screens: {
      'lobby-low': s1Lobby('low'),
      'lobby-mid': s1Lobby('mid'),
      'lobby-max': s1Lobby('max'),
      write: s1Write,
      'recap-mid': s1Recap,
    },
  };

  // ==========================================================================
  // SWISS-2 — Split Spine: chrome and room-code hero merge into one
  // persistent header band; roster and poems render as a tabular hairline
  // grid (background-gap dividers); action zone is one slim row.
  // ==========================================================================

  function s2Header(code, title, sub) {
    return `
      <header class="s2-header">
        <div class="s2-header-row">
          <p class="s2-code">${esc(code)}</p>
          <div class="s2-icons">
            <button class="s2-icon" type="button">Invite</button>
            <button class="s2-icon" type="button" aria-label="How to play">?</button>
            <button class="s2-icon" type="button" aria-label="More options">&#8942;</button>
          </div>
        </div>
        <p class="s2-status">${esc(title)}${sub ? ` \u00B7 ${esc(sub)}` : ''}</p>
      </header>`;
  }

  function s2RosterCell(p) {
    const role = p.host ? 'Host' : p.isBot ? 'AI' : p.isAway ? 'Away' : '\u2014';
    const roleClass = p.host ? ' s2-role-accent' : '';
    return `
      <div class="s2-cell">
        <p class="s2-cell-name">${esc(p.name)}</p>
        <p class="s2-cell-role${roleClass}">${role}</p>
      </div>`;
  }

  function s2Lobby(sizeKey) {
    return function (el, corpus) {
      const st = lobbyState(corpus, sizeKey);
      el.innerHTML = `
        ${s2Header(corpus.roomCodeFormatted, st.title, st.sub)}
        <div class="s2-body">
          <div class="s2-roster-wrap">
            <p class="s2-label">Players (${st.players.length})</p>
            <div class="s2-roster-grid" data-scroll-exempt="8-player roster grid scrolls internally at max party size; header and controls stay always visible">
              ${st.players.map((p) => s2RosterCell(p)).join('')}
            </div>
          </div>
          <div>
            <p class="s2-label">Room controls</p>
            <div class="s2-controls-row">
              <button class="s2-control" type="button">QR</button>
              <button class="s2-control" type="button">Join link</button>
              ${st.canAddBot ? `<button class="s2-control" type="button">+Bot ${st.bots}/3</button>` : ''}
              <button class="s2-control" type="button">Present</button>
            </div>
          </div>
        </div>
        <div class="s2-action">
          <p class="s2-action-caption">${esc(st.canStart ? `${st.players.length} ready to play.` : `Need ${st.needsMore} more player${st.needsMore === 1 ? '' : 's'}.`)}</p>
          <div class="s2-action-row">
            <button class="s2-cta" type="button" ${st.canStart ? '' : 'disabled'}>Start</button>
            <button class="s2-secondary" type="button">Close</button>
          </div>
        </div>`;
    };
  }

  function s2Write(el, corpus) {
    const w = corpus.writing;
    const empty = Math.max(0, w.targetWordCount - w.currentWords.length);
    el.innerHTML = `
      ${s2Header(corpus.roomCodeFormatted, `Round ${w.round} of ${w.totalRounds}`, `${w.targetWordCount} word line`)}
      <div class="s2-body">
        <div>
          <p class="s2-label">Round meta</p>
          <div class="s2-roster-grid">
            <div class="s2-cell">
              <p class="s2-cell-name">Round</p>
              <p class="s2-cell-role">${w.round} / ${w.totalRounds}</p>
            </div>
            <div class="s2-cell">
              <p class="s2-cell-name">Target</p>
              <p class="s2-cell-role">${w.targetWordCount} words</p>
            </div>
          </div>
        </div>
        <div>
          <p class="s2-label">Received line</p>
          <p class="s2-line">\u201C${esc(w.previousLineText)}\u201D</p>
        </div>
        <div>
          <p class="s2-label">Your words (${w.currentWords.length} / ${w.targetWordCount})</p>
          <div class="s2-chips">
            ${w.currentWords.map((word) => `<span class="s2-chip s2-chip-filled">${esc(word)}</span>`).join('')}
            ${Array.from({ length: empty })
              .map(() => '<span class="s2-chip s2-chip-empty" aria-hidden="true"></span>')
              .join('')}
          </div>
        </div>
      </div>
      <div class="s2-action">
        <p class="s2-action-caption">12 / 500 characters</p>
        <div class="s2-action-row">
          <button class="s2-cta" type="button">Submit</button>
        </div>
      </div>`;
  }

  function s2Recap(el, corpus) {
    const fav = corpus.recapPoems.find((p) => p.isFavorite);
    el.innerHTML = `
      ${s2Header(corpus.roomCodeFormatted, 'All poems revealed', '')}
      <div class="s2-body">
        <div>
          <p class="s2-label">Session complete</p>
          <p class="s2-line s2-line-body">Replay the set, then start another round or head back to the lobby.</p>
        </div>
        <div class="s2-favorite">
          <p class="s2-fav-kicker">Room favorite \u00B7 ${corpus.favoriteLeaderCount} heart${corpus.favoriteLeaderCount === 1 ? '' : 's'}</p>
          <p class="s2-fav-line">\u201C${esc(fav.preview)}\u201D</p>
          <p class="s2-fav-reader">${esc(fav.reader)}</p>
        </div>
        <div>
          <p class="s2-label">Poems (${corpus.recapPoems.length})</p>
          <div class="s2-poem-list">
            ${corpus.recapPoems
              .map(
                (p, i) => `
              <div class="s2-poem-row">
                <p class="s2-poem-meta">${String(i + 1).padStart(2, '0')} \u00B7 ${esc(p.reader)}</p>
                <p class="s2-poem-preview">\u201C${esc(p.preview)}\u201D</p>
              </div>`
              )
              .join('')}
          </div>
        </div>
      </div>
      <div class="s2-action">
        <div class="s2-action-row">
          <button class="s2-cta" type="button">Start</button>
          <button class="s2-secondary" type="button">Lobby</button>
          <button class="s2-ghost" type="button">Exit</button>
        </div>
      </div>`;
  }

  window.LANE_SPECS['SWISS-2'] = {
    lane: 'swiss',
    title: 'Split Spine',
    move: 'Merge the sticky chrome and room-code hero into one persistent header band, lay roster and poems out as a tabular hairline grid, and collapse the action zone to a single slim row.',
    css: `
      .opt-SWISS-2 { height: 100%; display: flex; flex-direction: column; overflow: hidden; background: var(--color-background); color: var(--color-text-primary); font-family: var(--font-sans); }
      .opt-SWISS-2 button { font-family: var(--font-sans); }
      .opt-SWISS-2 button:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
      .opt-SWISS-2 .s2-header { flex: none; padding: var(--space-3); border-bottom: 1px solid var(--color-border); background: var(--color-surface); }
      .opt-SWISS-2 .s2-header-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
      .opt-SWISS-2 .s2-code { margin: 0; font-family: var(--font-display); font-weight: 500; font-size: var(--text-xl); line-height: 1; letter-spacing: 0.06em; }
      .opt-SWISS-2 .s2-icons { flex: none; display: flex; gap: 1px; background: var(--color-border); border: 1px solid var(--color-border); }
      .opt-SWISS-2 .s2-icon { min-width: var(--space-5); min-height: var(--space-5); padding: 0 var(--space-2); border: none; background: var(--color-surface); color: var(--color-text-secondary); font-weight: 600; font-size: var(--text-xs); text-transform: uppercase; cursor: pointer; }
      .opt-SWISS-2 .s2-status { margin: var(--space-2) 0 0; font-weight: 500; font-size: var(--text-sm); color: color-mix(in srgb, var(--color-text-primary) 65%, transparent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .opt-SWISS-2 .s2-body { flex: 1; min-height: 0; padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3); }
      .opt-SWISS-2 .s2-roster-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .opt-SWISS-2 .s2-label { margin: 0 0 var(--space-1); font-family: var(--font-mono); font-weight: 700; font-size: var(--text-xs); letter-spacing: 0.08em; text-transform: uppercase; color: color-mix(in srgb, var(--color-text-primary) 45%, transparent); }
      .opt-SWISS-2 .s2-roster-grid { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--color-border); border: 1px solid var(--color-border); }
      .opt-SWISS-2 .s2-cell { background: var(--color-surface); padding: var(--space-2); min-width: 0; }
      .opt-SWISS-2 .s2-cell-name { margin: 0; font-weight: 600; font-size: var(--text-sm); color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .opt-SWISS-2 .s2-cell-role { margin: 2px 0 0; font-family: var(--font-mono); font-weight: 600; font-size: var(--text-xs); letter-spacing: 0.06em; text-transform: uppercase; color: color-mix(in srgb, var(--color-text-primary) 45%, transparent); font-variant-numeric: tabular-nums; }
      .opt-SWISS-2 .s2-role-accent { color: var(--color-primary); }
      .opt-SWISS-2 .s2-controls-row { display: flex; gap: 1px; background: var(--color-border); border: 1px solid var(--color-border); }
      .opt-SWISS-2 .s2-control { flex: 1; min-width: 0; padding: var(--space-2) var(--space-1); background: var(--color-surface); border: none; font-weight: 600; font-size: var(--text-xs); text-align: center; color: var(--color-text-primary); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .opt-SWISS-2 .s2-line { margin: 0; font-family: var(--font-display); font-style: italic; font-weight: 500; font-size: var(--text-lg); line-height: 1.4; color: var(--color-text-secondary); }
      .opt-SWISS-2 .s2-line-body { font-family: var(--font-sans); font-style: normal; font-weight: 400; font-size: var(--text-sm); line-height: 1.5; max-width: 34ch; }
      .opt-SWISS-2 .s2-favorite { flex: none; border: 1px solid var(--color-primary); padding: var(--space-2); display: flex; flex-direction: column; gap: 2px; }
      .opt-SWISS-2 .s2-fav-kicker { margin: 0; font-family: var(--font-mono); font-weight: 700; font-size: var(--text-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-primary); }
      .opt-SWISS-2 .s2-fav-line { margin: 2px 0 0; font-family: var(--font-display); font-style: italic; font-weight: 500; font-size: var(--text-sm); line-height: 1.3; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .opt-SWISS-2 .s2-fav-reader { margin: 2px 0 0; font-family: var(--font-mono); font-weight: 600; font-size: var(--text-xs); letter-spacing: 0.04em; text-transform: uppercase; color: color-mix(in srgb, var(--color-text-primary) 55%, transparent); }
      .opt-SWISS-2 .s2-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
      .opt-SWISS-2 .s2-chip { display: inline-flex; align-items: center; justify-content: center; padding: var(--space-1) var(--space-2); font-family: var(--font-display); font-weight: 500; font-size: var(--text-base); }
      .opt-SWISS-2 .s2-chip-filled { border: 1px solid var(--color-primary); background: color-mix(in srgb, var(--color-primary) 10%, transparent); }
      .opt-SWISS-2 .s2-chip-empty { min-width: 2.75em; min-height: 1.2em; border: 1px dashed var(--color-border); }
      .opt-SWISS-2 .s2-poem-list { display: flex; flex-direction: column; gap: 1px; background: var(--color-border); border: 1px solid var(--color-border); }
      .opt-SWISS-2 .s2-poem-row { background: var(--color-surface); padding: var(--space-2); }
      .opt-SWISS-2 .s2-poem-meta { margin: 0; font-family: var(--font-mono); font-weight: 700; font-size: var(--text-xs); letter-spacing: 0.04em; text-transform: uppercase; color: color-mix(in srgb, var(--color-text-primary) 45%, transparent); }
      .opt-SWISS-2 .s2-poem-preview { margin: 2px 0 0; font-family: var(--font-display); font-style: italic; font-weight: 500; font-size: var(--text-sm); line-height: 1.3; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .opt-SWISS-2 .s2-action { flex: none; padding: var(--space-2) var(--space-3); border-top: 1px solid var(--color-border); background: var(--color-surface); }
      .opt-SWISS-2 .s2-action-caption { margin: 0 0 var(--space-1); font-weight: 500; font-size: var(--text-xs); font-variant-numeric: tabular-nums; color: color-mix(in srgb, var(--color-text-primary) 60%, transparent); }
      .opt-SWISS-2 .s2-action-row { display: flex; gap: var(--space-2); }
      .opt-SWISS-2 .s2-cta { flex: 1; min-height: 44px; border: none; background: var(--color-primary); color: var(--color-text-inverse); font-weight: 600; font-size: var(--text-sm); letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; }
      .opt-SWISS-2 .s2-cta:disabled { background: color-mix(in srgb, var(--color-primary) 30%, var(--color-surface)); color: color-mix(in srgb, var(--color-text-inverse) 70%, transparent); cursor: not-allowed; }
      .opt-SWISS-2 .s2-secondary { flex: none; min-height: 44px; min-width: var(--space-7); padding: 0 var(--space-2); border: 1px solid var(--color-border); background: transparent; color: var(--color-text-primary); font-weight: 600; font-size: var(--text-xs); letter-spacing: 0.02em; text-transform: uppercase; cursor: pointer; }
      .opt-SWISS-2 .s2-ghost { flex: none; min-height: 44px; padding: 0 var(--space-2); border: none; background: transparent; color: color-mix(in srgb, var(--color-text-primary) 55%, transparent); font-weight: 600; font-size: var(--text-xs); letter-spacing: 0.02em; text-transform: uppercase; cursor: pointer; }
      @media (prefers-reduced-motion: no-preference) {
        .opt-SWISS-2 button { transition: background var(--duration-fast) var(--ease-theme), border-color var(--duration-fast) var(--ease-theme); }
      }
    `,
    screens: {
      'lobby-low': s2Lobby('low'),
      'lobby-mid': s2Lobby('mid'),
      'lobby-max': s2Lobby('max'),
      write: s2Write,
      'recap-mid': s2Recap,
    },
  };

  // ==========================================================================
  // SWISS-3 — Disclosure Poster: chrome collapses to a room-code mark plus
  // one overflow trigger, freeing maximum room for one dominant poster-scale
  // typographic hero per screen; roster becomes a compact monogram band.
  // ==========================================================================

  function s3Chrome(code) {
    return `
      <div class="s3-chrome">
        <span class="s3-chrome-code">${esc(code)}</span>
        <button class="s3-chrome-trigger" type="button" aria-label="Room menu: invite, help, and more options">Room &#8943;</button>
      </div>`;
  }

  function s3Tile(p) {
    const tag = p.isBot ? 'AI' : p.isAway ? 'Away' : p.host ? 'Host' : '';
    return `
      <div class="s3-tile">
        <span class="s3-tile-mark${p.host ? ' s3-tile-host' : ''}">${initials(p.name)}</span>
        <span class="s3-tile-name">${esc(p.name)}</span>
        ${tag ? `<span class="s3-tile-tag">${tag}</span>` : ''}
      </div>`;
  }

  function s3Lobby(sizeKey) {
    return function (el, corpus) {
      const st = lobbyState(corpus, sizeKey);
      el.innerHTML = `
        ${s3Chrome(corpus.roomCodeFormatted)}
        <div class="s3-body">
          <p class="s3-caption">${esc(st.title)} \u00B7 ${esc(st.sub)}</p>
          <p class="s3-poster">${esc(corpus.roomCodeFormatted)}</p>
          <div class="s3-band-wrap">
            <p class="s3-caption">Players (${st.players.length})</p>
            <div class="s3-band" data-scroll-exempt="8-player monogram band scrolls internally at max party size; poster, controls, and action zone stay always visible">
              ${st.players.map((p) => s3Tile(p)).join('')}
            </div>
          </div>
          <p class="s3-caption">Room controls</p>
          <div class="s3-controls">
            <button class="s3-control" type="button">QR code</button>
            <button class="s3-control" type="button">Join link</button>
            ${st.canAddBot ? `<button class="s3-control" type="button">Add a bot (${st.bots}/3)</button>` : ''}
            <button class="s3-control" type="button">Present room</button>
          </div>
        </div>
        <div class="s3-action">
          <p class="s3-action-caption">${esc(st.canStart ? `${st.players.length} ready to play.` : `Need ${st.needsMore} more player${st.needsMore === 1 ? '' : 's'}.`)}</p>
          <button class="s3-cta" type="button" ${st.canStart ? '' : 'disabled'}>Start</button>
          <button class="s3-ghost" type="button">Close room</button>
        </div>`;
    };
  }

  function s3Write(el, corpus) {
    const w = corpus.writing;
    const empty = Math.max(0, w.targetWordCount - w.currentWords.length);
    el.innerHTML = `
      ${s3Chrome(corpus.roomCodeFormatted)}
      <div class="s3-body">
        <p class="s3-caption">Round ${w.round} of ${w.totalRounds} \u00B7 ${w.targetWordCount} words</p>
        <p class="s3-line">\u201C${esc(w.previousLineText)}\u201D</p>
        <p class="s3-caption">Your words (${w.currentWords.length} / ${w.targetWordCount})</p>
        <div class="s3-chips">
          ${w.currentWords.map((word) => `<span class="s3-chip s3-chip-filled">${esc(word)}</span>`).join('')}
          ${Array.from({ length: empty })
            .map(() => '<span class="s3-chip s3-chip-empty" aria-hidden="true"></span>')
            .join('')}
        </div>
        <p class="s3-charcount">12 / 500 characters</p>
      </div>
      <div class="s3-action">
        <p class="s3-action-caption">Submit when your line is ready.</p>
        <button class="s3-cta" type="button">Submit</button>
      </div>`;
  }

  function s3Recap(el, corpus) {
    const fav = corpus.recapPoems.find((p) => p.isFavorite);
    el.innerHTML = `
      ${s3Chrome(corpus.roomCodeFormatted)}
      <div class="s3-body">
        <p class="s3-caption">Recap \u00B7 ${corpus.recapPoems.length} poems</p>
        <p class="s3-poster s3-poster-headline">Session complete</p>
        <div class="s3-favorite">
          <p class="s3-fav-kicker">Room favorite \u00B7 ${corpus.favoriteLeaderCount} heart${corpus.favoriteLeaderCount === 1 ? '' : 's'}</p>
          <p class="s3-fav-line">\u201C${esc(fav.preview)}\u201D</p>
          <p class="s3-fav-reader">Read by ${esc(fav.reader)}</p>
        </div>
        <p class="s3-caption">Poems</p>
        <div class="s3-poem-list">
          ${corpus.recapPoems
            .map(
              (p, i) => `
            <p class="s3-poem-row">
              <span class="s3-poem-index">${String(i + 1).padStart(2, '0')}</span>
              <span class="s3-poem-reader">${esc(p.reader)}</span>
              <span class="s3-poem-preview">\u201C${esc(p.preview)}\u201D</span>
            </p>`
            )
            .join('')}
        </div>
      </div>
      <div class="s3-action">
        <p class="s3-action-caption">Play another round, or head back to the lobby.</p>
        <button class="s3-cta" type="button">Start</button>
        <button class="s3-ghost" type="button">Back to lobby</button>
      </div>`;
  }

  window.LANE_SPECS['SWISS-3'] = {
    lane: 'swiss',
    title: 'Disclosure Poster',
    move: 'Collapse chrome to a room-code mark plus one overflow trigger, giving each screen one dominant poster-scale hero, a compact monogram roster band, and a single-action bottom zone.',
    css: `
      .opt-SWISS-3 { height: 100%; display: flex; flex-direction: column; overflow: hidden; background: var(--color-background); color: var(--color-text-primary); font-family: var(--font-sans); }
      .opt-SWISS-3 button { font-family: var(--font-sans); }
      .opt-SWISS-3 button:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
      .opt-SWISS-3 .s3-chrome { flex: none; display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border-subtle); }
      .opt-SWISS-3 .s3-chrome-code { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-xs); letter-spacing: 0.12em; text-transform: uppercase; color: color-mix(in srgb, var(--color-text-primary) 55%, transparent); }
      .opt-SWISS-3 .s3-chrome-trigger { border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: transparent; color: var(--color-text-primary); font-weight: 600; font-size: var(--text-xs); letter-spacing: 0.04em; text-transform: uppercase; padding: var(--space-1) var(--space-2); cursor: pointer; }
      .opt-SWISS-3 .s3-body { flex: 1; min-height: 0; padding: var(--space-3); display: flex; flex-direction: column; }
      .opt-SWISS-3 .s3-caption { margin: 0 0 var(--space-1); font-weight: 500; font-size: var(--text-xs); letter-spacing: 0.04em; text-transform: uppercase; color: color-mix(in srgb, var(--color-text-primary) 60%, transparent); }
      .opt-SWISS-3 .s3-poster { margin: 0 0 var(--space-3); font-family: var(--font-display); font-weight: 500; font-size: var(--text-3xl); line-height: 1.05; letter-spacing: 0.04em; color: var(--color-text-primary); }
      .opt-SWISS-3 .s3-poster-headline { font-size: var(--text-2xl); letter-spacing: 0; }
      .opt-SWISS-3 .s3-favorite { margin: 0 0 var(--space-3); padding-left: var(--space-2); border-left: 2px solid var(--color-primary); }
      .opt-SWISS-3 .s3-fav-kicker { margin: 0; font-weight: 600; font-size: var(--text-xs); letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-primary); }
      .opt-SWISS-3 .s3-fav-line { margin: 2px 0 0; font-family: var(--font-display); font-style: italic; font-weight: 500; font-size: var(--text-base); line-height: 1.3; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .opt-SWISS-3 .s3-fav-reader { margin: 2px 0 0; font-weight: 500; font-size: var(--text-xs); color: color-mix(in srgb, var(--color-text-primary) 60%, transparent); }
      .opt-SWISS-3 .s3-line { margin: 0 0 var(--space-3); font-family: var(--font-display); font-style: italic; font-weight: 500; font-size: var(--text-xl); line-height: 1.35; color: var(--color-text-primary); }
      .opt-SWISS-3 .s3-band-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .opt-SWISS-3 .s3-band { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-wrap: wrap; align-content: flex-start; gap: var(--space-2); margin-bottom: var(--space-3); }
      .opt-SWISS-3 .s3-tile { flex: none; width: var(--space-6); display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .opt-SWISS-3 .s3-tile-mark { width: var(--space-5); height: var(--space-5); display: flex; align-items: center; justify-content: center; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-weight: 600; font-size: var(--text-sm); color: var(--color-text-primary); }
      .opt-SWISS-3 .s3-tile-host { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary); }
      .opt-SWISS-3 .s3-tile-name { max-width: 100%; font-weight: 500; font-size: var(--text-xs); color: color-mix(in srgb, var(--color-text-primary) 70%, transparent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .opt-SWISS-3 .s3-tile-tag { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-xs); letter-spacing: 0.04em; text-transform: uppercase; color: color-mix(in srgb, var(--color-text-primary) 45%, transparent); }
      .opt-SWISS-3 .s3-controls { display: flex; flex-wrap: wrap; gap: var(--space-1); }
      .opt-SWISS-3 .s3-control { flex: none; padding: var(--space-1) var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: transparent; color: var(--color-text-primary); font-weight: 600; font-size: var(--text-xs); letter-spacing: 0.02em; cursor: pointer; white-space: nowrap; }
      .opt-SWISS-3 .s3-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-2); }
      .opt-SWISS-3 .s3-chip { display: inline-flex; align-items: center; justify-content: center; padding: var(--space-1) var(--space-2); font-family: var(--font-display); font-weight: 500; font-size: var(--text-base); border-radius: var(--radius-sm); }
      .opt-SWISS-3 .s3-chip-filled { border: 1px solid var(--color-primary); background: color-mix(in srgb, var(--color-primary) 10%, transparent); }
      .opt-SWISS-3 .s3-chip-empty { min-width: 2.75em; min-height: 1.2em; border: 1px dashed var(--color-border); }
      .opt-SWISS-3 .s3-charcount { margin: 0; font-family: var(--font-mono); font-weight: 500; font-size: var(--text-xs); font-variant-numeric: tabular-nums; color: color-mix(in srgb, var(--color-text-primary) 45%, transparent); }
      .opt-SWISS-3 .s3-poem-list { display: flex; flex-direction: column; }
      .opt-SWISS-3 .s3-poem-row { display: flex; align-items: baseline; gap: var(--space-2); margin: 0; padding: var(--space-1) 0; border-bottom: 1px solid var(--color-border-subtle); }
      .opt-SWISS-3 .s3-poem-row:last-child { border-bottom: none; }
      .opt-SWISS-3 .s3-poem-index { flex: none; font-family: var(--font-mono); font-weight: 600; font-size: var(--text-xs); color: color-mix(in srgb, var(--color-text-primary) 40%, transparent); }
      .opt-SWISS-3 .s3-poem-reader { flex: none; font-weight: 600; font-size: var(--text-xs); letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-text-primary); }
      .opt-SWISS-3 .s3-poem-preview { flex: 1; min-width: 0; font-family: var(--font-display); font-style: italic; font-weight: 500; font-size: var(--text-sm); color: color-mix(in srgb, var(--color-text-primary) 75%, transparent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .opt-SWISS-3 .s3-action { flex: none; padding: var(--space-3); border-top: 1px solid var(--color-border); }
      .opt-SWISS-3 .s3-action-caption { margin: 0 0 var(--space-2); font-weight: 500; font-size: var(--text-xs); color: color-mix(in srgb, var(--color-text-primary) 60%, transparent); }
      .opt-SWISS-3 .s3-cta { width: 100%; min-height: 44px; border: none; border-radius: var(--radius-sm); background: var(--color-primary); color: var(--color-text-inverse); font-weight: 600; font-size: var(--text-sm); letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; }
      .opt-SWISS-3 .s3-cta:disabled { background: color-mix(in srgb, var(--color-primary) 30%, var(--color-surface)); color: color-mix(in srgb, var(--color-text-inverse) 70%, transparent); cursor: not-allowed; }
      .opt-SWISS-3 .s3-ghost { display: block; width: 100%; margin-top: var(--space-2); min-height: 44px; border: none; background: transparent; color: color-mix(in srgb, var(--color-text-primary) 55%, transparent); font-weight: 600; font-size: var(--text-xs); letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; }
      @media (prefers-reduced-motion: no-preference) {
        .opt-SWISS-3 button { transition: background var(--duration-fast) var(--ease-theme), border-color var(--duration-fast) var(--ease-theme); }
      }
    `,
    screens: {
      'lobby-low': s3Lobby('low'),
      'lobby-mid': s3Lobby('mid'),
      'lobby-max': s3Lobby('max'),
      write: s3Write,
      'recap-mid': s3Recap,
    },
  };
})();
