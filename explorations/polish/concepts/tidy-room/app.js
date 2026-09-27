/* Tidy Room: same rooms, less noise.
   One quiet header, one focal point per screen, three motion moments:
   settle (acceptance, 320 ms), crossfade (round turn, 200 ms), rise (poem open, 280 ms). */
(function () {
  const R = LJ.room;
  const YOU = R.byId[R.you];
  const QR_ROWS = [
    "11111110000011001111001111111",
    "10000010110100111101101000001",
    "10111010011111101001001011101",
    "10111010011111110010001011101",
    "10111010111000100111001011101",
    "10000010010101000011001000001",
    "11111110101010101010101111111",
    "00000000001011101100000000000",
    "10101010011100111111100010010",
    "00010100101100110010111001001",
    "11100010110101000100000110111",
    "10010101111100000110111000010",
    "10100010110100011101111001011",
    "00101100100001011100011001001",
    "11100110111100100110101001011",
    "01101101010011111111000011010",
    "11010110000110100100011001011",
    "01110101100010111000111001101",
    "10110010101111000100110110011",
    "01000100001010010111000111010",
    "10101010000110001100111110000",
    "00000000100101011100100010111",
    "11111110000110100001101011011",
    "10000010010001110100100011011",
    "10111010111000110100111110001",
    "10111010011111100100010110111",
    "10111010101100000000100111001",
    "10000010011111111111101100010",
    "11111110100101110111100100011",
  ];

  /* ---------- small helpers ---------- */
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const node = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length;
  const ordinal = (n) => ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][n] || `${n}th`;
  const plural = (n, one, many) => (n === 1 ? one : many);

  /* Simulated server round trips. Nothing shows as accepted before these resolve. */
  const SERVER_MS = { submit: 700, open: 420, start: 600 };
  /* Motion budget. Every moment uses var(--ease-out). */
  const MOTION_MS = { settle: 320, crossfade: 200, rise: 280 };

  const ICON = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    sound: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6a1.4 1.4 0 0 1-1 .4H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5Z"/><path d="M16 9a5 5 0 0 1 0 6M19.4 18.4a9 9 0 0 0 0-12.8"/>',
    muted: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6a1.4 1.4 0 0 1-1 .4H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5Z"/><path d="m22 9-6 6M16 9l6 6"/>',
    more: '<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    pencil: '<path d="M21.2 6.8a1 1 0 0 0-4-4L3.8 16.2a2 2 0 0 0-.5.8L2 21.4a.5.5 0 0 0 .6.6l4.4-1.3a2 2 0 0 0 .8-.5Z"/>',
    eye: '<path d="M2.1 12.3a1 1 0 0 1 0-.6 10.8 10.8 0 0 1 19.8 0 1 1 0 0 1 0 .6 10.8 10.8 0 0 1-19.8 0"/><circle cx="12" cy="12" r="3"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/>',
    keep: '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/>',
  };
  const icon = (name, size = 22) =>
    `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[name]}</svg>`;

  /* Characters supplement names, so they are decorative next to a visible name. */
  const cast = (id, size, { outlined = false, className = '' } = {}) =>
    `<span class="cast${outlined ? ' cast--outlined' : ''} ${className}" style="--cast:${size}px">${LJ.avatar(id, { size, outlined })}</span>`;

  function qrSvg(size) {
    let d = '';
    QR_ROWS.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === '1') d += `M${x + 4} ${y + 4}h1v1h-1z`;
    });
    const n = QR_ROWS.length + 8;
    return `<svg class="qr" viewBox="0 0 ${n} ${n}" width="${size}" height="${size}" role="img" aria-label="QR code to join room ${R.codeDisplay}" shape-rendering="crispEdges" focusable="false"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#39234E"/></svg>`;
  }

  /* ---------- chrome state shared by every view ---------- */
  const chrome = {
    appearance: LJ.theme, // 'system' | 'light' | 'dark'
    muted: false,
  };
  const APPEARANCE_NEXT = { system: 'light', light: 'dark', dark: 'system' };
  const APPEARANCE_WORD = { system: 'System', light: 'Light', dark: 'Dark' };
  const APPEARANCE_ICON = { system: 'monitor', light: 'sun', dark: 'moon' };

  function applyAppearance() {
    const dark =
      chrome.appearance === 'dark' ||
      (chrome.appearance === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.querySelectorAll('[data-appearance]').forEach((b) => {
      const now = chrome.appearance;
      b.innerHTML = icon(APPEARANCE_ICON[now]);
      b.setAttribute('aria-label', `Appearance: ${APPEARANCE_WORD[now]}. Switch to ${APPEARANCE_WORD[APPEARANCE_NEXT[now]]}`);
    });
  }
  function applySound() {
    document.querySelectorAll('[data-sound]').forEach((b) => {
      b.innerHTML = icon(chrome.muted ? 'muted' : 'sound');
      b.setAttribute('aria-pressed', String(chrome.muted));
      b.setAttribute('aria-label', 'Mute sound');
    });
  }

  const MENUS = {
    lobbyHost: ['How to play', 'Your poems', 'Close room'],
    lobbyGuest: ['How to play', 'Your poems', 'Leave room'],
    game: ['How to play', 'Your poems', 'End game'],
  };

  function header({ left = 'code', menu = 'game' } = {}) {
    const leftHtml =
      left === 'wordmark'
        ? '<span class="wordmark">Linejam</span>'
        : `<button class="code-chip" type="button" data-invite aria-expanded="false" aria-label="Room ${R.codeDisplay}. Invite players">${R.codeDisplay}</button>`;
    return `<header class="bar" data-menu-kind="${menu}">
      ${leftHtml}
      <div class="bar-tools">
        <button class="tool" type="button" data-appearance></button>
        <button class="tool" type="button" data-sound></button>
        <button class="tool" type="button" data-menu aria-expanded="false" aria-label="Room options">${icon('more')}</button>
      </div>
    </header>`;
  }

  function inviteBlock({ compact = false } = {}) {
    return `<section class="invite${compact ? ' invite--compact' : ''}" aria-label="Invite players">
      <div class="invite-top">
        <div class="invite-code">
          <p class="overline">Room code</p>
          <button class="code-big" type="button" data-copy-code aria-label="Room code ${R.codeDisplay}. Copy code">
            <span>${R.codeDisplay}</span>${icon('copy', 20)}
          </button>
          <p class="invite-hint" role="status" data-copy-status>Scan, or enter the code at linejam.app</p>
        </div>
        ${qrSvg(compact ? 104 : 120)}
      </div>
      <button class="btn btn--quiet btn--block" type="button" data-share>${icon('share', 20)}<span>Share invite</span></button>
      <p class="invite-feedback" role="status" data-share-status></p>
    </section>`;
  }

  /* ---------- popovers: Room options and compact invitation ---------- */
  let openPop = null;
  function closePop(returnFocus = true) {
    if (!openPop) return;
    const { el, btn } = openPop;
    el.remove();
    btn.setAttribute('aria-expanded', 'false');
    openPop = null;
    if (returnFocus) btn.focus();
  }
  function togglePop(view, btn, html, kind) {
    if (openPop && openPop.btn === btn) return closePop();
    closePop(false);
    const el = node(html);
    el.classList.add('pop', `pop--${kind}`);
    el.id = `pop-${kind}`;
    btn.setAttribute('aria-controls', el.id);
    view.append(el);
    btn.setAttribute('aria-expanded', 'true');
    openPop = { el, btn };
    const first = el.querySelector('button');
    if (first) first.focus();
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePop();
  });
  document.addEventListener('pointerdown', (e) => {
    if (openPop && !openPop.el.contains(e.target) && !openPop.btn.contains(e.target)) closePop(false);
  });

  function wireView(view) {
    const bar = view.querySelector('.bar');
    if (bar) {
      bar.querySelector('[data-appearance]').addEventListener('click', () => {
        chrome.appearance = APPEARANCE_NEXT[chrome.appearance];
        applyAppearance();
      });
      bar.querySelector('[data-sound]').addEventListener('click', () => {
        chrome.muted = !chrome.muted;
        applySound();
      });
      const menuBtn = bar.querySelector('[data-menu]');
      menuBtn.addEventListener('click', () => {
        const items = MENUS[bar.dataset.menuKind]
          .map((label, i, all) => `<li><button type="button" class="pop-item${i === all.length - 1 ? ' pop-item--end' : ''}" data-close>${label}</button></li>`)
          .join('');
        togglePop(view, menuBtn, `<div role="group" aria-label="Room options"><ul class="pop-list">${items}</ul></div>`, 'menu');
      });
      const invite = bar.querySelector('[data-invite]');
      if (invite) {
        invite.addEventListener('click', () => togglePop(view, invite, `<div role="group" aria-label="Invite players">${inviteBlock({ compact: true })}</div>`, 'invite'));
      }
    }
    applyAppearance();
    applySound();
  }

  /* Invitation feedback lives at the action that succeeded or failed. */
  function flash(el, text, ms = 2600) {
    const prev = el.dataset.rest ?? el.textContent;
    el.dataset.rest = prev;
    el.textContent = text;
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.textContent = prev), ms);
  }
  async function copyText(text) {
    if (!navigator.clipboard) throw new Error('no clipboard');
    await navigator.clipboard.writeText(text);
  }
  document.addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('[data-copy-code]');
    if (copyBtn) {
      const status = copyBtn.closest('.invite').querySelector('[data-copy-status]');
      try {
        await copyText(R.code);
        flash(status, 'Code copied');
      } catch {
        flash(status, 'Copy did not work here. Read the code out instead.');
      }
      return;
    }
    const shareBtn = e.target.closest('[data-share]');
    if (shareBtn) {
      const status = shareBtn.closest('.invite').querySelector('[data-share-status]');
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Join my Linejam room', url: R.joinUrl });
          return;
        }
        await copyText(R.joinUrl);
        flash(status, 'Invite link copied');
      } catch {
        flash(status, 'Sharing did not work here. Friends can scan the code instead.');
      }
    }
  });

  /* ---------- stage: a grid cell where views swap ---------- */
  function stage(root) {
    const el = node('<div class="tr"><div class="sr-only" role="status" aria-live="polite" data-live></div></div>');
    root.append(el);
    const live = el.querySelector('[data-live]');
    return {
      el,
      say(text) {
        live.textContent = '';
        setTimeout(() => (live.textContent = text), 30);
      },
      show(view, { motion = null, focus = null } = {}) {
        closePop(false);
        const old = el.querySelector('.view');
        el.append(view);
        wireView(view);
        if (motion === 'crossfade' && old && !reduced()) {
          old.classList.add('xfade-out');
          old.setAttribute('aria-hidden', 'true');
          old.inert = true;
          view.classList.add('xfade-in');
          setTimeout(() => old.remove(), MOTION_MS.crossfade);
        } else if (old) {
          old.remove();
        }
        if (motion === 'settle') view.querySelector('main').classList.add('settle');
        if (motion === 'rise') view.querySelector('.rise-target').classList.add('rise');
        if (focus) {
          const target = view.querySelector(focus);
          if (target) target.focus({ preventScroll: true });
        }
        return view;
      },
    };
  }

  /* ---------- round glyph ---------- */
  const ROUND_NOTE = { 1: 'The first word', 5: 'The longest line', 9: 'The last word' };
  function roundRow(round) {
    const bars = R.WORD_COUNTS.map((n, i) => {
      const cls = i + 1 === round ? 'now' : i + 1 < round ? 'done' : '';
      return `<i class="${cls}" style="--n:${n}"></i>`;
    }).join('');
    const note = ROUND_NOTE[round] ? `<span class="round-note">${ROUND_NOTE[round]}</span>` : '';
    return `<div class="round"><span class="glyph" aria-hidden="true">${bars}</span><p class="round-label"><strong>Round ${round} of 9</strong>${note}</p></div>`;
  }

  /* ---------- lobby ---------- */
  function lobbyView({ guest = false } = {}) {
    const rows = R.players
      .map(
        (p) => `<li class="row">
          <span class="who">${cast(p.avatar, 40)}<span class="name">${esc(p.name)}${p.host ? ' <span class="tag">Host</span>' : ''}</span></span>
        </li>`
      )
      .join('');
    const host = R.players.find((p) => p.host);
    const foot = guest
      ? `<p class="foot-status" role="status">${cast(host.avatar, 28)}<span>${esc(host.name)} will start the game</span></p>`
      : '<button class="btn btn--primary btn--block btn--lg" type="button" data-start>Start game</button>';
    return node(`<div class="view view--lobby">
      ${header({ left: 'wordmark', menu: guest ? 'lobbyGuest' : 'lobbyHost' })}
      <main class="main lobby">
        <h1 class="sr-only">Lobby for room ${R.codeDisplay}</h1>
        ${inviteBlock()}
        <section class="players" aria-labelledby="players-h">
          <div class="section-head"><h2 id="players-h">Players</h2><span>${R.players.length} of ${R.capacity}</span></div>
          <ul class="roster">${rows}</ul>
          <p class="note">Friends who arrive after the start watch this game and play the next.</p>
        </section>
      </main>
      <div class="foot">${foot}</div>
    </div>`);
  }

  function renderLobby(root, { guest = false } = {}) {
    const st = stage(root);
    const view = st.show(lobbyView({ guest }));
    const start = view.querySelector('[data-start]');
    if (!start) return;
    start.addEventListener('click', async () => {
      start.disabled = true;
      start.classList.add('is-pending');
      start.textContent = 'Starting…';
      st.say('Starting the game');
      await sleep(SERVER_MS.start);
      showWriting(st, 1, { motion: 'crossfade' });
    });
  }

  /* ---------- writing ---------- */
  function writingView(round, prefill = '') {
    const a = R.assignments[round - 1];
    const slots = Array.from({ length: a.target }, () => '<i></i>').join('');
    const received = a.previousLine
      ? `<p class="overline" id="received-label">The line before yours</p>
         <p class="received-line" tabindex="-1" aria-describedby="received-label">${esc(a.previousLine)}</p>`
      : `<p class="overline" id="received-label">You start this poem</p>
         <p class="received-line received-line--empty" tabindex="-1">Begin it with one word.</p>`;
    return node(`<div class="view view--writing">
      ${header()}
      <main class="main writing">
        <h1 class="sr-only">Write your line for round ${round}</h1>
        ${roundRow(round)}
        <div class="spacer spacer--top"></div>
        <div class="write-group">
          <section class="received" aria-label="The line before yours">${received}</section>
          <div class="composer">
            <label class="overline" for="line-input">Your line</label>
            <textarea id="line-input" class="line-input" rows="2" maxlength="500" enterkeyhint="done" autocapitalize="sentences"
              aria-describedby="slot-text" aria-required="true" placeholder="${a.target} ${plural(a.target, 'word', 'words')}">${esc(prefill)}</textarea>
            <div class="slots" aria-hidden="true">${slots}</div>
            <div class="composer-row">
              <p class="slot-text" id="slot-text"></p>
              <button class="btn btn--primary submit" type="button" disabled>Submit</button>
            </div>
          </div>
        </div>
        <div class="spacer spacer--bottom"></div>
      </main>
    </div>`);
  }

  function showWriting(st, round, { motion = null, prefill = '' } = {}) {
    const a = R.assignments[round - 1];
    const view = st.show(writingView(round, prefill), { motion, focus: motion ? '.received-line' : null });
    if (motion) st.say(`Round ${round} of 9. ${a.previousLine ? `The line before yours: ${a.previousLine}` : 'You start this poem.'}`);
    const input = view.querySelector('.line-input');
    const slotEls = [...view.querySelectorAll('.slots i')];
    const slotsBox = view.querySelector('.slots');
    const slotText = view.querySelector('.slot-text');
    const submit = view.querySelector('.submit');

    function update() {
      const clean = input.value.replace(/[\r\n]+/g, ' ');
      if (clean !== input.value) input.value = clean;
      const n = countWords(clean);
      const over = n > a.target;
      slotEls.forEach((s, i) => s.classList.toggle('on', i < n));
      slotsBox.classList.toggle('over', over);
      input.setAttribute('aria-invalid', String(over));
      slotText.classList.toggle('over', over);
      slotText.textContent = over
        ? `${n} of ${a.target} words. ${n - a.target === 1 ? 'One' : n - a.target} too many.`
        : `${n} of ${a.target} ${plural(a.target, 'word', 'words')}`;
      submit.disabled = n !== a.target;
    }
    input.addEventListener('input', update);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!submit.disabled) submit.click();
      }
    });
    update();

    submit.addEventListener('click', async () => {
      if (countWords(input.value) !== a.target) return;
      const line = input.value.trim().replace(/\s+/g, ' ');
      input.readOnly = true;
      submit.disabled = true;
      submit.classList.add('is-pending');
      submit.setAttribute('aria-busy', 'true');
      submit.textContent = 'Sending…';
      view.querySelector('.composer').classList.add('is-pending');
      st.say('Sending your line');
      await sleep(SERVER_MS.submit); // server accepts
      st.show(waitingView({ round, line, submittedIds: ['juniper', 'wren'] }), { motion: 'settle', focus: '.ack' });
      st.say('Tucked into the poem.');
    });
    return view;
  }

  /* ---------- waiting ---------- */
  const STATUS = {
    in: { text: 'Tucked in', icon: 'check', cls: 'status--in' },
    writing: { text: 'Writing', icon: 'pencil', cls: '' },
    away: { text: 'Away', icon: 'moon', cls: '' },
    watching: { text: 'Watching', icon: 'eye', cls: '' },
  };
  function waitingRoster(statusOf) {
    const people = [...R.players, R.lateJoiner];
    const playing = R.players.length;
    const inCount = R.players.filter((p) => statusOf(p) === 'in').length;
    const rows = people
      .map((p) => {
        const s = STATUS[statusOf(p)];
        const sub = p.id === R.you ? 'You' : p.spectator ? 'Joined late, plays next game' : '';
        return `<li class="row" data-person="${p.id}">
          <span class="who">${cast(p.avatar, 36, { outlined: !!p.spectator })}<span class="name">${esc(p.name)}${sub ? `<span class="sub">${sub}</span>` : ''}</span></span>
          <span class="status ${s.cls}">${icon(s.icon, 16)}${s.text}</span>
        </li>`;
      })
      .join('');
    return `<section class="players" aria-labelledby="round-h">
      <div class="section-head"><h2 id="round-h">This round</h2><span data-in-count>${inCount} of ${playing} lines in</span></div>
      <ul class="roster">${rows}</ul>
    </section>`;
  }

  function waitingView({ round = 5, line = R.assignments[4].yourLine, submittedIds = ['juniper', 'wren'], awayIds = ['marguerite'] } = {}) {
    const statusOf = (p) =>
      p.spectator ? 'watching' : submittedIds.includes(p.id) ? 'in' : awayIds.includes(p.id) ? 'away' : 'writing';
    return node(`<div class="view view--waiting">
      ${header()}
      <main class="main waiting">
        ${roundRow(round)}
        <div class="wait-hero">
          <div class="wait-moment" aria-hidden="true">${cast(YOU.avatar, 88, { className: 'cast--tilt' })}</div>
          <h1 class="ack" tabindex="-1">Tucked into the poem.</h1>
          <p class="wait-line">You wrote <q>${esc(line)}</q></p>
        </div>
        ${waitingRoster(statusOf)}
      </main>
    </div>`);
  }

  function renderWaiting(root) {
    stage(root).show(waitingView());
  }

  /* The round turn: the room finishes, the screen crossfades into the next round. */
  function renderRoundTurn(root) {
    const st = stage(root);
    const submitted = ['juniper', 'wren'];
    const away = ['marguerite'];
    st.show(waitingView({ submittedIds: submitted, awayIds: away }));
    const patch = (id, key) => {
      const row = st.el.querySelector(`.view:last-of-type [data-person="${id}"] .status`);
      const s = STATUS[key];
      row.className = `status ${s.cls}`;
      row.innerHTML = `${icon(s.icon, 16)}${s.text}`;
      const count = st.el.querySelector('[data-in-count]');
      count.textContent = `${submitted.length} of ${R.players.length} lines in`;
    };
    (async () => {
      await sleep(900);
      submitted.push('basil');
      patch('basil', 'in');
      await sleep(700);
      submitted.push('marguerite');
      away.length = 0;
      patch('marguerite', 'in');
      await sleep(700); // server opens round 6
      showWriting(st, 6, { motion: 'crossfade' });
    })();
  }

  /* ---------- reading circle ---------- */
  const readerOf = (poem) => R.byId[poem.reader];
  const ORDER = [...R.poems].sort((a, b) => a.number - b.number);

  function readingView() {
    const now = ORDER[0];
    const nowReader = readerOf(now);
    const mine = R.poems.find((p) => p.reader === R.you);
    const myIndex = ORDER.indexOf(mine);
    const before = readerOf(ORDER[myIndex - 1]);
    const rows = ORDER.map((p, i) => {
      const who = readerOf(p);
      const status =
        i === 0 ? '<span class="status status--now">Reading now</span>'
        : i === 1 ? '<span class="status">Up next</span>'
        : '';
      return `<li class="row"${i === 0 ? ' aria-current="true"' : ''}>
        <span class="who">${cast(who.avatar, 32, { outlined: i !== 0 })}<span class="name">${esc(who.name)}${who.id === R.you ? ' <span class="you">(you)</span>' : ''}<span class="sub">Poem ${p.number}</span></span></span>
        ${status}
      </li>`;
    }).join('');
    return node(`<div class="view view--reading">
      ${header()}
      <main class="main reading">
        <section class="now" aria-labelledby="now-title">
          ${cast(nowReader.avatar, 80)}
          <p class="overline">Reading now</p>
          <h1 class="now-title" id="now-title" tabindex="-1">${esc(nowReader.name)} is reading Poem&nbsp;${now.number}</h1>
          <p class="now-sub">Listen, or follow the poem on your phone.</p>
          <button class="btn btn--quiet follow" type="button" data-follow>Follow along</button>
        </section>
        <div class="your-turn">
          ${cast(YOU.avatar, 32)}
          <p><strong>You read ${ordinal(myIndex + 1)}</strong><span>Poem ${mine.number}, after ${esc(before.name.split(' ')[0])}</span></p>
        </div>
        <section class="players order" aria-labelledby="order-h">
          <div class="section-head"><h2 id="order-h">Reading order</h2><span>${ORDER.length} poems</span></div>
          <ol class="roster">${rows}</ol>
        </section>
      </main>
    </div>`);
  }

  function poemView(poem) {
    const reader = readerOf(poem);
    const lines = poem.lines
      .map(([text, by]) => `<li><span class="line-text">${esc(text)}</span><span class="line-by">${esc(R.byId[by].name.split(' ')[0])}</span></li>`)
      .join('');
    const poets = [...new Set(poem.lines.map(([, by]) => by))]
      .map((id) => `<li>${cast(R.byId[id].avatar, 24)}<span>${esc(R.byId[id].name)}</span></li>`)
      .join('');
    return node(`<div class="view view--poem">
      ${header()}
      <main class="main poem">
        <div class="rise-target">
          <article class="sheet" aria-labelledby="poem-title">
            <header class="sheet-head">
              ${cast(reader.avatar, 36)}
              <div><h1 id="poem-title" tabindex="-1">Poem ${poem.number}</h1><p>Read by ${esc(reader.name)}</p></div>
            </header>
            <ol class="lines" data-authors="off" aria-label="Poem ${poem.number}, nine lines">${lines}</ol>
            <footer class="sheet-foot">
              <p class="overline">Written by</p>
              <ul class="poets">${poets}</ul>
              <button class="toggle" type="button" aria-pressed="false" data-authors-toggle>Show who wrote each line</button>
            </footer>
          </article>
          <div class="poem-actions">
            <button class="btn btn--primary btn--block btn--lg" type="button" data-done>Done</button>
            <div class="poem-secondary">
              <button class="btn btn--ghost" type="button">${icon('keep', 20)}<span>Keep poem</span></button>
              <button class="btn btn--ghost" type="button">${icon('share', 20)}<span>Share poem</span></button>
            </div>
          </div>
        </div>
      </main>
    </div>`);
  }

  function showReading(st, { focusFollow = false } = {}) {
    const view = st.show(readingView(), { focus: focusFollow ? '[data-follow]' : null });
    const follow = view.querySelector('[data-follow]');
    follow.addEventListener('click', async () => {
      follow.disabled = true;
      follow.classList.add('is-pending');
      follow.textContent = 'Opening…';
      st.say('Opening Poem 1');
      await sleep(SERVER_MS.open); // poem text arrives
      showPoem(st);
    });
  }

  function showPoem(st) {
    const poem = R.poems[0];
    const view = st.show(poemView(poem), { motion: 'rise', focus: '#poem-title' });
    st.say(`Poem ${poem.number}, read by ${readerOf(poem).name}. All nine lines are showing.`);
    const toggle = view.querySelector('[data-authors-toggle]');
    const lines = view.querySelector('.lines');
    toggle.addEventListener('click', () => {
      const on = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', String(on));
      toggle.textContent = on ? 'Hide who wrote each line' : 'Show who wrote each line';
      lines.dataset.authors = on ? 'on' : 'off';
    });
    view.querySelector('[data-done]').addEventListener('click', () => showReading(st, { focusFollow: true }));
  }

  LJ.mount({
    title: 'Tidy Room',
    stance: 'Same rooms, less noise. Identical screens and components to today; one quiet header, one focal point per screen, and three short motion moments.',
    screens: [
      { id: 'lobby-host', label: 'Lobby, host', render: (root) => renderLobby(root) },
      { id: 'writing', label: 'Writing, round 5', render: (root) => showWriting(stage(root), 5, { prefill: 'and nobody asked' }) },
      { id: 'waiting', label: 'Waiting, round 5', render: renderWaiting },
      { id: 'reading-turn', label: 'Reading circle', render: (root) => showReading(stage(root)) },
      { id: 'poem-open', label: 'Poem 1 open', render: (root) => showPoem(stage(root)) },
      { id: 'x-round-turn', label: 'Round turn, 5 to 6', render: renderRoundTurn },
      { id: 'x-lobby-guest', label: 'Lobby, guest', render: (root) => renderLobby(root, { guest: true }) },
    ],
  });
})();
