// TASTE lane — three structurally distinct room-frame systems, each built
// against leon-taste-skill's anti-default dials (metric-based rules over
// vibes): DESIGN_VARIANCE toward asymmetric/merged compositions instead of
// centered stacks, VISUAL_DENSITY tuned per option (T1 "daily app" ~4,
// T2 "daily app, split" ~5, T3 "cockpit" ~7-8), and restraint as the actual
// scroll-killer — Rule 4's "anti-card-overuse" (divide-y rows, no boxed
// cards eating padding), Rule 2's single-accent discipline (no rainbow
// per-player palette — status reads via mono glyphs, not hue), and Rule 1's
// "control hierarchy with weight/color, not massive scale" (the room-code
// hero shrinks to a legible badge instead of a room-eating hero block, the
// exact move DESIGN.md's "hero" law permits once chrome+hero merge). Every
// value is a var(--token); the accent stays singular; :active is the only
// motion (DESIGN.md law 7: no ambient motion).
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  // -- shared helpers (content/logic only — no shared markup or CSS) -------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[c]);
  }
  function initials(name) {
    return esc(String(name).charAt(0).toUpperCase());
  }
  function needMore(players) {
    return Math.max(0, 2 - players.length);
  }
  function botCount(players) {
    return players.filter((p) => p.isBot).length;
  }
  function botDisabled(players) {
    return botCount(players) >= 3 || players.length >= 8;
  }
  function glyphFor(p) {
    if (p.host) return 'HOST';
    if (p.isBot) return 'AI';
    if (p.isAway) return 'AWAY';
    return '';
  }
  function lobbyStatus(players, corpus) {
    const n = needMore(players);
    if (n > 0) {
      return `Need ${n} more player${n === 1 ? '' : 's'}. Share ${corpus.roomCodeFormatted} to start.`;
    }
    return `${players.length} players ready. Start when you like.`;
  }
  function lobbyCta(players) {
    const n = needMore(players);
    return n > 0 ? `Need ${n} more player${n === 1 ? '' : 's'}` : 'Start Linejam';
  }
  function wordSlots(w) {
    return Array.from({ length: w.targetWordCount }).map((_, i) =>
      i < w.currentWords.length ? { filled: true, word: w.currentWords[i] } : { filled: false }
    );
  }

  // =========================================================================
  // TASTE-1 — "Merged Strip": chrome + hero collapse into one row (badge
  // legible via weight/tracking, not scale); lobby extras become a single
  // compact icon-label row instead of four stacked full-width blocks; roster
  // is a wrapping chip cluster that scales its own row count instead of
  // growing a fixed-height list; one full-width CTA bar closes every screen.
  // =========================================================================
  (function () {
    function bar(codeLabel, actions) {
      return `
        <header class="t1-bar">
          <span class="t1-code">${esc(codeLabel)}</span>
          <div class="t1-actions">${actions}</div>
        </header>`;
    }
    const chromeActions = `
      <button class="t1-chip" type="button">Share</button>
      <button class="t1-chip t1-chip-icon" type="button" aria-label="How to play">?</button>
      <button class="t1-chip t1-chip-icon" type="button" aria-label="More options">&#8943;</button>`;
    const recapActions = `
      <button class="t1-chip" type="button">Share recap</button>
      <button class="t1-chip t1-chip-icon" type="button" aria-label="More options">&#8943;</button>`;

    function quickRow(players) {
      return `
        <div class="t1-quickrow">
          <button class="t1-quick" type="button"><span class="t1-quick-glyph">QR</span>Show QR</button>
          <button class="t1-quick" type="button" ${botDisabled(players) ? 'disabled' : ''}><span class="t1-quick-glyph">+AI</span>Add bot ${botCount(players)}/3</button>
          <button class="t1-quick" type="button"><span class="t1-quick-glyph">&#9635;</span>Present room</button>
        </div>`;
    }

    function rosterList(players) {
      return `
        <ul class="t1-roster" role="list">
          ${players
            .map((p) => {
              const g = glyphFor(p);
              return `
              <li class="t1-chip-player ${p.isAway ? 't1-away' : ''}">
                <span class="t1-avatar">${initials(p.name)}</span>
                <span class="t1-pname">${esc(p.name)}</span>
                ${g ? `<span class="t1-tag ${p.host ? 't1-tag-host' : ''}">${g}</span>` : ''}
              </li>`;
            })
            .join('')}
        </ul>`;
    }

    function lobbyScreen(sizeKey) {
      return function (el, corpus) {
        const players = corpus.players[sizeKey];
        const ready = needMore(players) === 0;
        el.innerHTML = `
          <div class="t1-shell">
            ${bar(corpus.roomCodeFormatted, chromeActions)}
            <p class="t1-status">${esc(lobbyStatus(players, corpus))}</p>
            ${quickRow(players)}
            <div class="t1-body">
              ${rosterList(players)}
            </div>
            <div class="t1-cta-zone">
              <button class="t1-cta-btn" type="button" ${ready ? '' : 'disabled'}>${esc(lobbyCta(players))}</button>
              <button class="t1-cta-ghost" type="button">Close room</button>
            </div>
          </div>`;
      };
    }

    function writeScreen(el, corpus) {
      const w = corpus.writing;
      const slots = wordSlots(w);
      el.innerHTML = `
        <div class="t1-shell">
          ${bar(corpus.roomCodeFormatted, chromeActions)}
          <p class="t1-status">Round ${w.round} of ${w.totalRounds} &middot; ${w.targetWordCount} words this line.</p>
          <div class="t1-body">
            <div class="t1-write-body">
              <p class="t1-received-label">Line so far</p>
              <p class="t1-received-line">&ldquo;${esc(w.previousLineText)}&rdquo;</p>
              <div class="t1-word-row">
                ${slots
                  .map((s) =>
                    s.filled
                      ? `<span class="t1-word-chip t1-word-filled">${esc(s.word)}</span>`
                      : `<span class="t1-word-chip t1-word-empty">&middot;</span>`
                  )
                  .join('')}
              </div>
            </div>
          </div>
          <div class="t1-cta-zone t1-write-zone">
            <input class="t1-word-input" type="text" placeholder="Type your word" aria-label="Your word" />
            <button class="t1-cta-btn t1-write-submit" type="button">Submit</button>
          </div>
        </div>`;
    }

    function recapScreen(el, corpus) {
      const fav = corpus.recapPoems.find((p) => p.isFavorite);
      el.innerHTML = `
        <div class="t1-shell">
          ${bar(corpus.roomCodeFormatted, recapActions)}
          <p class="t1-status">${corpus.recapPoems.length} poems read tonight.</p>
          <div class="t1-body">
            ${
              fav
                ? `
            <div class="t1-fav">
              <p class="t1-fav-kicker"><span class="t1-fav-glyph">&#9825;&#9819;</span>Room favorite &middot; ${corpus.favoriteLeaderCount} heart${corpus.favoriteLeaderCount === 1 ? '' : 's'}</p>
              <p class="t1-fav-line">&ldquo;${esc(fav.preview)}&rdquo;</p>
              <p class="t1-fav-reader">Read by ${esc(fav.reader)}</p>
            </div>`
                : ''
            }
            <ul class="t1-poems" role="list">
              ${corpus.recapPoems
                .map(
                  (p) => `
                <li class="t1-poem-row">
                  <span class="t1-poem-reader">${initials(p.reader)}</span>
                  <span class="t1-poem-preview">&ldquo;${esc(p.preview)}&rdquo;</span>
                </li>`
                )
                .join('')}
            </ul>
          </div>
          <div class="t1-cta-zone t1-recap-zone">
            <div class="t1-recap-ctas">
              <button class="t1-cta-btn t1-cta-outline" type="button">Back to Lobby</button>
              <button class="t1-cta-btn" type="button">Start Next Round</button>
            </div>
          </div>
        </div>`;
    }

    window.LANE_SPECS['TASTE-1'] = {
      lane: 'taste',
      title: 'Merged Strip',
      move: 'Chrome and room-code hero fold into one row (legible via weight/tracking, not a giant scaled block); lobby extras collapse from four stacked full-width buttons to one labeled icon row; roster is a wrapping chip cluster, not a growing list; one full-width CTA bar closes every screen.',
      css: `
        .opt-TASTE-1 { font-family: var(--font-sans); color: var(--color-text-primary); background: var(--color-background); height: 100%; overflow: hidden; }
        .opt-TASTE-1 .t1-shell { display: flex; flex-direction: column; height: 100%; min-height: 0; }
        .opt-TASTE-1 .t1-bar { flex: none; display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); padding: var(--space-3) var(--space-3) var(--space-1); }
        .opt-TASTE-1 .t1-code { font: 700 var(--text-lg)/1 var(--font-mono); letter-spacing: var(--tracking-wider); color: var(--color-text-primary); background: var(--color-muted); border: 1px solid var(--color-border); border-radius: var(--radius-full); padding: var(--space-1) var(--space-3); }
        .opt-TASTE-1 .t1-actions { display: flex; gap: var(--space-1); flex: none; }
        .opt-TASTE-1 .t1-chip { font: 600 var(--text-xs)/1 var(--font-sans); border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); border-radius: var(--radius-full); padding: 0 var(--space-2); height: 32px; cursor: pointer; transition: transform var(--duration-fast) var(--ease-theme), background var(--duration-fast) var(--ease-theme); }
        .opt-TASTE-1 .t1-chip:active { transform: scale(0.96); background: var(--color-surface-hover); }
        .opt-TASTE-1 .t1-chip-icon { width: 32px; padding: 0; }
        .opt-TASTE-1 .t1-status { flex: none; margin: 0; padding: 0 var(--space-3) var(--space-2); font: 500 var(--text-sm)/1.3 var(--font-sans); color: var(--color-text-secondary); }
        .opt-TASTE-1 .t1-quickrow { flex: none; display: flex; flex-wrap: wrap; gap: var(--space-2); padding: 0 var(--space-3) var(--space-2); }
        .opt-TASTE-1 .t1-quick { display: flex; align-items: center; gap: var(--space-1); border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-md); padding: var(--space-1) var(--space-2); font: 600 var(--text-xs)/1 var(--font-sans); color: var(--color-text-primary); cursor: pointer; transition: transform var(--duration-fast) var(--ease-theme); }
        .opt-TASTE-1 .t1-quick:active { transform: scale(0.96); }
        .opt-TASTE-1 .t1-quick[disabled] { opacity: 0.45; cursor: not-allowed; }
        .opt-TASTE-1 .t1-quick-glyph { font: 700 var(--text-xs)/1 var(--font-mono); color: var(--color-primary); }
        .opt-TASTE-1 .t1-body { flex: 1; min-height: 0; overflow-y: auto; padding: 0 var(--space-3); border-top: 1px solid var(--color-border-subtle); display: flex; flex-direction: column; justify-content: center; }
        .opt-TASTE-1 .t1-roster { list-style: none; margin: 0; padding: var(--space-2) 0; display: flex; flex-wrap: wrap; gap: var(--space-2); align-content: flex-start; }
        .opt-TASTE-1 .t1-chip-player { display: flex; align-items: center; gap: var(--space-1); border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-full); padding: var(--space-1) var(--space-2) var(--space-1) var(--space-1); }
        .opt-TASTE-1 .t1-away { opacity: 0.6; }
        .opt-TASTE-1 .t1-avatar { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font: 700 var(--text-xs)/1 var(--font-mono); background: var(--color-muted); color: var(--color-text-primary); flex: none; }
        .opt-TASTE-1 .t1-pname { font: 500 var(--text-sm)/1 var(--font-sans); }
        .opt-TASTE-1 .t1-tag { font: 700 9px/1 var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-muted); }
        .opt-TASTE-1 .t1-tag-host { color: var(--color-primary); }
        .opt-TASTE-1 .t1-cta-zone { flex: none; padding: var(--space-2) var(--space-3) var(--space-3); border-top: 1px solid var(--color-border-subtle); background: var(--color-surface); }
        .opt-TASTE-1 .t1-cta-btn { width: 100%; height: 48px; border-radius: var(--radius-md); border: none; background: var(--color-primary); color: var(--color-text-inverse); font: 700 var(--text-md)/1 var(--font-sans); cursor: pointer; transition: transform var(--duration-fast) var(--ease-theme); }
        .opt-TASTE-1 .t1-cta-btn:active { transform: translateY(1px) scale(0.99); }
        .opt-TASTE-1 .t1-cta-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
        .opt-TASTE-1 .t1-cta-ghost { display: block; width: 100%; margin-top: var(--space-1); height: 30px; background: transparent; border: none; color: var(--color-text-muted); font: 600 var(--text-xs)/1 var(--font-sans); cursor: pointer; }
        .opt-TASTE-1 .t1-write-body { padding-top: var(--space-3); }
        .opt-TASTE-1 .t1-received-label { margin: 0 0 var(--space-1); font: 700 10px/1 var(--font-mono); text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-primary); }
        .opt-TASTE-1 .t1-received-line { margin: 0 0 var(--space-4); font: italic 500 var(--text-lg)/1.3 var(--font-display); color: var(--color-text-secondary); }
        .opt-TASTE-1 .t1-word-row { display: flex; gap: var(--space-2); flex-wrap: wrap; }
        .opt-TASTE-1 .t1-word-chip { min-width: 44px; height: 36px; display: inline-flex; align-items: center; justify-content: center; padding: 0 var(--space-2); border-radius: var(--radius-md); font: 600 var(--text-sm)/1 var(--font-sans); white-space: nowrap; }
        .opt-TASTE-1 .t1-word-filled { background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface)); border: 1px solid var(--color-primary); color: var(--color-text-primary); }
        .opt-TASTE-1 .t1-word-empty { border: 1px dashed var(--color-border); color: var(--color-text-muted); }
        .opt-TASTE-1 .t1-write-zone { display: flex; gap: var(--space-2); align-items: center; }
        .opt-TASTE-1 .t1-word-input { flex: 1; min-width: 0; height: 48px; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: var(--color-background); padding: 0 var(--space-2); font: 500 var(--text-sm)/1 var(--font-sans); color: var(--color-text-primary); }
        .opt-TASTE-1 .t1-write-submit { width: 110px; flex: none; height: 48px; }
        .opt-TASTE-1 .t1-fav { flex: none; padding: var(--space-2) 0 var(--space-2) var(--space-2); border-left: 2px solid var(--color-primary); border-bottom: 1px solid var(--color-border-subtle); margin-bottom: var(--space-1); }
        .opt-TASTE-1 .t1-fav-kicker { display: flex; align-items: center; gap: 4px; margin: 0 0 2px; font: 700 9px/1 var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-primary); }
        .opt-TASTE-1 .t1-fav-glyph { font-size: 11px; letter-spacing: 0; }
        .opt-TASTE-1 .t1-fav-line { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: italic 600 var(--text-sm)/1.3 var(--font-display); color: var(--color-text-primary); }
        .opt-TASTE-1 .t1-fav-reader { margin: 2px 0 0; font: 600 9px/1 var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted); }
        .opt-TASTE-1 .t1-poems { list-style: none; margin: 0; padding: var(--space-1) 0 var(--space-2); display: flex; flex-direction: column; }
        .opt-TASTE-1 .t1-poem-row { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border-subtle); }
        .opt-TASTE-1 .t1-poem-row:last-child { border-bottom: none; }
        .opt-TASTE-1 .t1-poem-reader { flex: none; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font: 700 var(--text-xs)/1 var(--font-mono); background: var(--color-muted); }
        .opt-TASTE-1 .t1-poem-preview { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: italic 500 var(--text-sm)/1.3 var(--font-display); color: var(--color-text-secondary); }
        .opt-TASTE-1 .t1-recap-ctas { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
        .opt-TASTE-1 .t1-recap-ctas .t1-cta-btn { width: auto; }
        .opt-TASTE-1 .t1-cta-outline { background: transparent; border: 1px solid var(--color-primary); color: var(--color-primary); }
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

  // =========================================================================
  // TASTE-2 — "Split Rail": an asymmetric persistent left rail (anti-center
  // bias, a real split-screen structural move) carries invite/help/overflow
  // off the critical path for good; the roster becomes a dense two-column
  // grid of divide-bordered rows instead of a single tall list, so eight
  // players cost four rows, not eight; the CTA bar spans the FULL viewport
  // width beneath the rail so the thumb zone is never narrowed.
  // =========================================================================
  (function () {
    function rail(showShare) {
      return `
        <nav class="t2-rail">
          ${showShare ? '<button class="t2-rail-btn" type="button" aria-label="Share room">Sh</button>' : ''}
          <button class="t2-rail-btn" type="button" aria-label="How to play">?</button>
          <button class="t2-rail-btn t2-rail-more" type="button" aria-label="More options">&#8943;</button>
        </nav>`;
    }

    function quickRow(players) {
      return `
        <div class="t2-quickrow">
          <button class="t2-quick" type="button">QR</button>
          <button class="t2-quick" type="button" ${botDisabled(players) ? 'disabled' : ''}>Bot ${botCount(players)}/3</button>
          <button class="t2-quick" type="button">Present</button>
        </div>`;
    }

    function rosterGrid(players) {
      return `
        <ul class="t2-roster" role="list">
          ${players
            .map((p) => {
              const g = glyphFor(p);
              return `
              <li class="t2-row ${p.isAway ? 't2-away' : ''}">
                <span class="t2-avatar">${initials(p.name)}</span>
                <span class="t2-name">${esc(p.name)}</span>
                ${g ? `<span class="t2-tag ${p.host ? 't2-tag-host' : ''}">${g}</span>` : ''}
              </li>`;
            })
            .join('')}
        </ul>`;
    }

    function lobbyScreen(sizeKey) {
      return function (el, corpus) {
        const players = corpus.players[sizeKey];
        const ready = needMore(players) === 0;
        el.innerHTML = `
          <div class="t2-shell">
            <div class="t2-upper">
              ${rail(true)}
              <div class="t2-main">
                <div class="t2-head">
                  <p class="t2-code">${esc(corpus.roomCodeFormatted)}</p>
                  <p class="t2-status">${esc(lobbyStatus(players, corpus))}</p>
                </div>
                <div class="t2-fill">
                  ${quickRow(players)}
                  ${rosterGrid(players)}
                </div>
              </div>
            </div>
            <div class="t2-cta-zone">
              <button class="t2-cta" type="button" ${ready ? '' : 'disabled'}>${esc(lobbyCta(players))}</button>
              <button class="t2-cta-ghost" type="button">Close room</button>
            </div>
          </div>`;
      };
    }

    function writeScreen(el, corpus) {
      const w = corpus.writing;
      const slots = wordSlots(w);
      el.innerHTML = `
        <div class="t2-shell">
          <div class="t2-upper">
            ${rail(true)}
            <div class="t2-main">
              <div class="t2-head">
                <p class="t2-code">Round ${w.round}<span class="t2-code-of">/${w.totalRounds}</span></p>
                <p class="t2-status">${w.targetWordCount} words this line.</p>
              </div>
              <div class="t2-fill">
                <p class="t2-received-label">Line so far</p>
                <p class="t2-received-line">&ldquo;${esc(w.previousLineText)}&rdquo;</p>
                <div class="t2-word-row">
                  ${slots
                    .map((s) =>
                      s.filled
                        ? `<span class="t2-word-chip t2-word-filled">${esc(s.word)}</span>`
                        : `<span class="t2-word-chip t2-word-empty">&middot;</span>`
                    )
                    .join('')}
                </div>
              </div>
            </div>
          </div>
          <div class="t2-cta-zone t2-write-zone">
            <input class="t2-word-input" type="text" placeholder="Type your word" aria-label="Your word" />
            <button class="t2-cta t2-write-submit" type="button">Submit</button>
          </div>
        </div>`;
    }

    function recapScreen(el, corpus) {
      const fav = corpus.recapPoems.find((p) => p.isFavorite);
      el.innerHTML = `
        <div class="t2-shell">
          <div class="t2-upper">
            ${rail(false)}
            <div class="t2-main">
              <div class="t2-head">
                <p class="t2-code">Recap</p>
                <p class="t2-status">${corpus.recapPoems.length} poems read tonight.</p>
              </div>
              <div class="t2-fill">
                ${
                  fav
                    ? `
                <div class="t2-fav">
                  <span class="t2-fav-glyph">&#9825;</span>
                  <div class="t2-fav-body">
                    <p class="t2-fav-kicker">Room favorite &middot; ${corpus.favoriteLeaderCount} heart${corpus.favoriteLeaderCount === 1 ? '' : 's'}</p>
                    <p class="t2-fav-line">&ldquo;${esc(fav.preview)}&rdquo;</p>
                    <p class="t2-fav-reader">Read by ${esc(fav.reader)}</p>
                  </div>
                </div>`
                    : ''
                }
                <ul class="t2-poems" role="list">
                  ${corpus.recapPoems
                    .map(
                      (p) => `
                    <li class="t2-poem-row">
                      <span class="t2-poem-reader">${initials(p.reader)}</span>
                      <span class="t2-poem-preview">&ldquo;${esc(p.preview)}&rdquo;</span>
                    </li>`
                    )
                    .join('')}
                </ul>
              </div>
            </div>
          </div>
          <div class="t2-cta-zone t2-recap-zone">
            <button class="t2-cta t2-cta-outline" type="button">Back to Lobby</button>
            <button class="t2-cta" type="button">Start Next Round</button>
          </div>
        </div>`;
    }

    window.LANE_SPECS['TASTE-2'] = {
      lane: 'taste',
      title: 'Split Rail',
      move: 'A persistent 52px left rail carries invite/help/overflow off the critical path for good (anti-center-bias split, not another top bar); the roster becomes a two-column divide-bordered grid so eight players cost four rows; the CTA bar spans the full viewport width beneath the rail, never narrowing the thumb zone.',
      css: `
        .opt-TASTE-2 { font-family: var(--font-sans); color: var(--color-text-primary); background: var(--color-background); height: 100%; overflow: hidden; }
        .opt-TASTE-2 .t2-shell { display: flex; flex-direction: column; height: 100%; min-height: 0; }
        .opt-TASTE-2 .t2-upper { flex: 1; min-height: 0; display: flex; }
        .opt-TASTE-2 .t2-rail { flex: none; width: 52px; display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-3) 0; background: var(--color-muted); border-right: 1px solid var(--color-border); }
        .opt-TASTE-2 .t2-rail-btn { width: 34px; height: 34px; flex: none; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); display: flex; align-items: center; justify-content: center; font: 700 var(--text-xs)/1 var(--font-sans); cursor: pointer; transition: transform var(--duration-fast) var(--ease-theme); }
        .opt-TASTE-2 .t2-rail-btn:active { transform: scale(0.94); }
        .opt-TASTE-2 .t2-rail-more { margin-top: auto; }
        .opt-TASTE-2 .t2-main { flex: 1; min-width: 0; min-height: 0; overflow-y: auto; padding: var(--space-3); display: flex; flex-direction: column; }
        .opt-TASTE-2 .t2-head { flex: none; margin-bottom: var(--space-2); }
        .opt-TASTE-2 .t2-fill { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; }
        .opt-TASTE-2 .t2-code { margin: 0; font: 700 var(--text-xl)/1 var(--font-display); letter-spacing: var(--tracking-tight); color: var(--color-text-primary); }
        .opt-TASTE-2 .t2-code-of { color: var(--color-text-muted); font-family: var(--font-mono); font-size: var(--text-md); }
        .opt-TASTE-2 .t2-status { margin: var(--space-1) 0 0; font: 500 var(--text-sm)/1.3 var(--font-sans); color: var(--color-text-secondary); }
        .opt-TASTE-2 .t2-quickrow { display: flex; flex-wrap: wrap; gap: var(--space-1); margin-bottom: var(--space-2); }
        .opt-TASTE-2 .t2-quick { height: 30px; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); font: 600 var(--text-xs)/1 var(--font-sans); padding: 0 var(--space-2); cursor: pointer; }
        .opt-TASTE-2 .t2-quick[disabled] { opacity: 0.45; cursor: not-allowed; }
        .opt-TASTE-2 .t2-roster { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-1) var(--space-2); }
        .opt-TASTE-2 .t2-row { display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1); border-radius: var(--radius-sm); background: var(--color-surface); border: 1px solid var(--color-border-subtle); min-width: 0; }
        .opt-TASTE-2 .t2-away { opacity: 0.6; }
        .opt-TASTE-2 .t2-avatar { width: 22px; height: 22px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; font: 700 10px/1 var(--font-mono); background: var(--color-muted); color: var(--color-text-primary); }
        .opt-TASTE-2 .t2-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 500 var(--text-xs)/1 var(--font-sans); }
        .opt-TASTE-2 .t2-tag { flex: none; font: 700 8px/1 var(--font-mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-muted); }
        .opt-TASTE-2 .t2-tag-host { color: var(--color-primary); }
        .opt-TASTE-2 .t2-cta-zone { flex: none; display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3) var(--space-3); border-top: 1px solid var(--color-border-subtle); background: var(--color-surface); }
        .opt-TASTE-2 .t2-cta { flex: 1; height: 48px; border-radius: var(--radius-md); border: none; background: var(--color-primary); color: var(--color-text-inverse); font: 700 var(--text-md)/1 var(--font-sans); cursor: pointer; transition: transform var(--duration-fast) var(--ease-theme); }
        .opt-TASTE-2 .t2-cta:active { transform: translateY(1px) scale(0.99); }
        .opt-TASTE-2 .t2-cta[disabled] { opacity: 0.5; cursor: not-allowed; }
        .opt-TASTE-2 .t2-cta-ghost { flex: none; height: 48px; padding: 0 var(--space-3); background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text-muted); font: 600 var(--text-xs)/1 var(--font-sans); cursor: pointer; }
        .opt-TASTE-2 .t2-received-label { margin: var(--space-2) 0 var(--space-1); font: 700 10px/1 var(--font-mono); text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-primary); }
        .opt-TASTE-2 .t2-received-line { margin: 0 0 var(--space-3); font: italic 500 var(--text-lg)/1.3 var(--font-display); color: var(--color-text-secondary); }
        .opt-TASTE-2 .t2-word-row { display: flex; gap: var(--space-2); flex-wrap: wrap; }
        .opt-TASTE-2 .t2-word-chip { min-width: 40px; height: 34px; display: inline-flex; align-items: center; justify-content: center; padding: 0 var(--space-2); border-radius: var(--radius-md); font: 600 var(--text-sm)/1 var(--font-sans); white-space: nowrap; }
        .opt-TASTE-2 .t2-word-filled { background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface)); border: 1px solid var(--color-primary); color: var(--color-text-primary); }
        .opt-TASTE-2 .t2-word-empty { border: 1px dashed var(--color-border); color: var(--color-text-muted); }
        .opt-TASTE-2 .t2-write-zone .t2-word-input { flex: 1; min-width: 0; height: 48px; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: var(--color-background); padding: 0 var(--space-2); font: 500 var(--text-sm)/1 var(--font-sans); color: var(--color-text-primary); }
        .opt-TASTE-2 .t2-write-submit { flex: none; width: 96px; }
        .opt-TASTE-2 .t2-fav { flex: none; display: flex; gap: var(--space-2); align-items: flex-start; padding: var(--space-2); background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface)); border: 1px solid var(--color-primary); border-radius: var(--radius-sm); margin-bottom: var(--space-2); }
        .opt-TASTE-2 .t2-fav-glyph { flex: none; font-size: 15px; line-height: 1.2; color: var(--color-primary); }
        .opt-TASTE-2 .t2-fav-body { flex: 1; min-width: 0; }
        .opt-TASTE-2 .t2-fav-kicker { margin: 0 0 2px; font: 700 9px/1 var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-primary); }
        .opt-TASTE-2 .t2-fav-line { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: italic 600 var(--text-sm)/1.3 var(--font-display); color: var(--color-text-primary); }
        .opt-TASTE-2 .t2-fav-reader { margin: 2px 0 0; font: 600 9px/1 var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted); }
        .opt-TASTE-2 .t2-poems { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
        .opt-TASTE-2 .t2-poem-row { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border-subtle); }
        .opt-TASTE-2 .t2-poem-row:last-child { border-bottom: none; }
        .opt-TASTE-2 .t2-poem-reader { flex: none; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font: 700 var(--text-xs)/1 var(--font-mono); background: var(--color-muted); }
        .opt-TASTE-2 .t2-poem-preview { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: italic 500 var(--text-sm)/1.3 var(--font-display); color: var(--color-text-secondary); }
        .opt-TASTE-2 .t2-recap-zone .t2-cta-outline { flex: 1; background: transparent; border: 1px solid var(--color-primary); color: var(--color-primary); }
        .opt-TASTE-2 .t2-recap-zone .t2-cta { flex: 1; }
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

  // =========================================================================
  // TASTE-3 — "Disclosed Dock": the extreme end of the density dial
  // (cockpit-adjacent). Chrome shrinks to a code badge plus ONE native
  // <details> overflow trigger — every secondary action (share, QR, add
  // bot, present, help) lives disclosed-on-demand instead of on-screen by
  // default. The roster is a single-line-per-player table (no chips, no
  // cards — Rule 4's divide-y grouping taken to its floor). The primary
  // action is not a bar at all: a floating pill anchored bottom-right in
  // the thumb zone, so the whole screen height stays available to content.
  // =========================================================================
  (function () {
    function rosterTable(players) {
      return `
        <ul class="t3-roster" role="list">
          ${players
            .map((p) => {
              const g = glyphFor(p);
              return `
              <li class="t3-row">
                <span class="t3-dot ${p.host ? 't3-dot-host' : ''}"></span>
                <span class="t3-name">${esc(p.name)}</span>
                ${g ? `<span class="t3-glyph">${g}</span>` : ''}
              </li>`;
            })
            .join('')}
        </ul>`;
    }

    function lobbyDrawer(players) {
      return `
        <details class="t3-drawer">
          <summary class="t3-more" aria-label="More room actions">&#8943;</summary>
          <div class="t3-drawer-body">
            <button class="t3-drawer-btn" type="button">Share room</button>
            <button class="t3-drawer-btn" type="button">Show QR code</button>
            <button class="t3-drawer-btn" type="button" ${botDisabled(players) ? 'disabled' : ''}>Add bot ${botCount(players)}/3</button>
            <button class="t3-drawer-btn" type="button">Present room</button>
            <button class="t3-drawer-btn" type="button">How to play</button>
          </div>
        </details>`;
    }

    function miniDrawer() {
      return `
        <details class="t3-drawer">
          <summary class="t3-more" aria-label="More room actions">&#8943;</summary>
          <div class="t3-drawer-body">
            <button class="t3-drawer-btn" type="button">Share room</button>
            <button class="t3-drawer-btn" type="button">How to play</button>
          </div>
        </details>`;
    }

    function lobbyScreen(sizeKey) {
      return function (el, corpus) {
        const players = corpus.players[sizeKey];
        const ready = needMore(players) === 0;
        el.innerHTML = `
          <div class="t3-shell">
            <header class="t3-bar">
              <span class="t3-code">${esc(corpus.roomCodeFormatted)}</span>
              ${lobbyDrawer(players)}
            </header>
            <p class="t3-status">${esc(lobbyStatus(players, corpus))}</p>
            <div class="t3-body">
              ${rosterTable(players)}
            </div>
            <div class="t3-pill-dock">
              <span class="t3-pill-caption">${esc(lobbyCta(players))}</span>
              <button class="t3-pill" type="button" ${ready ? '' : 'disabled'}>Start</button>
            </div>
          </div>`;
      };
    }

    function writeScreen(el, corpus) {
      const w = corpus.writing;
      const slots = wordSlots(w);
      el.innerHTML = `
        <div class="t3-shell">
          <header class="t3-bar">
            <span class="t3-code">${esc(corpus.roomCodeFormatted)}</span>
            ${miniDrawer()}
          </header>
          <p class="t3-status">Round ${w.round} of ${w.totalRounds} &middot; ${w.targetWordCount} words this line.</p>
          <div class="t3-body">
            <p class="t3-mini-label">Line so far</p>
            <p class="t3-received">&ldquo;${esc(w.previousLineText)}&rdquo;</p>
            <div class="t3-slots">
              ${slots
                .map((s) =>
                  s.filled
                    ? `<span class="t3-slot t3-slot-filled">${esc(s.word)}</span>`
                    : `<span class="t3-slot t3-slot-empty">&middot;</span>`
                )
                .join('')}
            </div>
            <label class="t3-input-label" for="t3-word-input">Your word</label>
            <input id="t3-word-input" class="t3-input" type="text" placeholder="type it" />
          </div>
          <div class="t3-pill-dock">
            <span class="t3-pill-caption">Round ${w.round} of ${w.totalRounds}</span>
            <button class="t3-pill" type="button">Submit</button>
          </div>
        </div>`;
    }

    function recapScreen(el, corpus) {
      const fav = corpus.recapPoems.find((p) => p.isFavorite);
      el.innerHTML = `
        <div class="t3-shell">
          <header class="t3-bar">
            <span class="t3-code">Recap</span>
            ${miniDrawer()}
          </header>
          <p class="t3-status">${corpus.recapPoems.length} poems read tonight.</p>
          <div class="t3-body t3-body-recap">
            ${
              fav
                ? `
            <div class="t3-fav">
              <p class="t3-fav-kicker">&#9819; Room favorite &middot; ${corpus.favoriteLeaderCount} heart${corpus.favoriteLeaderCount === 1 ? '' : 's'}</p>
              <p class="t3-fav-line">&ldquo;${esc(fav.preview)}&rdquo; <span class="t3-fav-reader">&mdash; ${esc(fav.reader)}</span></p>
            </div>`
                : ''
            }
            <ul class="t3-poems" role="list">
              ${corpus.recapPoems
                .map(
                  (p) => `
                <li class="t3-poem-row">
                  <span class="t3-poem-reader">${initials(p.reader)}</span>
                  <span class="t3-poem-text">${esc(p.preview)}</span>
                </li>`
                )
                .join('')}
            </ul>
          </div>
          <div class="t3-pill-dock">
            <button class="t3-pill t3-pill-ghost" type="button">Back to Lobby</button>
            <button class="t3-pill" type="button">Start Next Round</button>
          </div>
        </div>`;
    }

    window.LANE_SPECS['TASTE-3'] = {
      lane: 'taste',
      title: 'Disclosed Dock',
      move: 'Chrome shrinks to a code badge plus one native <details> overflow trigger — share/QR/bot/present/help live disclosed-on-demand, not on-screen by default; the roster is a single-line-per-player table, cards and chips both gone; the primary action is a floating pill docked bottom-right instead of a bar, so the whole height stays content.',
      css: `
        .opt-TASTE-3 { font-family: var(--font-sans); color: var(--color-text-primary); background: var(--color-background); height: 100%; overflow: hidden; }
        .opt-TASTE-3 .t3-shell { position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; }
        .opt-TASTE-3 .t3-bar { flex: none; display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3) var(--space-1); }
        .opt-TASTE-3 .t3-code { font: 700 var(--text-md)/1 var(--font-mono); letter-spacing: var(--tracking-wide); color: var(--color-text-inverse); background: var(--color-primary); border-radius: var(--radius-full); padding: 6px var(--space-2); }
        .opt-TASTE-3 .t3-drawer { position: relative; }
        .opt-TASTE-3 .t3-more { list-style: none; width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); display: flex; align-items: center; justify-content: center; font: 700 15px/1 var(--font-sans); cursor: pointer; }
        .opt-TASTE-3 .t3-more::-webkit-details-marker { display: none; }
        .opt-TASTE-3 .t3-drawer-body { display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-1) 0 0; }
        .opt-TASTE-3 .t3-drawer[open] .t3-drawer-body { padding-bottom: var(--space-1); }
        .opt-TASTE-3 .t3-drawer-btn { height: 34px; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); font: 600 var(--text-xs)/1 var(--font-sans); cursor: pointer; text-align: left; padding: 0 var(--space-2); width: 160px; }
        .opt-TASTE-3 .t3-drawer-btn[disabled] { opacity: 0.45; cursor: not-allowed; }
        .opt-TASTE-3 .t3-status { flex: none; margin: 0; padding: 0 var(--space-3) var(--space-1); font: 500 var(--text-xs)/1.3 var(--font-sans); color: var(--color-text-secondary); }
        .opt-TASTE-3 .t3-body { flex: 1; min-height: 0; overflow-y: auto; padding: 0 var(--space-3) 104px; border-top: 1px solid var(--color-border-subtle); display: flex; flex-direction: column; justify-content: center; }
        .opt-TASTE-3 .t3-roster { list-style: none; margin: 0; padding: var(--space-1) 0 0; }
        .opt-TASTE-3 .t3-row { display: flex; align-items: center; gap: var(--space-2); padding: 7px 0; border-bottom: 1px solid var(--color-border-subtle); }
        .opt-TASTE-3 .t3-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-border); flex: none; }
        .opt-TASTE-3 .t3-dot-host { background: var(--color-primary); }
        .opt-TASTE-3 .t3-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 500 var(--text-sm)/1 var(--font-sans); }
        .opt-TASTE-3 .t3-glyph { flex: none; font: 700 9px/1 var(--font-mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-muted); }
        .opt-TASTE-3 .t3-pill-dock { position: absolute; right: var(--space-3); bottom: var(--space-3); display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-1); z-index: 2; }
        .opt-TASTE-3 .t3-pill-caption { font: 600 var(--text-xs)/1 var(--font-sans); color: var(--color-text-secondary); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-full); padding: 4px var(--space-2); box-shadow: var(--shadow-sm); }
        .opt-TASTE-3 .t3-pill { height: 48px; min-width: 148px; padding: 0 var(--space-4); border-radius: var(--radius-full); border: none; background: var(--color-primary); color: var(--color-text-inverse); font: 700 var(--text-sm)/1 var(--font-sans); box-shadow: var(--shadow-lg); cursor: pointer; transition: transform var(--duration-fast) var(--ease-theme); }
        .opt-TASTE-3 .t3-pill:active { transform: scale(0.97); }
        .opt-TASTE-3 .t3-pill[disabled] { opacity: 0.5; cursor: not-allowed; }
        .opt-TASTE-3 .t3-pill-ghost { background: var(--color-surface); color: var(--color-primary); border: 1px solid var(--color-primary); box-shadow: none; height: 40px; min-width: 130px; }
        .opt-TASTE-3 .t3-mini-label { margin: var(--space-2) 0 4px; font: 700 10px/1 var(--font-mono); text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-primary); }
        .opt-TASTE-3 .t3-received { margin: 0 0 var(--space-3); font: italic 500 var(--text-lg)/1.3 var(--font-display); color: var(--color-text-secondary); }
        .opt-TASTE-3 .t3-slots { display: flex; gap: var(--space-1); flex-wrap: wrap; margin-bottom: var(--space-3); }
        .opt-TASTE-3 .t3-slot { min-width: 36px; height: 32px; display: inline-flex; align-items: center; justify-content: center; padding: 0 var(--space-1); border-radius: var(--radius-sm); font: 600 var(--text-sm)/1 var(--font-sans); white-space: nowrap; }
        .opt-TASTE-3 .t3-slot-filled { background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface)); border: 1px solid var(--color-primary); color: var(--color-text-primary); }
        .opt-TASTE-3 .t3-slot-empty { border: 1px dashed var(--color-border); color: var(--color-text-muted); }
        .opt-TASTE-3 .t3-input-label { display: block; margin-bottom: 4px; font: 600 var(--text-xs)/1 var(--font-sans); color: var(--color-text-muted); }
        .opt-TASTE-3 .t3-input { width: 100%; height: 44px; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: var(--color-surface); padding: 0 var(--space-2); font: 500 var(--text-sm)/1 var(--font-sans); color: var(--color-text-primary); }
        .opt-TASTE-3 .t3-fav { flex: none; padding: 6px 0 8px; border-bottom: 1px solid var(--color-primary); margin-bottom: 2px; }
        .opt-TASTE-3 .t3-fav-kicker { margin: 0 0 2px; font: 700 9px/1 var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-primary); }
        .opt-TASTE-3 .t3-fav-line { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: italic 500 var(--text-sm)/1.3 var(--font-display); color: var(--color-text-primary); }
        .opt-TASTE-3 .t3-fav-reader { font-style: normal; font: 600 10px/1 var(--font-mono); color: var(--color-text-muted); }
        .opt-TASTE-3 .t3-poems { list-style: none; margin: 0; padding: var(--space-1) 0 0; }
        .opt-TASTE-3 .t3-poem-row { display: flex; align-items: center; gap: var(--space-2); padding: 8px 0; border-bottom: 1px solid var(--color-border-subtle); }
        .opt-TASTE-3 .t3-poem-reader { flex: none; width: 26px; font: 700 10px/1 var(--font-mono); color: var(--color-primary); }
        .opt-TASTE-3 .t3-poem-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: italic 500 var(--text-sm)/1.3 var(--font-display); color: var(--color-text-secondary); }
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
})();
