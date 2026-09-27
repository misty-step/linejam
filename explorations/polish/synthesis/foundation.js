/* Tucked In: foundation. One global, LJS. Every slice builds from these helpers.
   Helpers return HTML strings (compose with template literals) unless noted; behavior for
   chrome, invitation, favorites and the "Lines by" key is wired once by delegation, so markup
   works wherever it lands. Documented in FOUNDATION.md. */
(function () {
  'use strict';

  const R = LJ.room;
  const params = LJ.params || new URLSearchParams(location.search);

  /* ---------- small utilities ---------- */
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const words = (text) => String(text).trim().split(/\s+/).filter(Boolean).length;
  const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
  const ordinal = (n) => ORDINALS[n] || `${n}th`;
  const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  let uidCount = 0;
  const uid = (prefix = 'ljs') => `${prefix}-${++uidCount}`;

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  }

  /* Player lookup: accepts a player id ('juniper'), a player object, or a cast id ('orbit'). */
  function person(who) {
    if (who && typeof who === 'object') return who;
    return R.byId[who] || null;
  }
  const first = (who) => {
    const p = person(who);
    return p ? p.name.split(' ')[0] : String(who);
  };
  function castOf(who) {
    const p = person(who);
    if (p) return p.avatar;
    return LJ.CAST_IDS.includes(who) ? who : 'pip';
  }
  const poemOf = (n) => (typeof n === 'object' ? n : R.poems.find((p) => p.number === n));

  /* ---------- screen registry ---------- */
  const screens = [];
  function add(screen) {
    if (!screen || !screen.id || typeof screen.render !== 'function') {
      throw new Error('LJS.add needs { id, label, group, render(root, ctx) }');
    }
    const at = screens.findIndex((s) => s.id === screen.id);
    const entry = { label: screen.id, group: 'screens', ...screen };
    if (at >= 0) screens[at] = entry;
    else screens.push(entry);
    return entry;
  }
  const has = (id) => screens.some((s) => s.id === id);

  /* Move to another registered screen, keeping theme and text scale. Returns false if the
     screen is not registered (the caller keeps its own state). */
  function go(id) {
    if (!has(id)) return false;
    const url = new URL(location.href);
    url.searchParams.set('screen', id);
    if (document.documentElement.classList.contains('dark')) url.searchParams.set('theme', 'dark');
    else url.searchParams.delete('theme');
    location.href = url.toString();
    return true;
  }

  /* ---------- icons (24px grid, stroke) ---------- */
  const ICON = {
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sound: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6a1.4 1.4 0 0 1-1 .4H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5Z"/><path d="M16 9a5 5 0 0 1 0 6M19.4 18.4a9 9 0 0 0 0-12.8"/>',
    muted: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6a1.4 1.4 0 0 1-1 .4H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5Z"/><path d="m22 9-6 6M16 9l6 6"/>',
    more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4.5M12 8h.01"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    offline: '<path d="M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.4-1.7M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8a15 15 0 0 0-11.9-3.7M2 2l20 20"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
    heart: '<path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6.1a5 5 0 1 1 7.5 6.5Z"/>',
    folds: '<path d="M4 6h16M4 10.5h16M4 15h16"/><path d="M4 19.5h9" stroke-dasharray="2 2.6"/>',
    back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    crown: '<path d="m3 18 1.5-11 5 4.5L12 5l2.5 6.5 5-4.5L21 18Z"/>',
  };
  function icon(name, size = 22) {
    return `<svg class="ljs-ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[name] || ''}</svg>`;
  }

  /* ---------- props: small inline drawings over the shipped cast (never redrawn) ---------- */
  const PAPER = 'style="fill:#fff"';
  const PEACH = 'style="fill:var(--avatar-peach)"';
  const MINT = 'style="fill:var(--avatar-mint)"';
  const LAV = 'style="fill:var(--avatar-lavender)"';
  const INKF = 'style="fill:var(--avatar-ink)"';
  const PROP_ART = {
    crown: `<path d="M6 24 L4.5 11 L11 16.5 L16 7.5 L21 16.5 L27.5 11 L26 24 Z" ${PEACH}/><path d="M6.5 20.5 H25.5"/><circle cx="16" cy="6" r="1.6" ${MINT}/>`,
    pencil: `<path d="M5 27 L7 20 L21 6 L26 11 L12 25 Z" ${PEACH}/><path d="M21 6 L23 4 Q24.5 2.8 26 4.2 L27.8 6 Q29.2 7.5 28 9 L26 11" ${MINT}/><path d="M5 27 L7 20 L12 25 Z" ${PAPER}/><path d="M5 27 L5.9 24 L8 26.1 Z" ${INKF}/>`,
    note: `<path d="M4 9.5 H28 V25 H4 Z" ${PAPER}/><path d="M4 9.5 L16 18.5 L28 9.5"/><circle cx="16" cy="18" r="3.4" ${PEACH}/>`,
    moon: `<path d="M20 4.5 A11.5 11.5 0 1 0 28.5 21 A9 9 0 0 1 20 4.5 Z" ${LAV}/><path d="M13 16 Q14.5 17.5 16 16"/>`,
    book: `<path d="M16 9 Q10 5.5 3 7.5 V26 Q10 24 16 27 Z" ${PAPER}/><path d="M16 9 Q22 5.5 29 7.5 V26 Q22 24 16 27 Z" ${PAPER}/><path d="M6.5 12 Q9.5 11 12.5 12.2 M6.5 16 Q9.5 15 12.5 16.2 M6.5 20 Q8.5 19.4 10.5 20 M19.5 12.2 Q22.5 11 25.5 12 M19.5 16.2 Q22.5 15 25.5 16" opacity=".55"/>`,
  };
  const PROPS = Object.keys(PROP_ART);
  function prop(name) {
    if (!PROP_ART[name]) return '';
    return `<svg class="ljs-prop ljs-prop--${name}" viewBox="0 0 32 32" fill="none" stroke="var(--avatar-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PROP_ART[name]}</svg>`;
  }

  /* A character: shipped art + sticker edge, optional prop, optional peach lamp, or outlined.
     Decorative by default because a visible name always sits beside it. */
  function character(who, opts = {}) {
    const { size = 44, prop: propName = null, lamp = false, outlined = false, label = null, className = '', edge = true } = opts;
    const cast = opts.avatar || castOf(who);
    const cls = ['ljs-char'];
    if (outlined) cls.push('ljs-char--outlined');
    else if (edge) cls.push('ljs-char--edge');
    if (lamp) cls.push('ljs-char--lamp');
    if (className) cls.push(className);
    const lampHtml = lamp ? `<span class="ljs-lamp" aria-hidden="true"${lamp === 'off' ? ' data-off' : ''}></span>` : '';
    return `<span class="${cls.join(' ')}" style="--s:${size}px" data-cast="${cast}">${lampHtml}${LJ.avatar(cast, { size, outlined, label: label || undefined })}${propName ? prop(propName) : ''}</span>`;
  }

  /* ---------- buttons ---------- */
  function button(opts = {}) {
    const { label, variant = 'primary', size = 'md', block = false, icon: iconName = null, disabled = false, pending = null, attrs = '', type = 'button', className = '' } = opts;
    const cls = ['ljs-btn', `ljs-btn--${variant}`];
    if (size === 'lg') cls.push('ljs-btn--lg');
    if (size === 'sm') cls.push('ljs-btn--sm');
    if (block) cls.push('ljs-btn--block');
    if (className) cls.push(className);
    const text = pending || label;
    const state = pending ? ` aria-disabled="true" aria-busy="true" data-label="${esc(label)}"` : disabled ? ' disabled' : '';
    return `<button type="${type}" class="${cls.join(' ')}"${state} ${attrs}>${iconName ? icon(iconName, 20) : ''}<span class="ljs-btn__label">${esc(text)}</span></button>`;
  }

  /* Swap a button to its pending label. Returns restore(). While pending, clicks are ignored
     (aria-disabled keeps focus on the button instead of dropping it to the page). */
  function pending(btn, text) {
    const labelEl = btn.querySelector('.ljs-btn__label') || btn;
    const prev = labelEl.textContent;
    btn.dataset.label = prev;
    labelEl.textContent = text;
    btn.setAttribute('aria-disabled', 'true');
    btn.setAttribute('aria-busy', 'true');
    return () => {
      labelEl.textContent = prev;
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('aria-busy');
    };
  }
  const isInert = (btn) => btn.disabled || btn.getAttribute('aria-disabled') === 'true';

  function iconButton({ icon: iconName, label, attrs = '', className = '' }) {
    return `<button type="button" class="ljs-icon-btn ${className}" aria-label="${esc(label)}" ${attrs}>${icon(iconName)}</button>`;
  }

  /* ---------- chrome: header, appearance, sound ---------- */
  const chrome = { appearance: LJ.theme === 'dark' ? 'dark' : 'system', muted: false };
  const APPEARANCE_NEXT = { system: 'light', light: 'dark', dark: 'system' };
  const APPEARANCE_WORD = { system: 'System', light: 'Light', dark: 'Dark' };
  const APPEARANCE_ICON = { system: 'monitor', light: 'sun', dark: 'moon' };

  function syncChrome(scope = document) {
    scope.querySelectorAll('[data-ljs="appearance"]').forEach((b) => {
      const now = chrome.appearance;
      b.innerHTML = icon(APPEARANCE_ICON[now]);
      b.setAttribute('aria-label', `Appearance: ${APPEARANCE_WORD[now]}. Switch to ${APPEARANCE_WORD[APPEARANCE_NEXT[now]]}`);
    });
    scope.querySelectorAll('[data-ljs="sound"]').forEach((b) => {
      b.innerHTML = icon(chrome.muted ? 'muted' : 'sound');
      b.setAttribute('aria-pressed', String(chrome.muted));
      b.setAttribute('aria-label', 'Mute sound');
    });
  }
  function applyAppearance() {
    const dark =
      chrome.appearance === 'dark' || (chrome.appearance === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    syncChrome();
  }

  const MENU_ITEMS = {
    how: { label: 'How to play' },
    poems: { label: 'Your poems' },
    close: { label: 'Close room', danger: true, confirm: 'close' },
    leave: { label: 'Leave room', danger: true, confirm: 'leave' },
    end: { label: 'End game', danger: true, confirm: 'end' },
  };
  const MENUS = {
    lobbyHost: { label: 'Room options', items: ['how', 'poems', 'close'] },
    lobbyGuest: { label: 'Room options', items: ['how', 'poems', 'leave'] },
    game: { label: 'Room options', items: ['how', 'poems', 'end'] },
    gameGuest: { label: 'Room options', items: ['how', 'poems', 'leave'] },
    more: { label: 'More options', items: ['how', 'poems'] },
  };

  function wordmark(tag = 'span') {
    return `<${tag} class="ljs-wordmark">Linejam</${tag}>`;
  }
  function codeChip() {
    return `<button type="button" class="ljs-chip-code" data-ljs="invite" aria-haspopup="dialog" aria-expanded="false" aria-label="Room ${R.codeDisplay}. Invite friends">${R.codeDisplay}</button>`;
  }

  function header(opts = {}) {
    const { left = 'wordmark', menu = 'more', signIn = false } = opts;
    const leftHtml = left === 'code' ? codeChip() : left === 'none' ? '<span></span>' : wordmark();
    const m = MENUS[menu];
    const tools = [
      signIn ? iconButton({ icon: 'user', label: 'Sign in', attrs: 'data-ljs="signin"' }) : '',
      `<button type="button" class="ljs-icon-btn" data-ljs="appearance"></button>`,
      `<button type="button" class="ljs-icon-btn" data-ljs="sound"></button>`,
      m
        ? `<button type="button" class="ljs-icon-btn" data-ljs="menu" data-menu="${menu}" aria-haspopup="menu" aria-expanded="false" aria-label="${m.label}">${icon('more')}</button>`
        : '',
    ].join('');
    return `<header class="ljs-header">${leftHtml}<div class="ljs-header__tools">${tools}</div></header>`;
  }

  /* ---------- page frame ---------- */
  /* page(root, { header, body, notices, mainClass, label }) builds header + notice slot + main
     + a polite live region into root (the harness .lj-screen). Returns a context object. */
  function page(root, opts = {}) {
    const { header: headerOpts = {}, body = '', notices = [], mainClass = '', label = null } = opts;
    root.classList.add('ljs-root');
    const frame = el(`<div class="ljs-page">
      ${headerOpts === false ? '' : header(headerOpts)}
      <div class="ljs-notices">${notices.map((n) => notice(typeof n === 'string' ? NOTICE[n] : n)).join('')}</div>
      <main class="ljs-main ${mainClass}"${label ? ` aria-label="${esc(label)}"` : ''}>${body}</main>
      <div class="sr-only" role="status" aria-live="polite" data-ljs-live></div>
    </div>`);
    root.replaceChildren(frame);
    syncChrome(frame);
    const live = frame.querySelector('[data-ljs-live]');
    const ctx = {
      root,
      el: frame,
      main: frame.querySelector('.ljs-main'),
      say(text) {
        live.textContent = '';
        setTimeout(() => (live.textContent = text), 40);
      },
      notice(n, { settle: doSettle = true } = {}) {
        const data = typeof n === 'string' ? NOTICE[n] : n;
        const node = el(notice(data));
        frame.querySelector('.ljs-notices').append(node);
        if (doSettle) motion.settle(node);
        ctx.say(data.text);
        return node;
      },
    };
    return ctx;
  }

  function sectionHead({ title, count = null, id = null, level = 2 }) {
    return `<div class="ljs-section-head"><h${level} class="ljs-h2"${id ? ` id="${id}"` : ''}>${esc(title)}</h${level}>${
      count ? `<span class="ljs-section-head__count">${esc(count)}</span>` : ''
    }</div>`;
  }

  /* ---------- overlays: anchored menu, invite popover, bottom sheets ---------- */
  let overlay = null; // { el, opener, kind, cleanup }

  function closeOverlay({ returnFocus = true } = {}) {
    if (!overlay) return;
    const { el: node, opener, cleanup } = overlay;
    overlay = null;
    if (cleanup) cleanup();
    node.remove();
    if (opener && opener.hasAttribute('aria-expanded')) opener.setAttribute('aria-expanded', 'false');
    if (returnFocus && opener && document.contains(opener)) opener.focus({ preventScroll: true });
  }

  function place(node, anchor, align) {
    const r = anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const pad = vw <= 360 ? 12 : 16;
    node.style.top = `${r.bottom + window.scrollY + 6}px`;
    const w = node.offsetWidth;
    let left = align === 'start' ? r.left : r.right - w;
    left = Math.max(pad, Math.min(left, vw - pad - w));
    node.style.left = `${left + window.scrollX}px`;
  }

  function menuMarkup(kind, { static: isStatic = false } = {}) {
    const m = MENUS[kind];
    const items = m.items
      .map((key) => {
        const it = MENU_ITEMS[key];
        const rule = it.danger ? '<div class="ljs-menu__rule" role="separator"></div>' : '';
        return `${rule}<button type="button" role="menuitem" tabindex="-1" class="ljs-menu__item${it.danger ? ' ljs-menu__item--danger' : ''}" data-item="${key}">${esc(it.label)}</button>`;
      })
      .join('');
    return `<div class="ljs-menu${isStatic ? ' ljs-menu--static' : ''}" role="menu" aria-label="${m.label}">${items}</div>`;
  }

  /* Actions for menu items. Slices may replace LJS.menuActions.how / .poems. */
  const menuActions = {
    how: () => go('03-entry-how-to-play'),
    poems: () => go('63-archive-populated'),
    close: (opener) => confirm('close', { opener }),
    leave: (opener) => confirm('leave', { opener }),
    end: (opener) => confirm('end', { opener }),
  };

  function openMenu(btn) {
    if (overlay && overlay.opener === btn) return closeOverlay();
    closeOverlay({ returnFocus: false });
    const kind = btn.dataset.menu;
    const node = el(menuMarkup(kind));
    node.id = uid('menu');
    document.body.append(node);
    place(node, btn, 'end');
    btn.setAttribute('aria-controls', node.id);
    btn.setAttribute('aria-expanded', 'true');
    const items = [...node.querySelectorAll('[role="menuitem"]')];
    const onKey = (e) => {
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
      else if (e.key === 'Tab') { closeOverlay(); }
    };
    node.addEventListener('keydown', onKey);
    node.addEventListener('click', (e) => {
      const item = e.target.closest('[data-item]');
      if (!item) return;
      closeOverlay();
      const action = menuActions[item.dataset.item];
      if (action) action(btn);
    });
    overlay = { el: node, opener: btn, kind: 'menu' };
    items[0].focus();
  }

  /* The in-game invitation opens as a panel in flow directly under the header (it pushes the
     page down instead of covering it), so the received line and the action stay on the page
     at any text size. The code chip toggles it; Escape closes it and returns focus to the chip. */
  function openInvite(btn, { state = 'idle' } = {}) {
    if (overlay && overlay.opener === btn) return closeOverlay();
    closeOverlay({ returnFocus: false });
    const pageEl = btn.closest('.ljs-page');
    const node = el(`<section class="ljs-invite-panel" role="region" aria-label="Invite friends">${invitation({ compact: true, inGame: true, state })}</section>`);
    node.id = uid('invite');
    if (pageEl) pageEl.querySelector('.ljs-header').after(node);
    else document.body.append(node);
    btn.setAttribute('aria-controls', node.id);
    btn.setAttribute('aria-expanded', 'true');
    overlay = { el: node, opener: btn, kind: 'panel' };
    node.querySelector('button').focus({ preventScroll: true });
    motion.settle(node);
  }

  function focusables(root) {
    return [...root.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter(
      (n) => !n.disabled && n.offsetParent !== null
    );
  }

  /* Modal bottom sheet. openSheet({ title, body, actions, labelledBy, close, className, opener,
     onClose }) -> { el, close }. Traps focus (inert page + Tab loop), Escape closes, focus returns. */
  function sheetMarkup({ title, body = '', actions = '', close: closeBtn = true, id = uid('sheet'), className = '', static: isStatic = false }) {
    const role = isStatic ? '' : ' role="dialog" aria-modal="true"';
    return `<section class="ljs-sheet${isStatic ? ' ljs-sheet--static' : ''} ${className}"${role} aria-labelledby="${id}-t">
      <div class="ljs-sheet__head">
        <h2 class="ljs-sheet__title" id="${id}-t">${esc(title)}</h2>
        ${closeBtn ? iconButton({ icon: 'close', label: 'Close', attrs: 'data-ljs="dismiss"' }) : ''}
      </div>
      ${body}
      ${actions ? `<div class="ljs-sheet__actions">${actions}</div>` : ''}
    </section>`;
  }

  function openSheet(opts = {}) {
    const opener = opts.opener || document.activeElement;
    closeOverlay({ returnFocus: false });
    const layer = el(`<div class="ljs-layer"><div class="ljs-scrim" data-ljs="dismiss"></div>${sheetMarkup(opts)}</div>`);
    document.body.append(layer);
    const screenEl = document.querySelector('.lj-screen');
    if (screenEl) screenEl.inert = true;
    const sheet = layer.querySelector('.ljs-sheet');
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const f = focusables(sheet);
      if (!f.length) return;
      const firstEl = f[0];
      const lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    layer.addEventListener('keydown', onKey);
    overlay = {
      el: layer,
      opener,
      kind: 'sheet',
      cleanup() {
        if (screenEl) screenEl.inert = false;
        if (opts.onClose) opts.onClose();
      },
    };
    motion.settle(sheet);
    const target = sheet.querySelector('[data-autofocus]') || focusables(sheet)[0];
    if (target) target.focus();
    return { el: sheet, close: (o) => closeOverlay(o) };
  }

  /* ---------- confirmations ---------- */
  const CONFIRM = {
    close: { title: 'Close this room?', body: 'Everyone leaves this room. Saved poems stay in Your poems.', safe: 'Keep room open', action: 'Close room', pending: 'Closing room…' },
    leave: { title: 'Leave this room?', body: 'The room stays open for the others. You can rejoin with its code.', safe: 'Stay here', action: 'Leave room', pending: 'Leaving room…' },
    end: { title: 'End this game?', body: 'Everyone returns to the lobby. Partial poems stay private.', safe: 'Keep playing', action: 'End game', pending: 'Ending game…' },
  };
  const CONFIRM_ERROR = "That didn't go through. Check your connection and try again.";
  const CONFIRM_NEXT = { close: '73-after-close-room-host', leave: '01-entry-home', end: '13-lobby-host-ready' };

  function confirmParts(kind, state = 'idle') {
    const c = CONFIRM[kind];
    const body = `<p class="ljs-sheet__body">${esc(c.body)}</p>${
      state === 'error' ? `<p class="ljs-sheet__error" role="alert">${icon('alert', 20)}<span>${esc(CONFIRM_ERROR)}</span></p>` : ''
    }`;
    const actions = [
      button({ label: c.action, variant: 'danger', block: true, pending: state === 'pending' ? c.pending : null, attrs: 'data-ljs-confirm' }),
      button({ label: c.safe, variant: 'secondary', block: true, attrs: 'data-ljs="dismiss" data-autofocus' }),
    ].join('');
    return { title: c.title, body, actions, close: false };
  }
  function confirmMarkup(kind, { state = 'idle', static: isStatic = true } = {}) {
    return sheetMarkup({ ...confirmParts(kind, state), static: isStatic });
  }

  /* confirm(kind, { opener, state, onConfirm, pendingMs }) opens the confirmation sheet.
     onConfirm(handle, button) may return a promise; default: pending label, then the next screen. */
  function confirm(kind, opts = {}) {
    const { opener, state = 'idle', onConfirm = null, pendingMs = 700 } = opts;
    const handle = openSheet({ ...confirmParts(kind, state), opener, className: 'ljs-sheet--confirm' });
    const act = handle.el.querySelector('[data-ljs-confirm]');
    act.addEventListener('click', async () => {
      if (isInert(act)) return;
      if (onConfirm) return onConfirm(handle, act);
      pending(act, CONFIRM[kind].pending);
      await wait(pendingMs);
      if (!go(CONFIRM_NEXT[kind])) handle.close();
    });
    return handle;
  }

  /* ---------- notices ---------- */
  const NOTICE_ICON = { info: 'info', success: 'check', offline: 'offline', error: 'alert', pending: 'refresh' };
  const NOTICE = {
    handoffOthers: { tone: 'info', text: 'Juniper stepped away, so Wren is hosting now.' },
    handoffNewHost: { tone: 'info', text: "Juniper stepped away. You're hosting now." },
    handoffOldHost: { tone: 'info', text: 'You were away, so Wren is hosting now.' },
    gameEnded: { tone: 'info', text: 'Juniper ended the game. Partial poems stay private.' },
    roomClosedGuest: { tone: 'info', text: 'Juniper closed the room. Your poems are saved in Your poems.' },
    roomClosedHost: { tone: 'info', text: 'Room 9A UK is closed.' },
    offline: { tone: 'offline', text: "You're offline. Your line is safe on this phone." },
    reconnecting: { tone: 'pending', text: 'Reconnecting…' },
    back: { tone: 'success', text: "You're back. Round 5 is still yours." },
    update: { tone: 'info', text: 'Linejam was updated. Reload to keep playing.', action: { label: 'Reload', attrs: 'data-ljs="reload"' } },
    arrival: { tone: 'info', text: 'Wren joined.' },
  };
  function notice(n) {
    const { tone = 'info', text, action = null } = n;
    return `<div class="ljs-notice ljs-notice--${tone}">
      <span class="ljs-notice__icon">${icon(NOTICE_ICON[tone] || 'info', 18)}</span>
      <p class="ljs-notice__text">${esc(text)}</p>
      ${action ? button({ label: action.label, variant: 'quiet', size: 'sm', attrs: action.attrs || '' }) : ''}
    </div>`;
  }

  /* ---------- roster ---------- */
  const STATUS = {
    in: { text: 'Tucked in', prop: 'note' },
    writing: { text: 'Writing', prop: 'pencil' },
    away: { text: 'Away', prop: 'moon' },
    watching: { text: 'Watching', outlined: true },
    read: { text: 'Read' },
    now: { text: 'Reading now', lamp: true },
    next: { text: 'Up next' },
  };
  function statusChip(key, text) {
    const s = STATUS[key];
    return `<span class="ljs-status ljs-status--${key}">${esc(text || (s ? s.text : key))}</span>`;
  }

  function rosterRow({ player, status = 'in', you = false, note = null, size = 40, statusText = null, extra = '' }) {
    const p = person(player);
    const s = STATUS[status] || {};
    const ch = character(p, { size, prop: s.prop, outlined: !!s.outlined });
    return `<li class="ljs-row" data-player="${p.id}">
      ${ch}
      <span class="ljs-row__who"><span class="ljs-row__name">${esc(p.name)}${you ? ' <span class="ljs-you">(you)</span>' : ''}</span>${
        note ? `<span class="ljs-row__note">${esc(note)}</span>` : ''
      }</span>
      <span class="ljs-row__end">${extra}${statusChip(status, statusText)}</span>
    </li>`;
  }

  /* The waiting roster: "This round" with a count, playing rows, spectators set apart. */
  function waitingRoster({ statuses = { juniper: 'in', wren: 'in', basil: 'writing', marguerite: 'away' }, you = R.you, spectators = [R.lateJoiner], id = uid('round') } = {}) {
    const ids = Object.keys(statuses);
    const inCount = ids.filter((k) => statuses[k] === 'in').length;
    const rows = ids.map((k) => rosterRow({ player: k, status: statuses[k], you: k === you })).join('');
    const watch = spectators.length
      ? `<ul class="ljs-roster ljs-roster--apart" aria-label="Watching this game">${spectators
          .map((p) => rosterRow({ player: p, status: 'watching', you: p.id === you, note: 'Joined late. Plays the next game.' }))
          .join('')}</ul>`
      : '';
    return `<section class="ljs-round-roster" aria-labelledby="${id}">
      ${sectionHead({ title: 'This round', count: `${inCount} of ${ids.length} lines in`, id })}
      <ul class="ljs-roster">${rows}</ul>
      ${watch}
    </section>`;
  }

  /* ---------- lobby gathering ---------- */
  function gathering(players = R.players, { size = 72, you = null, arriving = null } = {}) {
    return `<ul class="ljs-gather">${players
      .map(
        (p) => `<li class="ljs-gather__item"${arriving === p.id ? ' data-arriving' : ''} data-player="${p.id}">
          ${character(p, { size, prop: p.host ? 'crown' : null })}
          <span class="ljs-gather__name">${esc(p.name)}${p.id === you ? ' <span class="ljs-you">(you)</span>' : ''}</span>
          ${p.host ? '<span class="ljs-gather__tag">Host</span>' : ''}
        </li>`
      )
      .join('')}</ul>`;
  }

  /* ---------- invitation ---------- */
  const INVITE_TEXT = {
    copied: 'Copied',
    'copy-refused': "Couldn't copy. Read the code out or show the QR.",
    'link-copied': 'Link copied',
    'share-refused': "Couldn't share. Show the QR or read the code out.",
  };
  function invitation({ state = 'idle', compact = false, inGame = false, full = false, qrSize = null, id = uid('invite') } = {}) {
    const q = qrSize || (compact ? 132 : 140);
    const copyText = state === 'copied' || state === 'copy-refused' ? INVITE_TEXT[state] : '';
    const shareText = state === 'link-copied' || state === 'share-refused' ? INVITE_TEXT[state] : '';
    const tone = (s) => (s === 'copied' || s === 'link-copied' ? ' is-good' : ' is-refused');
    return `<section class="ljs-invite${compact ? ' ljs-invite--compact' : ''}" aria-labelledby="${id}-l" data-state="${state}">
      <div class="ljs-invite__top">
        <div class="ljs-invite__code-col">
          <p class="ljs-label" id="${id}-l">Room code</p>
          <button type="button" class="ljs-invite__code" data-ljs="copy" aria-label="Room code ${R.codeDisplay}. Copy code" aria-describedby="${id}-c">
            <span>${R.codeDisplay}</span>${icon(state === 'copied' ? 'check' : 'copy', 20)}
          </button>
          <p class="ljs-invite__status${copyText ? tone(state) : ''}" id="${id}-c" role="status" data-ljs-copy-status>${esc(copyText)}</p>
        </div>
        <figure class="ljs-invite__qr">
          ${LJ.qr({ size: q, label: `QR code to join room ${R.codeDisplay}` })}
          <figcaption>Scan to join</figcaption>
        </figure>
      </div>
      ${inGame ? '<p class="ljs-invite__note">Friends who join now watch this game and write in the next one.</p>' : ''}
      ${
        full
          ? `<p class="ljs-invite__full" role="status">${icon('info', 18)}<span>This room is full. It holds ${R.capacity} players.</span></p>`
          : `<div class="ljs-invite__share">
        ${button({ label: 'Share invite', variant: 'secondary', block: true, icon: 'share', attrs: 'data-ljs="share"' })}
        <p class="ljs-invite__status${shareText ? tone(state) : ''}" role="status" data-ljs-share-status>${esc(shareText)}</p>
      </div>`
      }
    </section>`;
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fall through to the legacy path */
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
  function setInviteStatus(statusEl, text, good) {
    clearTimeout(statusEl._t);
    statusEl.textContent = text;
    statusEl.classList.toggle('is-good', good);
    statusEl.classList.toggle('is-refused', !good);
    if (good) statusEl._t = setTimeout(() => (statusEl.textContent = ''), 3000);
  }

  /* ---------- writing: round glyph, note, slots ---------- */
  const ROUND_CAPTION = {
    1: 'One word to start', 2: 'Two words', 3: 'Three words', 4: 'Four words', 5: 'Five words, the longest line',
    6: 'Four words', 7: 'Three words', 8: 'Two words', 9: 'One word to finish',
  };
  function roundGlyph(round, { caption = true, label = true } = {}) {
    const bars = R.WORD_COUNTS.map((n, i) => {
      const cls = i + 1 === round ? 'is-now' : i + 1 < round ? 'is-past' : '';
      return `<i class="${cls}" style="--n:${n}"></i>`;
    }).join('');
    return `<div class="ljs-round">
      <span class="ljs-glyph" aria-hidden="true">${bars}</span>
      ${label ? `<p class="ljs-round__text"><strong>Round ${round} of 9</strong>${caption ? `<span>${ROUND_CAPTION[round]}</span>` : ''}</p>` : ''}
    </div>`;
  }

  const unit = (n) => (n === 1 ? 'word' : 'words');
  function countText(n, target) {
    if (n > target) return `${n} of ${target} ${unit(target)}. Take ${n - target} out.`;
    if (n === target) return `${n} of ${target} ${unit(target)}. Ready.`;
    return `${n} of ${target} ${unit(target)}`;
  }
  function wordSlots(n, target) {
    const shown = Math.min(Math.max(n, target), target + 3);
    return Array.from({ length: shown }, (_, i) => {
      const cls = i >= target ? 'is-over' : i < n ? 'is-filled' : '';
      return `<span class="ljs-slot ${cls}"></span>`;
    }).join('');
  }
  function countState(n, target) {
    return n > target ? 'is-over' : n === target ? 'is-ready' : '';
  }

  function foldsText(round) {
    if (round <= 1) return null;
    const k = round - 1;
    return `${k} ${k === 1 ? 'line' : 'lines'} folded away`;
  }

  /* note({ round, received, value, draft, readonly, folded, id }) -> HTML */
  function note(opts = {}) {
    const { round = 5, value = '', draft = false, readonly = false, folded = false, id = uid('line'), limit = 500, message = null, messageTone = 'info' } = opts;
    const target = R.WORD_COUNTS[round - 1];
    const received = opts.received !== undefined ? opts.received : R.assignments[round - 1].previousLine;
    const n = words(value);
    const folds = foldsText(round);
    const top = received
      ? `${folds ? `<p class="ljs-note__folds">${icon('folds', 16)}<span>${folds}</span></p>` : ''}
         <div class="ljs-note__passed">
           <p class="ljs-label" id="${id}-rl">Passed to you</p>
           <p class="ljs-note__received" aria-describedby="${id}-rl">${esc(received)}</p>
         </div>`
      : `<div class="ljs-note__passed"><p class="ljs-note__received ljs-note__received--fresh">A fresh note. You start this poem.</p></div>`;
    const near = value.length >= limit - 50;
    const msg = draft ? 'Your draft is back.' : message;
    return `<article class="ljs-note${folded ? ' is-folded' : ''}" aria-label="Your note, round ${round}" data-target="${target}">
      <div class="ljs-note__top">
        <div class="ljs-note__face">${top}</div>
        <div class="ljs-note__back" aria-hidden="true"></div>
      </div>
      <div class="ljs-note__bottom">
        ${
          msg
            ? messageTone === 'error' && !draft
              ? `<p class="ljs-note__msg ljs-note__msg--error" role="alert">${icon('alert', 16)}<span>${esc(msg)}</span></p>`
              : `<p class="ljs-note__msg">${icon(draft ? 'refresh' : 'info', 16)}<span>${esc(msg)}</span></p>`
            : ''
        }
        <label class="ljs-label" for="${id}">Your line</label>
        <textarea id="${id}" class="ljs-note__input" rows="1" maxlength="${limit}" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" spellcheck="true" aria-describedby="${id}-n"${
          readonly ? ' readonly' : ''
        }${n > target ? ' aria-invalid="true"' : ''}>${esc(value)}</textarea>
        <div class="ljs-count">
          <span class="ljs-slots" aria-hidden="true">${wordSlots(n, target)}</span>
          <span class="ljs-count__text ${countState(n, target)}" id="${id}-n">${esc(countText(n, target))}</span>
        </div>
        <p class="ljs-note__limit" data-ljs-limit${near ? '' : ' hidden'}>${value.length} of ${limit} characters</p>
      </div>
    </article>`;
  }

  /* Grows the line input to its content. Past three lines the note drops its equal halves
     (.is-tall) so the received line stays in view; the tuck restores them while it folds. */
  function autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 30;
    const noteEl = ta.closest('.ljs-note');
    if (noteEl) noteEl.classList.toggle('is-tall', ta.scrollHeight > lineHeight * 3.4);
  }

  /* bindNote(noteEl, { button }) wires counting, slots, Enter-to-submit and the action's
     enabled state. Returns { input, update, words() }. */
  function bindNote(noteEl, { button: btn = null } = {}) {
    const target = Number(noteEl.dataset.target);
    const input = noteEl.querySelector('textarea');
    const slots = noteEl.querySelector('.ljs-slots');
    const count = noteEl.querySelector('.ljs-count__text');
    const limitEl = noteEl.querySelector('[data-ljs-limit]');
    function update() {
      const n = words(input.value);
      slots.innerHTML = wordSlots(n, target);
      count.textContent = countText(n, target);
      count.className = `ljs-count__text ${countState(n, target)}`;
      if (n > target) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
      const max = Number(input.maxLength);
      limitEl.hidden = input.value.length < max - 50;
      limitEl.textContent = `${input.value.length} of ${max} characters`;
      if (btn && btn.getAttribute('aria-busy') !== 'true') btn.disabled = n !== target;
    }
    input.addEventListener('input', () => {
      if (/[\r\n]/.test(input.value)) input.value = input.value.replace(/[\r\n]+/g, ' ');
      update();
      autoGrow(input);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      e.preventDefault();
      if (btn && !isInert(btn)) btn.click();
    });
    update();
    requestAnimationFrame(() => autoGrow(input));
    /* Measure again once the webfont is in and whenever the width changes (rotation, resize). */
    if (document.fonts) document.fonts.ready.then(() => autoGrow(input));
    let lastWidth = 0;
    new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w !== lastWidth) {
        lastWidth = w;
        autoGrow(input);
      }
    }).observe(input);
    return { input, update, words: () => words(input.value) };
  }

  /* ---------- waiting ---------- */
  function waitingHero({ you = R.you, line = null, round = 5, repeat = false, id = uid('ack') } = {}) {
    const mine = line || R.assignments[round - 1].yourLine;
    const nextText = round >= 9 ? 'The reading starts when every line is in.' : `Round ${round + 1} starts when every line is in.`;
    return `<section class="ljs-ack" aria-labelledby="${id}">
      ${character(you, { size: 112, prop: 'note' })}
      <h1 class="ljs-display" id="${id}" tabindex="-1" data-ljs-ack>${repeat ? 'Your line was already tucked in.' : 'Tucked into the poem.'}</h1>
      <p class="ljs-ack__echo">You wrote <q>${esc(mine)}</q></p>
      <p class="ljs-ack__next">${nextText}</p>
    </section>`;
  }

  /* ---------- reading ---------- */
  const readerOf = (n) => poemOf(n).reader;

  /* readingHero({ mode, poem, reader, next, follow, id }) mode: listener | reader | fallback |
     spectator | after. The action (Read, Step in) is a separate button the screen places. */
  function readingHero(opts = {}) {
    const { mode = 'listener', poem = 1, follow = true, id = uid('read') } = opts;
    /* The open book only once the reader has opened the poem (D1/D3); before that, just the lamp. */
    const opened = opts.opened !== undefined ? !!opts.opened : follow;
    const reader = opts.reader || readerOf(poem);
    const name = first(reader);
    if (mode === 'reader') {
      return `<section class="ljs-hero ljs-hero--reader" aria-labelledby="${id}">
        ${character(reader, { size: 128, lamp: true })}
        <h1 class="ljs-hero__title" id="${id}" tabindex="-1">Your turn to read.</h1>
        <p class="ljs-hero__body">Poem ${poem}, nine lines. Read it aloud to the room.</p>
      </section>`;
    }
    if (mode === 'fallback') {
      const absent = opts.absent || reader;
      return `<section class="ljs-hero ljs-hero--fallback" aria-labelledby="${id}">
        ${character(absent, { size: 112, lamp: true, prop: 'moon' })}
        <h1 class="ljs-hero__title" id="${id}" tabindex="-1">${esc(first(absent))} stepped away.</h1>
        <p class="ljs-hero__body">Read Poem ${poem} for ${esc(first(absent))}?</p>
      </section>`;
    }
    if (mode === 'after') {
      const hasNext = opts.next !== undefined ? !!opts.next : !!poemOf(poem + 1);
      const next = hasNext ? opts.next || readerOf(poem + 1) : null;
      const moved = !!opts.lampMoved;
      return `<section class="ljs-hero ljs-hero--after" aria-labelledby="${id}">
        ${character(reader, { size: 112, lamp: moved ? 'off' : true })}
        <h1 class="ljs-display" id="${id}" tabindex="-1">Nicely read.</h1>
        ${next ? `<p class="ljs-hero__next">${character(next, { size: 36, lamp: moved ? true : 'off', className: 'ljs-next-char' })}<span>${esc(first(next))} reads next.</span></p>` : ''}
      </section>`;
    }
    const spectatorLine =
      mode === 'spectator' ? `<p class="ljs-hero__aside">You joined during this game. You'll write in the next one.</p>` : '';
    return `<section class="ljs-hero ljs-hero--listener" aria-labelledby="${id}">
      ${character(reader, { size: 120, lamp: true, prop: opened ? 'book' : null })}
      <h1 class="ljs-hero__title" id="${id}" tabindex="-1"><span class="ljs-hero__listen">Listen.</span> ${esc(name)} is reading Poem&nbsp;${poem}.</h1>
      ${follow ? button({ label: 'Follow along', variant: 'quiet', attrs: 'data-ljs-follow' }) : ''}
      ${spectatorLine}
    </section>`;
  }

  function yourTurnRow({ you = R.you, poem = null } = {}) {
    const mine = poem || R.poems.find((p) => p.reader === you).number;
    return `<div class="ljs-yourturn">
      ${character(you, { size: 40, prop: 'note' })}
      <p><strong>You read ${ordinal(mine)}</strong><span>Poem ${mine} stays folded until your turn.</span></p>
    </div>`;
  }

  /* readingOrder({ current, you, readAgain, id }): current = index of the poem whose reader has
     the lamp (0 based); before it "Read", after it "Up next", then ordinals. */
  function readingOrder({ current = 0, you = R.you, readAgain = false, id = uid('order'), statuses = {} } = {}) {
    const rows = R.poems
      .map((p, i) => {
        let status = i < current ? 'read' : i === current ? 'now' : i === current + 1 ? 'next' : 'pos';
        if (statuses[p.number]) status = statuses[p.number];
        const text = status === 'pos' ? ordinal(i + 1) : null;
        const pl = person(p.reader);
        const again = readAgain && status === 'read' ? button({ label: 'Read again', variant: 'quiet', size: 'sm', attrs: `data-ljs-read-again="${p.number}"` }) : '';
        return `<li class="ljs-row ljs-row--order${status === 'now' ? ' is-now' : ''}" data-poem="${p.number}">
          ${character(pl, { size: 40, lamp: status === 'now' ? true : 'off' })}
          <span class="ljs-row__who"><span class="ljs-row__name">${esc(pl.name)}${pl.id === you ? ' <span class="ljs-you">(you)</span>' : ''}</span><span class="ljs-row__note">Poem ${p.number}</span></span>
          <span class="ljs-row__end${again ? ' ljs-row__end--stack' : ''}">${statusChip(status, text)}${again}</span>
        </li>`;
      })
      .join('');
    return `<section class="ljs-order" aria-labelledby="${id}">
      ${sectionHead({ title: 'Reading order', id })}
      <ol class="ljs-roster">${rows}</ol>
    </section>`;
  }

  /* ---------- poems ---------- */
  function favoriteToggle({ pressed = false, poem = 1, compact = false } = {}) {
    return `<button type="button" class="ljs-fav${compact ? ' ljs-fav--icon' : ''}" data-ljs="fav" aria-pressed="${pressed}" aria-label="Favorite Poem ${poem}">${icon(
      'heart',
      18
    )}${compact ? '' : '<span>Favorite</span>'}</button>`;
  }

  function authorsOf(p) {
    const order = [];
    p.lines.forEach(([, by]) => {
      if (!order.includes(by)) order.push(by);
    });
    return order;
  }

  function poemLines(poemRef, { size = 'lg', label = null, highlight = null } = {}) {
    const p = poemOf(poemRef);
    return `<ol class="ljs-poem ljs-poem--${size}" aria-label="${esc(label || `Poem ${p.number}`)}"${highlight ? ` data-highlight="${highlight}"` : ''}>${p.lines
      .map(([text, by]) => `<li data-by="${by}"${highlight === by ? ' class="is-hit"' : ''}><span>${esc(text)}</span></li>`)
      .join('')}</ol>`;
  }

  function linesByKey(poemRef, { highlight = null, you = R.you } = {}) {
    const p = poemOf(poemRef);
    const chips = authorsOf(p)
      .map((id) => {
        const pl = person(id);
        return `<button type="button" class="ljs-keychip" data-ljs="key" data-by="${id}" aria-pressed="${highlight === id}">${character(pl, { size: 28, edge: true })}<span>${esc(first(pl))}${id === you ? ' (you)' : ''}</span></button>`;
      })
      .join('');
    return `<div class="ljs-key" role="group" aria-label="Lines by">
      <p class="ljs-key__label"><strong>Lines by</strong> <span>Tap a name to see their lines.</span></p>
      <div class="ljs-key__chips">${chips}</div>
    </div>`;
  }

  /* poemSheet({ poem, mode, byline, favorite, key, highlight, closable, id })
     mode: reader (1.5rem, for reading aloud) | listener | archive | public. */
  function poemSheet(opts = {}) {
    const { poem = 1, mode = 'reader', favorite = false, key = true, highlight = null, closable = mode === 'listener', bylineLamp = false, id = uid('poem'), you = R.you } = opts;
    const p = poemOf(poem);
    const reader = person(opts.bylineBy || p.reader);
    const byline = opts.byline !== undefined ? opts.byline : `Read by ${first(reader)}`;
    const size = mode === 'reader' ? 'lg' : 'md';
    return `<article class="ljs-sheetpoem ljs-sheetpoem--${mode}" aria-labelledby="${id}">
      <header class="ljs-sheetpoem__head">
        <div class="ljs-sheetpoem__titles">
          <h1 class="ljs-sheetpoem__title" id="${id}" tabindex="-1">Poem ${p.number}</h1>
          ${byline ? `<p class="ljs-byline${bylineLamp ? ' ljs-byline--lamp' : ''}">${character(reader, bylineLamp ? { size: 36, lamp: true } : { size: 28 })}<span>${esc(byline)}</span></p>` : ''}
        </div>
        <div class="ljs-sheetpoem__tools">
          ${favorite === null ? '' : favoriteToggle({ pressed: favorite, poem: p.number, compact: closable })}
          ${closable ? iconButton({ icon: 'close', label: `Close Poem ${p.number}`, attrs: 'data-ljs-close-poem' }) : ''}
        </div>
      </header>
      <div class="ljs-sheetpoem__body">
        ${poemLines(p, { size, highlight })}
        ${key ? linesByKey(p, { highlight, you }) : ''}
      </div>
    </article>`;
  }

  function poemCard({ poem = 1, favorite = false, byline, bylineBy = null, meta = null, action = '', open = null, level = 2, id = uid('card') } = {}) {
    const p = poemOf(poem);
    const reader = person(bylineBy || p.reader);
    const by = byline !== undefined ? byline : `Read by ${first(reader)}`;
    return `<article class="ljs-card" aria-labelledby="${id}">
      <header class="ljs-card__head">
        <h${level} class="ljs-card__title" id="${id}">${open ? `<button type="button" class="ljs-card__open" ${open}>Poem ${p.number}</button>` : `Poem ${p.number}`}</h${level}>
        ${favorite === null ? '' : favoriteToggle({ pressed: favorite, poem: p.number })}
      </header>
      ${poemLines(p, { size: 'sm' })}
      <footer class="ljs-card__foot"><div class="ljs-card__credits">${by ? `<p class="ljs-byline">${character(reader, { size: 28 })}<span>${esc(by)}</span></p>` : ''}${
        meta ? `<p class="ljs-card__meta">${esc(meta)}</p>` : ''
      }</div>${action}</footer>
    </article>`;
  }

  /* shareBlock({ what: 'poems' | 'poem', state: 'idle' | 'preparing' | 'shared' }) */
  function shareBlock({ what = 'poems', state = 'idle' } = {}) {
    const label = what === 'poems' ? 'Share these poems' : 'Share poem';
    const disclosure = what === 'poems' ? 'Anyone with the link can read them.' : 'Anyone with the link can read this poem.';
    const shared = what === 'poems' ? 'Link copied. Anyone with it can read these poems.' : 'Link copied.';
    if (state === 'shared') {
      return `<div class="ljs-share is-shared" data-ljs-share-block data-what="${what}">
        <p class="ljs-share__done" role="status">${icon('check', 18)}<span>${esc(shared)}</span></p>
        ${button({ label: 'Stop sharing', variant: 'quiet', attrs: 'data-ljs="unshare"' })}
      </div>`;
    }
    return `<div class="ljs-share" data-ljs-share-block data-what="${what}">
      ${button({ label, variant: 'secondary', block: true, icon: 'share', pending: state === 'preparing' ? 'Preparing link…' : null, attrs: 'data-ljs="publish"' })}
      <p class="ljs-share__disclosure">${esc(disclosure)}</p>
    </div>`;
  }

  function emptyState({ cast = 'sprout', title, body = '', action = '', level = 1, id = uid('empty') } = {}) {
    return `<section class="ljs-empty" aria-labelledby="${id}">
      ${character(cast, { size: 96 })}
      <h${level} class="ljs-empty__title" id="${id}">${esc(title)}</h${level}>
      ${body ? `<p class="ljs-empty__body">${esc(body)}</p>` : ''}
      ${action}
    </section>`;
  }

  /* ---------- motion: the four verbs. Each returns a promise; reduced motion ends at once. ---------- */
  const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const EASE_OUT = () => cssVar('--ease-out', 'cubic-bezier(0.25, 1, 0.5, 1)');
  const EASE_FOLD = () => cssVar('--ease-fold', 'cubic-bezier(0.55, 0, 0.35, 1)');
  const DUR = { settle: 240, tuck: 320, unfoldNote: 320, unfoldPoem: 420, lamp: 300, fade: 150 };

  /* Plays keyframes, then applies `end(node)` (the committed end state) before the animation is
     cancelled, so nothing flashes back to its start state between the two. */
  async function run(node, keyframes, options, end = null) {
    if (!node) return;
    if (reduced()) {
      if (end) end(node);
      return;
    }
    const anim = node.animate(keyframes, { fill: 'both', ...options });
    try {
      await anim.finished;
    } catch {
      /* cancelled */
    }
    if (end) end(node);
    anim.cancel();
  }
  const hide = (n) => (n.style.visibility = 'hidden');

  const motion = {
    DUR,
    /* Someone or something arrived. */
    settle(node, { delay = 0 } = {}) {
      return run(node, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], {
        duration: DUR.settle, easing: EASE_OUT(), delay,
      });
    },
    /* Your line is in the poem: the upper half folds down over your line at the crease. The
       action stays solid while the flap starts to move, fades over the fold's last 150 ms and
       stays hidden (visibility) until the stage is replaced. */
    async tuck(noteEl, { action = null } = {}) {
      const top = noteEl.querySelector('.ljs-note__top');
      noteEl.classList.add('is-folding');
      const jobs = [
        run(top, [{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-180deg)' }], { duration: DUR.tuck, easing: EASE_FOLD() }, () => {
          noteEl.classList.add('is-folded');
          noteEl.classList.remove('is-folding');
        }),
      ];
      if (action) {
        jobs.push(run(action, [{ opacity: 1 }, { opacity: 0 }], { duration: DUR.fade, delay: DUR.tuck - DUR.fade, easing: EASE_OUT() }, hide));
      }
      await Promise.all(jobs);
    },
    /* Something is revealed to you. kind 'note': the folded note opens (the action is hidden
       until it has, then fades in 150 ms); 'poem': the sheet body opens from under its title,
       all lines as one block. */
    async unfold(node, { kind = 'poem', action = null } = {}) {
      if (kind === 'note') {
        const top = node.querySelector('.ljs-note__top');
        if (action) hide(action);
        node.classList.add('is-folding');
        node.classList.remove('is-folded');
        await run(top, [{ transform: 'rotateX(-180deg)' }, { transform: 'rotateX(0deg)' }], { duration: DUR.unfoldNote, easing: EASE_OUT() }, () =>
          node.classList.remove('is-folding')
        );
        if (action) {
          action.style.visibility = '';
          await run(action, [{ opacity: 0 }, { opacity: 1 }], { duration: DUR.fade, easing: EASE_OUT() });
        }
        return;
      }
      return run(
        node,
        [
          { transform: 'rotateX(-90deg)', opacity: 0 },
          { transform: 'rotateX(-38deg)', opacity: 1, offset: 0.45 },
          { transform: 'rotateX(0deg)', opacity: 1 },
        ],
        { duration: DUR.unfoldPoem, easing: EASE_OUT() }
      );
    },
    /* Whose turn: the peach lamp crossfades from one character to another (no travel). */
    async lamp(fromChar, toChar) {
      const a = fromChar && fromChar.querySelector('.ljs-lamp');
      const b = toChar && toChar.querySelector('.ljs-lamp');
      if (b) b.removeAttribute('data-off');
      await Promise.all([
        a && run(a, [{ opacity: 1 }, { opacity: 0 }], { duration: DUR.lamp, easing: EASE_OUT() }, (n) => n.setAttribute('data-off', '')),
        b && run(b, [{ opacity: 0 }, { opacity: 1 }], { duration: DUR.lamp, easing: EASE_OUT() }),
      ]);
    },
    /* A composition leaves (150 ms by default) and stays hidden. */
    fade(node, { duration = DUR.fade } = {}) {
      return run(node, [{ opacity: 1 }, { opacity: 0 }], { duration, easing: EASE_OUT() }, hide);
    },
    /* Hand-off in place: `from` leaves while `to` settles where it was, one 240 ms beat.
       `from` is lifted out of flow (absolute, same box) so both share the spot, then removed. */
    async swap(from, to) {
      const parent = from.offsetParent || from.parentElement;
      const r = from.getBoundingClientRect();
      const pr = parent.getBoundingClientRect();
      Object.assign(from.style, {
        position: 'absolute', left: `${r.left - pr.left}px`, top: `${r.top - pr.top + parent.scrollTop}px`,
        width: `${r.width}px`, margin: '0', pointerEvents: 'none',
      });
      from.setAttribute('aria-hidden', 'true');
      from.after(to);
      await Promise.all([
        run(from, [{ opacity: 1 }, { opacity: 0 }], { duration: DUR.settle, easing: EASE_OUT() }, hide),
        motion.settle(to),
      ]);
      from.remove();
    },
  };

  /* The whole line-accepted sequence: pending label (solid button, label swap only), tuck, then
     at once the folded note fades while the next composition settles in its place (one 240 ms
     beat); focus moves to [data-ljs-ack], the live region announces. */
  async function tuckSequence({ page: pg, stage, noteEl, button: btn, render, pendingMs = 700, announce = 'Tucked into the poem.', onPending = null }) {
    if (isInert(btn)) return;
    const input = noteEl.querySelector('textarea');
    input.readOnly = true;
    pending(btn, 'Tucking in…');
    if (onPending) onPending();
    await wait(pendingMs);
    const action = btn.closest('.ljs-action') || btn;
    await motion.tuck(noteEl, { action });
    const next = el(`<div class="ljs-stage-next">${render()}</div>`);
    const handoff = motion.swap(stage, next);
    const heading = next.querySelector('[data-ljs-ack]') || next.querySelector('h1, h2');
    if (heading) heading.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
    if (pg) pg.say(announce);
    await handoff;
    return next;
  }

  /* ---------- delegated behavior ---------- */
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-ljs]');
    if (!t) return;
    const kind = t.dataset.ljs;
    if (kind === 'appearance') {
      chrome.appearance = APPEARANCE_NEXT[chrome.appearance];
      applyAppearance();
    } else if (kind === 'sound') {
      chrome.muted = !chrome.muted;
      syncChrome();
    } else if (kind === 'menu') {
      openMenu(t);
    } else if (kind === 'invite') {
      openInvite(t);
    } else if (kind === 'dismiss') {
      closeOverlay();
    } else if (kind === 'reload') {
      location.reload();
    } else if (kind === 'copy') {
      const status = t.closest('.ljs-invite').querySelector('[data-ljs-copy-status]');
      const ok = await copyToClipboard(R.codeDisplay);
      setInviteStatus(status, ok ? INVITE_TEXT.copied : INVITE_TEXT['copy-refused'], ok);
    } else if (kind === 'share') {
      const status = t.closest('.ljs-invite').querySelector('[data-ljs-share-status]');
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Join my Linejam room', url: R.joinUrl });
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }
      const ok = await copyToClipboard(R.joinUrl);
      setInviteStatus(status, ok ? INVITE_TEXT['link-copied'] : INVITE_TEXT['share-refused'], ok);
    } else if (kind === 'fav') {
      t.setAttribute('aria-pressed', String(t.getAttribute('aria-pressed') !== 'true'));
    } else if (kind === 'key') {
      const sheet = t.closest('.ljs-sheetpoem');
      const lines = sheet.querySelector('.ljs-poem');
      const on = t.getAttribute('aria-pressed') !== 'true';
      sheet.querySelectorAll('[data-ljs="key"]').forEach((c) => c.setAttribute('aria-pressed', 'false'));
      t.setAttribute('aria-pressed', String(on));
      if (on) lines.dataset.highlight = t.dataset.by;
      else delete lines.dataset.highlight;
      lines.querySelectorAll('li').forEach((li) => li.classList.toggle('is-hit', on && li.dataset.by === t.dataset.by));
    } else if (kind === 'publish') {
      if (isInert(t)) return;
      const block = t.closest('[data-ljs-share-block]');
      pending(t, 'Preparing link…');
      await wait(600);
      const next = el(shareBlock({ what: block.dataset.what, state: 'shared' }));
      block.replaceWith(next);
      next.querySelector('button').focus();
      motion.settle(next);
    } else if (kind === 'unshare') {
      const block = t.closest('[data-ljs-share-block]');
      const next = el(shareBlock({ what: block.dataset.what, state: 'idle' }));
      block.replaceWith(next);
      next.querySelector('button').focus();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay) {
      e.preventDefault();
      closeOverlay();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!overlay || overlay.kind !== 'menu') return;
    if (!overlay.el.contains(e.target) && !overlay.opener.contains(e.target)) closeOverlay({ returnFocus: false });
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (chrome.appearance === 'system') applyAppearance();
  });

  window.LJS = {
    R,
    params,
    screens,
    add,
    has,
    go,
    esc,
    el,
    wait,
    reduced,
    words,
    ordinal,
    first,
    person,
    uid,
    NUMBER_WORDS,
    icon,
    ICON_NAMES: Object.keys(ICON),
    prop,
    PROPS,
    character,
    button,
    pending,
    iconButton,
    wordmark,
    header,
    page,
    sectionHead,
    MENUS,
    menuMarkup,
    menuActions,
    openMenu,
    openInvite,
    closeOverlay,
    sheetMarkup,
    openSheet,
    CONFIRM,
    confirm,
    confirmMarkup,
    NOTICE,
    notice,
    STATUS,
    statusChip,
    rosterRow,
    waitingRoster,
    gathering,
    invitation,
    INVITE_TEXT,
    ROUND_CAPTION,
    roundGlyph,
    countText,
    wordSlots,
    note,
    bindNote,
    waitingHero,
    readingHero,
    yourTurnRow,
    readingOrder,
    favoriteToggle,
    poemLines,
    linesByKey,
    poemSheet,
    poemCard,
    shareBlock,
    emptyState,
    motion,
    tuckSequence,
    syncChrome,
  };
})();
