/* Tucked In: keep slice. The recap for every phone, the poem page and its sharing, the public
   pages a visitor opens from a link, and Your poems. */
(function () {
  'use strict';
  const { R, esc } = LJS;
  const B = LJS.button;
  const TABLE = 'Written at a Linejam table by Juniper, Wren, Basil and Marguerite.';

  /* A button that navigates to another registered state; stays put when it is missing. */
  function goOn(scope, selector, id) {
    const btn = scope.querySelector(selector);
    if (btn) btn.addEventListener('click', () => LJS.go(id));
  }

  /* Play again: pending label first, then the next game. */
  function wireAgain(scope) {
    const again = scope.querySelector('[data-again]');
    if (!again) return;
    again.addEventListener('click', async () => {
      if (again.getAttribute('aria-busy') === 'true') return;
      const restore = LJS.pending(again, 'Starting…');
      await LJS.wait(600);
      if (!LJS.go('20-writing-r1-empty')) restore();
    });
  }

  /* Bring a lower block into view on load (the before captures show these states scrolled). */
  function reveal(node, focusEl) {
    if (focusEl) focusEl.focus({ preventScroll: true });
    node.scrollIntoView({ block: 'center' });
  }

  /* ---------- the recap, as core 52 composes it ---------- */
  function recapBody({ spectator = false, closed = false, share = 'idle' } = {}) {
    const cards = R.poems.map((p) => LJS.poemCard({ poem: p.number, favorite: false })).join('');
    const aside = spectator
      ? `<p class="ljs-byline keep-aside">${LJS.character('pim', { size: 28, outlined: true })}<span>You're in for the next game.</span></p>`
      : '';
    const actions = closed
      ? `${B({ label: 'Start a new room', size: 'lg', block: true, attrs: 'data-new-room' })}
         ${B({ label: 'Your poems', variant: 'secondary', block: true, attrs: 'data-poems' })}`
      : `${B({ label: 'Play again', size: 'lg', block: true, attrs: 'data-again' })}
         ${B({ label: 'Back to lobby', variant: 'secondary', block: true, attrs: 'data-lobby' })}`;
    const shareHtml = spectator || closed ? '' : LJS.shareBlock({ what: 'poems', state: share });
    const links = closed
      ? ''
      : `<nav class="core-recap__links" aria-label="Leave the recap">
          ${B({ label: 'Your poems', variant: 'secondary', block: true, attrs: 'data-poems' })}
          ${B({ label: 'Exit room', variant: 'quiet', attrs: 'data-exit' })}
        </nav>`;
    return `
      <header class="core-recap__head">
        <h1 class="ljs-title" tabindex="-1">All four poems, read aloud.</h1>
        <p class="ljs-secondary">4 poems · 4 poets · Room ${R.codeDisplay}</p>
        ${aside}
      </header>
      <div class="core-recap__actions">${actions}</div>
      <section class="core-recap__poems" aria-label="Poems">${cards}</section>
      ${shareHtml}
      ${links}`;
  }

  function renderRecap(root, opts = {}) {
    const { menu = 'lobbyHost', lobby = '13-lobby-host-ready', poems = '63-archive-populated', closed = false } = opts;
    const pg = LJS.page(root, {
      header: { left: 'wordmark', menu: closed ? 'more' : menu },
      notices: closed ? ['roomClosedGuest'] : [],
      mainClass: 'core-recap keep-recap',
      body: recapBody(opts),
    });
    wireAgain(pg.main);
    goOn(pg.main, '[data-lobby]', lobby);
    goOn(pg.main, '[data-poems]', poems);
    goOn(pg.main, '[data-exit]', '01-entry-home');
    goOn(pg.main, '[data-new-room]', '04-host-entry-empty');
    return pg;
  }

  LJS.add({
    id: '54-recap-guest',
    label: 'Recap, all poems read (Wren)',
    group: 'recap',
    render(root) {
      renderRecap(root, { menu: 'lobbyGuest', lobby: '12-lobby-guest' });
    },
  });

  LJS.add({
    id: '55-recap-spectator',
    label: 'Recap, joined late (Pim)',
    group: 'recap',
    render(root) {
      renderRecap(root, { menu: 'lobbyGuest', lobby: '12-lobby-guest', poems: '64-archive-empty', spectator: true });
    },
  });

  LJS.add({
    id: '56-recap-shared-feedback',
    label: 'Recap, after Share these poems (host)',
    group: 'recap',
    render(root) {
      const show = () => {
        const pg = renderRecap(root, { share: 'shared' });
        const block = pg.main.querySelector('[data-ljs-share-block]');
        reveal(block, block.querySelector('button'));
      };
      show();
      window.__replay = () => {
        LJS.closeOverlay({ returnFocus: false });
        window.scrollTo(0, 0);
        show();
      };
    },
  });

  LJS.add({
    id: '74-after-close-room-guest',
    label: 'Recap after the host closed the room (Wren)',
    group: 'recap',
    render(root) {
      renderRecap(root, { closed: true });
    },
  });

  /* ---------- x-recap-arrival: the last reader finishes, then the recap settles in ---------- */
  let arrivalRun = 0;

  async function playArrival(root) {
    const run = ++arrivalRun;
    const live = () => run === arrivalRun;
    const pg = LJS.page(root, {
      header: { left: 'code', menu: 'game' },
      mainClass: 'core-reading',
      body: `<div class="core-page">${LJS.poemSheet({ poem: 4, mode: 'reader', favorite: false })}</div>
        <div class="ljs-action">${B({ label: 'Done reading', size: 'lg', block: true, attrs: 'data-done' })}</div>`,
    });
    const done = pg.main.querySelector('[data-done]');
    await LJS.wait(900);
    if (!live()) return;
    done.focus({ preventScroll: true });
    LJS.pending(done, 'Finishing…');
    await LJS.wait(600);
    if (!live()) return;

    pg.main.innerHTML = `<div class="core-after keep-after">${LJS.readingHero({ mode: 'after', poem: 4, reader: 'juniper' })}</div>`;
    pg.main.querySelector('h1').focus({ preventScroll: true });
    window.scrollTo(0, 0);
    pg.say('Nicely read.');
    await LJS.motion.settle(pg.main);
    await LJS.wait(1200);
    if (!live()) return;
    await LJS.motion.fade(pg.main);
    if (!live()) return;

    const recap = renderRecap(root, {});
    const head = recap.main.querySelector('.core-recap__head');
    const rest = [...recap.main.children].filter((n) => n !== head);
    head.querySelector('h1').focus({ preventScroll: true });
    window.scrollTo(0, 0);
    recap.say('All four poems, read aloud.');
    await Promise.all([LJS.motion.settle(head), ...rest.map((n) => LJS.motion.settle(n, { delay: 180 }))]);
  }

  LJS.add({
    id: 'x-recap-arrival',
    label: 'The game ends: last Done reading, then the recap (Juniper)',
    group: 'recap',
    render(root) {
      playArrival(root);
      window.__replay = () => {
        LJS.closeOverlay({ returnFocus: false });
        window.scrollTo(0, 0);
        playArrival(root);
      };
    },
  });

  /* ---------- poem page (participant) ---------- */
  function saveImage(n) {
    const p = R.poems.find((x) => x.number === n);
    const font = getComputedStyle(document.body).fontFamily;
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--avatar-ink').trim() || '#39234e';
    const W = 1080;
    const pad = 104;
    const lh = 76;
    const H = pad + 90 + p.lines.length * lh + 140;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    g.fillStyle = ink;
    g.font = `700 56px ${font}`;
    g.fillText(`Poem ${p.number}`, pad, pad + 40);
    g.font = `400 48px ${font}`;
    p.lines.forEach(([text], i) => g.fillText(text, pad, pad + 150 + i * lh));
    g.font = `600 34px ${getComputedStyle(document.documentElement).getPropertyValue('--font-dynapuff') || font}`;
    g.fillText('Linejam', pad, H - 72);
    const a = document.createElement('a');
    a.download = `linejam-poem-${p.number}.png`;
    a.href = c.toDataURL('image/png');
    a.click();
  }

  function renderPoemPage(root, { share = 'idle' } = {}) {
    const pg = LJS.page(root, {
      header: { left: 'wordmark', menu: 'more' },
      mainClass: 'keep-poem',
      body: `
        <nav class="keep-back" aria-label="Back">${B({ label: 'Your poems', variant: 'quiet', icon: 'back', attrs: 'data-back' })}</nav>
        ${LJS.poemSheet({ poem: 1, mode: 'archive', favorite: false })}
        <div class="keep-tools">
          ${B({ label: 'Save image', variant: 'secondary', block: true, attrs: 'data-save' })}
          ${LJS.shareBlock({ what: 'poem', state: share })}
          ${B({ label: 'Print', variant: 'quiet', attrs: 'data-print' })}
        </div>`,
    });
    goOn(pg.main, '[data-back]', '63-archive-populated');
    pg.main.querySelector('[data-save]').addEventListener('click', () => saveImage(1));
    pg.main.querySelector('[data-print]').addEventListener('click', () => window.print());
    return pg;
  }

  LJS.add({
    id: '59-poem-detail-participant',
    label: 'Poem page, Poem 1 (Juniper)',
    group: 'keep',
    render(root) {
      renderPoemPage(root);
    },
  });

  function sharedPoemState(root, state) {
    const pg = renderPoemPage(root, { share: state });
    const block = pg.main.querySelector('[data-ljs-share-block]');
    reveal(block, block.querySelector('button'));
  }

  LJS.add({
    id: '60-poem-detail-shared',
    label: 'Poem page, after Share poem (Juniper)',
    group: 'keep',
    render(root) {
      sharedPoemState(root, 'shared');
      window.__replay = () => {
        LJS.closeOverlay({ returnFocus: false });
        window.scrollTo(0, 0);
        sharedPoemState(root, 'shared');
      };
    },
  });

  LJS.add({
    id: 'x-share-preparing',
    label: 'Poem page, Share poem preparing the link (Juniper)',
    group: 'keep',
    render(root) {
      sharedPoemState(root, 'preparing');
      window.__replay = () => {
        LJS.closeOverlay({ returnFocus: false });
        window.scrollTo(0, 0);
        sharedPoemState(root, 'preparing');
      };
    },
  });

  /* ---------- public pages (a visitor with no account) ---------- */
  function invitation() {
    return `<div class="ljs-action keep-invite">
      <h2 class="ljs-h2" id="keep-invite-h">Write one with your friends</h2>
      ${B({ label: 'Start a game', size: 'lg', block: true, attrs: 'data-start' })}
      ${B({ label: 'Join a room', variant: 'secondary', block: true, attrs: 'data-join' })}
    </div>`;
  }

  function renderPublic(root, body) {
    const pg = LJS.page(root, { header: { left: 'wordmark', menu: 'more' }, mainClass: 'keep-public', body: `${body}${invitation()}` });
    goOn(pg.main, '[data-start]', '04-host-entry-empty');
    goOn(pg.main, '[data-join]', '09-join-empty');
    return pg;
  }

  LJS.add({
    id: '61-public-poem-page',
    label: 'Public poem page (visitor)',
    group: 'keep',
    render(root) {
      renderPublic(
        root,
        `<div class="keep-public__poem">
          ${LJS.poemSheet({ poem: 1, mode: 'public', favorite: null, byline: null, you: null })}
          <p class="ljs-secondary keep-table">${esc(TABLE)}</p>
        </div>`
      );
    },
  });

  LJS.add({
    id: '57-public-recap-page',
    label: 'Public recap page (visitor)',
    group: 'keep',
    render(root) {
      const cards = R.poems.map((p) => LJS.poemCard({ poem: p.number, favorite: null })).join('');
      renderPublic(
        root,
        `<header class="keep-head">
          <h1 class="ljs-title">Four poems from a Linejam table</h1>
          <p class="ljs-secondary">${esc(TABLE)}</p>
        </header>
        <section class="keep-cards" aria-label="Poems">${cards}</section>`
      );
    },
  });

  /* ---------- Your poems ---------- */
  const FAVORITES = [2];

  LJS.add({
    id: '63-archive-populated',
    label: 'Your poems, after one game (Juniper)',
    group: 'keep',
    render(root) {
      const order = [...R.poems].sort((a, b) => FAVORITES.includes(b.number) - FAVORITES.includes(a.number));
      const written = R.poems.reduce((n, p) => n + p.lines.filter(([, by]) => by === R.you).length, 0);
      const meta = (favs) => `${R.poems.length} poems · ${favs} ${favs === 1 ? 'favorite' : 'favorites'} · ${written} lines written`;
      const cards = order
        .map((p) =>
          LJS.poemCard({
            poem: p.number,
            favorite: FAVORITES.includes(p.number),
            byline: `Read by ${LJS.first(p.reader)} · Sep 26`,
            open: `data-open="${p.number}"`,
            action: B({ label: 'Open poem', variant: 'quiet', attrs: `data-open="${p.number}" aria-label="Open Poem ${p.number}"` }),
          })
        )
        .join('');
      const pg = LJS.page(root, {
        header: { left: 'wordmark', menu: 'more' },
        mainClass: 'keep-archive',
        body: `
          <header class="keep-head">
            <h1 class="ljs-title">Your poems</h1>
            <p class="ljs-secondary" data-archive-meta>${meta(FAVORITES.length)}</p>
            <p class="ljs-secondary">These poems live in this browser.</p>
          </header>
          <section class="keep-cards" aria-label="Poems">${cards}</section>`,
      });
      /* Favorites are personal: the count follows your hearts; the order holds until you come back. */
      pg.main.addEventListener('click', (e) => {
        const fav = e.target.closest('[data-ljs="fav"]');
        if (fav) {
          setTimeout(() => {
            const n = pg.main.querySelectorAll('[data-ljs="fav"][aria-pressed="true"]').length;
            pg.main.querySelector('[data-archive-meta]').textContent = meta(n);
          });
          return;
        }
        if (e.target.closest('[data-open]')) LJS.go('59-poem-detail-participant');
      });
    },
  });

  LJS.add({
    id: '64-archive-empty',
    label: 'Your poems, empty (new guest)',
    group: 'keep',
    render(root) {
      const pg = LJS.page(root, {
        header: { left: 'wordmark', menu: 'more' },
        mainClass: 'keep-archive keep-archive--empty',
        body: `
          <header class="keep-head"><h1 class="ljs-title">Your poems</h1></header>
          ${LJS.emptyState({ title: 'Your first poem starts with friends.', body: 'Every poem you help write lands here.', level: 2 })}
          <div class="ljs-action">
            ${B({ label: 'Start a game', size: 'lg', block: true, attrs: 'data-start' })}
            ${B({ label: 'Join a room', variant: 'secondary', block: true, attrs: 'data-join' })}
          </div>`,
      });
      goOn(pg.main, '[data-start]', '04-host-entry-empty');
      goOn(pg.main, '[data-join]', '09-join-empty');
    },
  });
})();
