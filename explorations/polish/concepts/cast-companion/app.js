/* Cast Companion: your character stays with you the whole game, and the cast
   carries state (props) so the words on screen can stay quiet. Names and text
   statuses are always present; characters and props supplement them. */
(function () {
  const R = LJ.room;
  const YOU = R.byId[R.you];

  /* Motion vocabulary. One move per committed change.
     Down into a character = committed (your line is handed in).
     Up out of a character = opened (a poem comes out of the reader's page). */
  const EASE_OUT = 'cubic-bezier(0.25, 1, 0.5, 1)'; /* --ease-out */
  const EASE_IN = 'cubic-bezier(0.25, 0.1, 0.25, 1)'; /* --ease-in */
  const T = {
    submitPending: 700, /* simulated server acceptance */
    handIn: 400, /* line condenses into a note that lands in your character's hands */
    swapOut: 150, /* composer fades */
    swapIn: 200, /* waiting composition fades in (no movement) */
    openPending: 350, /* simulated open acknowledgement */
    open: 420, /* whole poem opens out of the reader's page */
    arrive: 350, /* a newly joined character settles into the lobby */
  };
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /* Props: small inline drawings laid over the shipped character art.
     Same ink, same 64-grid stroke feel, palette fills only. */
  const INK = '#39234E';
  const PEACH = '#FFB887';
  const MINT = '#B6F1D0';
  const LAV = '#D8C3FF';
  const PAPER = '#FFFFFF';
  const PROP_ART = {
    crown: `<path d="M6 24 L4.5 11 L11 16.5 L16 7.5 L21 16.5 L27.5 11 L26 24 Z" fill="${PEACH}"/><path d="M6.5 20.5 H25.5"/><circle cx="16" cy="6" r="1.6" fill="${MINT}"/>`,
    pencil: `<path d="M5 27 L7 20 L21 6 L26 11 L12 25 Z" fill="${PEACH}"/><path d="M21 6 L23 4 Q24.5 2.8 26 4.2 L27.8 6 Q29.2 7.5 28 9 L26 11" fill="${MINT}"/><path d="M5 27 L7 20 L12 25 Z" fill="${PAPER}"/><path d="M5 27 L5.9 24 L8 26.1 Z" fill="${INK}"/>`,
    note: `<path d="M4 9.5 H28 V25 H4 Z" fill="${PAPER}"/><path d="M4 9.5 L16 18.5 L28 9.5"/><circle cx="16" cy="18" r="3.4" fill="${PEACH}"/>`,
    moon: `<path d="M20 4.5 A11.5 11.5 0 1 0 28.5 21 A9 9 0 0 1 20 4.5 Z" fill="${LAV}"/><path d="M13 16 Q14.5 17.5 16 16"/>`,
    eyes: `<ellipse cx="11" cy="17" rx="4" ry="5" fill="${PAPER}"/><ellipse cx="21" cy="17" rx="4" ry="5" fill="${PAPER}"/><circle cx="12" cy="16.5" r="1.7" fill="${INK}" stroke="none"/><circle cx="22" cy="16.5" r="1.7" fill="${INK}" stroke="none"/><rect x="3" y="20" width="26" height="8" rx="2.5" fill="${MINT}"/>`,
    page: `<path d="M16 9 Q10 5.5 3 7.5 V26 Q10 24 16 27 Z" fill="${PAPER}"/><path d="M16 9 Q22 5.5 29 7.5 V26 Q22 24 16 27 Z" fill="${PAPER}"/><path d="M6.5 12 Q9.5 11 12.5 12.2 M6.5 16 Q9.5 15 12.5 16.2 M6.5 20 Q8.5 19.4 10.5 20 M19.5 12.2 Q22.5 11 25.5 12 M19.5 16.2 Q22.5 15 25.5 16" opacity=".55"/>`,
  };
  function propSvg(name, extraClass = '') {
    return `<svg class="cc-prop cc-prop--${name} ${extraClass}" viewBox="0 0 32 32" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PROP_ART[name]}</svg>`;
  }

  /* A character with an optional prop. Decorative: the name and status text sit next to it. */
  function char(avatarId, { size = 64, prop, className = '', edge = true } = {}) {
    return `<span class="cc-char ${edge ? 'cc-edge' : ''} ${className}" style="--s:${size}px">${LJ.avatar(avatarId, { size })}${prop ? propSvg(prop) : ''}</span>`;
  }

  /* ---------- Chrome ---------- */
  const ICON = {
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    sound: '<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
  };
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[name]}</svg>`;

  function header(left) {
    const leftHtml =
      left === 'wordmark'
        ? '<span class="cc-wordmark">Linejam</span>'
        : `<button type="button" class="cc-code-chip" aria-label="Invite friends to room ${R.codeDisplay}">${R.codeDisplay}</button>`;
    return `<header class="cc-header">
      ${leftHtml}
      <div class="cc-header-tools">
        <button type="button" class="cc-icon-btn" aria-label="Appearance: System. Switch to Light">${icon('monitor')}</button>
        <button type="button" class="cc-icon-btn" aria-label="Sound on. Mute sound">${icon('sound')}</button>
        <button type="button" class="cc-icon-btn" aria-label="Room options" aria-haspopup="dialog">${icon('more')}</button>
      </div>
    </header>`;
  }

  /* QR stand-in: deterministic modules with real finder patterns. Not scannable. */
  function qrSvg() {
    const n = 25;
    let seed = 9127;
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const finder = (x, y, r, c) => r >= y && r < y + 7 && c >= x && c < x + 7;
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        let on;
        const inF = [[0, 0], [n - 7, 0], [0, n - 7]].find(([fx, fy]) => finder(fx, fy, r, c));
        if (inF) {
          const lr = r - inF[1];
          const lc = c - inF[0];
          on = lr === 0 || lr === 6 || lc === 0 || lc === 6 || (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
        } else if ((r === 7 && c < 8) || (c === 7 && r < 8) || (r === 7 && c >= n - 8) || (c === n - 8 && r < 8) || (r === n - 8 && c < 8) || (c === 7 && r >= n - 8)) {
          on = false;
        } else if (r === 6 || c === 6) {
          on = (r + c) % 2 === 0;
        } else {
          on = rand() > 0.52;
        }
        if (on) d += `M${c} ${r}h1v1h-1z`;
      }
    }
    return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#1b1024"/></svg>`;
  }

  /* ---------- Shared compositions ---------- */
  const WAITING_ROSTER = [
    { p: R.byId.wren, prop: 'note', status: 'Tucked in' },
    { p: R.byId.basil, prop: 'pencil', status: 'Writing' },
    { p: R.byId.marguerite, prop: 'moon', status: 'Away' },
    { p: R.lateJoiner, prop: 'eyes', status: 'Watching', note: 'Joined late' },
  ];

  function castItem({ p, prop, status, size = 64 }) {
    return `<li class="cc-cast-item">
      ${char(p.avatar, { size, prop })}
      <span class="cc-name">${esc(p.name)}</span>
      <span class="cc-status">${esc(status)}</span>
    </li>`;
  }

  function waitingStage(round) {
    return `<p class="cc-meta">Round ${round} of 9</p>
      <div class="cc-stage-center">
        <ul class="cc-cast-grid" aria-label="Players this round">
          ${WAITING_ROSTER.map((r) => castItem(r)).join('')}
        </ul>
      </div>`;
  }

  function dock({ prop, title, titleClass = '', status, action = '', live = false }) {
    return `<section class="cc-dock" aria-label="You, ${esc(YOU.name)}">
      <span class="cc-dock-char">${char(YOU.avatar, { size: 64, prop })}</span>
      <div class="cc-dock-text" ${live ? 'role="status" aria-live="polite"' : ''}>
        <p class="cc-dock-title ${titleClass}" tabindex="-1">${title}</p>
        <p class="cc-dock-status">${status}</p>
      </div>
      ${action}
    </section>`;
  }

  const waitingDock = () =>
    dock({
      prop: 'note',
      title: 'Tucked into the poem.',
      titleClass: 'cc-ack',
      status: `${esc(YOU.name)}, tucked in`,
      live: true,
    });

  /* ---------- Screens ---------- */
  function renderLobby(root) {
    const roster = R.players.map((p) =>
      castItem({ p, prop: p.host ? 'crown' : null, status: p.host ? 'Host' : '', size: 68 })
    );
    root.innerHTML = `<div class="cc-page">
      ${header('wordmark')}
      <main class="cc-main">
        <h1 class="sr-only">Room lobby</h1>
        <section class="cc-invite" aria-label="Room invitation">
          <div class="cc-invite-text">
            <p class="cc-eyebrow" id="code-label">Room code</p>
            <div class="cc-code-row">
              <span class="cc-code-big" aria-labelledby="code-label">${R.codeDisplay}</span>
              <button type="button" class="cc-icon-btn" aria-label="Copy room code">${icon('copy')}</button>
            </div>
            <button type="button" class="cc-btn cc-btn--secondary cc-btn--small">${icon('share')}<span>Share invite</span></button>
          </div>
          <div class="cc-qr" role="img" aria-label="QR code to join room ${R.codeDisplay}">${qrSvg()}</div>
        </section>
        <section class="cc-roster" aria-labelledby="players-h">
          <div class="cc-roster-head">
            <h2 id="players-h" class="cc-h2">Players</h2>
            <span class="cc-count-quiet">${R.players.length} of ${R.capacity}</span>
          </div>
          <ul class="cc-cast-grid cc-cast-grid--lobby">${roster.join('')}</ul>
        </section>
        <div class="cc-action">
          <button type="button" class="cc-btn cc-btn--primary cc-btn--wide">Start Linejam</button>
        </div>
      </main>
    </div>`;
    /* The newest arrival settles in once (one join = one settle). */
    const newest = root.querySelectorAll('.cc-cast-item')[R.players.length - 1];
    if (newest && !reducedMotion()) {
      newest.animate(
        [{ transform: 'translateY(8px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: T.arrive, easing: EASE_OUT }
      );
    }
  }

  function renderWriting(root) {
    const a = R.assignments[4];
    root.innerHTML = `<div class="cc-page">
      ${header('code')}
      <main class="cc-main cc-main--game">
        <h1 class="sr-only">Write your line</h1>
        <div class="cc-stage cc-stage--writing" id="stage">
          <p class="cc-meta">Round ${a.round} of 9 <span aria-hidden="true">·</span> ${a.target} words</p>
          <section class="cc-received" aria-labelledby="recv-label">
            <p class="cc-eyebrow" id="recv-label">The line before yours</p>
            <p class="cc-hero-line">${esc(a.previousLine)}</p>
          </section>
          <div class="cc-compose">
            <label class="cc-eyebrow" for="line">Your line, ${a.target} words</label>
            <textarea id="line" class="cc-textarea" rows="2" maxlength="500" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" aria-describedby="count">and nobody asked</textarea>
            <div class="cc-count-row">
              <span class="cc-slots" aria-hidden="true"></span>
              <p class="cc-count" id="count" aria-live="polite"></p>
            </div>
          </div>
        </div>
        ${dock({
          prop: 'pencil',
          title: esc(YOU.name),
          status: 'Writing',
          action: '<button type="button" class="cc-btn cc-btn--primary cc-dock-action" id="submit" disabled>Submit</button>',
        })}
      </main>
    </div>`;
    wireWriting(root, a.target);
  }

  function wireWriting(root, target) {
    const ta = root.querySelector('#line');
    const btn = root.querySelector('#submit');
    const slots = root.querySelector('.cc-slots');
    const count = root.querySelector('#count');
    let busy = false;
    const words = (v) => (v.trim() ? v.trim().split(/\s+/).length : 0);

    function update() {
      const n = words(ta.value);
      const shown = Math.max(target, Math.min(n, target + 4));
      let s = '';
      for (let i = 0; i < shown; i++) {
        s += `<span class="cc-slot ${i < n ? (i < target ? 'is-filled' : 'is-over') : ''}"></span>`;
      }
      slots.innerHTML = s;
      const diff = target - n;
      const hint =
        n === 0 ? '' : diff === 0 ? 'Ready' : diff > 0 ? `Add ${diff}` : `Remove ${-diff}`;
      count.innerHTML = `<strong>${n} of ${target} words</strong>${hint ? `<span class="cc-count-hint">${hint}</span>` : ''}`;
      ta.setAttribute('aria-invalid', String(n > target));
      btn.disabled = n !== target;
    }
    ta.addEventListener('input', () => {
      if (busy) return;
      ta.value = ta.value.replace(/[\r\n]+/g, ' ');
      update();
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!btn.disabled) btn.click();
      }
    });
    update();

    btn.addEventListener('click', async () => {
      if (busy || words(ta.value) !== target) return;
      busy = true;
      /* Pending: nothing looks accepted yet. Focus stays on the button. */
      ta.readOnly = true;
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('aria-busy', 'true');
      btn.textContent = 'Submitting…';
      btn.classList.add('is-pending');
      await wait(T.submitPending);
      /* Accepted by the (simulated) server. */
      await handIn(root, ta);
      await swapToWaiting(root, 5);
    });
  }

  /* The one move: your line condenses into a folded note and lands in your character's hands. */
  async function handIn(root, ta) {
    const dockChar = root.querySelector('.cc-dock .cc-char');
    const pencil = dockChar.querySelector('.cc-prop--pencil');
    dockChar.insertAdjacentHTML('beforeend', propSvg('note', 'is-landing'));
    const noteProp = dockChar.querySelector('.cc-prop--note');
    const swapProps = () => {
      pencil.remove();
      noteProp.classList.remove('is-landing');
    };
    if (reducedMotion()) {
      swapProps();
      return;
    }
    const from = ta.getBoundingClientRect();
    const to = noteProp.getBoundingClientRect();
    const flight = document.createElement('div');
    flight.className = 'cc-flight';
    flight.setAttribute('aria-hidden', 'true');
    flight.innerHTML = `<div class="cc-flight-paper"><span>${esc(ta.value.trim())}</span></div>${propSvg('note', 'cc-flight-note')}`;
    Object.assign(flight.style, {
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
    });
    document.body.append(flight);
    ta.style.visibility = 'hidden';
    const opts = { duration: T.handIn, fill: 'forwards' };
    const move = flight.animate(
      [
        { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` },
        { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px` },
      ],
      { ...opts, easing: EASE_OUT }
    );
    flight.querySelector('.cc-flight-paper span').animate([{ opacity: 1 }, { opacity: 0, offset: 0.3 }, { opacity: 0 }], opts);
    flight.querySelector('.cc-flight-paper').animate(
      [{ opacity: 1, borderRadius: '14px' }, { opacity: 1, offset: 0.5 }, { opacity: 0, borderRadius: '3px' }],
      opts
    );
    flight.querySelector('.cc-flight-note').animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], opts);
    pencil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 150, fill: 'forwards', easing: EASE_IN });
    await move.finished;
    swapProps();
    flight.remove();
  }

  /* Consequence of the landing: the composer gives way to the waiting composition.
     Opacity only, so the note landing stays the single movement. */
  async function swapToWaiting(root, round) {
    const stage = root.querySelector('#stage');
    const btn = root.querySelector('#submit');
    const text = root.querySelector('.cc-dock-text');
    const outgoing = [stage, btn, text];
    if (!reducedMotion()) {
      await Promise.all(
        outgoing.map((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T.swapOut, easing: EASE_IN, fill: 'forwards' }).finished)
      );
    }
    root.querySelector('h1.sr-only').textContent = 'Waiting for the round';
    stage.innerHTML = waitingStage(round);
    stage.classList.replace('cc-stage--writing', 'cc-stage--waiting');
    /* Keep the dock's height so your character does not shift: if the button had
       wrapped onto its own row (narrow phones, large text), leave its row as space. */
    const charEl = root.querySelector('.cc-dock-char');
    if (btn.offsetTop > charEl.offsetTop + charEl.offsetHeight / 2) {
      const spacer = document.createElement('div');
      spacer.className = 'cc-dock-spacer';
      spacer.style.height = `${btn.offsetHeight}px`;
      btn.replaceWith(spacer);
    } else {
      btn.remove();
    }
    text.setAttribute('role', 'status');
    text.setAttribute('aria-live', 'polite');
    text.innerHTML = `<p class="cc-dock-title cc-ack" tabindex="-1">Tucked into the poem.</p><p class="cc-dock-status">${esc(YOU.name)}, tucked in</p>`;
    for (const el of [stage, text]) {
      el.getAnimations().forEach((an) => an.cancel());
      if (!reducedMotion()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.swapIn, easing: EASE_OUT });
    }
    text.querySelector('.cc-dock-title').focus({ preventScroll: true });
  }

  function renderWaiting(root) {
    root.innerHTML = `<div class="cc-page">
      ${header('code')}
      <main class="cc-main cc-main--game">
        <h1 class="sr-only">Waiting for the round</h1>
        <div class="cc-stage cc-stage--waiting" id="stage">${waitingStage(5)}</div>
        ${waitingDock()}
      </main>
    </div>`;
  }

  function readingMain() {
    const reader = R.byId.marguerite;
    const next = [
      { p: R.byId.basil, ord: '2nd' },
      { p: R.byId.wren, ord: '3rd' },
    ];
    return `<main class="cc-main cc-main--game">
      <div class="cc-stage">
        <p class="cc-meta">Reading circle</p>
        <div class="cc-reader">
          ${char(reader.avatar, { size: 132, prop: 'page', className: 'cc-reader-char' })}
          <h1 class="cc-reader-line"><span class="cc-reader-name">${esc(reader.name)}</span> is reading Poem 1</h1>
          <button type="button" class="cc-btn cc-btn--secondary" id="follow">Follow along</button>
        </div>
        <section class="cc-next" aria-labelledby="next-h">
          <h2 class="cc-eyebrow" id="next-h">Up next</h2>
          <ol class="cc-next-list">
            ${next
              .map(
                ({ p, ord }) => `<li class="cc-next-item">${char(p.avatar, { size: 44 })}<span class="cc-next-text"><span class="cc-name">${esc(p.name)}</span><span class="cc-status">Reads ${ord}</span></span></li>`
              )
              .join('')}
          </ol>
        </section>
      </div>
      ${dock({
        prop: 'note',
        title: 'You read 4th',
        status: 'Poem 4 stays folded until your turn.',
      })}
    </main>`;
  }

  function renderReading(root, { animateIn = false } = {}) {
    root.innerHTML = `<div class="cc-page">${header('code')}${readingMain()}</div>`;
    const btn = root.querySelector('#follow');
    btn.addEventListener('click', async () => {
      if (btn.getAttribute('aria-busy') === 'true') return;
      btn.setAttribute('aria-busy', 'true');
      btn.textContent = 'Opening…';
      await wait(T.openPending);
      const page = root.querySelector('.cc-reader-char .cc-prop--page');
      openPoem(root, page.getBoundingClientRect());
    });
    if (animateIn && !reducedMotion()) {
      root.querySelector('.cc-main').animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.swapIn, easing: EASE_OUT });
    }
    if (animateIn) btn.focus({ preventScroll: true });
  }

  function poemMain() {
    const poem = R.poems[0];
    const reader = R.byId[poem.reader];
    const authors = [];
    for (const [, id] of poem.lines) if (!authors.includes(id)) authors.push(id);
    return `<main class="cc-main cc-main--poem">
      <article class="cc-sheet" aria-labelledby="poem-title">
        <header class="cc-sheet-head">
          ${char(reader.avatar, { size: 48, prop: 'page', className: 'cc-sheet-reader' })}
          <div>
            <h1 class="cc-sheet-title" id="poem-title" tabindex="-1">Poem 1</h1>
            <p class="cc-sheet-sub">${esc(reader.name)} is reading</p>
          </div>
        </header>
        <ol class="cc-poem" aria-label="Poem lines">
          ${poem.lines
            .map(
              ([text, id]) => `<li><span class="cc-line">${esc(text)}</span> <span class="cc-line-by"><span class="sr-only">Written by </span>${esc(R.byId[id].name)}</span></li>`
            )
            .join('')}
        </ol>
        <footer class="cc-credits">
          <p class="cc-eyebrow">Lines by</p>
          <ul class="cc-credit-list">
            ${authors.map((id) => `<li>${char(R.byId[id].avatar, { size: 32 })}<span>${esc(R.byId[id].name)}</span></li>`).join('')}
          </ul>
          <button type="button" class="cc-text-btn" id="who" aria-pressed="false">Show who wrote each line</button>
        </footer>
      </article>
      <div class="cc-action">
        <button type="button" class="cc-btn cc-btn--primary cc-btn--wide" id="done">Done</button>
      </div>
    </main>`;
  }

  /* Opening: the whole poem comes up out of the reader's page, all nine lines at once. */
  function openPoem(root, fromRect) {
    const page = root.querySelector('.cc-page');
    const oldMain = page.querySelector('.cc-main');
    const oldBox = oldMain && { top: oldMain.offsetTop, height: oldMain.offsetHeight };
    if (oldMain) {
      if (reducedMotion()) oldMain.remove();
      else {
        /* Freeze the outgoing composition where it is while it fades. */
        Object.assign(oldMain.style, {
          position: 'absolute',
          top: `${oldBox.top}px`,
          left: '0',
          right: '0',
          height: `${oldBox.height}px`,
          pointerEvents: 'none',
        });
        oldMain.setAttribute('aria-hidden', 'true');
        oldMain.inert = true;
        oldMain
          .animate([{ opacity: 1 }, { opacity: 0 }], { duration: T.swapOut, easing: EASE_IN, fill: 'forwards' })
          .finished.then(() => oldMain.remove());
      }
    }
    page.insertAdjacentHTML('beforeend', poemMain());
    const newMain = page.querySelector('.cc-main--poem');
    wirePoem(root);
    const title = newMain.querySelector('#poem-title');
    title.focus({ preventScroll: true });
    if (reducedMotion()) return;
    const sheet = newMain.querySelector('.cc-sheet');
    const to = sheet.getBoundingClientRect();
    const from = fromRect || newMain.querySelector('.cc-sheet-reader').getBoundingClientRect();
    const s = Math.max(0.12, from.width / to.width);
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - to.top;
    sheet.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0 },
        { opacity: 1, offset: 0.35 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: T.open, easing: EASE_OUT }
    );
    newMain.querySelector('.cc-action').animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], {
      duration: T.open,
      easing: EASE_OUT,
    });
  }

  function wirePoem(root) {
    const who = root.querySelector('#who');
    const sheet = root.querySelector('.cc-sheet');
    who.addEventListener('click', () => {
      const on = who.getAttribute('aria-pressed') !== 'true';
      who.setAttribute('aria-pressed', String(on));
      who.textContent = on ? 'Hide who wrote each line' : 'Show who wrote each line';
      sheet.classList.toggle('show-authors', on);
    });
    root.querySelector('#done').addEventListener('click', () => renderReading(root, { animateIn: true }));
  }

  function renderPoem(root) {
    root.innerHTML = `<div class="cc-page">${header('code')}</div>`;
    openPoem(root, null);
  }

  /* Extra: the cast sheet. Dark edge treatment and the prop vocabulary side by side. */
  function renderCastSheet(root) {
    const legend = [
      ['crown', 'Host'],
      ['pencil', 'Writing'],
      ['note', 'Tucked in'],
      ['moon', 'Away'],
      ['eyes', 'Watching'],
      ['page', 'Reading'],
    ];
    root.innerHTML = `<div class="cc-page">
      ${header('wordmark')}
      <main class="cc-main cc-sheet-board">
        <h1 class="cc-h2">Cast and props</h1>
        <section aria-labelledby="edge-h">
          <h2 class="cc-eyebrow" id="edge-h">Sticker edge (every character, both modes)</h2>
          <ul class="cc-board-row">
            ${LJ.CAST_IDS.map((id) => `<li>${char(id, { size: 56 })}<span class="cc-status">${LJ.CAST_NAMES[id]}</span></li>`).join('')}
          </ul>
        </section>
        <section aria-labelledby="bare-h">
          <h2 class="cc-eyebrow" id="bare-h">Without the edge, as shipped today</h2>
          <ul class="cc-board-row">
            ${LJ.CAST_IDS.map((id) => `<li>${char(id, { size: 56, edge: false })}<span class="cc-status">${LJ.CAST_NAMES[id]}</span></li>`).join('')}
          </ul>
        </section>
        <section aria-labelledby="props-h">
          <h2 class="cc-eyebrow" id="props-h">Props, always with their words</h2>
          <ul class="cc-board-row cc-board-row--props">
            ${legend.map(([p, label]) => `<li>${char('orbit', { size: 56, prop: p })}<span class="cc-name">${label}</span></li>`).join('')}
          </ul>
        </section>
      </main>
    </div>`;
  }

  LJ.mount({
    title: 'Cast Companion',
    stance:
      'Your character is with you the whole game, and the cast carries state so the words on screen can stay quiet. Characters and props supplement names and text statuses, never replace them.',
    screens: [
      { id: 'lobby-host', label: 'Lobby, host', render: renderLobby },
      { id: 'writing', label: 'Writing, round 5', render: renderWriting },
      { id: 'waiting', label: 'Waiting, round 5', render: renderWaiting },
      { id: 'reading-turn', label: 'Reading circle, Marguerite reads', render: (root) => renderReading(root) },
      { id: 'poem-open', label: 'Poem 1 open', render: renderPoem },
      { id: 'x-cast-sheet', label: 'Cast and props', render: renderCastSheet },
    ],
  });
})();
