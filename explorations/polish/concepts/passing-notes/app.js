/* Passing Notes: one note object whose fold and pass carry the game state.
   Direction rule (never broken): notes ARRIVE from the left edge and LEAVE to the
   right edge, the way a line reads and the way a poem moves forward. Vertical folds
   mean hidden (fold down) or revealed (unfold). */
(function () {
  'use strict';

  const R = LJ.room;
  const P = R.byId;
  const YOU = P[R.you];

  /* Every duration and easing, in one place (mirrored in README motion spec). */
  const MOTION = {
    pending: 500, // simulated server acceptance; not motion, never skipped
    tuck: { duration: 320, easing: 'cubic-bezier(0.55, 0, 0.35, 1)' },
    pass: { duration: 300, easing: 'cubic-bezier(0.5, 0, 0.75, 0)' },
    arrive: { duration: 320, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
    open: { duration: 300, easing: 'cubic-bezier(0.55, 0, 0.35, 1)' },
    settle: { duration: 200, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
    clear: { duration: 150, easing: 'linear' },
    unfold: { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    refold: { duration: 260, easing: 'cubic-bezier(0.5, 0, 0.75, 0)' },
  };

  const params = new URLSearchParams(location.search);
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const firstName = (p) => p.name.split(' ')[0];
  const wordsIn = (text) => {
    const t = text.trim();
    return t ? t.split(/\s+/).length : 0;
  };

  function play(el, keyframes, spec, keep = false) {
    if (!el || reduceMotion()) return Promise.resolve();
    const anim = el.animate(keyframes, { duration: spec.duration, easing: spec.easing, fill: 'both' });
    return anim.finished.then(() => {
      if (!keep) anim.cancel();
    });
  }

  /* ---------- Small functional icons (inline, 24 grid) ---------- */

  const ICON = {
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sound: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    muted: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
    dots: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    eye: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.5"/>',
    share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>',
    folds: '<path d="M7 5h10M5.5 9h13"/><path d="M4 13h16v6H4z"/>',
  };
  const icon = (name, size = 20) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[name]}</svg>`;

  const plate = (player, size) =>
    `<span class="plate" style="width:${size + 8}px;height:${size + 8}px">${LJ.avatar(player.avatar, { size })}</span>`;

  /* Real, scannable QR for R.joinUrl (qrcode.react, level M, 4-module quiet zone, 37x37). */
  const QR_PATH = 'M4 4h7v1H4zM16 4h2v1H16zM20 4h4v1H20zM26,4 h7v1H26zM4 5h1v1H4zM10 5h1v1H10zM12 5h2v1H12zM15 5h1v1H15zM18 5h4v1H18zM23 5h2v1H23zM26 5h1v1H26zM32,5 h1v1H32zM4 6h1v1H4zM6 6h3v1H6zM10 6h1v1H10zM13 6h6v1H13zM20 6h1v1H20zM23 6h1v1H23zM26 6h1v1H26zM28 6h3v1H28zM32,6 h1v1H32zM4 7h1v1H4zM6 7h3v1H6zM10 7h1v1H10zM13 7h7v1H13zM22 7h1v1H22zM26 7h1v1H26zM28 7h3v1H28zM32,7 h1v1H32zM4 8h1v1H4zM6 8h3v1H6zM10 8h1v1H10zM12 8h3v1H12zM18 8h1v1H18zM21 8h3v1H21zM26 8h1v1H26zM28 8h3v1H28zM32,8 h1v1H32zM4 9h1v1H4zM10 9h1v1H10zM13 9h1v1H13zM15 9h1v1H15zM17 9h1v1H17zM22 9h2v1H22zM26 9h1v1H26zM32,9 h1v1H32zM4 10h7v1H4zM12 10h1v1H12zM14 10h1v1H14zM16 10h1v1H16zM18 10h1v1H18zM20 10h1v1H20zM22 10h1v1H22zM24 10h1v1H24zM26,10 h7v1H26zM14 11h1v1H14zM16 11h3v1H16zM20 11h2v1H20zM4 12h1v1H4zM6 12h1v1H6zM8 12h1v1H8zM10 12h1v1H10zM13 12h3v1H13zM18 12h7v1H18zM28 12h1v1H28zM31 12h1v1H31zM7 13h1v1H7zM9 13h1v1H9zM12 13h1v1H12zM14 13h2v1H14zM18 13h2v1H18zM22 13h1v1H22zM24 13h3v1H24zM29 13h1v1H29zM32,13 h1v1H32zM4 14h3v1H4zM10 14h1v1H10zM12 14h2v1H12zM15 14h1v1H15zM17 14h1v1H17zM21 14h1v1H21zM27 14h2v1H27zM30,14 h3v1H30zM4 15h1v1H4zM7 15h1v1H7zM9 15h1v1H9zM11 15h5v1H11zM21 15h2v1H21zM24 15h3v1H24zM31 15h1v1H31zM4 16h1v1H4zM6 16h1v1H6zM10 16h1v1H10zM12 16h2v1H12zM15 16h1v1H15zM19 16h3v1H19zM23 16h4v1H23zM29 16h1v1H29zM31,16 h2v1H31zM6 17h1v1H6zM8 17h2v1H8zM12 17h1v1H12zM17 17h1v1H17zM19 17h3v1H19zM25 17h2v1H25zM29 17h1v1H29zM32,17 h1v1H32zM4 18h3v1H4zM9 18h2v1H9zM12 18h4v1H12zM18 18h1v1H18zM21 18h2v1H21zM24 18h1v1H24zM26 18h1v1H26zM29 18h1v1H29zM31,18 h2v1H31zM5 19h2v1H5zM8 19h2v1H8zM11 19h1v1H11zM13 19h1v1H13zM16 19h8v1H16zM28 19h2v1H28zM31 19h1v1H31zM4 20h2v1H4zM7 20h1v1H7zM9 20h2v1H9zM15 20h2v1H15zM18 20h1v1H18zM21 20h1v1H21zM25 20h2v1H25zM29 20h1v1H29zM31,20 h2v1H31zM5 21h3v1H5zM9 21h1v1H9zM11 21h2v1H11zM16 21h1v1H16zM18 21h3v1H18zM24 21h3v1H24zM29 21h2v1H29zM32,21 h1v1H32zM4 22h1v1H4zM6 22h2v1H6zM10 22h1v1H10zM12 22h1v1H12zM14 22h4v1H14zM21 22h1v1H21zM24 22h2v1H24zM27 22h2v1H27zM31,22 h2v1H31zM5 23h1v1H5zM9 23h1v1H9zM14 23h1v1H14zM16 23h1v1H16zM19 23h1v1H19zM21 23h3v1H21zM27 23h3v1H27zM31 23h1v1H31zM4 24h1v1H4zM6 24h1v1H6zM8 24h1v1H8zM10 24h1v1H10zM15 24h2v1H15zM20 24h2v1H20zM24 24h5v1H24zM12 25h1v1H12zM15 25h1v1H15zM17 25h1v1H17zM19 25h3v1H19zM24 25h1v1H24zM28 25h1v1H28zM30,25 h3v1H30zM4 26h7v1H4zM15 26h2v1H15zM18 26h1v1H18zM23 26h2v1H23zM26 26h1v1H26zM28 26h2v1H28zM31,26 h2v1H31zM4 27h1v1H4zM10 27h1v1H10zM13 27h1v1H13zM17 27h3v1H17zM21 27h1v1H21zM24 27h1v1H24zM28 27h2v1H28zM31,27 h2v1H31zM4 28h1v1H4zM6 28h3v1H6zM10 28h1v1H10zM12 28h3v1H12zM18 28h2v1H18zM21 28h1v1H21zM24 28h5v1H24zM32,28 h1v1H32zM4 29h1v1H4zM6 29h3v1H6zM10 29h1v1H10zM13 29h6v1H13zM21 29h1v1H21zM25 29h1v1H25zM27 29h2v1H27zM30,29 h3v1H30zM4 30h1v1H4zM6 30h3v1H6zM10 30h1v1H10zM12 30h1v1H12zM14 30h2v1H14zM24 30h1v1H24zM27 30h3v1H27zM32,30 h1v1H32zM4 31h1v1H4zM10 31h1v1H10zM13 31h12v1H13zM26 31h2v1H26zM31 31h1v1H31zM4 32h7v1H4zM12 32h1v1H12zM15 32h1v1H15zM17 32h3v1H17zM21 32h4v1H21zM27 32h1v1H27zM31,32 h2v1H31z';
  const qr = () =>
    `<svg class="invite__qr" viewBox="0 0 37 37" role="img" aria-label="QR code for joining room ${R.codeDisplay}" shape-rendering="crispEdges"><path fill="#ffffff" d="M0 0h37v37H0z"/><path fill="#000000" d="${QR_PATH}"/></svg>`;

  /* ---------- Chrome: code or wordmark left; appearance, sound, Room options right ---------- */

  const APPEARANCE = ['system', 'light', 'dark'];
  const APPEARANCE_ICON = { system: 'monitor', light: 'sun', dark: 'moon' };
  const APPEARANCE_WORD = { system: 'System', light: 'Light', dark: 'Dark' };
  const chrome = { appearance: LJ.theme, muted: false };

  function bar(kind) {
    const left =
      kind === 'lobby'
        ? '<p class="pn-wordmark">Linejam</p>'
        : `<button type="button" class="pn-code" data-copy aria-label="Copy room code ${R.codeDisplay}">${R.codeDisplay}</button>`;
    const leave = kind === 'lobby' ? 'Close room' : 'End game';
    return `<header class="pn-bar">${left}
      <div class="pn-tools">
        <button type="button" class="pn-icon" data-appearance></button>
        <button type="button" class="pn-icon" data-sound></button>
        <div class="pn-menu-wrap">
          <button type="button" class="pn-icon" data-options aria-label="Room options" aria-haspopup="menu" aria-expanded="false" aria-controls="pn-menu">${icon('dots')}</button>
          <div class="pn-menu" id="pn-menu" role="menu" hidden>
            <button type="button" role="menuitem">How to play</button>
            <button type="button" role="menuitem">Your poems</button>
            <button type="button" role="menuitem" class="pn-menu__end">${leave}</button>
          </div>
        </div>
      </div>
    </header>`;
  }

  function paintChrome(root) {
    const a = root.querySelector('[data-appearance]');
    const next = APPEARANCE[(APPEARANCE.indexOf(chrome.appearance) + 1) % APPEARANCE.length];
    a.innerHTML = icon(APPEARANCE_ICON[chrome.appearance]);
    a.setAttribute('aria-label', `Appearance: ${APPEARANCE_WORD[chrome.appearance]}. Switch to ${APPEARANCE_WORD[next]}`);
    const s = root.querySelector('[data-sound]');
    s.innerHTML = icon(chrome.muted ? 'muted' : 'sound');
    s.setAttribute('aria-label', chrome.muted ? 'Sound off. Turn sound on' : 'Sound on. Turn sound off');
    const dark =
      chrome.appearance === 'dark' ||
      (chrome.appearance === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }

  function wireChrome(root, announce) {
    paintChrome(root);
    root.querySelector('[data-appearance]').addEventListener('click', () => {
      chrome.appearance = APPEARANCE[(APPEARANCE.indexOf(chrome.appearance) + 1) % APPEARANCE.length];
      paintChrome(root);
    });
    root.querySelector('[data-sound]').addEventListener('click', () => {
      chrome.muted = !chrome.muted;
      paintChrome(root);
    });
    const trigger = root.querySelector('[data-options]');
    const menu = root.querySelector('#pn-menu');
    const close = (refocus) => {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (refocus) trigger.focus();
    };
    trigger.addEventListener('click', () => {
      const open = menu.hidden;
      menu.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
      if (open) menu.querySelector('button').focus();
    });
    menu.addEventListener('click', () => close(true));
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) close(true);
    });
    document.addEventListener('click', (e) => {
      if (!menu.hidden && !e.target.closest('.pn-menu-wrap')) close(false);
    });
    const copy = root.querySelector('[data-copy]');
    if (copy) copy.addEventListener('click', () => copyCode(announce));
  }

  async function copyCode(announce) {
    try {
      await navigator.clipboard.writeText(R.code);
      announce('Room code copied');
    } catch {
      announce(`Could not copy. The room code is ${R.codeDisplay}.`);
    }
  }

  function frame(root, kind, inner) {
    root.innerHTML = `<div class="pn">${bar(kind)}${inner}<p class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-live></p></div>`;
    const live = root.querySelector('[data-live]');
    const announce = (msg) => {
      live.textContent = '';
      requestAnimationFrame(() => (live.textContent = msg));
    };
    wireChrome(root, announce);
    return announce;
  }

  /* ---------- Writing: the note in your hand ---------- */

  function noteMarkup(a, draft) {
    const hidden = a.round - 2; // lines folded away above the one you can see
    const unit = (n) => (n === 1 ? 'word' : 'words');
    const top = a.previousLine
      ? `${
          hidden > 0
            ? `<p class="note__folds">${icon('folds', 16)}${hidden} ${hidden === 1 ? 'line' : 'lines'} folded away</p>`
            : ''
        }
        <span class="pn-over" id="received-label">Passed to you</span>
        <p class="note__received" aria-labelledby="received-label received-line" id="received-line">${esc(a.previousLine)}</p>`
      : `<span class="pn-over" style="margin-top:auto">A fresh note</span>
        <p class="note__received note__received--fresh">You start this poem.</p>`;
    return `<article class="note" aria-label="Your note, Poem ${a.poem}">
      <div class="note__top">
        <div class="note__face">${top}</div>
        <div class="note__back" aria-hidden="true"></div>
      </div>
      <div class="note__bottom">
        <label class="pn-over" for="line">Your line: ${a.target} ${unit(a.target)}</label>
        <textarea id="line" class="note__input" rows="1" maxlength="500" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" spellcheck="true" aria-describedby="count" placeholder="Write it here">${esc(draft)}</textarea>
        <div class="note__count">
          <span class="slots" aria-hidden="true"></span>
          <output class="count" id="count" for="line"></output>
        </div>
      </div>
    </article>`;
  }

  function renderWriting(root, a, { draft = '', arrive = false, focus = false } = {}) {
    const announce = frame(
      root,
      'game',
      `<p class="pn-round">Round ${a.round} of 9</p>
      <h1 class="sr-only">Write your line for round ${a.round}</h1>
      <div class="pn-stage pn-stage--note">
        ${noteMarkup(a, draft)}
        <div class="pn-act">
          <p class="pn-alert" role="alert" hidden></p>
          <button type="button" class="pn-primary" id="pass" disabled>Pass it on</button>
        </div>
      </div>`
    );
    const note = root.querySelector('.note');
    const input = root.querySelector('#line');
    const slots = root.querySelector('.slots');
    const count = root.querySelector('#count');
    const button = root.querySelector('#pass');
    const alert = root.querySelector('.pn-alert');
    const act = root.querySelector('.pn-act');
    let busy = false;

    function update() {
      const n = wordsIn(input.value);
      const t = a.target;
      const over = n - t;
      const shown = Math.min(Math.max(n, t), t + 3);
      slots.innerHTML = Array.from({ length: shown }, (_, i) => {
        const cls = i >= t ? 'is-over' : i < n ? (over > 0 ? 'is-over' : 'is-filled') : '';
        return `<span class="slot ${cls}"></span>`;
      }).join('');
      count.classList.toggle('is-exact', n === t);
      count.classList.toggle('is-over', over > 0);
      count.textContent =
        over > 0
          ? `${n} of ${t} words. Take ${over} out.`
          : n === t
            ? `${n} of ${t} ${t === 1 ? 'word' : 'words'}. Ready.`
            : `${n} of ${t} ${t === 1 ? 'word' : 'words'}`;
      input.setAttribute('aria-invalid', String(over > 0));
      button.disabled = busy || n !== t;
    }

    input.addEventListener('input', () => {
      if (/[\r\n]/.test(input.value)) input.value = input.value.replace(/[\r\n]+/g, ' ');
      alert.hidden = true;
      update();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!button.disabled) button.click();
      }
    });

    button.addEventListener('click', async () => {
      if (busy || wordsIn(input.value) !== a.target) return;
      busy = true;
      // Pending: nothing looks accepted yet. The note stays open and readable.
      input.readOnly = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Passing…';
      announce('Passing your line…');
      await sleep(MOTION.pending);

      if (params.get('fail') === '1') {
        busy = false;
        input.readOnly = false;
        button.removeAttribute('aria-busy');
        button.textContent = 'Try again';
        alert.textContent = 'Your line did not reach the room. It is still here, so try again.';
        alert.hidden = false;
        update();
        return;
      }

      // Accepted by the room. Tuck: the received half folds down over your line.
      announce('Tucked into the poem.');
      const top = note.querySelector('.note__top');
      await Promise.all([
        play(top, [{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-180deg)' }], MOTION.tuck, true),
        play(act, [{ opacity: 1 }, { opacity: 0 }], MOTION.clear, true),
      ]);
      note.classList.add('is-folded');
      // Pass: the folded note leaves by the right edge, onward to the next writer.
      await play(
        note,
        [{ transform: 'translateX(0)' }, { transform: `translateX(${window.innerWidth}px)` }],
        MOTION.pass,
        true
      );
      renderDesk(root.querySelector('.pn-stage'), { you: 'tucked', settle: true });
      root.querySelector('#ack').focus();
    });

    update();

    if (arrive) {
      note.classList.add('is-folded');
      act.style.visibility = 'hidden';
      announce(`Round ${a.round}. A new note was passed to you.`);
      const land = async () => {
        if (!reduceMotion()) {
          await sleep(250);
          await play(
            note,
            [{ transform: `translateX(${-window.innerWidth}px)` }, { transform: 'translateX(0)' }],
            MOTION.arrive
          );
          const top = note.querySelector('.note__top');
          note.classList.remove('is-folded');
          await play(top, [{ transform: 'rotateX(-180deg)' }, { transform: 'rotateX(0deg)' }], MOTION.open);
        }
        note.classList.remove('is-folded');
        act.style.visibility = '';
        if (focus) input.focus({ preventScroll: true });
        await play(act, [{ opacity: 0 }, { opacity: 1 }], MOTION.settle);
      };
      if (!reduceMotion()) note.style.transform = `translateX(${-window.innerWidth}px)`;
      requestAnimationFrame(() => {
        note.style.transform = '';
        land();
      });
    }
  }

  /* ---------- Waiting: the empty desk ---------- */

  const STATUS = {
    tucked: { icon: 'check', text: 'Tucked in' },
    writing: { icon: 'pen', text: 'Writing' },
    away: { icon: 'moon', text: 'Away' },
  };

  function chit(player, status) {
    const s = STATUS[status];
    const role = player.id === R.you ? `<span class="chit__role">You${player.host ? ', host' : ''}</span>` : '';
    return `<li class="chit chit--${status}">
      <div class="chit__who">${plate(player, 36)}<span><span class="chit__name">${esc(player.name)}</span>${role}</span></div>
      <p class="chit__foot">${icon(s.icon, 16)}<span>${s.text}</span></p>
    </li>`;
  }

  function deskMarkup(yourState) {
    const states = { juniper: yourState, wren: 'tucked', basil: 'writing', marguerite: 'away' };
    const pim = R.lateJoiner;
    return `<section class="desk" aria-labelledby="ack">
      <div class="desk__head">
        <h1 class="desk__ack" id="ack" tabindex="-1">Tucked into the poem.</h1>
        <p class="desk__sub">Your next note comes when everyone has written.</p>
      </div>
      <ul class="chits" aria-label="Players this round">
        ${R.players.map((p) => chit(p, states[p.id])).join('')}
      </ul>
      <div class="watchers">
        <h2 class="pn-over">Watching this game</h2>
        <ul>
          <li class="watcher">${plate(pim, 32)}<span><span class="watcher__name">${esc(pim.name)}</span>
            <span class="watcher__state">${icon('eye', 16)}Joined late. Plays the next game.</span></span></li>
        </ul>
      </div>
    </section>`;
  }

  function renderDesk(stage, { settle = false } = {}) {
    stage.classList.remove('pn-stage--note');
    stage.innerHTML = deskMarkup('tucked');
    if (settle) play(stage.firstElementChild, [{ opacity: 0 }, { opacity: 1 }], MOTION.settle);
  }

  function renderWaiting(root) {
    frame(root, 'game', `<p class="pn-round">Round 5 of 9</p><div class="pn-stage"></div>`);
    renderDesk(root.querySelector('.pn-stage'));
  }

  /* ---------- Lobby: blank notes, ready to be dealt ---------- */

  function renderLobby(root) {
    const announce = frame(
      root,
      'lobby',
      `<h1 class="sr-only">Room lobby</h1>
      <section class="invite" aria-label="Room invitation">
        <div class="invite__text">
          <span class="pn-over">Room code</span>
          <button type="button" class="invite__code" data-copy-code aria-label="Copy room code ${R.codeDisplay}">${R.codeDisplay}${icon('copy', 20)}</button>
          <button type="button" class="pn-secondary" data-share>${icon('share', 18)}<span>Share invite</span></button>
          <p class="invite__note" data-invite-note></p>
        </div>
        ${qr()}
      </section>
      <section class="gather" aria-labelledby="players-h">
        <div class="gather__head"><h2 id="players-h">Players</h2><span>${R.players.length} of ${R.capacity}</span></div>
        <ul class="chits" aria-labelledby="players-h">
          ${R.players
            .map(
              (p) => `<li class="chit chit--blank">
                <div class="chit__who">${plate(p, 36)}<span><span class="chit__name">${esc(p.name)}</span>${
                  p.id === R.you ? '<span class="chit__role">You, host</span>' : ''
                }</span></div>
                <p class="chit__foot" aria-hidden="true"><span class="chit__rule"></span></p>
              </li>`
            )
            .join('')}
        </ul>
      </section>
      <div class="pn-dock pn-dock--near"><button type="button" class="pn-primary" id="start">Start Linejam</button></div>`
    );
    const note = root.querySelector('[data-invite-note]');
    root.querySelector('[data-copy-code]').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(R.code);
        note.textContent = 'Room code copied';
      } catch {
        note.textContent = 'Could not copy. Read the code out loud, or scan the QR.';
      }
    });
    root.querySelector('[data-share]').addEventListener('click', async () => {
      try {
        if (navigator.share) await navigator.share({ title: 'Join my Linejam room', url: R.joinUrl });
        else await navigator.clipboard.writeText(R.joinUrl);
        note.textContent = navigator.share ? 'Invite shared' : 'Invite link copied';
      } catch {
        note.textContent = 'Could not share. Scan the QR instead.';
      }
    });

    const start = root.querySelector('#start');
    start.addEventListener('click', async () => {
      if (start.getAttribute('aria-busy') === 'true') return;
      start.setAttribute('aria-busy', 'true');
      start.textContent = 'Dealing…';
      announce('Dealing notes…');
      await sleep(MOTION.pending);
      // Accepted: every blank note is dealt out, leaving by the right edge.
      const cards = [...root.querySelectorAll('.gather .chit')];
      await Promise.all([
        ...cards.map((c) =>
          play(c, [{ transform: 'translateX(0)' }, { transform: `translateX(${window.innerWidth}px)` }], MOTION.pass, true)
        ),
        play(root.querySelector('.invite'), [{ opacity: 1 }, { opacity: 0 }], MOTION.clear, true),
        play(root.querySelector('.pn-dock'), [{ opacity: 1 }, { opacity: 0 }], MOTION.clear, true),
      ]);
      // Your own first note arrives from the left.
      renderWriting(root, R.assignments[0], { arrive: true, focus: true });
    });
  }

  /* ---------- Reading circle ---------- */

  function readingMarkup() {
    const reader = P[R.poems[0].reader];
    const order = R.poems.slice(1, 3).map((poem) => P[poem.reader]);
    const mine = R.poems.find((poem) => poem.reader === R.you);
    return `<p class="pn-round">Reading circle</p>
      <div class="pn-stage">
        <section class="inplay" aria-labelledby="inplay-h">
          <div class="inplay__head">${plate(reader, 44)}
            <div><span class="pn-over">Reading now</span>
            <h1 class="inplay__title" id="inplay-h" tabindex="-1">${esc(reader.name)} is reading Poem ${R.poems[0].number}</h1></div>
          </div>
          <div class="inplay__fold">
            <span class="inplay__hint">${icon('folds', 16)}Nine lines</span>
            <button type="button" class="pn-secondary" id="follow">Follow along</button>
          </div>
        </section>
        <section class="after" aria-labelledby="after-h">
          <h2 class="pn-over" id="after-h">Then</h2>
          <ol class="order">
            ${order
              .map(
                (p, i) => `<li><span class="order__n" aria-hidden="true">${i + 2}</span>${plate(p, 28)}
                  <span class="order__name">${esc(p.name)}</span><span class="order__poem">Poem ${i + 2}</span></li>`
              )
              .join('')}
          </ol>
        </section>
        <section class="pn-dock" aria-labelledby="hand-h">
          <div class="hand">${plate(YOU, 36)}
            <div><h2 class="hand__title" id="hand-h">Yours is 4th</h2>
            <p class="hand__detail">Poem ${mine.number} waits in your hand. You read after ${esc(firstName(order[1]))}.</p></div>
          </div>
        </section>
      </div>`;
  }

  function renderReading(root, { settle = false } = {}) {
    const announce = frame(root, 'game', readingMarkup());
    if (settle) {
      play(root.querySelector('.pn-stage'), [{ opacity: 0 }, { opacity: 1 }], MOTION.settle);
      root.querySelector('#inplay-h').focus();
    }
    root.querySelector('#follow').addEventListener('click', async () => {
      // Local open of a poem the reader already opened: no server wait, one move.
      await play(root.querySelector('.pn-stage'), [{ opacity: 1 }, { opacity: 0 }], MOTION.clear, true);
      renderPoem(root, R.poems[0], { unfold: true });
      announce('Poem 1 is open.');
    });
  }

  /* ---------- Open poem ---------- */

  function poemMarkup(poem) {
    const reader = P[poem.reader];
    const authors = [...new Set(poem.lines.map(([, id]) => id))].map((id) => P[id]);
    return `<p class="pn-round">Reading circle</p>
      <article class="sheet" aria-labelledby="poem-h">
        <header class="sheet__head">${plate(reader, 32)}
          <div><h1 class="sheet__title" id="poem-h" tabindex="-1">Poem ${poem.number}</h1>
          <p class="sheet__by">Read by ${esc(reader.name)}</p></div>
        </header>
        <div class="sheet__body">
          <ol class="poem" aria-label="Poem lines">
            ${poem.lines
              .map(
                ([text, id]) => `<li><span class="poem__line">${esc(text)}</span><span class="poem__who"><span aria-hidden="true">${P[id].name[0]}</span><span class="sr-only">, by ${esc(P[id].name)}</span></span></li>`
              )
              .join('')}
          </ol>
          <ul class="poem__key" aria-hidden="true">
            ${authors.map((p) => `<li><b>${p.name[0]}</b>${plate(p, 20)}<span>${esc(p.name)}</span></li>`).join('')}
          </ul>
        </div>
      </article>
      <div class="sheet-act"><button type="button" class="pn-primary" id="done">Done</button></div>`;
  }

  function renderPoem(root, poem, { unfold = false } = {}) {
    frame(root, 'game', poemMarkup(poem));
    const body = root.querySelector('.sheet__body');
    const done = root.querySelector('#done');
    if (unfold) {
      // One move: the whole folded body swings down from the crease under the title.
      play(
        body,
        [
          { transform: 'rotateX(-88deg)', opacity: 0.2 },
          { transform: 'rotateX(-30deg)', opacity: 1, offset: 0.45 },
          { transform: 'rotateX(0deg)', opacity: 1 },
        ],
        MOTION.unfold
      );
      play(done, [{ opacity: 0 }, { opacity: 1 }], MOTION.unfold);
      root.querySelector('#poem-h').focus();
    }
    done.addEventListener('click', async () => {
      await Promise.all([
        play(body, [{ transform: 'rotateX(0deg)', opacity: 1 }, { transform: 'rotateX(-88deg)', opacity: 0.2 }], MOTION.refold, true),
        play(done, [{ opacity: 1 }, { opacity: 0 }], MOTION.clear, true),
      ]);
      renderReading(root, { settle: true });
    });
  }

  /* ---------- Mount ---------- */

  function mount() {
    LJ.mount({
      title: 'Passing Notes',
      stance:
        'The poem is a folded note that travels hand to hand. The note is the only object on screen; its fold and its pass tell you what happened. Notes arrive from the left and leave to the right.',
      screens: [
        { id: 'lobby-host', label: 'Lobby, host', render: (root) => renderLobby(root) },
        {
          id: 'writing',
          label: 'Writing, round 5',
          render: (root) => renderWriting(root, R.assignments[4], { draft: 'and nobody asked' }),
        },
        { id: 'waiting', label: 'Waiting, the empty desk', render: (root) => renderWaiting(root) },
        { id: 'reading-turn', label: 'Reading circle, Marguerite reads', render: (root) => renderReading(root) },
        { id: 'poem-open', label: 'Poem 1 open', render: (root) => renderPoem(root, R.poems[0]) },
        {
          id: 'x-round-turn',
          label: 'Round turn, a new note arrives',
          render: (root) => renderWriting(root, R.assignments[5], { arrive: true }),
        },
      ],
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
