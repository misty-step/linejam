// REDESIGN lane — three options built through the "redesign-existing-projects"
// audit lens (skill leon-redesign-skill): treat the shipped RoomChrome frame
// as an existing product to diagnose, not a blank page to reinvent. Every
// option fixes the same two audit findings the baseline exhibits —
// (1) Strategic Omissions: "no back navigation / dead end" -> Session Recap
// gets a real persistent action zone in all three, and (2) DESIGN.md law 4
// ("button labels are plain verbs; context copy sits near the button, never
// inside it") -> the CTA always reads a constant verb, status/context text
// lives beside it, never swapped into the button label the way the baseline
// does. Where the three options genuinely diverge is chrome disclosure
// strategy, roster shape, and action-zone composition — the fence's named
// varying axes.
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  // -- shared, content-only helpers (no visual opinions live here) --------
  function esc(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }
  function initials(name) {
    return esc(String(name).slice(0, 1).toUpperCase());
  }
  function botCount(players) {
    return players.filter((p) => p.isBot).length;
  }
  function lobbyCopy(players) {
    const needsMore = Math.max(0, 2 - players.length);
    const canStart = players.length >= 2;
    const status =
      needsMore > 0
        ? `Need ${needsMore} more player${needsMore === 1 ? '' : 's'} to start.`
        : `${players.length} players ready. Start when you are set.`;
    return { needsMore, canStart, status };
  }
  function canAddBot(players) {
    return botCount(players) < 3 && players.length < 8;
  }
  function playerTag(p) {
    if (p.host) return 'Host';
    if (p.isBot) return 'AI';
    return '';
  }

  // =========================================================================
  // REDESIGN-1 — Merged panel
  // Fixes: "generic card look" / "no overlap or depth" (audit, Layout) by
  // collapsing hero + roster + side controls into one continuous surface
  // instead of the baseline's separately-margined blocks, and "always one
  // filled + one ghost button" (audit, Component Patterns) by replacing the
  // second full-width ghost button with a plain text link. A single "More"
  // disclosure holds help/QR/present; Invite stays always-visible.
  // =========================================================================
  (function defineRedesign1() {
    function chrome(headline, sub, menuItems) {
      return `
        <header class="r1-chrome">
          <div class="r1-chrome-id">
            <p class="r1-headline">${esc(headline)}</p>
            ${sub ? `<p class="r1-sub">${esc(sub)}</p>` : ''}
          </div>
          <div class="r1-chrome-actions">
            <button class="r1-btn r1-btn-primary" type="button">Invite</button>
            <details class="r1-more">
              <summary class="r1-btn r1-btn-icon" aria-label="Room options">&#8942;</summary>
              <div class="r1-more-panel">
                ${menuItems.map((label) => `<button class="r1-more-item" type="button">${esc(label)}</button>`).join('')}
              </div>
            </details>
          </div>
        </header>`;
    }

    function playerRow(p) {
      return `
        <li class="r1-player${p.host ? ' host' : ''}">
          <span class="r1-avatar">${initials(p.name)}</span>
          <span class="r1-player-name">${esc(p.name)}${p.isAway ? ' &middot; away' : ''}</span>
          <span class="r1-player-tag">${esc(playerTag(p))}</span>
        </li>`;
    }

    function lobby(sizeKey) {
      return function (el, corpus) {
        const players = corpus.players[sizeKey];
        const copy = lobbyCopy(players);
        const bots = botCount(players);
        const addable = canAddBot(players);
        const ctaId = `r1-cta-${sizeKey}`;
        el.innerHTML = `
          <div class="r1-shell">
            <a class="r1-skip" href="#${ctaId}">Skip to Start Linejam</a>
            ${chrome(`Lobby &middot; ${players.length} in the room`, '', ['How to play', 'Show QR code', 'Present room'])}
            <div class="r1-main">
              <div class="r1-hero">
                <p class="r1-hero-label">Room code</p>
                <p class="r1-hero-code">${esc(corpus.roomCodeFormatted)}</p>
              </div>
              <ul class="r1-roster">
                ${players.map(playerRow).join('')}
              </ul>
              <div class="r1-controls">
                <button class="r1-chip" type="button" ${addable ? '' : 'disabled'}>${addable ? `Add a bot (${bots}/3)` : `Bots full (${bots}/3)`}</button>
                <button class="r1-chip" type="button">Open join link</button>
              </div>
            </div>
            <div class="r1-action">
              <p class="r1-action-status">${esc(copy.status)}</p>
              <button class="r1-cta" id="${ctaId}" type="button" ${copy.canStart ? '' : 'disabled'}>Start Linejam</button>
              <button class="r1-secondary-link" type="button">Close room</button>
            </div>
          </div>`;
      };
    }

    function write(el, corpus) {
      const w = corpus.writing;
      const filled = w.currentWords.length;
      const text = w.currentWords.join(' ');
      el.innerHTML = `
        <div class="r1-shell">
          <a class="r1-skip" href="#r1-submit">Skip to Submit</a>
          ${chrome(`Round ${w.round} of ${w.totalRounds}`, `${w.targetWordCount}-word line`, ['How to play', 'Leave room'])}
          <div class="r1-main r1-write-main">
            <p class="r1-received-label">Previous line</p>
            <p class="r1-received">${esc(w.previousLineText)}</p>
            <div class="r1-canvas">
              <p class="r1-current">${text ? esc(text) : '&nbsp;'}</p>
              <div class="r1-slots">
                ${Array.from({ length: w.targetWordCount })
                  .map((_, i) => `<span class="r1-slot${i < filled ? ' filled' : ''}"></span>`)
                  .join('')}
              </div>
              <p class="r1-charcount">${text.length}/500 characters</p>
            </div>
          </div>
          <div class="r1-action">
            <p class="r1-action-status">${filled} of ${w.targetWordCount} words written.</p>
            <button class="r1-cta" id="r1-submit" type="button">Submit</button>
          </div>
        </div>`;
    }

    function recap(el, corpus) {
      const poems = corpus.recapPoems;
      const fav = poems.find((p) => p.isFavorite);
      el.innerHTML = `
        <div class="r1-shell">
          <a class="r1-skip" href="#r1-next-round">Skip to Start next round</a>
          ${chrome('All poems revealed', '', ['Share the set', 'Exit room'])}
          <div class="r1-main">
            <p class="r1-recap-lede">Replay the set, share it with the room, or start another round.</p>
            ${
              fav
                ? `
            <div class="r1-favorite">
              <p class="r1-favorite-kicker">&#9813; &#9829; Room favorite &middot; ${corpus.favoriteLeaderCount} heart${corpus.favoriteLeaderCount === 1 ? '' : 's'}</p>
              <a class="r1-favorite-link" href="#">&ldquo;${esc(fav.preview)}&rdquo;</a>
              <p class="r1-favorite-reader">Read by ${esc(fav.reader)}</p>
            </div>`
                : ''
            }
            <ul class="r1-poem-list">
              ${poems
                .map(
                  (p, i) => `
                <li class="r1-poem-row">
                  <span class="r1-poem-index">${String(i + 1).padStart(2, '0')}</span>
                  <span class="r1-poem-text">&ldquo;${esc(p.preview)}&rdquo;</span>
                  <span class="r1-poem-reader">${esc(p.reader)}</span>
                </li>`
                )
                .join('')}
            </ul>
          </div>
          <div class="r1-action">
            <p class="r1-action-status">${poems.length} poems read this round.</p>
            <button class="r1-cta" id="r1-next-round" type="button">Start next round</button>
            <button class="r1-secondary-link" type="button">Back to lobby</button>
          </div>
        </div>`;
    }

    window.LANE_SPECS['REDESIGN-1'] = {
      lane: 'redesign',
      title: 'Merged panel',
      move: 'Collapses hero, roster, and side controls into one continuous surface instead of stacked cards, trades the second full-width ghost button for a plain text link, and moves dynamic status copy beside the CTA instead of inside its label — reclaiming enough height for every capability to fit with zero scroll.',
      css: `
        .opt-REDESIGN-1 { height: 100%; font-family: var(--font-sans); color: var(--color-text-primary); background: var(--color-background); }
        .opt-REDESIGN-1 * { box-sizing: border-box; }
        .opt-REDESIGN-1 .r1-shell { height: 100%; display: flex; flex-direction: column; overflow: hidden; position: relative; }
        .opt-REDESIGN-1 .r1-skip { position: absolute; left: -9999px; top: 0; background: var(--color-primary); color: var(--color-text-inverse); padding: 10px 16px; border-radius: 0 0 var(--radius-md) 0; z-index: 20; font: 600 var(--text-sm)/1 var(--font-sans); text-decoration: none; }
        .opt-REDESIGN-1 .r1-skip:focus { left: 0; }
        .opt-REDESIGN-1 button, .opt-REDESIGN-1 summary { font-family: var(--font-sans); }
        .opt-REDESIGN-1 button:focus-visible, .opt-REDESIGN-1 summary:focus-visible, .opt-REDESIGN-1 a:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
        .opt-REDESIGN-1 .r1-chrome { flex: none; display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-2); padding: 10px var(--space-3) 8px; border-bottom: 1px solid var(--color-border-subtle); }
        .opt-REDESIGN-1 .r1-chrome-id { min-width: 0; }
        .opt-REDESIGN-1 .r1-headline { margin: 0; font: 600 var(--text-md)/1.2 var(--font-sans); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .opt-REDESIGN-1 .r1-sub { margin: 2px 0 0; font-size: var(--text-xs); color: var(--color-text-secondary); }
        .opt-REDESIGN-1 .r1-chrome-actions { flex: none; display: flex; gap: var(--space-2); position: relative; }
        .opt-REDESIGN-1 .r1-btn { border-radius: var(--radius-full); border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); font: 600 var(--text-sm)/1 var(--font-sans); padding: 0 14px; height: 40px; cursor: pointer; transition: background var(--duration-fast) var(--ease-theme), transform var(--duration-instant) var(--ease-theme); }
        .opt-REDESIGN-1 .r1-btn:hover { background: var(--color-surface-hover); }
        .opt-REDESIGN-1 .r1-btn:active { transform: scale(0.97); }
        .opt-REDESIGN-1 .r1-btn-primary { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-text-inverse); }
        .opt-REDESIGN-1 .r1-btn-primary:hover { background: var(--color-primary-hover); }
        .opt-REDESIGN-1 .r1-btn-primary:active { background: var(--color-primary-active); }
        .opt-REDESIGN-1 .r1-btn-icon { width: 40px; padding: 0; }
        .opt-REDESIGN-1 .r1-more { position: relative; }
        .opt-REDESIGN-1 .r1-more summary { list-style: none; cursor: pointer; }
        .opt-REDESIGN-1 .r1-more summary::-webkit-details-marker { display: none; }
        .opt-REDESIGN-1 .r1-more-panel { position: absolute; right: 0; top: calc(100% + 6px); z-index: 5; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); padding: var(--space-2); display: flex; flex-direction: column; gap: 4px; min-width: 180px; }
        .opt-REDESIGN-1 .r1-more-item { text-align: left; background: none; border: none; padding: 8px 10px; border-radius: var(--radius-sm); font: 500 var(--text-sm)/1.2 var(--font-sans); color: var(--color-text-primary); cursor: pointer; transition: background var(--duration-fast) var(--ease-theme); }
        .opt-REDESIGN-1 .r1-more-item:hover { background: var(--color-surface-hover); }
        .opt-REDESIGN-1 .r1-main { flex: 1; min-height: 0; overflow-y: auto; padding: 10px var(--space-3); display: flex; flex-direction: column; gap: 8px; }
        .opt-REDESIGN-1 .r1-hero { text-align: center; padding: 0 0 2px; }
        .opt-REDESIGN-1 .r1-hero-label { margin: 0 0 2px; font: 700 var(--text-xs)/1 var(--font-mono); letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--color-text-muted); }
        .opt-REDESIGN-1 .r1-hero-code { margin: 0; font: 500 var(--text-xl)/1.05 var(--font-display); letter-spacing: var(--tracking-wide); font-variant-numeric: tabular-nums; }
        .opt-REDESIGN-1 .r1-roster { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
        .opt-REDESIGN-1 .r1-player { display: flex; align-items: center; gap: 8px; padding: 3px 6px; border-radius: var(--radius-md); }
        .opt-REDESIGN-1 .r1-player.host { background: var(--color-muted); }
        .opt-REDESIGN-1 .r1-avatar { flex: none; width: 21px; height: 21px; border-radius: var(--radius-full); border: 1.5px solid var(--color-border); display: flex; align-items: center; justify-content: center; font: 700 10px/1 var(--font-sans); color: var(--color-text-secondary); }
        .opt-REDESIGN-1 .r1-player.host .r1-avatar { border-color: var(--color-primary); color: var(--color-primary); }
        .opt-REDESIGN-1 .r1-player-name { flex: 1; min-width: 0; font: 500 var(--text-xs)/1.2 var(--font-sans); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .opt-REDESIGN-1 .r1-player-tag { flex: none; font: 700 9px/1 var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted); }
        .opt-REDESIGN-1 .r1-controls { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 6px; border-top: 1px solid var(--color-border-subtle); }
        .opt-REDESIGN-1 .r1-chip { flex: 1 1 auto; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); font: 600 var(--text-xs)/1 var(--font-sans); padding: 6px 10px; text-align: center; cursor: pointer; transition: background var(--duration-fast) var(--ease-theme); }
        .opt-REDESIGN-1 .r1-chip:hover:not(:disabled) { background: var(--color-surface-hover); }
        .opt-REDESIGN-1 .r1-chip:disabled { color: var(--color-text-muted); cursor: not-allowed; }
        .opt-REDESIGN-1 .r1-write-main { justify-content: center; }
        .opt-REDESIGN-1 .r1-received-label { margin: 0 0 6px; font: 700 var(--text-xs)/1 var(--font-mono); text-transform: uppercase; letter-spacing: var(--tracking-wide); color: var(--color-primary); }
        .opt-REDESIGN-1 .r1-received { margin: 0 0 var(--space-4); font: italic 500 var(--text-lg)/1.35 var(--font-display); color: var(--color-text-secondary); }
        .opt-REDESIGN-1 .r1-canvas { display: flex; flex-direction: column; gap: 10px; }
        .opt-REDESIGN-1 .r1-current { margin: 0; font: 500 var(--text-2xl)/1.2 var(--font-display); min-height: 1.2em; }
        .opt-REDESIGN-1 .r1-slots { display: flex; gap: 6px; }
        .opt-REDESIGN-1 .r1-slot { width: 22px; height: 22px; border: 2px solid var(--color-border); border-radius: var(--radius-sm); }
        .opt-REDESIGN-1 .r1-slot.filled { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 12%, transparent); }
        .opt-REDESIGN-1 .r1-charcount { margin: 0; font: var(--text-xs)/1 var(--font-mono); color: var(--color-text-muted); }
        .opt-REDESIGN-1 .r1-recap-lede { margin: 0; font-size: var(--text-sm); color: var(--color-text-secondary); line-height: var(--leading-normal); }
        .opt-REDESIGN-1 .r1-favorite { display: flex; flex-direction: column; gap: 2px; padding: 7px 10px; border-radius: var(--radius-md); border: 1px solid var(--color-primary); background: color-mix(in srgb, var(--color-primary) 7%, var(--color-surface)); }
        .opt-REDESIGN-1 .r1-favorite-kicker { margin: 0; font: 700 10px/1 var(--font-mono); text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-primary); }
        .opt-REDESIGN-1 .r1-favorite-link { display: block; font: italic 500 var(--text-sm)/1.25 var(--font-display); color: var(--color-text-primary); text-decoration: underline; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .opt-REDESIGN-1 .r1-favorite-reader { margin: 0; font: 600 10px/1 var(--font-sans); color: var(--color-text-muted); }
        .opt-REDESIGN-1 .r1-poem-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .opt-REDESIGN-1 .r1-poem-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--radius-md); background: var(--color-surface); border: 1px solid var(--color-border-subtle); }
        .opt-REDESIGN-1 .r1-poem-index { flex: none; font: 700 var(--text-xs)/1 var(--font-mono); color: var(--color-text-muted); }
        .opt-REDESIGN-1 .r1-poem-text { flex: 1; min-width: 0; font: italic 500 var(--text-sm)/1.3 var(--font-display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .opt-REDESIGN-1 .r1-poem-reader { flex: none; font: 600 var(--text-xs)/1 var(--font-sans); color: var(--color-text-muted); }
        .opt-REDESIGN-1 .r1-action { flex: none; padding: 8px var(--space-3) 12px; border-top: 1px solid var(--color-border-subtle); }
        .opt-REDESIGN-1 .r1-action-status { margin: 0 0 8px; font-size: var(--text-xs); color: var(--color-text-muted); text-align: center; }
        .opt-REDESIGN-1 .r1-cta { width: 100%; height: 52px; border-radius: var(--radius-md); border: none; background: var(--color-primary); color: var(--color-text-inverse); font: 600 var(--text-base)/1 var(--font-sans); cursor: pointer; transition: background var(--duration-fast) var(--ease-theme), transform var(--duration-instant) var(--ease-theme); }
        .opt-REDESIGN-1 .r1-cta:disabled { background: var(--color-muted); color: var(--color-text-muted); cursor: not-allowed; }
        .opt-REDESIGN-1 .r1-cta:not(:disabled):hover { background: var(--color-primary-hover); }
        .opt-REDESIGN-1 .r1-cta:not(:disabled):active { background: var(--color-primary-active); transform: translateY(1px); }
        .opt-REDESIGN-1 .r1-secondary-link { display: block; width: 100%; margin-top: 8px; background: none; border: none; font: 500 var(--text-sm)/1 var(--font-sans); color: var(--color-text-secondary); text-decoration: underline; cursor: pointer; padding: 6px; }
      `,
      screens: {
        'lobby-low': lobby('low'),
        'lobby-mid': lobby('mid'),
        'lobby-max': lobby('max'),
        write: write,
        'recap-mid': recap,
      },
    };
  })();

  // =========================================================================
  // REDESIGN-2 — Shared action rail
  // Fixes: "no back navigation / dead end" (audit, Strategic Omissions) by
  // building ONE literal action-rail component and reusing its exact markup
  // on Lobby, Write, and Recap — the recap dead end disappears because it is
  // now running the same code path as every other screen, not a bespoke
  // afterthought. Chrome goes further into progressive disclosure than
  // REDESIGN-1: everything except the room code and screen label collapses
  // behind one "Room" menu (audit: "accordion FAQ -> inline progressive
  // disclosure").
  // =========================================================================
  (function defineRedesign2() {
    function chrome(codeText, screenLabel, items) {
      return `
        <header class="r2-chrome">
          <div class="r2-chrome-left">
            <span class="r2-code-chip">${esc(codeText)}</span>
            <span class="r2-screen-label">${esc(screenLabel)}</span>
          </div>
          <details class="r2-room-toggle">
            <summary class="r2-room-btn" aria-label="Room menu">Room</summary>
            <div class="r2-room-panel">
              ${items.map((label) => `<button class="r2-room-item" type="button">${esc(label)}</button>`).join('')}
            </div>
          </details>
        </header>`;
    }

    function hero(kicker, big, status) {
      return `
        <div class="r2-hero">
          <p class="r2-hero-kicker">${esc(kicker)}</p>
          <p class="r2-hero-big">${esc(big)}</p>
          ${status ? `<p class="r2-status" aria-live="polite">${esc(status)}</p>` : ''}
        </div>`;
    }

    // The one action-rail component every screen mounts verbatim.
    function actionRail(ctaId, ctaLabel, ctaDisabled, statusText, secondaryLabel) {
      return `
        <div class="r2-rail">
          <p class="r2-rail-status">${esc(statusText)}</p>
          <button class="r2-cta" id="${ctaId}" type="button" ${ctaDisabled ? 'disabled' : ''}>${esc(ctaLabel)}</button>
          ${secondaryLabel ? `<button class="r2-cta-secondary" type="button">${esc(secondaryLabel)}</button>` : ''}
        </div>`;
    }

    function playerChip(p) {
      return `
        <li class="r2-chip-player${p.host ? ' host' : ''}">
          <span class="r2-chip-avatar">${initials(p.name)}</span>
          <span class="r2-chip-name">${esc(p.name)}${p.isAway ? ' &middot; away' : ''}</span>
          ${playerTag(p) ? `<span class="r2-chip-tag">${esc(playerTag(p))}</span>` : ''}
        </li>`;
    }

    function lobby(sizeKey) {
      return function (el, corpus) {
        const players = corpus.players[sizeKey];
        const copy = lobbyCopy(players);
        const bots = botCount(players);
        const addable = canAddBot(players);
        const ctaId = `r2-cta-${sizeKey}`;
        el.innerHTML = `
          <div class="r2-shell">
            ${chrome(corpus.roomCodeFormatted, 'Lobby', ['Invite friends', 'Show QR code', 'Present room', 'How to play'])}
            <div class="r2-body">
              ${hero('Room code', corpus.roomCodeFormatted, `${players.length} in the room.`)}
              <ul class="r2-roster">
                ${players.map(playerChip).join('')}
              </ul>
              <button class="r2-addbot" type="button" ${addable ? '' : 'disabled'}>${addable ? `Add a bot (${bots}/3)` : `Bots full (${bots}/3)`}</button>
            </div>
            ${actionRail(ctaId, 'Start Linejam', !copy.canStart, copy.status, 'Close room')}
          </div>`;
      };
    }

    function write(el, corpus) {
      const w = corpus.writing;
      const filled = w.currentWords.length;
      const text = w.currentWords.join(' ');
      el.innerHTML = `
        <div class="r2-shell">
          ${chrome(corpus.roomCodeFormatted, 'Write', ['How to play', 'Leave room'])}
          <div class="r2-body">
            ${hero(`Round ${w.round} of ${w.totalRounds}`, `${w.targetWordCount}-word line`, '')}
            <p class="r2-received-label">Previous line</p>
            <p class="r2-received">${esc(w.previousLineText)}</p>
            <div class="r2-canvas">
              <p class="r2-current">${text ? esc(text) : '&nbsp;'}</p>
              <div class="r2-slots">
                ${Array.from({ length: w.targetWordCount })
                  .map((_, i) => `<span class="r2-slot${i < filled ? ' filled' : ''}"></span>`)
                  .join('')}
              </div>
            </div>
          </div>
          ${actionRail('r2-submit', 'Submit', false, `${filled} of ${w.targetWordCount} words written &middot; ${text.length}/500 characters`, null)}
        </div>`;
    }

    function recap(el, corpus) {
      const poems = corpus.recapPoems;
      const fav = poems.find((p) => p.isFavorite);
      el.innerHTML = `
        <div class="r2-shell">
          ${chrome(corpus.roomCodeFormatted, 'Recap', ['Share the set', 'Exit room'])}
          <div class="r2-body">
            ${hero('Session recap', 'All poems revealed', 'Replay the set or start another round.')}
            ${
              fav
                ? `
            <div class="r2-favorite">
              <span class="r2-favorite-badge" aria-hidden="true">&#9813;&#9829;</span>
              <div class="r2-favorite-body">
                <p class="r2-favorite-kicker">Room favorite &middot; ${corpus.favoriteLeaderCount} heart${corpus.favoriteLeaderCount === 1 ? '' : 's'}</p>
                <a class="r2-favorite-link" href="#">&ldquo;${esc(fav.preview)}&rdquo;</a>
                <p class="r2-favorite-reader">Read by ${esc(fav.reader)}</p>
              </div>
            </div>`
                : ''
            }
            <ul class="r2-poem-list">
              ${poems
                .map(
                  (p, i) => `
                <li class="r2-poem-row">
                  <span class="r2-poem-index">${String(i + 1).padStart(2, '0')}</span>
                  <span class="r2-poem-text">&ldquo;${esc(p.preview)}&rdquo;</span>
                  <span class="r2-poem-reader">${esc(p.reader)}</span>
                </li>`
                )
                .join('')}
            </ul>
          </div>
          ${actionRail('r2-next-round', 'Start next round', false, `${poems.length} poems read this round.`, 'Back to lobby')}
        </div>`;
    }

    window.LANE_SPECS['REDESIGN-2'] = {
      lane: 'redesign',
      title: 'Shared action rail',
      move: 'Closes the recap dead end (audit: "no back navigation") by mounting one literal action-rail component, unchanged, on Lobby, Write, and Recap, and pushes every secondary control — including invite — behind a single "Room" disclosure so only the code, the roster, and the rail stay in view.',
      css: `
        .opt-REDESIGN-2 { height: 100%; font-family: var(--font-sans); color: var(--color-text-primary); background: var(--color-background); }
        .opt-REDESIGN-2 * { box-sizing: border-box; }
        .opt-REDESIGN-2 .r2-shell { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
        .opt-REDESIGN-2 button, .opt-REDESIGN-2 summary { font-family: var(--font-sans); }
        .opt-REDESIGN-2 button:focus-visible, .opt-REDESIGN-2 summary:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
        .opt-REDESIGN-2 .r2-chrome { flex: none; display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border-subtle); }
        .opt-REDESIGN-2 .r2-chrome-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .opt-REDESIGN-2 .r2-code-chip { flex: none; font: 700 10px/1 var(--font-mono); letter-spacing: 0.18em; text-transform: uppercase; background: var(--color-muted); border: 1px solid var(--color-border); border-radius: var(--radius-full); padding: 7px 10px; color: var(--color-text-secondary); }
        .opt-REDESIGN-2 .r2-screen-label { font: 600 var(--text-sm)/1 var(--font-sans); color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .opt-REDESIGN-2 .r2-room-toggle { position: relative; flex: none; }
        .opt-REDESIGN-2 .r2-room-toggle summary { list-style: none; cursor: pointer; }
        .opt-REDESIGN-2 .r2-room-toggle summary::-webkit-details-marker { display: none; }
        .opt-REDESIGN-2 .r2-room-btn { border-radius: var(--radius-full); border: 1px solid var(--color-border); background: var(--color-surface); font: 600 var(--text-sm)/1 var(--font-sans); padding: 0 16px; height: 40px; display: inline-flex; align-items: center; transition: background var(--duration-fast) var(--ease-theme); }
        .opt-REDESIGN-2 .r2-room-btn:hover { background: var(--color-surface-hover); }
        .opt-REDESIGN-2 .r2-room-panel { position: absolute; right: 0; top: calc(100% + 6px); z-index: 5; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); padding: var(--space-2); min-width: 200px; display: flex; flex-direction: column; gap: 4px; }
        .opt-REDESIGN-2 .r2-room-item { text-align: left; background: none; border: none; padding: 8px 10px; border-radius: var(--radius-sm); font: 500 var(--text-sm)/1.2 var(--font-sans); cursor: pointer; transition: background var(--duration-fast) var(--ease-theme); }
        .opt-REDESIGN-2 .r2-room-item:hover { background: var(--color-surface-hover); }
        .opt-REDESIGN-2 .r2-body { flex: 1; min-height: 0; overflow-y: auto; padding: 0 var(--space-3) var(--space-2); display: flex; flex-direction: column; gap: var(--space-2); }
        .opt-REDESIGN-2 .r2-hero { padding-top: var(--space-2); }
        .opt-REDESIGN-2 .r2-hero-kicker { margin: 0 0 4px; font: 700 var(--text-xs)/1 var(--font-mono); text-transform: uppercase; letter-spacing: var(--tracking-wider); color: var(--color-text-muted); }
        .opt-REDESIGN-2 .r2-hero-big { margin: 0; font: 500 var(--text-2xl)/1.05 var(--font-display); letter-spacing: var(--tracking-wide); }
        .opt-REDESIGN-2 .r2-status { margin: 6px 0 0; font-size: var(--text-sm); color: var(--color-text-secondary); }
        .opt-REDESIGN-2 .r2-roster { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
        .opt-REDESIGN-2 .r2-chip-player { display: flex; align-items: center; gap: 6px; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 6px 10px 6px 6px; background: var(--color-surface); }
        .opt-REDESIGN-2 .r2-chip-player.host { border-color: var(--color-primary); }
        .opt-REDESIGN-2 .r2-chip-avatar { flex: none; width: 22px; height: 22px; border-radius: var(--radius-sm); background: var(--color-muted); display: flex; align-items: center; justify-content: center; font: 700 10px/1 var(--font-sans); color: var(--color-text-secondary); }
        .opt-REDESIGN-2 .r2-chip-player.host .r2-chip-avatar { background: var(--color-primary); color: var(--color-text-inverse); }
        .opt-REDESIGN-2 .r2-chip-name { font: 500 var(--text-xs)/1 var(--font-sans); }
        .opt-REDESIGN-2 .r2-chip-tag { font: 700 8px/1 var(--font-mono); text-transform: uppercase; color: var(--color-text-muted); }
        .opt-REDESIGN-2 .r2-addbot { align-self: flex-start; border-radius: var(--radius-md); border: 1px dashed var(--color-border); background: none; color: var(--color-text-secondary); font: 600 var(--text-xs)/1 var(--font-sans); padding: 8px 12px; cursor: pointer; transition: background var(--duration-fast) var(--ease-theme); }
        .opt-REDESIGN-2 .r2-addbot:hover:not(:disabled) { background: var(--color-surface-hover); }
        .opt-REDESIGN-2 .r2-addbot:disabled { color: var(--color-text-muted); cursor: not-allowed; }
        .opt-REDESIGN-2 .r2-received-label { margin: var(--space-2) 0 4px; font: 700 var(--text-xs)/1 var(--font-mono); text-transform: uppercase; letter-spacing: var(--tracking-wide); color: var(--color-primary); }
        .opt-REDESIGN-2 .r2-received { margin: 0; font: italic 500 var(--text-md)/1.35 var(--font-display); color: var(--color-text-secondary); }
        .opt-REDESIGN-2 .r2-canvas { margin-top: var(--space-2); display: flex; flex-direction: column; gap: 8px; }
        .opt-REDESIGN-2 .r2-current { margin: 0; font: 500 var(--text-xl)/1.2 var(--font-display); min-height: 1.2em; }
        .opt-REDESIGN-2 .r2-slots { display: flex; gap: 6px; }
        .opt-REDESIGN-2 .r2-slot { width: 20px; height: 20px; border: 2px solid var(--color-border); border-radius: var(--radius-sm); }
        .opt-REDESIGN-2 .r2-slot.filled { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 12%, transparent); }
        .opt-REDESIGN-2 .r2-favorite { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid var(--color-primary); border-radius: var(--radius-md); background: color-mix(in srgb, var(--color-primary) 7%, var(--color-surface)); }
        .opt-REDESIGN-2 .r2-favorite-badge { flex: none; width: 26px; height: 26px; border-radius: var(--radius-sm); background: var(--color-primary); color: var(--color-text-inverse); display: flex; align-items: center; justify-content: center; font-size: 11px; }
        .opt-REDESIGN-2 .r2-favorite-body { flex: 1; min-width: 0; }
        .opt-REDESIGN-2 .r2-favorite-kicker { margin: 0; font: 700 10px/1 var(--font-mono); text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-primary); }
        .opt-REDESIGN-2 .r2-favorite-link { display: block; font: italic 500 var(--text-sm)/1.25 var(--font-display); color: var(--color-text-primary); text-decoration: underline; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .opt-REDESIGN-2 .r2-favorite-reader { margin: 0; font: 600 10px/1 var(--font-sans); color: var(--color-text-muted); }
        .opt-REDESIGN-2 .r2-poem-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .opt-REDESIGN-2 .r2-poem-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--radius-md); background: var(--color-surface); border: 1px solid var(--color-border-subtle); }
        .opt-REDESIGN-2 .r2-poem-index { flex: none; font: 700 var(--text-xs)/1 var(--font-mono); color: var(--color-text-muted); }
        .opt-REDESIGN-2 .r2-poem-text { flex: 1; min-width: 0; font: italic 500 var(--text-sm)/1.3 var(--font-display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .opt-REDESIGN-2 .r2-poem-reader { flex: none; font: 600 var(--text-xs)/1 var(--font-sans); color: var(--color-text-muted); }
        .opt-REDESIGN-2 .r2-rail { flex: none; padding: var(--space-2) var(--space-3) var(--space-3); border-top: 1px solid var(--color-border); background: var(--color-surface); }
        .opt-REDESIGN-2 .r2-rail-status { margin: 0 0 8px; font-size: var(--text-xs); color: var(--color-text-muted); text-align: center; }
        .opt-REDESIGN-2 .r2-cta { width: 100%; height: 52px; border-radius: var(--radius-md); border: none; background: var(--color-primary); color: var(--color-text-inverse); font: 600 var(--text-base)/1 var(--font-sans); cursor: pointer; transition: background var(--duration-fast) var(--ease-theme), transform var(--duration-instant) var(--ease-theme); }
        .opt-REDESIGN-2 .r2-cta:disabled { background: var(--color-muted); color: var(--color-text-muted); cursor: not-allowed; }
        .opt-REDESIGN-2 .r2-cta:not(:disabled):hover { background: var(--color-primary-hover); }
        .opt-REDESIGN-2 .r2-cta:not(:disabled):active { background: var(--color-primary-active); transform: translateY(1px); }
        .opt-REDESIGN-2 .r2-cta-secondary { display: block; width: 100%; margin-top: 8px; background: none; border: none; font: 500 var(--text-sm)/1 var(--font-sans); color: var(--color-text-secondary); text-decoration: underline; cursor: pointer; padding: 6px; }
      `,
      screens: {
        'lobby-low': lobby('low'),
        'lobby-mid': lobby('mid'),
        'lobby-max': lobby('max'),
        write: write,
        'recap-mid': recap,
      },
    };
  })();

  // =========================================================================
  // REDESIGN-3 — Landmark shell + roster grid
  // Fixes: "no skip-to-content link" and "div soup" (audit, Strategic
  // Omissions / Code Quality) with real <nav>/<main> landmarks, a skip link
  // that jumps straight to the primary CTA (serving both the a11y omission
  // and DESIGN.md's thumb-zone law at once), and an aria-live status region.
  // Roster fix: instead of a uniform list or uniform grid (audit: "three
  // equal columns is the most generic AI layout"), the host spans the full
  // row and everyone else pairs up two-per-row — an asymmetric grid, not a
  // symmetric one. Chrome trades disclosure for compact always-visible
  // icon buttons, all carrying real aria-labels.
  // =========================================================================
  (function defineRedesign3() {
    function chrome(codeText, status, ctaId, ctaLabel) {
      return `
        <a class="r3-skip-link" href="#${ctaId}">Skip to ${esc(ctaLabel)}</a>
        <header class="r3-chrome">
          <nav class="r3-nav" aria-label="Room actions">
            <span class="r3-code" aria-label="Room code ${esc(codeText)}">${esc(codeText)}</span>
            <button class="r3-nav-btn" type="button" aria-label="Invite players">+</button>
            <button class="r3-nav-btn" type="button" aria-label="Show QR code">&#9638;</button>
            <button class="r3-nav-btn" type="button" aria-label="How to play">?</button>
          </nav>
          <p class="r3-status" aria-live="polite">${esc(status)}</p>
        </header>`;
    }

    function playerTile(p) {
      return `
        <li class="r3-player${p.host ? ' host' : ''}">
          <span class="r3-avatar">${initials(p.name)}</span>
          <span class="r3-player-info">
            <span class="r3-player-name">${esc(p.name)}${p.isAway ? ' &middot; away' : ''}</span>
            ${playerTag(p) ? `<span class="r3-player-role">${esc(playerTag(p))}</span>` : ''}
          </span>
        </li>`;
    }

    function lobby(sizeKey) {
      return function (el, corpus) {
        const players = corpus.players[sizeKey];
        const copy = lobbyCopy(players);
        const bots = botCount(players);
        const addable = canAddBot(players);
        const ctaId = `r3-cta-${sizeKey}`;
        el.innerHTML = `
          <div class="r3-shell">
            ${chrome(corpus.roomCodeFormatted, copy.status, ctaId, 'Start Linejam')}
            <main class="r3-main" id="r3-main-${sizeKey}">
              <h2 class="r3-section-title">Players</h2>
              <ul class="r3-roster-grid">
                ${players.map(playerTile).join('')}
              </ul>
              <div class="r3-controls">
                <button class="r3-control-btn" type="button" ${addable ? '' : 'disabled'}>${addable ? `Add a bot (${bots}/3)` : `Bots full (${bots}/3)`}</button>
                <button class="r3-control-btn" type="button">Present room</button>
              </div>
            </main>
            <div class="r3-action" role="group" aria-label="Primary actions">
              <button class="r3-cta" id="${ctaId}" type="button" ${copy.canStart ? '' : 'disabled'}>Start Linejam</button>
              <button class="r3-cta-secondary" type="button">Close room</button>
            </div>
          </div>`;
      };
    }

    function write(el, corpus) {
      const w = corpus.writing;
      const filled = w.currentWords.length;
      const text = w.currentWords.join(' ');
      el.innerHTML = `
        <div class="r3-shell">
          ${chrome(corpus.roomCodeFormatted, `Round ${w.round} of ${w.totalRounds} &middot; ${filled} of ${w.targetWordCount} words written`, 'r3-submit', 'Submit')}
          <main class="r3-main" id="r3-main-write">
            <h2 class="r3-section-title">Previous line</h2>
            <p class="r3-received">${esc(w.previousLineText)}</p>
            <div class="r3-canvas">
              <p class="r3-current">${text ? esc(text) : '&nbsp;'}</p>
              <div class="r3-slots">
                ${Array.from({ length: w.targetWordCount })
                  .map((_, i) => `<span class="r3-slot${i < filled ? ' filled' : ''}"></span>`)
                  .join('')}
              </div>
              <p class="r3-charcount">${text.length}/500 characters</p>
            </div>
          </main>
          <div class="r3-action" role="group" aria-label="Primary actions">
            <button class="r3-cta" id="r3-submit" type="button">Submit</button>
          </div>
        </div>`;
    }

    function recap(el, corpus) {
      const poems = corpus.recapPoems;
      const fav = poems.find((p) => p.isFavorite);
      el.innerHTML = `
        <div class="r3-shell">
          ${chrome(corpus.roomCodeFormatted, `${poems.length} poems read this round`, 'r3-next-round', 'Start next round')}
          <main class="r3-main" id="r3-main-recap">
            <h2 class="r3-section-title">Session recap</h2>
            ${
              fav
                ? `
            <section class="r3-favorite" aria-label="Room favorite">
              <p class="r3-favorite-kicker">&#9813; &#9829; Room favorite &middot; ${corpus.favoriteLeaderCount} heart${corpus.favoriteLeaderCount === 1 ? '' : 's'}</p>
              <a class="r3-favorite-link" href="#">&ldquo;${esc(fav.preview)}&rdquo;</a>
              <p class="r3-favorite-reader">Read by ${esc(fav.reader)}</p>
            </section>`
                : ''
            }
            <ul class="r3-poem-list">
              ${poems
                .map(
                  (p, i) => `
                <li class="r3-poem-row">
                  <span class="r3-poem-index">${String(i + 1).padStart(2, '0')}</span>
                  <span class="r3-poem-text">&ldquo;${esc(p.preview)}&rdquo;</span>
                  <span class="r3-poem-reader">${esc(p.reader)}</span>
                </li>`
                )
                .join('')}
            </ul>
          </main>
          <div class="r3-action" role="group" aria-label="Primary actions">
            <button class="r3-cta" id="r3-next-round" type="button">Start next round</button>
            <button class="r3-cta-secondary" type="button">Back to lobby</button>
          </div>
        </div>`;
    }

    window.LANE_SPECS['REDESIGN-3'] = {
      lane: 'redesign',
      title: 'Landmark shell + roster grid',
      move: 'Rebuilds the frame as real HTML landmarks (nav/main) with a skip link that jumps straight to the primary CTA and an aria-live status region (audit: "no skip-to-content link"), and replaces the player list with an asymmetric grid — host full-width, everyone else paired two-up — so density scales without adding height per player.',
      css: `
        .opt-REDESIGN-3 { height: 100%; font-family: var(--font-sans); color: var(--color-text-primary); background: var(--color-background); }
        .opt-REDESIGN-3 * { box-sizing: border-box; }
        .opt-REDESIGN-3 .r3-shell { height: 100%; display: flex; flex-direction: column; overflow: hidden; position: relative; }
        .opt-REDESIGN-3 button, .opt-REDESIGN-3 a { font-family: var(--font-sans); }
        .opt-REDESIGN-3 button:focus-visible, .opt-REDESIGN-3 a:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
        .opt-REDESIGN-3 .r3-skip-link { position: absolute; left: -9999px; top: 0; background: var(--color-primary); color: var(--color-text-inverse); padding: 10px 16px; border-radius: 0 0 var(--radius-md) 0; z-index: 20; font: 600 var(--text-sm)/1 var(--font-sans); text-decoration: none; }
        .opt-REDESIGN-3 .r3-skip-link:focus { left: 0; }
        .opt-REDESIGN-3 .r3-chrome { flex: none; padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border-subtle); }
        .opt-REDESIGN-3 .r3-nav { display: flex; align-items: center; gap: 8px; }
        .opt-REDESIGN-3 .r3-code { flex: 1; min-width: 0; font: 700 var(--text-sm)/1 var(--font-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-text-primary); }
        .opt-REDESIGN-3 .r3-nav-btn { flex: none; width: 38px; height: 38px; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); font: 600 var(--text-sm)/1 var(--font-sans); cursor: pointer; transition: background var(--duration-fast) var(--ease-theme); }
        .opt-REDESIGN-3 .r3-nav-btn:hover { background: var(--color-surface-hover); }
        .opt-REDESIGN-3 .r3-nav-btn:active { transform: scale(0.96); }
        .opt-REDESIGN-3 .r3-status { margin: 6px 0 0; font-size: var(--text-xs); color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .opt-REDESIGN-3 .r3-main { flex: 1; min-height: 0; overflow-y: auto; padding: var(--space-3); }
        .opt-REDESIGN-3 .r3-section-title { margin: 0 0 var(--space-2); font: 700 var(--text-xs)/1 var(--font-mono); text-transform: uppercase; letter-spacing: var(--tracking-wider); color: var(--color-text-muted); }
        .opt-REDESIGN-3 .r3-roster-grid { list-style: none; margin: 0 0 var(--space-2); padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .opt-REDESIGN-3 .r3-roster-grid .r3-player.host { grid-column: 1 / -1; }
        .opt-REDESIGN-3 .r3-player { display: flex; align-items: center; gap: 8px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 8px 10px; background: var(--color-surface); min-width: 0; }
        .opt-REDESIGN-3 .r3-player.host { background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface)); border-color: var(--color-primary); }
        .opt-REDESIGN-3 .r3-avatar { flex: none; width: 26px; height: 26px; border-radius: var(--radius-md); background: var(--color-muted); display: flex; align-items: center; justify-content: center; font: 700 11px/1 var(--font-sans); color: var(--color-text-secondary); }
        .opt-REDESIGN-3 .r3-player.host .r3-avatar { background: var(--color-primary); color: var(--color-text-inverse); }
        .opt-REDESIGN-3 .r3-player-info { min-width: 0; display: flex; flex-direction: column; }
        .opt-REDESIGN-3 .r3-player-name { display: block; font: 500 var(--text-xs)/1.2 var(--font-sans); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .opt-REDESIGN-3 .r3-player-role { display: block; font: 700 9px/1 var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted); margin-top: 2px; }
        .opt-REDESIGN-3 .r3-controls { display: flex; flex-wrap: wrap; gap: 8px; padding-top: var(--space-2); border-top: 1px solid var(--color-border-subtle); }
        .opt-REDESIGN-3 .r3-control-btn { flex: 1 1 auto; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); font: 600 var(--text-xs)/1 var(--font-sans); padding: 9px 10px; text-align: center; cursor: pointer; transition: background var(--duration-fast) var(--ease-theme); }
        .opt-REDESIGN-3 .r3-control-btn:hover:not(:disabled) { background: var(--color-surface-hover); }
        .opt-REDESIGN-3 .r3-control-btn:disabled { color: var(--color-text-muted); cursor: not-allowed; }
        .opt-REDESIGN-3 .r3-received { margin: 0 0 var(--space-3); font: italic 500 var(--text-lg)/1.35 var(--font-display); color: var(--color-text-secondary); }
        .opt-REDESIGN-3 .r3-canvas { display: flex; flex-direction: column; gap: 8px; }
        .opt-REDESIGN-3 .r3-current { margin: 0; font: 500 var(--text-2xl)/1.2 var(--font-display); min-height: 1.2em; }
        .opt-REDESIGN-3 .r3-slots { display: flex; gap: 6px; }
        .opt-REDESIGN-3 .r3-slot { width: 22px; height: 22px; border: 2px solid var(--color-border); border-radius: var(--radius-sm); }
        .opt-REDESIGN-3 .r3-slot.filled { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 12%, transparent); }
        .opt-REDESIGN-3 .r3-charcount { margin: 0; font: var(--text-xs)/1 var(--font-mono); color: var(--color-text-muted); }
        .opt-REDESIGN-3 .r3-favorite { display: block; margin: 0 0 var(--space-2); padding: 8px 10px; border-radius: var(--radius-lg); border: 1px solid var(--color-primary); background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface)); }
        .opt-REDESIGN-3 .r3-favorite-kicker { margin: 0; font: 700 10px/1 var(--font-mono); text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-primary); }
        .opt-REDESIGN-3 .r3-favorite-link { display: block; font: italic 500 var(--text-sm)/1.25 var(--font-display); color: var(--color-text-primary); text-decoration: underline; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .opt-REDESIGN-3 .r3-favorite-reader { margin: 0; font: 600 10px/1 var(--font-sans); color: var(--color-text-muted); }
        .opt-REDESIGN-3 .r3-poem-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .opt-REDESIGN-3 .r3-poem-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--radius-md); background: var(--color-surface); border: 1px solid var(--color-border-subtle); }
        .opt-REDESIGN-3 .r3-poem-index { flex: none; font: 700 var(--text-xs)/1 var(--font-mono); color: var(--color-text-muted); }
        .opt-REDESIGN-3 .r3-poem-text { flex: 1; min-width: 0; font: italic 500 var(--text-sm)/1.3 var(--font-display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .opt-REDESIGN-3 .r3-poem-reader { flex: none; font: 600 var(--text-xs)/1 var(--font-sans); color: var(--color-text-muted); }
        .opt-REDESIGN-3 .r3-action { flex: none; padding: var(--space-2) var(--space-3) var(--space-3); border-top: 1px solid var(--color-border-subtle); }
        .opt-REDESIGN-3 .r3-cta { width: 100%; height: 52px; border-radius: var(--radius-lg); border: none; background: var(--color-primary); color: var(--color-text-inverse); font: 600 var(--text-base)/1 var(--font-sans); cursor: pointer; transition: background var(--duration-fast) var(--ease-theme), transform var(--duration-instant) var(--ease-theme); }
        .opt-REDESIGN-3 .r3-cta:disabled { background: var(--color-muted); color: var(--color-text-muted); cursor: not-allowed; }
        .opt-REDESIGN-3 .r3-cta:not(:disabled):hover { background: var(--color-primary-hover); }
        .opt-REDESIGN-3 .r3-cta:not(:disabled):active { background: var(--color-primary-active); transform: translateY(1px); }
        .opt-REDESIGN-3 .r3-cta-secondary { display: block; width: 100%; margin-top: 8px; background: none; border: 1px solid var(--color-border); border-radius: var(--radius-md); font: 500 var(--text-sm)/1 var(--font-sans); color: var(--color-text-primary); padding: 10px; cursor: pointer; transition: background var(--duration-fast) var(--ease-theme); }
        .opt-REDESIGN-3 .r3-cta-secondary:hover { background: var(--color-surface-hover); }
      `,
      screens: {
        'lobby-low': lobby('low'),
        'lobby-mid': lobby('mid'),
        'lobby-max': lobby('max'),
        write: write,
        'recap-mid': recap,
      },
    };
  })();
})();
