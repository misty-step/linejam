/* Tucked In: core screens (lead). The reference compositions every slice follows. */
(function () {
  'use strict';
  const { R, esc } = LJS;
  const FIVE = 'and nobody asked the moon';

  /* ---------- 13 lobby, host ready ---------- */
  LJS.add({
    id: '13-lobby-host-ready',
    label: 'Lobby, host ready (Juniper, 4 players)',
    group: 'lobby',
    render(root) {
      const pg = LJS.page(root, {
        header: { left: 'wordmark', menu: 'lobbyHost' },
        mainClass: 'core-lobby',
        body: `
          <h1 class="sr-only">Room ${R.codeDisplay}</h1>
          ${LJS.invitation()}
          <section class="core-players" aria-labelledby="players-h">
            ${LJS.sectionHead({ title: 'Players', count: `${R.players.length} of ${R.capacity}`, id: 'players-h' })}
            ${LJS.gathering(R.players, { you: R.you })}
          </section>
          <div class="ljs-action">${LJS.button({ label: 'Start game', size: 'lg', block: true, attrs: 'data-start' })}</div>`,
      });
      const start = pg.main.querySelector('[data-start]');
      start.addEventListener('click', async () => {
        if (start.getAttribute('aria-busy') === 'true') return;
        const restore = LJS.pending(start, 'Starting…');
        await LJS.wait(600);
        if (!LJS.go('20-writing-r1-empty')) restore();
      });
    },
  });

  /* ---------- 31 writing, round 5 (interactive tuck) and 24 waiting ---------- */
  function waitingComposition(line) {
    return `${LJS.waitingHero({ line, round: 5 })}
      ${LJS.waitingRoster()}`;
  }

  function renderWriting(root, { value = 'and nobody asked', focus = false } = {}) {
    const pg = LJS.page(root, {
      header: { left: 'code', menu: 'game' },
      mainClass: 'core-writing',
      body: `
        <h1 class="sr-only">Round 5 of 9. Write your line.</h1>
        ${LJS.roundGlyph(5)}
        <div class="core-stage" data-stage>
          ${LJS.note({ round: 5, value, id: 'line' })}
          <div class="ljs-action core-stage__action">${LJS.button({ label: 'Tuck it in', size: 'lg', block: true, attrs: 'data-tuck' })}</div>
        </div>`,
    });
    const stage = pg.main.querySelector('[data-stage]');
    const noteEl = stage.querySelector('.ljs-note');
    const btn = stage.querySelector('[data-tuck]');
    const { input } = LJS.bindNote(noteEl, { button: btn });
    btn.addEventListener('click', () => {
      LJS.tuckSequence({ page: pg, stage, noteEl, button: btn, render: () => waitingComposition(input.value.trim()) });
    });
    if (focus) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    return pg;
  }

  LJS.add({
    id: '31-writing-r5-under-count',
    label: 'Writing, round 5, under count (tuck it in)',
    group: 'writing',
    render(root) {
      renderWriting(root);
      /* Recording hook: back to the ready state (five words typed), nothing plays until Tuck it in. */
      window.__replay = () => {
        LJS.closeOverlay({ returnFocus: false });
        window.scrollTo(0, 0);
        renderWriting(root, { value: FIVE, focus: true });
      };
    },
  });

  LJS.add({
    id: '24-waiting-ack-roster',
    label: 'Waiting, acknowledged with roster',
    group: 'waiting',
    render(root) {
      LJS.page(root, {
        header: { left: 'code', menu: 'game' },
        mainClass: 'core-writing',
        body: `${LJS.roundGlyph(5)}<div class="ljs-stage-next">${waitingComposition(FIVE)}</div>`,
      });
    },
  });

  /* ---------- 38 listener ---------- */
  function listenBody() {
    return `<div class="core-listen">${LJS.readingHero({ mode: 'listener', poem: 1 })}</div>
      ${LJS.yourTurnRow()}
      ${LJS.readingOrder({ current: 0 })}`;
  }

  function renderListener(root) {
    const pg = LJS.page(root, { header: { left: 'code', menu: 'game' }, mainClass: 'core-reading', body: listenBody() });
    function wireListen() {
      const follow = pg.main.querySelector('[data-ljs-follow]');
      follow.addEventListener('click', async () => {
        pg.main.innerHTML = `<div class="core-page">${LJS.poemSheet({ poem: 1, mode: 'listener', favorite: false, bylineLamp: true })}</div>`;
        const sheet = pg.main.querySelector('.ljs-sheetpoem');
        sheet.querySelector('h1').focus({ preventScroll: true });
        window.scrollTo(0, 0);
        pg.say('Poem 1 is open.');
        sheet.querySelector('[data-ljs-close-poem]').addEventListener('click', () => {
          pg.main.innerHTML = listenBody();
          wireListen();
          pg.main.querySelector('[data-ljs-follow]').focus();
        });
        await LJS.motion.unfold(sheet.querySelector('.ljs-sheetpoem__body'), { kind: 'poem' });
      });
    }
    wireListen();
  }

  LJS.add({
    id: '38-reveal-reading-circle-host-reader',
    label: 'Reading, listener (Juniper; Marguerite reads Poem 1)',
    group: 'reveal',
    render: renderListener,
  });

  /* ---------- 39 reader's turn -> 42 reader's page -> Nicely read ---------- */
  const READER = 'marguerite';

  function readerPageBody() {
    return `<div class="core-page">${LJS.poemSheet({ poem: 1, mode: 'reader', favorite: false, you: READER })}</div>
      <div class="ljs-action">${LJS.button({ label: 'Done reading', size: 'lg', block: true, attrs: 'data-done' })}</div>`;
  }

  function wireReaderPage(pg) {
    const done = pg.main.querySelector('[data-done]');
    done.addEventListener('click', async () => {
      if (done.getAttribute('aria-busy') === 'true') return;
      LJS.pending(done, 'Finishing…');
      await LJS.wait(600);
      pg.main.innerHTML = `<div class="core-after">${LJS.readingHero({ mode: 'after', poem: 1, reader: READER, next: 'basil' })}</div>
        ${LJS.readingOrder({ current: 1, you: READER, readAgain: true })}`;
      const hero = pg.main.querySelector('.ljs-hero');
      hero.querySelector('h1').focus({ preventScroll: true });
      window.scrollTo(0, 0);
      pg.say('Nicely read. Basil reads next.');
      await LJS.motion.settle(pg.main);
      const chars = hero.querySelectorAll('.ljs-char--lamp');
      await LJS.motion.lamp(chars[0], chars[1]);
    });
  }

  function renderReaderTurn(root) {
    const pg = LJS.page(root, {
      header: { left: 'code', menu: 'gameGuest' },
      mainClass: 'core-reading core-turn',
      body: `<div class="core-turn__hero">${LJS.readingHero({ mode: 'reader', poem: 1, reader: READER })}</div>
        <div class="ljs-action">${LJS.button({ label: 'Read Poem 1', size: 'lg', block: true, attrs: 'data-read' })}</div>`,
    });
    const read = pg.main.querySelector('[data-read]');
    read.addEventListener('click', async () => {
      if (read.getAttribute('aria-busy') === 'true') return;
      LJS.pending(read, 'Opening…');
      await LJS.wait(600);
      pg.main.classList.remove('core-turn');
      pg.main.innerHTML = readerPageBody();
      const sheet = pg.main.querySelector('.ljs-sheetpoem');
      sheet.querySelector('h1').focus({ preventScroll: true });
      window.scrollTo(0, 0);
      pg.say('Poem 1 is open.');
      wireReaderPage(pg);
      await Promise.all([
        LJS.motion.unfold(sheet.querySelector('.ljs-sheetpoem__body'), { kind: 'poem' }),
        LJS.motion.settle(pg.main.querySelector('.ljs-action')),
      ]);
    });
    return pg;
  }

  LJS.add({
    id: '39-reveal-reading-now-reader',
    label: "Reading, reader's turn (Marguerite)",
    group: 'reveal',
    render(root) {
      renderReaderTurn(root);
      window.__replay = () => {
        LJS.closeOverlay({ returnFocus: false });
        window.scrollTo(0, 0);
        renderReaderTurn(root);
      };
    },
  });

  LJS.add({
    id: '42-poem-reading-reader',
    label: "Reader's page (Marguerite reads Poem 1)",
    group: 'poem',
    render(root) {
      const pg = LJS.page(root, { header: { left: 'code', menu: 'gameGuest' }, mainClass: 'core-reading', body: readerPageBody() });
      wireReaderPage(pg);
    },
  });

  /* ---------- 52 recap ---------- */
  LJS.add({
    id: '52-recap-session-complete-host',
    label: 'Recap, all poems read (host)',
    group: 'recap',
    render(root) {
      const cards = R.poems.map((p) => LJS.poemCard({ poem: p.number, favorite: false })).join('');
      const pg = LJS.page(root, {
        header: { left: 'wordmark', menu: 'lobbyHost' },
        mainClass: 'core-recap',
        body: `
          <header class="core-recap__head">
            <h1 class="ljs-title">All four poems, read aloud.</h1>
            <p class="ljs-secondary">4 poems · 4 poets · Room ${R.codeDisplay}</p>
          </header>
          <div class="core-recap__actions">
            ${LJS.button({ label: 'Play again', size: 'lg', block: true, attrs: 'data-again' })}
            ${LJS.button({ label: 'Back to lobby', variant: 'secondary', block: true, attrs: 'data-lobby' })}
          </div>
          <section class="core-recap__poems" aria-label="Poems">${cards}</section>
          ${LJS.shareBlock({ what: 'poems' })}
          <nav class="core-recap__links" aria-label="Leave the recap">
            ${LJS.button({ label: 'Your poems', variant: 'secondary', block: true, attrs: 'data-poems' })}
            ${LJS.button({ label: 'Exit room', variant: 'quiet', attrs: 'data-exit' })}
          </nav>`,
      });
      const again = pg.main.querySelector('[data-again]');
      again.addEventListener('click', async () => {
        if (again.getAttribute('aria-busy') === 'true') return;
        const restore = LJS.pending(again, 'Starting…');
        await LJS.wait(600);
        if (!LJS.go('20-writing-r1-empty')) restore();
      });
      pg.main.querySelector('[data-lobby]').addEventListener('click', () => LJS.go('13-lobby-host-ready'));
      pg.main.querySelector('[data-poems]').addEventListener('click', () => LJS.go('63-archive-populated'));
      pg.main.querySelector('[data-exit]').addEventListener('click', () => LJS.go('01-entry-home'));
    },
  });

  /* ---------- x-components: every component and state, labeled ---------- */
  function spec(label, html, { cls = '' } = {}) {
    return `<figure class="core-spec ${cls}"><figcaption>${esc(label)}</figcaption><div class="core-spec__body">${html}</div></figure>`;
  }
  function group(title, items, { id } = {}) {
    return `<section class="core-group" aria-labelledby="${id}"><h2 class="core-group__title" id="${id}">${esc(title)}</h2>${items.join('')}</section>`;
  }

  LJS.add({
    id: 'x-components',
    label: 'Components (the slice reference)',
    group: 'components',
    render(root) {
      const B = LJS.button;
      const castGrid = LJ.CAST_IDS.map(
        (id) => `<li class="core-castpick"><button type="button" class="core-castpick__btn" aria-pressed="${id === 'orbit'}">${LJS.character(id, { size: 56 })}<span>${LJ.CAST_NAMES[id]}</span></button></li>`
      ).join('');
      const propWords = { crown: 'Host', pencil: 'Writing', note: 'Tucked in', moon: 'Away', book: 'Reading' };
      const sections = [
        group('Buttons', [
          spec('Primary (the one violet action)', B({ label: 'Start game', size: 'lg', block: true })),
          spec('Secondary', B({ label: 'Back to lobby', variant: 'secondary', block: true })),
          spec('Secondary with icon', B({ label: 'Share invite', variant: 'secondary', block: true, icon: 'share' })),
          spec('Quiet', B({ label: 'Follow along', variant: 'quiet' })),
          spec('Danger (confirmation action)', B({ label: 'Close room', variant: 'danger', block: true })),
          spec('Pending (label only, keeps its color)', B({ label: 'Tuck it in', size: 'lg', block: true, pending: 'Tucking in…' })),
          spec('Disabled', B({ label: 'Tuck it in', size: 'lg', block: true, disabled: true })),
          spec('Icon buttons (44 px, ghost)', `<div class="core-row">${LJS.iconButton({ icon: 'more', label: 'Room options' })}${LJS.iconButton({ icon: 'close', label: 'Close' })}${LJS.iconButton({ icon: 'user', label: 'Sign in' })}</div>`),
        ], { id: 'g-buttons' }),
        group('Header', [
          spec('Home: wordmark, Sign in, appearance, sound, More options', `<div class="core-frame">${LJS.header({ left: 'wordmark', menu: 'more', signIn: true })}</div>`),
          spec('Lobby host: wordmark, Room options', `<div class="core-frame">${LJS.header({ left: 'wordmark', menu: 'lobbyHost' })}</div>`),
          spec('In game: room code chip (opens the compact invitation)', `<div class="core-frame">${LJS.header({ left: 'code', menu: 'game' })}</div>`),
        ], { id: 'g-header' }),
        group('Anchored menus (open)', [
          spec('Room options, host in lobby', LJS.menuMarkup('lobbyHost', { static: true }), { cls: 'core-spec--menu' }),
          spec('Room options, guest', LJS.menuMarkup('lobbyGuest', { static: true }), { cls: 'core-spec--menu' }),
          spec('Room options, host in game', LJS.menuMarkup('game', { static: true }), { cls: 'core-spec--menu' }),
          spec('More options, outside a room', LJS.menuMarkup('more', { static: true }), { cls: 'core-spec--menu' }),
        ], { id: 'g-menus' }),
        group('Bottom sheets', [
          spec('Sheet (open): Choose your character', LJS.sheetMarkup({ title: 'Choose your character', body: `<ul class="core-castgrid">${castGrid}</ul>`, static: true })),
          spec('Confirmation: close room', LJS.confirmMarkup('close')),
          spec('Confirmation: leave room', LJS.confirmMarkup('leave')),
          spec('Confirmation: end game', LJS.confirmMarkup('end')),
          spec('Confirmation pending', LJS.confirmMarkup('close', { state: 'pending' })),
          spec('Confirmation error', LJS.confirmMarkup('end', { state: 'error' })),
          spec('Live: open a real sheet (traps focus, Escape closes)', `<div class="core-row">${B({ label: 'Open close-room sheet', variant: 'secondary', attrs: 'data-demo-confirm' })}</div>`),
        ], { id: 'g-sheets' }),
        group('Notices (inline, under the header)', Object.entries(LJS.NOTICE).map(([k, n]) => spec(`${n.tone}: ${k}`, LJS.notice(n))), { id: 'g-notices' }),
        group('Characters', [
          spec('Sizes 28, 40, 64, 96, 128 with sticker edge', `<div class="core-row core-row--end">${[28, 40, 64, 96, 128].map((s) => LJS.character('orbit', { size: s })).join('')}</div>`),
          spec('Sticker edge off, then on (96 px)', `<div class="core-row">${LJS.character('moss', { size: 96, edge: false })}${LJS.character('moss', { size: 96 })}</div>`),
          spec('The cast at 40 px', `<div class="core-row">${LJ.CAST_IDS.map((id) => LJS.character(id, { size: 40 })).join('')}</div>`),
          spec('Props beside their words (64 px)', `<ul class="core-props">${LJS.PROPS.map((p) => `<li>${LJS.character(p === 'crown' ? 'juniper' : p === 'book' ? 'marguerite' : p === 'moon' ? 'marguerite' : p === 'pencil' ? 'basil' : 'wren', { size: 64, prop: p })}<span>${propWords[p]}</span></li>`).join('')}</ul>`),
          spec('Props at roster size (40 px)', `<div class="core-row">${LJS.PROPS.map((p) => LJS.character('pebble', { size: 40, prop: p })).join('')}</div>`),
          spec('Outlined spectator (Pim), 40 and 64 px', `<div class="core-row core-row--end">${LJS.character('pim', { size: 40, outlined: true })}${LJS.character('pim', { size: 64, outlined: true })}</div>`),
          spec('Reading lamp: peach disc behind the reader (64, 120 px)', `<div class="core-row core-row--end">${LJS.character('marguerite', { size: 64, lamp: true })}${LJS.character('marguerite', { size: 120, lamp: true, prop: 'book' })}</div>`),
          spec('Lamp crossfade (tap to play)', `<div class="core-row" data-demo-lamp-row>${LJS.character('marguerite', { size: 64, lamp: true })}${LJS.character('basil', { size: 64, lamp: 'off' })}</div>${B({ label: 'Play lamp', variant: 'quiet', attrs: 'data-demo-lamp' })}`),
        ], { id: 'g-cast' }),
        group('Lobby gathering', [spec('Players, host with crown and the word Host', LJS.gathering(R.players, { you: R.you }))], { id: 'g-gather' }),
        group('Invitation card', [
          spec('Idle', LJS.invitation()),
          spec('Copied', LJS.invitation({ state: 'copied' })),
          spec('Copy refused', LJS.invitation({ state: 'copy-refused' })),
          spec('Link copied', LJS.invitation({ state: 'link-copied' })),
          spec('Share refused', LJS.invitation({ state: 'share-refused' })),
          spec('Compact, in game (header chip popover)', LJS.invitation({ compact: true, inGame: true })),
        ], { id: 'g-invite' }),
        group('Round glyph', [1, 5, 9].map((r) => spec(`Round ${r}`, LJS.roundGlyph(r))), { id: 'g-round' }),
        group('Note', [
          spec('Fresh, round 1', LJS.note({ round: 1 })),
          spec('Received, round 5, under count', LJS.note({ round: 5, value: 'and nobody asked' })),
          spec('Ready, round 5', LJS.note({ round: 5, value: FIVE })),
          spec('Draft restored, round 3', LJS.note({ round: 3, value: 'pockets full of', draft: true })),
          spec('Over count, round 1', LJS.note({ round: 1, value: 'Lanterns glowing' })),
          spec('Pending, read only', `${LJS.note({ round: 5, value: FIVE, readonly: true })}<div class="core-gap">${B({ label: 'Tuck it in', size: 'lg', block: true, pending: 'Tucking in…' })}</div>`),
          spec('Folded (after the tuck)', LJS.note({ round: 5, value: FIVE, folded: true })),
          spec('Tuck and unfold (tap to play)', `<div data-demo-note>${LJS.note({ round: 2, value: 'hum softly' })}</div><div class="core-row">${B({ label: 'Play tuck', variant: 'quiet', attrs: 'data-demo-tuck' })}${B({ label: 'Play unfold', variant: 'quiet', attrs: 'data-demo-unfold' })}</div>`),
        ], { id: 'g-note' }),
        group('Waiting', [
          spec('Waiting hero', LJS.waitingHero({ line: FIVE })),
          spec('Roster rows: Tucked in, Writing, Away, Watching', LJS.waitingRoster()),
        ], { id: 'g-waiting' }),
        group('Reading heroes', [
          spec('Listener', LJS.readingHero({ mode: 'listener', poem: 1 })),
          spec('Reader', LJS.readingHero({ mode: 'reader', poem: 1 })),
          spec('Fallback (Basil away)', `${LJS.readingHero({ mode: 'fallback', poem: 2 })}<div class="core-gap">${B({ label: 'Step in and read', size: 'lg', block: true })}</div>`),
          spec('Spectator', LJS.readingHero({ mode: 'spectator', poem: 1, follow: false })),
          spec('After reading (lamp moved)', LJS.readingHero({ mode: 'after', poem: 1, lampMoved: true })),
          spec('Your turn, quiet row', LJS.yourTurnRow()),
          spec('Reading order, Poem 1 being read', LJS.readingOrder({ current: 0 })),
          spec('Reading order, Poem 3, with Read again', LJS.readingOrder({ current: 2, readAgain: true })),
        ], { id: 'g-reading' }),
        group('Poems', [
          spec('Poem sheet, reader, Lines by key with Wren highlighted', LJS.poemSheet({ poem: 1, mode: 'reader', favorite: true, highlight: 'wren' })),
          spec('Poem sheet, listener (closable)', LJS.poemSheet({ poem: 2, mode: 'listener' })),
          spec('Poem card (recap)', LJS.poemCard({ poem: 3 })),
          spec('Poem card (archive, with meta)', LJS.poemCard({ poem: 4, favorite: true, meta: 'Room 9A UK' })),
          spec('Share: idle', LJS.shareBlock({ what: 'poems' })),
          spec('Share: preparing', LJS.shareBlock({ what: 'poems', state: 'preparing' })),
          spec('Share: shared', LJS.shareBlock({ what: 'poems', state: 'shared' })),
        ], { id: 'g-poems' }),
        group('Empty state', [
          spec('Archive empty', LJS.emptyState({ title: 'Your first poem starts with friends.', body: 'Every poem you help write lands here.', action: B({ label: 'Start a game', size: 'lg', block: true }) })),
        ], { id: 'g-empty' }),
      ];
      const pg = LJS.page(root, {
        header: { left: 'wordmark', menu: 'more' },
        mainClass: 'core-components',
        body: `<header class="core-components__head"><h1 class="ljs-title">Components</h1><p class="ljs-secondary">Every Tucked In component and state, labeled. The slices build from these.</p></header>${sections.join('')}`,
      });
      pg.main.querySelectorAll('.ljs-note').forEach((n) => {
        if (!n.querySelector('textarea[readonly]') && !n.classList.contains('is-folded')) LJS.bindNote(n);
      });
      pg.main.querySelector('[data-demo-confirm]').addEventListener('click', (e) =>
        LJS.confirm('close', { opener: e.currentTarget, onConfirm: async (h, b) => { LJS.pending(b, 'Closing room…'); await LJS.wait(700); h.close(); } })
      );
      let lampAt = 0;
      pg.main.querySelector('[data-demo-lamp]').addEventListener('click', () => {
        const chars = pg.main.querySelectorAll('[data-demo-lamp-row] .ljs-char');
        LJS.motion.lamp(chars[lampAt], chars[1 - lampAt]);
        lampAt = 1 - lampAt;
      });
      const demoNote = () => pg.main.querySelector('[data-demo-note] .ljs-note');
      pg.main.querySelector('[data-demo-tuck]').addEventListener('click', () => {
        if (!demoNote().classList.contains('is-folded')) LJS.motion.tuck(demoNote());
      });
      pg.main.querySelector('[data-demo-unfold]').addEventListener('click', () => {
        if (demoNote().classList.contains('is-folded')) LJS.motion.unfold(demoNote(), { kind: 'note' });
      });
    },
  });
})();
