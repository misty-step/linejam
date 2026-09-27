/* Round Table: every screen is the table. A ring of seats is the room's persistent map.
   Choreography grammar (one, everywhere):
   - Along the rim: the light moves to the seat where something changed (arrival, next reader).
   - Outward from the center: the table hands you something (the line before yours, a poem).
   - Inward to the center: you give the table something (your line).
   Lines never travel seat to seat: the server shuffles who receives what. */
(function () {
  const room = LJ.room;
  const people = room.byId;

  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = {
    out: 'cubic-bezier(0.25, 1, 0.5, 1)', // --ease-out
    in: 'cubic-bezier(0.25, 0.1, 0.25, 1)', // --ease-in
    travel: 'cubic-bezier(0.45, 0, 0.2, 1)', // --rt-ease-travel
  };
  const MS = { rim: 400, lamp: 450, fill: 300, handOut: 360, tuck: 320, open: 400, reveal: 300, sheet: 420, close: 300, fade: 150, pending: 700 };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /* Seats by compass point. You always sit at the bottom, nearest your hand. */
  const ANGLE = { S: 90, E: 0, N: -90, W: 180, SE: 45, NE: -45, NW: -135, SW: 135 };
  const UP = new Set(['N', 'NE', 'NW']);
  /* Arrivals fill the four sides first, then the corners, so a small table stays balanced. */
  const FILL_ORDER = ['S', 'E', 'N', 'W', 'SE', 'NW', 'NE', 'SW'];
  const SEAT = { juniper: 'S', wren: 'E', basil: 'N', marguerite: 'W' };
  /* Only for the ?full=1 capacity check: four more guests. */
  const EXTRA_GUESTS = [
    { id: 'ada', name: 'Ada', avatar: 'sunny' },
    { id: 'tomasz', name: 'Tomasz Wiśniewski', avatar: 'sprout' },
    { id: 'rosalind', name: 'Rosalind', avatar: 'pip' },
    { id: 'kofi', name: 'Kofi', avatar: 'plum' },
  ];

  const ICON = {
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sound: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    muted: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6M16 9l6 6"/>',
    more: '<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    book: '<path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2Z"/><path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8Z"/>',
    crown: '<path d="m2 8 4 10h12l4-10-6 4-4-7-4 7Z"/>',
  };
  const icon = (name, size = 20) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[name]}</svg>`;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const firstName = (name) => name.split(/\s+/)[0];
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  /* ---------- QR: https://linejam.app/join?code=9AUK, version 3, level M (qrencode). ---------- */
  const QR_ROWS = [
    '11111110000011001111001111111', '10000010110100111101101000001', '10111010011111101001001011101',
    '10111010011111110010001011101', '10111010111000100111001011101', '10000010010101000011001000001',
    '11111110101010101010101111111', '00000000001011101100000000000', '10101010011100111111100010010',
    '00010100101100110010111001001', '11100010110101000100000110111', '10010101111100000110111000010',
    '10100010110100011101111001011', '00101100100001011100011001001', '11100110111100100110101001011',
    '01101101010011111111000011010', '11010110000110100100011001011', '01110101100010111000111001101',
    '10110010101111000100110110011', '01000100001010010111000111010', '10101010000110001100111110000',
    '00000000100101011100100010111', '11111110000110100001101011011', '10000010010001110100100011011',
    '10111010111000110100111110001', '10111010011111100100010110111', '10111010101100000000100111001',
    '10000010011111111111101100010', '11111110100101110111100100011',
  ];
  function qrSvg() {
    let d = '';
    QR_ROWS.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === '1') d += `M${x} ${y}h1v1h-1z`;
    });
    const n = QR_ROWS.length;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR code for joining room ${room.codeDisplay}"><path d="${d}" fill="#1f1030"/></svg>`;
  }

  /* ---------- Chrome ---------- */
  function header({ lobby }) {
    const node = el(`
      <header class="rt-header">
        ${lobby
          ? '<p class="rt-wordmark">Linejam</p>'
          : `<button type="button" class="rt-headcode" aria-label="Invite friends to room ${room.codeDisplay}">${room.codeDisplay}</button>`}
        <div class="rt-header-tools">
          <button type="button" class="rt-icon" data-appearance></button>
          <button type="button" class="rt-icon" data-sound aria-pressed="false" aria-label="Mute sound">${icon('sound')}</button>
          <button type="button" class="rt-icon" aria-label="Room options">${icon('more')}</button>
        </div>
      </header>`);
    const modes = ['system', 'light', 'dark'];
    const glyph = { system: 'monitor', light: 'sun', dark: 'moon' };
    const word = { system: 'System', light: 'Light', dark: 'Dark' };
    let mode = 'system';
    const appearance = node.querySelector('[data-appearance]');
    const paint = () => {
      const next = modes[(modes.indexOf(mode) + 1) % 3];
      appearance.innerHTML = icon(glyph[mode]);
      appearance.setAttribute('aria-label', `Appearance: ${word[mode]}. Switch to ${word[next]}.`);
      const dark = mode === 'dark' || (mode === 'system' && LJ.theme === 'dark');
      document.documentElement.classList.toggle('dark', dark);
    };
    appearance.addEventListener('click', () => {
      mode = modes[(modes.indexOf(mode) + 1) % 3];
      paint();
    });
    paint();
    const sound = node.querySelector('[data-sound]');
    sound.addEventListener('click', () => {
      const muted = sound.getAttribute('aria-pressed') !== 'true';
      sound.setAttribute('aria-pressed', String(muted));
      sound.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
      sound.innerHTML = icon(muted ? 'muted' : 'sound');
    });
    return node;
  }

  /* ---------- The table ---------- */
  /* seat: { id, name, avatar, pos, state: filled|empty|lit|away|reader, status: [glyph, text], you, note } */
  function seatNode(seat) {
    const cls = ['rt-seat', `is-${seat.state}`];
    if (UP.has(seat.pos)) cls.push('is-up');
    if (seat.you) cls.push('is-you');
    const style = `--a:${ANGLE[seat.pos]}deg`;
    if (seat.state === 'empty') {
      return el(`<li class="${cls.join(' ')}" style="${style}" data-pos="${seat.pos}"><span class="rt-pad" aria-hidden="true"></span><span class="sr-only">Empty seat</span></li>`);
    }
    const node = el(`
      <li class="${cls.join(' ')}" style="${style}" data-id="${seat.id}" data-pos="${seat.pos}">
        <span class="rt-pad">${LJ.avatar(seat.avatar, { size: 44 })}<span class="rt-badge" aria-hidden="true"></span></span>
        <span class="rt-label">
          <span class="rt-name" aria-hidden="true">${esc(firstName(seat.name))}</span>
          <span class="rt-fullname">${esc(seat.name)}${seat.you ? '<span class="sr-only"> (you)</span>' : ''}</span>
          <span class="rt-status"></span>
        </span>
      </li>`);
    paintStatus(node, seat.status);
    return node;
  }

  function paintStatus(node, status) {
    const [glyph, text] = status || [null, ''];
    node.querySelector('.rt-status').innerHTML = `${glyph ? icon(glyph, 12) : ''}<span>${esc(text)}</span>`;
    node.querySelector('.rt-badge').innerHTML = glyph ? icon(glyph, 12) : '';
  }

  function makeTable({ seats, arc = false, watcher = null, label = 'Seats at the table' }) {
    const node = el(`
      <div class="rt-stage${arc ? ' is-arc' : ''}">
        <div class="rt-rim" aria-hidden="true"></div>
        <div class="rt-light" aria-hidden="true"></div>
        <div class="rt-table"><div class="rt-center" role="status" aria-live="polite" tabindex="-1"></div></div>
        <ul class="rt-seats" aria-label="${esc(label)}"></ul>
      </div>`);
    const list = node.querySelector('.rt-seats');
    for (const seat of seats) list.append(seatNode(seat));
    if (watcher) {
      node.append(
        el(`<div class="rt-watcher">
          ${LJ.avatar(watcher.avatar, { size: 36, outlined: true })}
          <span class="rt-wlabel">
            <span class="rt-name" aria-hidden="true">${esc(firstName(watcher.name))}</span>
            <span class="rt-fullname">${esc(watcher.name)}, joined late</span>
            <span class="rt-status">${icon('eye', 12)}<span>Watching</span></span>
          </span>
        </div>`),
      );
    }
    const center = node.querySelector('.rt-center');
    const light = node.querySelector('.rt-light');
    const seatEl = (key) => list.querySelector(`[data-id="${key}"]`) || list.querySelector(`[data-pos="${key}"]`);
    const isList = () => getComputedStyle(light).display === 'none';

    return {
      node,
      center,
      seatEl,
      isList,
      setCenter(html) {
        center.innerHTML = html;
      },
      setSeat(key, { state, status, arriving, lighting }) {
        const s = seatEl(key);
        if (state) {
          s.classList.remove('is-filled', 'is-empty', 'is-lit', 'is-away', 'is-reader');
          s.classList.add(`is-${state}`);
        }
        if (status) paintStatus(s, status);
        const anim = arriving ? 'is-arriving' : lighting ? 'is-lighting' : null;
        if (anim && !reduced()) {
          s.classList.remove(anim);
          void s.offsetWidth;
          s.classList.add(anim);
          setTimeout(() => s.classList.remove(anim), MS.fill + 50);
        }
      },
      light: {
        place(pos, kind) {
          light.classList.toggle('is-lamp', kind === 'lamp');
          light.style.setProperty('--rt-la', `${ANGLE[pos]}deg`);
          light.dataset.pos = pos;
          light.style.opacity = '1';
        },
        /* Travels along the rim by the shorter way; direction carries no meaning, the seat does. */
        async travel(pos, ms) {
          const from = ANGLE[light.dataset.pos];
          const delta = ((ANGLE[pos] - from + 540) % 360) - 180;
          light.dataset.pos = pos;
          if (reduced() || isList()) return void light.style.setProperty('--rt-la', `${from + delta}deg`);
          await light.animate([{ '--rt-la': `${from}deg` }, { '--rt-la': `${from + delta}deg` }], { duration: ms, easing: EASE.travel }).finished;
          light.style.setProperty('--rt-la', `${from + delta}deg`);
        },
        async fade(to, ms) {
          if (!reduced() && !isList()) {
            await light.animate([{ opacity: light.style.opacity || 0 }, { opacity: to }], { duration: ms, easing: EASE.out }).finished;
          }
          light.style.opacity = String(to);
        },
      },
    };
  }

  function appShell(root, { lobby }) {
    const app = el('<div class="rt-app"></div>');
    app.append(header({ lobby }));
    const main = el(`<main class="rt-main${lobby ? '' : ' rt-main--game'}"></main>`);
    app.append(main);
    root.append(app);
    return { app, main };
  }

  const seatFor = (id, extra) => ({ id, name: people[id].name, avatar: people[id].avatar, pos: SEAT[id], you: id === room.you, ...extra });

  /* ---------- lobby-host ---------- */
  function renderLobby(root) {
    const full = LJ.params.get('full') === '1';
    const { main } = appShell(root, { lobby: true });
    main.insertAdjacentHTML('beforeend', '<h1 class="sr-only">Room lobby</h1>');
    const guests = full ? EXTRA_GUESTS : [];
    const seated = [...room.players, ...guests];
    const taken = new Map(seated.map((p, i) => [FILL_ORDER[i], p]));
    const seats = [];
    for (const p of seated) {
      const pos = FILL_ORDER[seated.indexOf(p)];
      seats.push({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        pos,
        you: p.id === room.you,
        state: 'filled',
        status: p.host ? ['crown', 'Host'] : null,
      });
    }
    for (const pos of FILL_ORDER) if (!taken.has(pos)) seats.push({ pos, state: 'empty' });
    const table = makeTable({ seats, label: `${seated.length} of ${room.capacity} seats taken` });
    table.setCenter(`
      <span class="rt-c-label" id="rt-code-label">Room code</span>
      <button type="button" class="rt-c-code" aria-label="Copy room code ${room.codeDisplay}">${room.codeDisplay}${icon('copy', 16)}</button>
      <span class="rt-c-hint" aria-live="polite">Tap to copy</span>`);
    table.center.removeAttribute('role');
    table.center.removeAttribute('aria-live');
    main.append(table.node);

    const newest = seated[seated.length - 1];
    const arrivalText = `<strong>${esc(newest.name)}</strong> sat down. ${seated.length} of ${room.capacity} seats taken.`;
    const arrival = el(`<p class="rt-arrival" role="status" aria-live="polite"></p>`);
    main.append(arrival);

    main.append(
      el(`<section class="rt-invite" aria-label="Room invitation">
        <div class="rt-qr">${qrSvg()}</div>
        <div class="rt-invite-side">
          <h2>Scan to join</h2>
          <p>Hold your phone out. Friends scan it and take a seat.</p>
          <button type="button" class="rt-btn rt-btn--quiet rt-btn--small" data-share>${icon('share', 18)}<span>Share invite</span></button>
        </div>
      </section>`),
    );
    const start = el(`<button type="button" class="rt-btn rt-start">Start Linejam</button>`);
    main.append(start);

    const codeBtn = table.center.querySelector('.rt-c-code');
    const hint = table.center.querySelector('.rt-c-hint');
    codeBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(room.code);
        hint.textContent = 'Copied';
      } catch {
        hint.textContent = 'Couldn\u2019t copy. Read it out instead.';
      }
    });
    const share = main.querySelector('[data-share]');
    share.addEventListener('click', async () => {
      const label = share.querySelector('span');
      try {
        if (navigator.share) await navigator.share({ title: 'Join my Linejam', url: room.joinUrl });
        else await navigator.clipboard.writeText(room.joinUrl);
        label.textContent = navigator.share ? 'Shared' : 'Link copied';
      } catch {
        label.textContent = 'Try the QR code';
      }
    });
    start.addEventListener('click', async () => {
      if (start.getAttribute('aria-busy') === 'true') return;
      start.setAttribute('aria-busy', 'true');
      start.textContent = 'Starting\u2026';
      await wait(MS.pending);
      const url = new URL(location.href);
      url.searchParams.set('screen', 'writing');
      location.href = url.toString();
    });

    /* Arrival: the light leaves the last seat that changed and travels the rim to the new seat. */
    const prevPos = FILL_ORDER[seated.length - 2];
    const newPos = FILL_ORDER[seated.length - 1];
    if (reduced() || table.isList()) {
      arrival.innerHTML = arrivalText;
      return;
    }
    table.setSeat(newest.id, { state: 'empty' });
    table.light.place(prevPos, 'arrive');
    table.node.querySelector('.rt-light').style.opacity = '0';
    (async () => {
      await wait(250);
      await table.light.fade(1, MS.fade);
      await table.light.travel(newPos, MS.rim);
      table.setSeat(newest.id, { state: 'filled', arriving: true });
      arrival.innerHTML = arrivalText;
      await table.light.fade(0, MS.fill);
    })();
  }

  /* ---------- writing and waiting ---------- */
  const assignment = room.assignments[4];
  const PLAYING = ['juniper', 'wren', 'basil', 'marguerite'];
  const roundText = `Round ${assignment.round} of ${room.WORD_COUNTS.length}`;
  const writingStatus = {
    juniper: { state: 'filled', status: ['pencil', 'Writing'] },
    wren: { state: 'lit', status: ['check', 'Tucked in'] },
    basil: { state: 'filled', status: ['pencil', 'Writing'] },
    marguerite: { state: 'away', status: ['moon', 'Away'] },
  };
  const waitingCenter = `<p class="rt-c-ack">Tucked into the poem.</p><span class="rt-c-sub">${roundText}</span>`;

  function renderGame(root, phase) {
    const { app, main } = appShell(root, { lobby: false });
    const writing = phase === 'writing';
    app.style.setProperty('--rt-open', writing ? '0' : '1');
    main.insertAdjacentHTML('beforeend', `<h1 class="sr-only">${roundText}</h1>`);
    const seats = PLAYING.map((id) => seatFor(id, writing || id !== 'juniper' ? writingStatus[id] : { state: 'lit', status: ['check', 'Tucked in'] }));
    const table = makeTable({ seats, arc: writing, watcher: room.lateJoiner, label: `Players this round` });
    main.append(table.node);

    if (!writing) {
      table.setCenter(waitingCenter);
      table.setSeat('juniper', { lighting: true });
      return;
    }

    const peak = assignment.target === Math.max(...room.WORD_COUNTS) ? `${assignment.target} words, the longest line` : `exactly ${assignment.target} words`;
    table.setCenter(`<span class="rt-c-label">Round</span><span class="rt-c-round">${assignment.round} of ${room.WORD_COUNTS.length}</span>`);
    table.center.removeAttribute('role');
    table.center.removeAttribute('aria-live');

    const target = assignment.target;
    const compose = el(`
      <form class="rt-compose" novalidate>
        <div class="rt-received">
          <p class="rt-kicker">The line before yours</p>
          <p class="rt-received-line">${esc(assignment.previousLine)}</p>
        </div>
        <label class="rt-composer-label" for="rt-line"><span>Your line</span><span>${peak}</span></label>
        <textarea id="rt-line" class="rt-textarea" rows="2" autocomplete="off" autocapitalize="off" spellcheck="false"
          aria-label="Write your line for round ${assignment.round}. Target: ${target} words." aria-describedby="rt-count-text rt-count-hint">and nobody asked</textarea>
        <div class="rt-count">
          <div class="rt-slots" aria-hidden="true"></div>
          <span class="rt-count-text" id="rt-count-text"></span>
          <span class="rt-count-hint" id="rt-count-hint"></span>
        </div>
        <p class="sr-only" aria-live="polite" data-live></p>
        <button type="submit" class="rt-btn" data-submit>Submit</button>
      </form>`);
    main.append(compose);

    const ta = compose.querySelector('textarea');
    const slots = compose.querySelector('.rt-slots');
    const countText = compose.querySelector('.rt-count-text');
    const hint = compose.querySelector('.rt-count-hint');
    const live = compose.querySelector('[data-live]');
    const submit = compose.querySelector('[data-submit]');
    let pending = false;
    let liveTimer;
    const words = () => ta.value.trim().split(/\s+/).filter(Boolean).length;

    function paint() {
      const n = words();
      const diff = target - n;
      slots.innerHTML = '';
      for (let i = 0; i < target; i++) slots.append(el(`<span class="rt-slot${i < n ? ' is-filled' : ''}"></span>`));
      for (let i = target; i < Math.min(n, target + 3); i++) slots.append(el('<span class="rt-slot is-extra"></span>'));
      countText.textContent = `${n} of ${target} words`;
      const message = diff === 0 ? 'Ready to submit' : n === 0 ? '' : diff > 0 ? `Add ${diff} word${diff === 1 ? '' : 's'}` : `Remove ${-diff} word${diff === -1 ? '' : 's'}`;
      hint.textContent = message;
      hint.classList.toggle('is-over', diff < 0);
      submit.disabled = pending || diff !== 0;
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => (live.textContent = message), 500);
    }
    ta.addEventListener('input', paint);
    ta.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (!submit.disabled) compose.requestSubmit();
      }
    });
    paint();

    compose.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (pending || words() !== target) return;
      pending = true;
      /* Pending first: nothing looks accepted until the (simulated) server says so. */
      ta.readOnly = true;
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      submit.textContent = 'Submitting\u2026';
      live.textContent = 'Submitting your line';
      await wait(MS.pending);
      await tuckIn(ta.value.trim());
    });

    /* Received line: handed out from the table's center toward you. */
    if (!reduced() && !table.isList()) {
      const card = compose.querySelector('.rt-received');
      const c = table.node.querySelector('.rt-table').getBoundingClientRect();
      const r = card.getBoundingClientRect();
      const dx = c.left + c.width / 2 - (r.left + r.width / 2);
      const dy = c.top + c.height / 2 - (r.top + r.height / 2);
      card.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: MS.handOut, easing: EASE.out, delay: 150, fill: 'backwards' },
      );
    }

    async function tuckIn(text) {
      const motion = !reduced() && !table.isList();
      if (motion) {
        /* Your line travels inward, into the table's center. */
        const t = ta.getBoundingClientRect();
        const chip = el(`<p class="rt-chip">${esc(text)}</p>`);
        chip.style.left = `${t.left + 16}px`;
        chip.style.top = `${t.top + 14}px`;
        document.body.append(chip);
        const c = table.node.querySelector('.rt-table').getBoundingClientRect();
        const r = chip.getBoundingClientRect();
        const dx = c.left + c.width / 2 - (r.left + r.width / 2);
        const dy = c.top + c.height / 2 - (r.top + r.height / 2);
        ta.style.color = 'transparent';
        compose.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MS.fade, easing: EASE.in, fill: 'forwards' });
        await chip.animate(
          [
            { transform: 'none', opacity: 1 },
            { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0 },
          ],
          { duration: MS.tuck, easing: EASE.in, fill: 'forwards' },
        ).finished;
        chip.remove();
      }
      compose.remove();
      table.center.setAttribute('role', 'status');
      table.center.setAttribute('aria-live', 'polite');
      /* The table opens back up to the whole ring; your seat is revealed and lights. */
      table.node.classList.remove('is-arc');
      app.style.setProperty('--rt-open', '1');
      table.setCenter(waitingCenter);
      if (motion) await wait(MS.open);
      table.setSeat('juniper', { state: 'lit', status: ['check', 'Tucked in'], lighting: true });
      table.center.focus({ preventScroll: true });
    }
  }

  /* ---------- reading circle and the open poem ---------- */
  const ORDER = room.poems.map((p) => p.reader); // marguerite, basil, wren, juniper
  const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

  function readingSeats(current) {
    return ORDER.map((id, i) => {
      const extra =
        i < current
          ? { state: 'filled', status: ['check', 'Read'] }
          : i === current
            ? { state: 'reader', status: ['book', 'Reading'] }
            : { state: 'filled', status: [null, ORDINAL[i]] };
      return seatFor(id, extra);
    });
  }
  const readingCenter = (i) => {
    const poem = room.poems[i];
    return `<p class="rt-c-read">${esc(firstName(people[poem.reader].name))} is reading Poem ${poem.number}</p>
      <button type="button" class="rt-follow" data-follow aria-haspopup="dialog">Follow along</button>`;
  };

  function renderReading(root, { open = false, advance = false } = {}) {
    const { app, main } = appShell(root, { lobby: false });
    main.insertAdjacentHTML('beforeend', '<h1 class="sr-only">Reading circle</h1>');
    let current = 0;
    const table = makeTable({ seats: readingSeats(current), watcher: room.lateJoiner, label: 'Reading order' });
    table.setCenter(readingCenter(current));
    main.append(table.node);
    table.light.place(SEAT[ORDER[current]], 'lamp');
    const mine = room.poems.find((p) => p.reader === room.you);
    const before = firstName(people[ORDER[ORDER.indexOf(room.you) - 1]].name);
    main.append(el(`<p class="rt-note">You read Poem ${mine.number} last, after ${esc(before)}.</p>`));

    let sheet;
    let scroll;
    function mountSheet() {
      const fresh = buildSheet(room.poems[current]);
      fresh.querySelector('[data-done]').addEventListener('click', closeSheet);
      fresh.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeSheet();
      });
      if (sheet) sheet.replaceWith(fresh);
      else app.append(fresh);
      sheet = fresh;
      scroll = sheet.querySelector('.rt-sheet-scroll');
    }

    function tableCenterIn(rect) {
      const c = table.node.querySelector('.rt-table').getBoundingClientRect();
      return { cx: c.left + c.width / 2 - rect.left, cy: c.top + c.height / 2 - rect.top, r0: c.width / 2 };
    }

    async function openSheet(animate) {
      sheet.hidden = false;
      main.inert = true;
      const rect = sheet.getBoundingClientRect();
      if (animate && !reduced() && !table.isList()) {
        /* The table's surface grows into the page; the nine lines then appear together. */
        const { cx, cy, r0 } = tableCenterIn(rect);
        const r1 = Math.hypot(Math.max(cx, rect.width - cx), Math.max(cy, rect.height - cy));
        sheet.animate(
          [{ clipPath: `circle(${r0}px at ${cx}px ${cy}px)` }, { clipPath: `circle(${r1}px at ${cx}px ${cy}px)` }],
          { duration: MS.reveal, easing: EASE.out },
        );
        scroll.animate([{ opacity: 0 }, { opacity: 0, offset: 0.62 }, { opacity: 1 }], { duration: MS.sheet, easing: 'linear' });
      }
      sheet.querySelector('.rt-poem-title').focus({ preventScroll: true });
    }

    async function closeSheet() {
      if (!reduced() && !table.isList()) {
        const rect = sheet.getBoundingClientRect();
        const { cx, cy, r0 } = tableCenterIn(rect);
        const r1 = Math.hypot(Math.max(cx, rect.width - cx), Math.max(cy, rect.height - cy));
        scroll.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: EASE.in, fill: 'forwards' });
        await sheet.animate(
          [{ clipPath: `circle(${r1}px at ${cx}px ${cy}px)` }, { clipPath: `circle(${r0}px at ${cx}px ${cy}px)` }],
          { duration: MS.close, easing: EASE.in },
        ).finished;
        scroll.getAnimations().forEach((a) => a.cancel());
      }
      sheet.hidden = true;
      main.inert = false;
      table.center.querySelector('[data-follow]')?.focus();
    }

    table.center.addEventListener('click', (event) => {
      if (event.target.closest('[data-follow]')) openSheet(true);
    });
    mountSheet();
    if (open) openSheet(false);

    if (advance) {
      /* Marguerite taps Done on her phone: the lamp travels the rim to the next reader. */
      (async () => {
        await wait(900);
        current = 1;
        const next = ORDER[current];
        table.setSeat(ORDER[0], { state: 'filled', status: ['check', 'Read'] });
        await table.light.travel(SEAT[next], MS.lamp);
        table.setSeat(next, { state: 'reader', status: ['book', 'Reading'] });
        table.setCenter(readingCenter(current));
        mountSheet();
      })();
    }
  }

  function buildSheet(poem) {
    const reader = people[poem.reader];
    const authors = [...new Set(poem.lines.map(([, a]) => a))].map((a) => firstName(people[a].name));
    const credit = `${authors.slice(0, -1).join(', ')} and ${authors[authors.length - 1]}`;
    const marks = Object.entries(SEAT)
      .map(([id, pos]) => {
        const at = { S: 'left:50%;top:100%', N: 'left:50%;top:0', E: 'left:100%;top:50%', W: 'left:0;top:50%' }[pos];
        return `<span class="rt-mark${id === poem.reader ? ' is-reader' : ''}" style="${at}"></span>`;
      })
      .join('');
    const node = el(`
      <section class="rt-sheet" role="dialog" aria-modal="true" aria-labelledby="rt-poem-title" hidden>
        <div class="rt-sheet-scroll">
          <div class="rt-poem-head">
            <span class="rt-pad">${LJ.avatar(reader.avatar, { size: 36 })}</span>
            <div>
              <h2 class="rt-poem-title" id="rt-poem-title" tabindex="-1">Poem ${poem.number}</h2>
              <p class="rt-poem-reader">Read by ${esc(reader.name)}</p>
            </div>
          </div>
          <ol class="rt-lines" aria-label="Poem lines">
            ${poem.lines.map(([text, by]) => `<li><span>${esc(text)}</span><span class="rt-line-by"><span class="sr-only">Written by </span>${esc(firstName(people[by].name))}</span></li>`).join('')}
          </ol>
          <p class="rt-credit">Written around the table by ${esc(credit)}.</p>
          <button type="button" class="rt-toggle" aria-pressed="false" data-authors>Show who wrote each line</button>
          <button type="button" class="rt-btn rt-btn--quiet" data-done>Done</button>
        </div>
        <div class="rt-frame" aria-hidden="true">${marks}</div>
      </section>`);
    const toggle = node.querySelector('[data-authors]');
    toggle.addEventListener('click', () => {
      const on = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', String(on));
      toggle.textContent = on ? 'Hide who wrote each line' : 'Show who wrote each line';
      node.querySelector('.rt-lines').classList.toggle('show-authors', on);
    });
    return node;
  }

  LJ.mount({
    title: 'Round Table',
    stance: 'Everyone sits around one table. Every screen shows the table; seats are the map of the room.',
    screens: [
      { id: 'lobby-host', label: 'Lobby, host', render: (root) => renderLobby(root) },
      { id: 'writing', label: 'Writing, round 5', render: (root) => renderGame(root, 'writing') },
      { id: 'waiting', label: 'Waiting after your line', render: (root) => renderGame(root, 'waiting') },
      { id: 'reading-turn', label: 'Reading circle, Marguerite reads', render: (root) => renderReading(root) },
      { id: 'poem-open', label: 'Poem 1 open', render: (root) => renderReading(root, { open: true }) },
      { id: 'x-next-reader', label: 'Signature: the lamp moves on', render: (root) => renderReading(root, { advance: true }) },
    ],
  });
})();
