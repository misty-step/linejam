// Round-1 baseline: a faithful reconstruction of the shipped RoomChrome +
// Lobby.tsx + WritingScreen.tsx + RevealPhase/SessionRecapHub layout —
// same structure, same class shapes, same spacing scale, translated from
// Tailwind to plain CSS driven by the same --var(...) tokens the real app
// uses. This is not a guess: it is meant to overflow exactly where the
// shipped app overflows, so the auditor's verdict here is the truthful
// starting point every candidate must beat.
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  const PALETTE = [
    '#e85d2b',
    '#c2410c',
    '#0d9488',
    '#7c3aed',
    '#db2777',
    '#ea580c',
    '#0891b2',
    '#4f46e5',
    '#65a30d',
    '#b45309',
    '#1e40af',
    '#059669',
  ];
  function colorFor(stableId, allIds) {
    const i = allIds.indexOf(stableId);
    return PALETTE[i % PALETTE.length];
  }

  function esc(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  // -- RoomChrome (sticky top bar: room code, invite, help, overflow menu) --
  function chrome(title, subtitle) {
    return `
      <div class="b-chrome">
        <div class="b-chrome-bar">
          <div class="b-chrome-left">
            <div class="b-chrome-row">
              <button class="b-code-pill" type="button">Room PL UM</button>
              <h1 class="b-chrome-title">${esc(title)}</h1>
            </div>
            ${subtitle ? `<p class="b-chrome-sub">${esc(subtitle)}</p>` : ''}
          </div>
          <div class="b-chrome-right">
            <button class="b-btn b-btn-primary" type="button">Invite</button>
            <button class="b-btn b-btn-icon" type="button" aria-label="How to play">?</button>
            <button class="b-btn b-btn-icon" type="button" aria-label="More options">⋯</button>
          </div>
        </div>
      </div>`;
  }

  function playerRow(p, allIds, hostId) {
    const color = colorFor(p.stableId, allIds);
    return `
      <li class="b-player">
        <div class="b-player-id">
          <span class="b-avatar" style="background:${p.isBot ? 'transparent' : color};border-color:${color}"></span>
          <span class="b-player-name">${esc(p.name)}</span>
          ${p.isAway ? '<span class="b-away">away</span>' : ''}
        </div>
        <div class="b-player-badges">
          ${p.isBot ? '<span class="b-badge">AI</span>' : ''}
          ${p.host ? '<span class="b-badge b-badge-host">HOST</span>' : ''}
        </div>
      </li>`;
  }

  function lobbyScreen(sizeKey) {
    return function (el, corpus) {
      const players = corpus.players[sizeKey];
      const allIds = players.map((p) => p.stableId);
      const needsMore = Math.max(0, 2 - players.length);
      const isHost = true;
      const chromeTitle =
        needsMore > 0 ? `Need ${needsMore} more player${needsMore === 1 ? '' : 's'}` : `${players.length} players ready`;
      const chromeSub =
        needsMore > 0 ? `Share ${corpus.roomCodeFormatted} to start.` : 'Start when you are ready.';
      const canStart = players.length >= 2;

      el.innerHTML = `
        ${chrome(chromeTitle, chromeSub)}
        <div class="b-lobby-frame">
          <div class="b-scroll">
            <div class="b-hero">
              <p class="b-hero-label">Share this code</p>
              <p class="b-hero-code">${corpus.roomCodeFormatted}</p>
            </div>
            <ul class="b-roster">
              ${players.map((p) => playerRow(p, allIds, 'p-sam')).join('')}
            </ul>
            <div class="b-side-controls">
              <div class="b-qr">QR</div>
              <a class="b-link">Open join link</a>
              ${isHost && players.filter((p) => p.isBot).length < 3 && players.length < 8 ? `<button class="b-btn b-btn-secondary b-full">Add a bot (${players.filter((p) => p.isBot).length}/3)</button>` : ''}
              ${isHost ? '<button class="b-btn b-btn-outline b-full">Present room</button>' : ''}
            </div>
          </div>
          <div class="b-action-zone">
            ${
              isHost
                ? `<button class="b-btn b-btn-primary b-cta" ${canStart ? '' : 'disabled'}>${canStart ? 'Start Linejam' : `Need ${needsMore} more player${needsMore === 1 ? '' : 's'}`}</button>
                   <button class="b-btn b-btn-ghost b-full">Close room</button>`
                : `<button class="b-btn b-btn-secondary b-cta" disabled>Waiting for host</button>
                   <button class="b-btn b-btn-ghost b-full">Leave room</button>`
            }
          </div>
        </div>`;
    };
  }

  function writeScreen(el, corpus) {
    const w = corpus.writing;
    el.innerHTML = `
      ${chrome(`Round ${w.round} of ${w.totalRounds} · ${w.targetWordCount} words`, '')}
      <div class="b-write-frame">
        <div class="b-scroll b-write-scroll">
          <div class="b-clock">● round timer</div>
          <p class="b-received-label">Received line</p>
          <p class="b-received-line">${esc(w.previousLineText)}</p>
          <div class="b-canvas">
            <div class="b-textarea">${w.currentWords.join(' ')}</div>
            <p class="b-charcount">12/500 characters</p>
            <div class="b-slots">
              ${Array.from({ length: w.targetWordCount })
                .map((_, i) => `<span class="b-slot ${i < w.currentWords.length ? 'filled' : ''}"></span>`)
                .join('')}
            </div>
          </div>
        </div>
        <div class="b-action-zone">
          <button class="b-btn b-btn-primary b-cta">Submit</button>
        </div>
      </div>`;
  }

  function recapScreen(el, corpus) {
    el.innerHTML = `
      ${chrome('All poems revealed', 'Start again, open the archive, or leave the room.')}
      <div class="b-recap-frame">
        <div class="b-scroll">
          <section class="b-recap">
            <p class="b-kicker">Session Recap</p>
            <h2 class="b-recap-title">Session complete</h2>
            <p class="b-recap-body">Replay the full set, share the group recap, or keep this room moving into another round.</p>
            <p class="b-recap-meta">${corpus.recapPoems.length} poems / 5 poets</p>
            <div class="b-favorite">
              <p class="b-fav-kicker">♥ Room favorite · ${corpus.favoriteLeaderCount} heart${corpus.favoriteLeaderCount === 1 ? '' : 's'}</p>
              <p class="b-fav-line">"${esc(corpus.recapPoems.find((p) => p.isFavorite).preview)}..."</p>
              <p class="b-fav-reader">Read by ${esc(corpus.recapPoems.find((p) => p.isFavorite).reader)}</p>
            </div>
            <p class="b-share-note">Sharing makes the full session recap public to anyone with the link.</p>
            <div class="b-poem-list">
              ${corpus.recapPoems
                .map(
                  (p, i) => `
                <div class="b-poem-card">
                  <p class="b-poem-meta">Poem ${String(i + 1).padStart(2, '0')} / read by ${esc(p.reader)}</p>
                  <p class="b-poem-preview">"${esc(p.preview)}..."</p>
                </div>`
                )
                .join('')}
            </div>
            <button class="b-btn b-btn-primary b-full b-share-btn">Share the whole set</button>
            <div class="b-sound-row"><button class="b-btn b-btn-ghost">Sound</button></div>
            <div class="b-recap-ctas">
              <button class="b-btn b-btn-primary">Start Next Round</button>
              <button class="b-btn b-btn-outline">Back to Lobby</button>
            </div>
            <p class="b-exit">Exit Room</p>
          </section>
        </div>
      </div>`;
  }

  window.LANE_SPECS['BASE-1'] = {
    lane: 'baseline',
    title: 'Shipped app (current)',
    move: 'Faithful reconstruction of RoomChrome + Lobby.tsx + WritingScreen.tsx + SessionRecapHub — the literal current-production baseline, not a guess.',
    css: `
      .opt-BASE-1 { font-family: var(--font-sans); color: var(--color-text-primary); background: var(--color-background); height: 100%; display: flex; flex-direction: column; }
      .opt-BASE-1 .b-chrome { flex: none; padding: 12px; }
      .opt-BASE-1 .b-chrome-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid var(--color-border); background: color-mix(in srgb, var(--color-surface) 92%, transparent); border-radius: var(--radius-lg); padding: 10px 14px; box-shadow: var(--shadow-lg); }
      .opt-BASE-1 .b-chrome-left { min-width: 0; }
      .opt-BASE-1 .b-chrome-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
      .opt-BASE-1 .b-code-pill { flex: none; font: 700 10px/1 var(--font-mono); letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-text-muted); background: var(--color-muted); border: 1px solid var(--color-border); border-radius: var(--radius-full); padding: 6px 10px; }
      .opt-BASE-1 .b-chrome-title { font: 500 16px/1.2 var(--font-display); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .opt-BASE-1 .b-chrome-sub { margin: 4px 0 0; font-size: 12px; color: var(--color-text-secondary); }
      .opt-BASE-1 .b-chrome-right { flex: none; display: flex; gap: 8px; }
      .opt-BASE-1 .b-btn { border-radius: var(--radius-full); border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); font: 600 13px/1 var(--font-sans); padding: 0 16px; height: 44px; cursor: pointer; }
      .opt-BASE-1 .b-btn-icon { width: 44px; padding: 0; }
      .opt-BASE-1 .b-btn-primary { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-text-inverse); }
      .opt-BASE-1 .b-btn-secondary { background: var(--color-muted); }
      .opt-BASE-1 .b-btn-outline { background: transparent; border: 1px solid var(--color-primary); color: var(--color-primary); }
      .opt-BASE-1 .b-btn-ghost { background: transparent; border-color: transparent; }
      .opt-BASE-1 .b-full { width: 100%; }
      .opt-BASE-1 .b-cta { width: 100%; height: 56px; font-size: 16px; margin-bottom: 8px; }
      .opt-BASE-1 .b-lobby-frame, .opt-BASE-1 .b-write-frame, .opt-BASE-1 .b-recap-frame { flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .opt-BASE-1 .b-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; }
      .opt-BASE-1 .b-hero { text-align: center; margin-bottom: 40px; }
      .opt-BASE-1 .b-hero-label { font: 700 11px/1 var(--font-mono); letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-text-muted); margin: 0 0 8px; }
      .opt-BASE-1 .b-hero-code { font: 500 clamp(32px,16vw,48px)/1 var(--font-display); letter-spacing: 0.08em; margin: 0; }
      .opt-BASE-1 .b-roster { list-style: none; margin: 0 0 40px; padding: 0; display: flex; flex-direction: column; gap: 24px; }
      .opt-BASE-1 .b-player { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .opt-BASE-1 .b-player-id { display: flex; align-items: center; gap: 8px; min-width: 0; }
      .opt-BASE-1 .b-avatar { width: 12px; height: 12px; border-radius: 999px; border: 2px solid; flex: none; }
      .opt-BASE-1 .b-player-name { font: 500 24px/1.1 var(--font-sans); }
      .opt-BASE-1 .b-away { font: 700 10px/1 var(--font-mono); text-transform: uppercase; color: var(--color-text-muted); }
      .opt-BASE-1 .b-player-badges { display: flex; gap: 6px; flex: none; }
      .opt-BASE-1 .b-badge { font: 700 10px/1 var(--font-sans); text-transform: uppercase; border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 5px 8px; color: var(--color-text-muted); }
      .opt-BASE-1 .b-badge-host { color: var(--color-primary); border-color: var(--color-primary); }
      .opt-BASE-1 .b-side-controls { display: flex; flex-direction: column; align-items: center; gap: 12px; }
      .opt-BASE-1 .b-qr { width: 180px; height: 180px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: repeating-conic-gradient(var(--color-text-primary) 0% 25%, var(--color-surface) 0% 50%) 0 0/24px 24px; display: flex; align-items: center; justify-content: center; font: 700 12px var(--font-mono); }
      .opt-BASE-1 .b-link { font: 13px var(--font-mono); color: var(--color-primary); text-decoration: underline; margin-bottom: 8px; }
      .opt-BASE-1 .b-action-zone { flex: none; max-height: 50%; overflow-y: auto; border-top: 2px solid color-mix(in srgb, var(--color-primary) 20%, transparent); padding: 16px; box-shadow: var(--shadow-lg); }
      .opt-BASE-1 .b-write-scroll { padding-top: 24px; }
      .opt-BASE-1 .b-clock { font: 11px var(--font-mono); color: var(--color-text-muted); margin-bottom: 40px; }
      .opt-BASE-1 .b-received-label { font: 700 10px/1 var(--font-mono); text-transform: uppercase; color: var(--color-primary); margin: 0 0 12px; }
      .opt-BASE-1 .b-received-line { font: italic 500 28px/1.3 var(--font-display); color: var(--color-text-secondary); margin: 0 0 40px; }
      .opt-BASE-1 .b-textarea { font: 500 32px/1.2 var(--font-display); min-height: 64px; padding-left: 24px; }
      .opt-BASE-1 .b-charcount { font: 11px var(--font-mono); color: var(--color-text-muted); padding-left: 24px; }
      .opt-BASE-1 .b-slots { display: flex; gap: 6px; padding-left: 24px; margin-top: 8px; }
      .opt-BASE-1 .b-slot { width: 28px; height: 28px; border: 2px solid var(--color-border); border-radius: var(--radius-sm); }
      .opt-BASE-1 .b-slot.filled { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 10%, transparent); }
      .opt-BASE-1 .b-kicker { font: 700 11px var(--font-mono); text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-text-muted); }
      .opt-BASE-1 .b-recap-title { font: 500 40px/1.1 var(--font-display); margin: 8px 0; }
      .opt-BASE-1 .b-recap-body { color: var(--color-text-secondary); line-height: 1.6; }
      .opt-BASE-1 .b-recap-meta { font: 700 11px var(--font-mono); text-transform: uppercase; color: var(--color-text-muted); margin: 12px 0 24px; }
      .opt-BASE-1 .b-favorite { border: 1px solid var(--color-primary); background: var(--color-surface); padding: 20px; margin-bottom: 16px; }
      .opt-BASE-1 .b-fav-kicker { font: 700 10px var(--font-mono); text-transform: uppercase; color: var(--color-primary); }
      .opt-BASE-1 .b-fav-line { font: italic 500 24px/1.4 var(--font-display); margin: 8px 0 0; }
      .opt-BASE-1 .b-fav-reader { font: 700 11px var(--font-mono); text-transform: uppercase; color: var(--color-text-muted); }
      .opt-BASE-1 .b-share-note { font-size: 13px; color: var(--color-text-muted); margin: 16px 0; }
      .opt-BASE-1 .b-poem-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
      .opt-BASE-1 .b-poem-card { border: 1px solid var(--color-border-subtle); background: var(--color-surface); padding: 20px; }
      .opt-BASE-1 .b-poem-meta { font: 700 10px var(--font-mono); text-transform: uppercase; color: var(--color-text-muted); margin: 0 0 8px; }
      .opt-BASE-1 .b-poem-preview { font: italic 500 20px/1.4 var(--font-display); margin: 0; }
      .opt-BASE-1 .b-share-btn { height: 56px; margin-bottom: 24px; }
      .opt-BASE-1 .b-sound-row { text-align: center; margin-bottom: 24px; }
      .opt-BASE-1 .b-recap-ctas { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
      .opt-BASE-1 .b-recap-ctas .b-btn { height: 56px; }
      .opt-BASE-1 .b-exit { text-align: center; font: 700 12px var(--font-mono); text-transform: uppercase; color: var(--color-text-muted); }
    `,
    screens: {
      'lobby-low': lobbyScreen('low'),
      'lobby-mid': lobbyScreen('mid'),
      'lobby-max': lobbyScreen('max'),
      write: writeScreen,
      'recap-mid': recapScreen,
    },
  };
})();
