/* Tucked In: reveal slice. The reading circle from every phone: listeners, the reader, the
   spectator, the stand-in reader, and the lamp moving on. Compositions reuse the core reading
   layout classes (core-reading, core-listen, core-turn, core-after, core-page) so these states
   sit beside 38, 39 and 42 without drift. */
(function () {
  'use strict';
  const { R } = LJS;
  const HOST = R.players.find((p) => p.host).id;

  const header = (you) => ({ left: 'code', menu: you === HOST ? 'game' : 'gameGuest' });
  const readerOf = (n) => R.poems.find((p) => p.number === n).reader;
  const isBusy = (btn) => btn.getAttribute('aria-busy') === 'true';

  /* Resets a screen for __replay: no overlay, top of the page, fresh render. */
  function replayWith(root, render) {
    window.__replay = () => {
      LJS.closeOverlay({ returnFocus: false });
      window.scrollTo(0, 0);
      render(root);
    };
  }

  /* ---------- opening a poem in place (Follow along, Read again) ---------- */

  /* Replaces main with the poem sheet, focuses its title, announces it and unfolds the body.
     Closing restores `back()` and returns focus to `returnTo()`. */
  async function openPoem(pg, { sheet, poem, back, returnTo }) {
    pg.main.innerHTML = `<div class="core-page">${sheet}</div>`;
    const el = pg.main.querySelector('.ljs-sheetpoem');
    el.querySelector('h1').focus({ preventScroll: true });
    window.scrollTo(0, 0);
    pg.say(`Poem ${poem} is open.`);
    el.querySelector('[data-ljs-close-poem]').addEventListener('click', () => {
      back();
      window.scrollTo(0, 0);
      const target = returnTo();
      if (target) target.focus();
      else pg.main.querySelector('h1').focus({ preventScroll: true });
    });
    await LJS.motion.unfold(el.querySelector('.ljs-sheetpoem__body'), { kind: 'poem' });
  }

  /* A read poem opened again from the order. Players keep a compact Favorite; spectators
     (Pim) never get one. */
  function againSheet(poem, you) {
    const spectator = you === R.lateJoiner.id;
    return LJS.poemSheet({ poem, mode: 'listener', favorite: spectator ? null : false, you });
  }

  /* The live poem a listener follows: the reader keeps the lamp in the sheet header. */
  function followSheet(poem, you) {
    const spectator = you === R.lateJoiner.id;
    return LJS.poemSheet({ poem, mode: 'listener', favorite: spectator ? null : false, bylineLamp: true, you });
  }

  /* Wires Follow along and every Read again inside main. `body()` re-renders the composition. */
  function wireCircle(pg, { you, poem, body }) {
    const restore = () => {
      pg.main.innerHTML = body();
      wireCircle(pg, { you, poem, body });
    };
    const follow = pg.main.querySelector('[data-ljs-follow]');
    if (follow) {
      follow.addEventListener('click', () =>
        openPoem(pg, { sheet: followSheet(poem, you), poem, back: restore, returnTo: () => pg.main.querySelector('[data-ljs-follow]') })
      );
    }
    pg.main.querySelectorAll('[data-ljs-read-again]').forEach((btn) => {
      const n = Number(btn.dataset.ljsReadAgain);
      btn.addEventListener('click', () =>
        openPoem(pg, { sheet: againSheet(n, you), poem: n, back: restore, returnTo: () => pg.main.querySelector(`[data-ljs-read-again="${n}"]`) })
      );
    });
  }

  /* ---------- listener compositions ---------- */

  /* Listener (or spectator) circle while `poem` is being read. `opened`: the reader has opened
     the poem, so Follow along shows (D3). The lamp stays on the reader until Done reading (D1). */
  function circleBody({ you, poem = 1, opened = false, spectator = false, readAgain = false }) {
    return `<div class="core-listen">${LJS.readingHero({ mode: spectator ? 'spectator' : 'listener', poem, follow: opened })}</div>
      ${spectator ? '' : LJS.yourTurnRow({ you })}
      ${LJS.readingOrder({ current: poem - 1, you, readAgain })}`;
  }

  function renderCircle(root, opts) {
    const body = () => circleBody(opts);
    const pg = LJS.page(root, { header: header(opts.you), mainClass: 'core-reading', body: body() });
    wireCircle(pg, { you: opts.you, poem: opts.poem || 1, body });
    return pg;
  }

  function circleScreen(id, label, opts) {
    LJS.add({
      id,
      label,
      group: 'reveal',
      render(root) {
        const render = (r) => renderCircle(r, opts);
        render(root);
        replayWith(root, render);
      },
    });
  }

  circleScreen('40-reveal-waiting-turn', 'Reading, Wren waits her turn (reads 3rd)', { you: 'wren', poem: 1 });

  circleScreen('44-reveal-while-other-reads', 'Reading, Wren listens (Marguerite has opened Poem 1)', {
    you: 'wren',
    poem: 1,
    opened: true,
  });

  circleScreen('41-reveal-spectator', 'Reading, spectator (Pim; Marguerite reads Poem 1)', {
    you: 'pim',
    poem: 1,
    spectator: true,
  });

  circleScreen('47-reveal-spectator-read-available', 'Reading, spectator after Poem 1 (Pim; Read again)', {
    you: 'pim',
    poem: 2,
    spectator: true,
    readAgain: true,
  });

  /* ---------- open sheets on load: x-follow-along, 48 ---------- */

  function sheetScreen({ id, label, group, you, poem, sheet, back, play }) {
    function render(root) {
      const body = () => circleBody(back);
      const pg = LJS.page(root, { header: header(you), mainClass: 'core-reading', body: `<div class="core-page">${sheet()}</div>` });
      const el = pg.main.querySelector('.ljs-sheetpoem');
      el.querySelector('[data-ljs-close-poem]').addEventListener('click', () => {
        pg.main.innerHTML = body();
        wireCircle(pg, { you, poem: back.poem, body });
        window.scrollTo(0, 0);
        const target = pg.main.querySelector(`[data-ljs-read-again="${poem}"]`) || pg.main.querySelector('[data-ljs-follow]');
        if (target) target.focus();
        else pg.main.querySelector('h1').focus({ preventScroll: true });
      });
      if (play) {
        el.querySelector('h1').focus({ preventScroll: true });
        pg.say(`Poem ${poem} is open.`);
        LJS.motion.unfold(el.querySelector('.ljs-sheetpoem__body'), { kind: 'poem' });
      }
    }
    LJS.add({
      id,
      label,
      group,
      render(root) {
        render(root);
        replayWith(root, render);
      },
    });
  }

  sheetScreen({
    id: 'x-follow-along',
    label: 'Follow along opened (Juniper; Marguerite still reading)',
    group: 'reveal',
    you: HOST,
    poem: 1,
    play: true,
    sheet: () => followSheet(1, HOST),
    back: { you: HOST, poem: 1, opened: true },
  });

  sheetScreen({
    id: '48-poem-reading-readonly',
    label: 'Poem 1 again, spectator (Pim)',
    group: 'reveal',
    you: 'pim',
    poem: 1,
    sheet: () => againSheet(1, 'pim'),
    back: { you: 'pim', poem: 2, spectator: true, readAgain: true },
  });

  /* ---------- reading aloud: the reader's page and "Nicely read." ---------- */

  /* The reader's page: the poem at reading size and Done reading as the one action. */
  function readerPageBody({ poem, you, byline, bylineBy, favorite = false }) {
    const sheet = LJS.poemSheet({ poem, mode: 'reader', favorite, you, ...(byline ? { byline, bylineBy } : {}) });
    return `<div class="core-page">${sheet}</div>
      <div class="ljs-action">${LJS.button({ label: 'Done reading', size: 'lg', block: true, attrs: 'data-done' })}</div>`;
  }

  /* After Done reading: "Nicely read.", the order with this poem Read, then the lamp moves to
     the next reader. The last poem hands off to the recap instead. */
  function wireDone(pg, { poem, you }) {
    const done = pg.main.querySelector('[data-done]');
    done.addEventListener('click', async () => {
      if (isBusy(done)) return;
      const restore = LJS.pending(done, 'Finishing…');
      await LJS.wait(600);
      if (poem === R.poems.length) {
        if (!LJS.go('x-recap-arrival') && !LJS.go('52-recap-session-complete-host')) restore();
        return;
      }
      const next = readerOf(poem + 1);
      pg.main.classList.remove('core-turn');
      pg.main.innerHTML = afterBody({ poem, reader: you, next, you });
      wireCircle(pg, { you, poem: poem + 1, body: () => afterBody({ poem, reader: you, next, you, lampMoved: true }) });
      const hero = pg.main.querySelector('.ljs-hero');
      hero.querySelector('h1').focus({ preventScroll: true });
      window.scrollTo(0, 0);
      pg.say(`Nicely read. ${LJS.first(next)} reads next.`);
      await LJS.motion.settle(pg.main);
      const chars = hero.querySelectorAll('.ljs-char--lamp');
      await LJS.motion.lamp(chars[0], chars[1]);
    });
  }

  function afterBody({ poem, reader, next, you, lampMoved = false }) {
    return `<div class="core-after">${LJS.readingHero({ mode: 'after', poem, reader, next, lampMoved })}</div>
      ${LJS.readingOrder({ current: poem, you, readAgain: true })}`;
  }

  /* Reader's page rendered on load (45, 50). */
  function readerPageScreen({ id, label, group, poem, you, byline, bylineBy, favorite }) {
    function render(root) {
      const pg = LJS.page(root, { header: header(you), mainClass: 'core-reading', body: readerPageBody({ poem, you, byline, bylineBy, favorite }) });
      wireDone(pg, { poem, you });
    }
    LJS.add({
      id,
      label,
      group,
      render(root) {
        render(root);
        replayWith(root, render);
      },
    });
  }

  readerPageScreen({
    id: '45-poem-favorited',
    label: "Reader's page, Favorite pressed (Marguerite)",
    group: 'poem',
    poem: 1,
    you: 'marguerite',
    favorite: true,
  });

  readerPageScreen({
    id: '50-poem-reading-fallback-reader',
    label: 'Juniper reads Poem 2 for Basil',
    group: 'reveal',
    poem: 2,
    you: HOST,
    byline: 'Read by Juniper for Basil',
    bylineBy: HOST,
  });

  /* ---------- 46 Nicely read (end state, lamp already on Basil) ---------- */
  LJS.add({
    id: '46-reveal-after-own-read',
    label: 'Nicely read (Marguerite after Done reading)',
    group: 'reveal',
    render(root) {
      const render = (r) => {
        const body = () => afterBody({ poem: 1, reader: 'marguerite', next: 'basil', you: 'marguerite', lampMoved: true });
        const pg = LJS.page(r, { header: header('marguerite'), mainClass: 'core-reading', body: body() });
        wireCircle(pg, { you: 'marguerite', poem: 2, body });
      };
      render(root);
      replayWith(root, render);
    },
  });

  /* ---------- turns with one primary: 51 (your turn), 49 (step in) ---------- */

  /* One hero, one action, no order below it (as 39). `open` swaps in the reader's page. */
  function renderTurn(root, { you, poem, hero, action, pendingLabel, page }) {
    const pg = LJS.page(root, {
      header: header(you),
      mainClass: 'core-reading core-turn',
      body: `<div class="core-turn__hero">${hero}</div>
        <div class="ljs-action">${LJS.button({ label: action, size: 'lg', block: true, attrs: 'data-read' })}</div>`,
    });
    const read = pg.main.querySelector('[data-read]');
    read.addEventListener('click', async () => {
      if (isBusy(read)) return;
      LJS.pending(read, pendingLabel);
      await LJS.wait(600);
      pg.main.classList.remove('core-turn');
      pg.main.innerHTML = readerPageBody(page);
      const sheet = pg.main.querySelector('.ljs-sheetpoem');
      sheet.querySelector('h1').focus({ preventScroll: true });
      window.scrollTo(0, 0);
      pg.say(`Poem ${poem} is open.`);
      wireDone(pg, { poem, you });
      await Promise.all([
        LJS.motion.unfold(sheet.querySelector('.ljs-sheetpoem__body'), { kind: 'poem' }),
        LJS.motion.settle(pg.main.querySelector('.ljs-action')),
      ]);
    });
    return pg;
  }

  function turnScreen({ id, label, opts }) {
    LJS.add({
      id,
      label,
      group: 'reveal',
      render(root) {
        const render = (r) => renderTurn(r, opts);
        render(root);
        replayWith(root, render);
      },
    });
  }

  turnScreen({
    id: '51-reveal-last-poem-host',
    label: 'Reading, your turn for the last poem (Juniper, Poem 4)',
    opts: {
      you: HOST,
      poem: 4,
      hero: LJS.readingHero({ mode: 'reader', poem: 4, reader: HOST }),
      action: 'Read Poem 4',
      pendingLabel: 'Opening…',
      page: { poem: 4, you: HOST },
    },
  });

  turnScreen({
    id: '49-reveal-absent-reader-fallback',
    label: 'Reading, Basil stepped away (Juniper may step in)',
    opts: {
      you: HOST,
      poem: 2,
      hero: LJS.readingHero({ mode: 'fallback', poem: 2, absent: 'basil' }),
      action: 'Step in and read',
      pendingLabel: 'Opening…',
      page: { poem: 2, you: HOST, byline: 'Read by Juniper for Basil', bylineBy: HOST },
    },
  });

  /* ---------- x-lamp-move: the listener's lamp moves on when Marguerite finishes ---------- */

  /* Juniper listens while Marguerite reads Poem 1 (opened). Her Done reading lands: in the order
     the lamp crossfades from Marguerite to Basil and the statuses step on; the hero hands off in
     place to "Basil is reading Poem 2." (no Follow along until Basil opens it, D3). */
  function renderLampMove(root) {
    const you = HOST;
    let moved = false;
    const body = () => (moved ? circleBody({ you, poem: 2 }) : circleBody({ you, poem: 1, opened: true }));
    const pg = LJS.page(root, { header: header(you), mainClass: 'core-reading', body: body() });
    wireCircle(pg, { you, poem: 1, body });
    let cancelled = false;
    const run = async () => {
      if (!LJS.reduced()) await LJS.wait(1200);
      if (cancelled || !pg.main.isConnected) return;
      moved = true;
      const order = pg.main.querySelector('.ljs-order');
      if (!order) return; /* Follow along is open: the sheet stays; closing it shows Basil reading. */
      const rows = order.querySelectorAll('.ljs-row--order');
      const from = rows[0].querySelector(':scope > .ljs-char');
      const to = rows[1].querySelector(':scope > .ljs-char');
      const fresh = LJS.el(LJS.readingOrder({ current: 1, you }));
      const setStatus = (i) => {
        rows[i].className = fresh.querySelectorAll('.ljs-row--order')[i].className;
        rows[i].querySelector('.ljs-row__end').replaceWith(fresh.querySelectorAll('.ljs-row__end')[i].cloneNode(true));
      };
      [0, 1, 2].forEach(setStatus);
      const oldHero = pg.main.querySelector('.ljs-hero');
      const newHero = LJS.el(LJS.readingHero({ mode: 'listener', poem: 2, follow: false }));
      await Promise.all([LJS.motion.lamp(from, to), LJS.motion.swap(oldHero, newHero)]);
      if (cancelled) return;
      newHero.querySelector('h1').focus({ preventScroll: true });
      pg.say('Basil is reading Poem 2.');
    };
    run();
    return () => {
      cancelled = true;
    };
  }

  LJS.add({
    id: 'x-lamp-move',
    label: 'Lamp moves to Basil (listener, plays on load)',
    group: 'reveal',
    render(root) {
      let stop = renderLampMove(root);
      window.__replay = () => {
        stop();
        LJS.closeOverlay({ returnFocus: false });
        window.scrollTo(0, 0);
        stop = renderLampMove(root);
      };
    },
  });
})();
