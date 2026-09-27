/* Lights Down: reading is an event in a real room.
   Listeners' phones dim while one reader's phone becomes a lit page.
   Motion vocabulary (one axis, luminance):
     dim      someone else has the floor          450 ms, --ease-in
     brighten the page is yours                    300 ms, --ease-out
     return   the floor is open again              450 ms, --ease-out
     release  a thing leaves your hands            200 ms, --ease-in (opacity only)
     arrive   accepted content settles, rises 8 px 300 ms, --ease-out
   Pending states never move; only their label changes. */
(function () {
  const R = LJ.room;
  const P = R.byId;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = { release: 200 };
  const LATENCY = { submit: 700, open: 550, done: 550, start: 700 };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  /* Choreography waits collapse under reduced motion; simulated server latency never does. */
  const motion = (ms) => wait(REDUCED ? 0 : ms);
  const server = (ms) => wait(ms);
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const firstName = (p) => p.name.split(' ')[0];
  const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  /* ---------- small functional icons (24px grid, stroke) ---------- */
  const svg = (d, extra = '') =>
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" ${extra}>${d}</svg>`;
  const ICON = {
    system: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
    light: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
    dark: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
    sound: svg('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
    muted: svg('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>'),
    more: svg('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'),
    share: svg('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.8 7.4-4.4M8.3 13.2l7.4 4.4"/>', 'width="20" height="20"'),
    check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 'width="16" height="16"'),
    pencil: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>', 'width="16" height="16"'),
    away: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', 'width="16" height="16"'),
    eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>', 'width="16" height="16"'),
  };

  /* A character inside a lit disc. The disc is the concept's lamp: characters are
     always drawn on light, which also keeps plum outlines legible in Dark. */
  const lamp = (player, size, { label = null, cls = '' } = {}) =>
    `<span class="ld-lamp ${cls}" style="--lamp:${size}px">${LJ.avatar(player.avatar, {
      size: Math.round(size * 0.78),
      label,
    })}</span>`;

  /* ---------- QR (visual stand-in with real finder geometry; not scannable) ---------- */
  function qr(seedText, label) {
    const n = 25;
    const q = 3;
    let s = 0;
    for (const c of seedText) s = (Math.imul(s, 31) + c.charCodeAt(0)) >>> 0;
    s = s || 1;
    const rnd = () => {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
    const grid = Array.from({ length: n }, () => Array.from({ length: n }, () => rnd() > 0.52));
    const finder = (ox, oy) => {
      for (let y = -1; y <= 7; y++)
        for (let x = -1; x <= 7; x++) {
          const gx = ox + x, gy = oy + y;
          if (gx < 0 || gy < 0 || gx >= n || gy >= n) continue;
          const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
          grid[gy][gx] = ring === 3 || ring <= 1;
          if (x === -1 || y === -1 || x === 7 || y === 7) grid[gy][gx] = false;
        }
    };
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
    for (let i = 8; i < n - 8; i++) { grid[6][i] = i % 2 === 0; grid[i][6] = i % 2 === 0; }
    let d = '';
    grid.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + q} ${y + q}h1v1h-1z`; }));
    const size = n + q * 2;
    return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  /* ---------- chrome: code or wordmark left; appearance, sound, Room options right ---------- */
  const MODES = ['system', 'light', 'dark'];
  const MODE_NAME = { system: 'System', light: 'Light', dark: 'Dark' };
  let mode = 'system';
  let muted = false;

  const MENUS = {
    lobby: ['How to play', 'Your poems', 'Close room'],
    host: ['How to play', 'Your poems', 'End game'],
    guest: ['How to play', 'Your poems', 'Leave room'],
  };

  function appearanceLabel() {
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    return `Appearance: ${MODE_NAME[mode]}. Switch to ${MODE_NAME[next]}.`;
  }

  function bar(kind, menu) {
    const left =
      kind === 'lobby'
        ? '<span class="ld-wordmark">Linejam</span>'
        : `<button class="ld-code" type="button" data-copy-code aria-label="Copy room code ${R.codeDisplay}">${R.codeDisplay}</button>`;
    return `<header class="ld-bar">
      <div class="ld-bar__left ld-daylight">${left}</div>
      <div class="ld-bar__right">
        <div class="ld-bar__quiet ld-daylight">
          <button class="ld-icon-btn" type="button" data-appearance aria-label="${appearanceLabel()}">${ICON[mode]}</button>
          <button class="ld-icon-btn" type="button" data-sound aria-label="Sound on. Mute sounds.">${ICON.sound}</button>
        </div>
        <div class="ld-options">
          <button class="ld-icon-btn" type="button" data-options aria-label="Room options" aria-haspopup="menu" aria-expanded="false" aria-controls="ld-menu">${ICON.more}</button>
          <div class="ld-menu" id="ld-menu" role="menu" aria-label="Room options" hidden>
            ${MENUS[menu].map((item) => `<button type="button" role="menuitem">${item}</button>`).join('')}
          </div>
        </div>
      </div>
    </header>`;
  }

  function wireBar(app) {
    const appearance = app.querySelector('[data-appearance]');
    appearance.addEventListener('click', () => {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      const dark = mode === 'dark' || (mode === 'system' && LJ.theme === 'dark');
      document.documentElement.classList.toggle('dark', dark);
      appearance.innerHTML = ICON[mode];
      appearance.setAttribute('aria-label', appearanceLabel());
    });

    const sound = app.querySelector('[data-sound]');
    sound.addEventListener('click', () => {
      muted = !muted;
      sound.innerHTML = muted ? ICON.muted : ICON.sound;
      sound.setAttribute('aria-label', muted ? 'Sound off. Turn sounds on.' : 'Sound on. Mute sounds.');
    });

    const code = app.querySelector('[data-copy-code]');
    if (code) {
      code.addEventListener('click', async () => {
        const ok = await copy(R.code);
        code.textContent = ok ? 'Copied' : R.codeDisplay;
        announce(app, ok ? 'Room code copied.' : `Could not copy. The code is ${R.codeDisplay}.`);
        setTimeout(() => (code.textContent = R.codeDisplay), 1600);
      });
    }

    const trigger = app.querySelector('[data-options]');
    const menu = app.querySelector('#ld-menu');
    const items = [...menu.querySelectorAll('[role="menuitem"]')];
    const close = (refocus) => {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (refocus) trigger.focus();
    };
    trigger.addEventListener('click', () => {
      const open = menu.hidden;
      menu.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
      if (open) items[0].focus();
    });
    items.forEach((item) => item.addEventListener('click', () => close(true)));
    menu.addEventListener('keydown', (e) => {
      const i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    });
    document.addEventListener('click', (e) => {
      if (!menu.hidden && !e.target.closest('.ld-options')) close(false);
    });
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function shell(root, { kind = 'game', menu = 'host', cls = '', body = '' }) {
    root.innerHTML = `<div class="ld-app ${cls}">${bar(kind, menu)}${body}<p class="sr-only" aria-live="polite" data-live></p></div>`;
    const app = root.firstElementChild;
    wireBar(app);
    return app;
  }

  function announce(app, message) {
    const live = app.querySelector('[data-live]');
    live.textContent = '';
    setTimeout(() => (live.textContent = message), 40);
  }

  /* Pending: the control keeps focus, says what is happening, and does not move. */
  function pending(button, label) {
    button.dataset.label = button.textContent;
    button.textContent = label;
    button.setAttribute('aria-disabled', 'true');
    button.setAttribute('aria-busy', 'true');
  }

  /* ---------- lobby ---------- */
  function renderLobby(root) {
    const people = R.players
      .map(
        (p) => `<li class="ld-person">
          ${lamp(p, 44)}
          <span class="ld-person__name">${esc(p.name)}</span>
          ${p.host ? '<span class="ld-badge">Host</span>' : ''}
        </li>`
      )
      .join('');
    const app = shell(root, {
      kind: 'lobby',
      menu: 'lobby',
      body: `<main class="ld-main">
        <section class="ld-invite" aria-labelledby="invite-title">
          <div class="ld-invite__text">
            <h2 class="ld-kicker" id="invite-title">Room code</h2>
            <button class="ld-invite__code" type="button" data-lobby-code aria-label="Copy room code ${R.codeDisplay}">${R.codeDisplay}</button>
            <p class="ld-invite__note" data-code-note aria-live="polite">Tap the code to copy it.</p>
          </div>
          <div class="ld-qr">${qr(R.joinUrl, `QR code to join room ${R.codeDisplay}`)}</div>
          <button class="ld-btn ld-btn--quiet ld-invite__share" type="button" data-share>${ICON.share}<span>Share invite</span></button>
        </section>
        <section class="ld-roster" aria-labelledby="players-title">
          <div class="ld-roster__head">
            <h2 class="ld-kicker" id="players-title">Players</h2>
            <p class="ld-kicker ld-kicker--plain">${R.players.length} of ${R.capacity}</p>
          </div>
          <ul aria-labelledby="players-title">${people}</ul>
        </section>
        <div class="ld-actions">
          <button class="ld-btn ld-btn--primary ld-btn--block" type="button" data-start>Start Linejam</button>
        </div>
      </main>`,
    });

    const note = app.querySelector('[data-code-note]');
    app.querySelector('[data-lobby-code]').addEventListener('click', async () => {
      const ok = await copy(R.code);
      note.textContent = ok ? 'Code copied.' : `Could not copy. Read it out: ${R.codeDisplay}.`;
    });

    const share = app.querySelector('[data-share]');
    share.addEventListener('click', async () => {
      const label = share.querySelector('span');
      let result = 'Link copied';
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Join my Linejam', url: R.joinUrl });
          result = 'Shared';
        } catch {
          result = (await copy(R.joinUrl)) ? 'Link copied' : 'Could not share';
        }
      } else if (!(await copy(R.joinUrl))) {
        result = 'Could not share';
      }
      label.textContent = result;
      setTimeout(() => (label.textContent = 'Share invite'), 2000);
    });

    const start = app.querySelector('[data-start]');
    start.addEventListener('click', async () => {
      if (start.getAttribute('aria-busy')) return;
      pending(start, 'Starting…');
      await server(LATENCY.start);
      const url = new URL(location.href);
      url.searchParams.set('screen', 'writing');
      location.assign(url);
    });
  }

  /* ---------- waiting composition (shared by `waiting` and the post-submit writing state) ---------- */
  function waitingMain(line) {
    const you = P.juniper;
    const rows = [
      { p: you, you: true, status: 'Submitted', icon: ICON.check, tone: 'done' },
      { p: P.wren, status: 'Submitted', icon: ICON.check, tone: 'done' },
      { p: P.basil, status: 'Writing', icon: ICON.pencil, tone: '' },
      { p: P.marguerite, status: 'Away', icon: ICON.away, tone: '' },
      { p: R.lateJoiner, status: 'Watching', icon: ICON.eye, tone: '', note: 'Plays next game' },
    ]
      .map(
        (r) => `<li class="ld-person">
          ${lamp(r.p, 40)}
          <span class="ld-person__name">${esc(r.p.name)}${r.you ? ' <span class="ld-you">(you)</span>' : ''}${
          r.note ? `<span class="ld-person__note">${r.note}</span>` : ''
        }</span>
          <span class="ld-status ${r.tone ? `ld-status--${r.tone}` : ''}">${r.icon}${r.status}</span>
        </li>`
      )
      .join('');
    return `<main class="ld-main ld-arrive" data-stage>
      <section class="ld-ack" aria-labelledby="ack-title">
        ${lamp(you, 96, { label: `${you.name}, as ${LJ.CAST_NAMES[you.avatar]}` })}
        <h1 class="ld-ack__title" id="ack-title" tabindex="-1">Tucked into the poem.</h1>
        <p class="ld-ack__meta">Round 5 of 9</p>
        <p class="ld-ack__line">Your line: <q>${esc(line)}</q></p>
      </section>
      <section class="ld-roster" aria-labelledby="round-title">
        <h2 class="ld-kicker" id="round-title">This round</h2>
        <ul aria-labelledby="round-title">${rows}</ul>
      </section>
    </main>`;
  }

  function renderWaiting(root) {
    shell(root, { body: waitingMain(R.assignments[4].yourLine) });
  }

  /* ---------- writing ---------- */
  function renderWriting(root) {
    const a = R.assignments[4];
    const app = shell(root, {
      body: `<main class="ld-main" data-stage>
        <p class="ld-round"><span>Round ${a.round} of 9</span><span>${plural(a.target, 'word')}</span></p>
        <section class="ld-given" aria-labelledby="given-label">
          <h2 class="ld-kicker" id="given-label">The line before yours</h2>
          <p class="ld-given__line">${esc(a.previousLine)}</p>
        </section>
        <div class="ld-field">
          <label class="sr-only" for="ld-line">Write your line for round ${a.round}. Target: ${plural(a.target, 'word')}.</label>
          <textarea id="ld-line" rows="2" placeholder="Your line…" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="ld-count">and nobody asked</textarea>
        </div>
        <div class="ld-count-row">
          <p class="ld-count" id="ld-count"><span class="ld-count__num" data-num></span> <span class="ld-count__hint" data-hint></span></p>
          <button class="ld-btn ld-btn--primary ld-btn--submit" type="button" data-submit>Submit</button>
        </div>
        <p class="sr-only" aria-live="polite" data-hint-live></p>
      </main>`,
    });

    const ta = app.querySelector('#ld-line');
    const num = app.querySelector('[data-num]');
    const hint = app.querySelector('[data-hint]');
    const hintLive = app.querySelector('[data-hint-live]');
    const submit = app.querySelector('[data-submit]');
    const row = app.querySelector('.ld-count-row');
    let busy = false;
    let liveTimer;

    function update() {
      const n = words(ta.value);
      const d = a.target - n;
      num.textContent = `${n} of ${plural(a.target, 'word')}`;
      const text = n === 0 ? '' : d === 0 ? 'Ready to submit' : d > 0 ? `Add ${plural(d, 'word')}` : `Remove ${plural(-d, 'word')}`;
      hint.textContent = text;
      row.classList.toggle('is-over', d < 0);
      row.classList.toggle('is-ready', d === 0);
      ta.setAttribute('aria-invalid', String(d < 0));
      submit.disabled = d !== 0;
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => (hintLive.textContent = text), 500);
    }
    ta.addEventListener('input', update);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') e.preventDefault();
    });
    update();

    submit.addEventListener('click', async () => {
      if (busy || words(ta.value) !== a.target) return;
      busy = true;
      const line = ta.value.trim().replace(/\s+/g, ' ');
      ta.readOnly = true;
      pending(submit, 'Submitting…');
      await server(LATENCY.submit);
      /* Accepted. The composer releases, then the waiting composition arrives. */
      const stage = app.querySelector('[data-stage]');
      stage.classList.add('ld-release');
      await motion(T.release);
      stage.outerHTML = waitingMain(line);
      app.querySelector('#ack-title').focus({ preventScroll: true });
      announce(app, 'Tucked into the poem.');
    });
  }

  /* ---------- reading: listener ---------- */
  const reader = P.marguerite;
  const listenMain = () => `<main class="ld-listen" aria-labelledby="listen-title">
      <div class="ld-listen__center">
        ${lamp(reader, 176, { label: `${reader.name}, as ${LJ.CAST_NAMES[reader.avatar]}`, cls: 'ld-lamp--stage' })}
        <h1 class="ld-listen__line" id="listen-title"><span>Listen.</span> ${esc(firstName(reader))} is reading Poem&nbsp;1.</h1>
      </div>
      <p class="ld-listen__turn ld-quiet">You read 4th</p>
    </main>`;

  function renderListening(root) {
    const app = shell(root, { cls: 'ld-stage', body: listenMain() });
    /* Trigger: the server reports that the reader opened Poem 1. Lights dim. */
    nextFrame().then(() => {
      app.classList.add('is-night');
      announce(app, `${reader.name} is reading Poem 1. Listen. Your screen stays dim until the reading is done.`);
    });
  }

  /* ---------- reading: reader (Marguerite's phone) ---------- */
  const poem = R.poems[0];
  const authors = [...new Set(poem.lines.map((l) => l[1]))].map((id) => firstName(P[id]));
  const byline = `By ${authors.slice(0, -1).join(', ')} and ${authors.at(-1)}`;

  const turnMain = () => `<main class="ld-turn" aria-labelledby="turn-title" data-stage>
      <div class="ld-turn__center">
        ${lamp(reader, 112, { label: `${reader.name}, as ${LJ.CAST_NAMES[reader.avatar]}` })}
        <h1 class="ld-turn__title" id="turn-title">Your turn to read.</h1>
        <p class="ld-turn__detail">Poem 1. The other phones go quiet while you read it aloud.</p>
      </div>
      <div class="ld-actions">
        <button class="ld-btn ld-btn--primary ld-btn--block" type="button" data-open>Read poem</button>
      </div>
    </main>`;

  const pageMain = () => `<main class="ld-page ld-arrive" aria-labelledby="page-title" data-stage>
      <h1 class="ld-page__title" id="page-title" tabindex="-1">Poem 1</h1>
      <ol class="ld-poem ld-poem--aloud" aria-label="Poem lines">
        ${poem.lines.map(([text]) => `<li>${esc(text)}</li>`).join('')}
      </ol>
      <p class="ld-byline">${byline}</p>
      <div class="ld-actions">
        <button class="ld-btn ld-btn--ink ld-btn--block" type="button" data-done>Done reading</button>
      </div>
    </main>`;

  const returnMain = () => `<main class="ld-turn ld-arrive" aria-labelledby="return-title" data-stage>
      <div class="ld-turn__center">
        ${lamp(reader, 112, { label: `${reader.name}, as ${LJ.CAST_NAMES[reader.avatar]}` })}
        <h1 class="ld-ack__title" id="return-title" tabindex="-1">Nicely read.</h1>
        <p class="ld-turn__detail">Everyone has Poem 1 on their phone now.</p>
        <p class="ld-turn__next">Basil reads Poem 2 next.</p>
      </div>
    </main>`;

  /* The page is on: wire Done reading. */
  function showPage(app) {
    app.querySelector('[data-stage]').outerHTML = pageMain();
    app.classList.add('is-page');
    app.querySelector('#page-title').focus({ preventScroll: true });
    announce(app, 'Poem 1 is open. Read it aloud.');
    const done = app.querySelector('[data-done]');
    done.addEventListener('click', async () => {
      if (done.getAttribute('aria-busy')) return;
      pending(done, 'Finishing…');
      await server(LATENCY.done);
      /* Accepted: lights return for everyone. */
      app.querySelector('[data-stage]').outerHTML = returnMain();
      app.classList.add('is-waking');
      app.classList.remove('is-page');
      app.querySelector('#return-title').focus({ preventScroll: true });
      announce(app, 'Nicely read. Basil reads Poem 2 next.');
    });
  }

  /* x-reader-turn: the reader's phone before opening, with the working Read poem action. */
  function renderReaderTurn(root) {
    const app = shell(root, { menu: 'guest', body: turnMain() });
    const open = app.querySelector('[data-open]');
    open.addEventListener('click', async () => {
      if (open.getAttribute('aria-busy')) return;
      pending(open, 'Opening…');
      await server(LATENCY.open);
      /* Accepted: the page brightens and the whole poem settles, in one 300 ms moment. */
      showPage(app);
    });
  }

  /* poem-open: the same phone the moment the open is accepted (the choreography replays on load). */
  function renderReaderOpen(root) {
    const app = shell(root, { menu: 'guest', body: '<main data-stage></main>' });
    nextFrame().then(() => showPage(app));
  }

  /* ---------- after reading: listener gets the poem ---------- */
  const afterMain = () => `<main class="ld-main ld-after ld-arrive ld-arrive--late" aria-labelledby="after-title">
      <p class="ld-after__who">${lamp(reader, 40)}<span>${esc(firstName(reader))} read Poem 1.</span></p>
      <article class="ld-sheet" aria-labelledby="after-title">
        <h1 class="ld-sheet__title" id="after-title">Poem 1</h1>
        <ol class="ld-poem ld-poem--along" aria-label="Poem lines">
          ${poem.lines.map(([text]) => `<li>${esc(text)}</li>`).join('')}
        </ol>
        <p class="ld-byline">${byline}</p>
        <details class="ld-credits">
          <summary>Who wrote each line</summary>
          <ol>
            ${poem.lines
              .map(([text, id]) => `<li><span>${esc(text)}</span><span>${esc(firstName(P[id]))}</span></li>`)
              .join('')}
          </ol>
        </details>
      </article>
      <p class="ld-after__next">Basil reads Poem 2 next. You read 4th.</p>
    </main>`;

  function renderAfter(root) {
    const app = shell(root, { cls: 'ld-stage is-night', body: afterMain() });
    /* Trigger: the server reports the reader tapped Done reading. Lights return. */
    nextFrame().then(() => {
      app.classList.add('is-waking');
      app.classList.remove('is-night');
      announce(app, `${reader.name} finished reading. Poem 1 is on your phone.`);
    });
  }

  LJ.mount({
    title: 'Lights Down (wildcard)',
    stance:
      'Reading is an event in a real room. While a poem is read aloud, the listeners’ phones go dark and quiet, and only the reader’s phone is a page.',
    screens: [
      { id: 'lobby-host', label: 'Lobby, host', render: renderLobby },
      { id: 'writing', label: 'Writing, round 5', render: renderWriting },
      { id: 'waiting', label: 'Waiting, after your line', render: renderWaiting },
      { id: 'reading-turn', label: 'Listening while Marguerite reads', render: renderListening },
      { id: 'poem-open', label: "Reader's phone (Marguerite), Poem 1 open", render: renderReaderOpen },
      { id: 'x-reader-turn', label: "Reader's phone (Marguerite), before Read poem", render: renderReaderTurn },
      { id: 'x-listener-after', label: 'Listener, after Done reading', render: renderAfter },
    ],
  });
})();
