/* Tucked In: writing slice (writing, waiting, the round turn). Composition follows core 31 and 24:
   sr-only h1, round glyph, then the stage (note + action) or the waiting composition. */
(function () {
  'use strict';
  const { R, esc } = LJS;
  const FIVE = 'and nobody asked the moon';
  const LONG =
    'the lanterns kept humming after everyone went to bed and the moths applauded politely from the porch rail while somebody in the kitchen argued with the kettle about whether the moon had ever once been asked for its opinion on soup or bicycles or the tide and nobody could remember who had started the song but it kept going around the table like a borrowed coat that fits everyone a little wrong and still we wore it all the way home under the rain and the streetlights.';
  const RETRY = "We couldn't reach the room. Your line is safe.";
  const FINAL = "We still can't confirm your line. Reload the room to check whether it went in.";
  const PIM = R.lateJoiner;

  const headerFor = (you) => ({ left: 'code', menu: R.byId[you].host ? 'game' : 'gameGuest' });
  const srTitle = (round) => `Round ${round} of 9. Write your line.`;

  /* One sequence at a time: a replay (or re-render) makes any running sequence stale. */
  let runId = 0;
  let listeners = null;
  function fresh() {
    runId += 1;
    if (listeners) listeners.abort();
    listeners = null;
    return runId;
  }
  const stale = (id) => id !== runId;

  function hook(root, fn) {
    window.__replay = () => {
      LJS.closeOverlay({ returnFocus: false });
      window.scrollTo(0, 0);
      fn();
    };
  }

  /* ---------- waiting ---------- */
  function waitingBody({ round, you = 'juniper', line, statuses, spectators = [PIM], repeat = false }) {
    return `${LJS.waitingHero({ you, line, round, repeat })}
      ${LJS.waitingRoster({ statuses, you, spectators })}`;
  }

  function renderWaiting(root, { round, you = 'juniper', body }) {
    return LJS.page(root, {
      header: headerFor(you),
      mainClass: 'core-writing',
      body: `${LJS.roundGlyph(round)}<div class="ljs-stage-next">${body}</div>`,
    });
  }

  /* ---------- writing ---------- */
  function stageMarkup({ round, received, value = '', draft = false, readonly = false, folded = false, message = null, messageTone, button }) {
    const noteOpts = { round, value, draft, readonly, folded, message, id: LJS.uid('line') };
    if (received !== undefined) noteOpts.received = received;
    if (messageTone) noteOpts.messageTone = messageTone;
    return `<div class="core-stage" data-stage>
      ${LJS.note(noteOpts)}
      <div class="ljs-action core-stage__action">${LJS.button({ label: 'Tuck it in', size: 'lg', block: true, attrs: 'data-tuck', ...button })}</div>
    </div>`;
  }

  /* Wires Tuck it in on a bound note: pending, tuck, then the waiting composition. */
  function wireTuck(pg, stage, { round, you, after, spectators }) {
    const noteEl = stage.querySelector('.ljs-note');
    const btn = stage.querySelector('.ljs-action .ljs-btn');
    const input = noteEl.querySelector('textarea');
    btn.addEventListener('click', () => {
      LJS.tuckSequence({
        page: pg, stage, noteEl, button: btn,
        render: () => waitingBody({ round, you, line: input.value.trim(), statuses: after, spectators }),
      });
    });
    return { noteEl, btn, input };
  }

  /* Every note is bound (count, auto-grow); read-only states keep their authored action state. */
  function renderWriting(root, opts) {
    const { round, you = 'juniper', notices = [], after, spectators = [PIM], focus = false, readonly = false } = opts;
    const pg = LJS.page(root, {
      header: headerFor(you),
      notices,
      mainClass: 'core-writing',
      body: `
        <h1 class="sr-only">${esc(srTitle(round))}</h1>
        ${LJS.roundGlyph(round)}
        ${stageMarkup(opts)}`,
    });
    const stage = pg.main.querySelector('[data-stage]');
    const noteEl = stage.querySelector('.ljs-note');
    const btn = stage.querySelector('.ljs-action .ljs-btn');
    LJS.bindNote(noteEl, { button: readonly ? null : btn });
    const parts = after ? wireTuck(pg, stage, { round, you, after, spectators }) : { noteEl, btn, input: noteEl.querySelector('textarea') };
    if (focus) {
      parts.input.focus();
      parts.input.setSelectionRange(parts.input.value.length, parts.input.value.length);
    }
    return { pg, stage, ...parts };
  }

  /* Registers a live writing state; its replay returns to the same start with the input focused. */
  function writingScreen({ id, label, ...opts }) {
    LJS.add({
      id, label, group: 'writing',
      render(root) {
        fresh();
        renderWriting(root, opts);
        hook(root, () => {
          fresh();
          renderWriting(root, { ...opts, focus: true });
        });
      },
    });
  }

  /* After every line is in: the waiting composition leaves, the next folded note settles, then it
     opens to show only the line passed to you. Focus goes to the input. */
  async function turnRound(pg, from, { round, you = 'juniper', after, run }) {
    await LJS.motion.fade(from);
    if (stale(run)) return;
    const main = pg.main;
    main.querySelector('.ljs-round').replaceWith(LJS.el(LJS.roundGlyph(round)));
    let h1 = main.querySelector('h1.sr-only');
    if (!h1) {
      h1 = LJS.el('<h1 class="sr-only"></h1>');
      main.prepend(h1);
    }
    h1.textContent = srTitle(round);
    const stage = LJS.el(stageMarkup({ round, folded: true }));
    const action = stage.querySelector('.ljs-action');
    action.style.visibility = 'hidden';
    from.replaceWith(stage);
    window.scrollTo({ top: 0 });
    LJS.bindNote(stage.querySelector('.ljs-note'), { button: stage.querySelector('.ljs-action .ljs-btn') });
    const { noteEl, input } = wireTuck(pg, stage, { round, you, after });
    await LJS.motion.settle(stage);
    if (stale(run)) return;
    await LJS.motion.unfold(noteEl, { kind: 'note', action });
    /* One frame first: under reduced motion the kit gives every property a 1 ms transition, so the
       just-unfolded input is still visibility: hidden in this task and would refuse focus. */
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    if (stale(run)) return;
    input.focus({ preventScroll: true });
    pg.say(`Round ${round} of 9. ${LJS.ROUND_CAPTION[round]}.`);
  }

  /* ---------- round 1 ---------- */
  const R1_AFTER = { juniper: 'in', wren: 'writing', basil: 'writing', marguerite: 'writing' };

  writingScreen({
    id: '20-writing-r1-empty',
    label: 'Writing, round 1, empty',
    round: 1,
    after: R1_AFTER,
    spectators: [],
  });

  writingScreen({
    id: '21-writing-r1-over-count',
    label: 'Writing, round 1, over count (Wren)',
    round: 1,
    you: 'wren',
    value: 'Morning comes',
    after: { juniper: 'in', wren: 'in', basil: 'writing', marguerite: 'writing' },
    spectators: [],
  });

  writingScreen({
    id: '22-writing-r1-ready',
    label: 'Writing, round 1, ready (tuck it in)',
    round: 1,
    value: 'Lanterns',
    after: R1_AFTER,
    spectators: [],
  });

  /* ---------- rounds 2, 3, 5, 9 ---------- */
  writingScreen({
    id: '29-writing-r2-previous-line',
    label: 'Writing, round 2, line passed (Wren)',
    round: 2,
    you: 'wren',
    received: 'Lanterns',
    after: { juniper: 'in', wren: 'in', basil: 'writing', marguerite: 'writing' },
    spectators: [],
  });

  writingScreen({
    id: '30-writing-r3-draft-restored',
    label: 'Writing, round 3, draft restored (Basil)',
    round: 3,
    you: 'basil',
    received: 'hum softly',
    value: 'moths applaud',
    draft: true,
    after: { juniper: 'in', wren: 'in', basil: 'in', marguerite: 'writing' },
  });

  writingScreen({
    id: '34-writing-r5-reconnected',
    label: 'Writing, round 5, back online (Marguerite)',
    round: 5,
    you: 'marguerite',
    received: 'a dog named Tuesday',
    notices: ['back'],
    after: { juniper: 'in', wren: 'in', basil: 'writing', marguerite: 'in' },
  });

  writingScreen({
    id: '36-writing-r9-final-word',
    label: 'Writing, round 9, the last word',
    round: 9,
    after: { juniper: 'in', wren: 'in', basil: 'writing', marguerite: 'in' },
  });

  writingScreen({
    id: '97-writing-near-char-limit',
    label: 'Writing, round 2, near the character limit',
    round: 2,
    value: LONG,
    after: { juniper: 'in', wren: 'writing', basil: 'writing', marguerite: 'writing' },
    spectators: [],
  });

  writingScreen({
    id: 'x-writing-reconnecting',
    label: 'Writing, round 5, reconnecting',
    round: 5,
    value: 'and nobody asked',
    notices: ['reconnecting'],
    after: { juniper: 'in', wren: 'in', basil: 'writing', marguerite: 'away' },
  });

  /* ---------- sending the line: offline, retry, final error ---------- */
  LJS.add({
    id: '35-writing-submit-offline-pending',
    label: 'Writing, round 7, tucking in while offline (Basil)',
    group: 'writing',
    render(root) {
      fresh();
      renderWriting(root, {
        round: 7,
        you: 'basil',
        received: 'while the soup cooled',
        value: 'under the porch',
        readonly: true,
        notices: ['offline'],
        button: { pending: 'Tucking in…' },
      });
    },
  });

  function renderRetry(root, { focus = false } = {}) {
    const run = fresh();
    const w = renderWriting(root, {
      round: 5,
      value: FIVE,
      readonly: true,
      message: RETRY,
      messageTone: 'error',
      button: { label: 'Try again' },
      after: { juniper: 'in', wren: 'in', basil: 'writing', marguerite: 'away' },
    });
    const { pg, btn } = w;
    let offlineNotice = null;
    let restore = null;
    const goOffline = () => {
      if (restore || btn.getAttribute('aria-busy') === 'true') return;
      restore = LJS.pending(btn, 'Waiting for connection…');
      offlineNotice = pg.notice('offline', { settle: false });
    };
    const goOnline = () => {
      if (!restore) return;
      restore();
      restore = null;
      if (offlineNotice) offlineNotice.remove();
      offlineNotice = null;
    };
    listeners = new AbortController();
    window.addEventListener('offline', goOffline, { signal: listeners.signal });
    window.addEventListener('online', goOnline, { signal: listeners.signal });
    if (!navigator.onLine) goOffline();
    if (focus && !stale(run)) btn.focus();
  }

  LJS.add({
    id: 'x-writing-retry',
    label: "Writing, round 5, couldn't reach the room",
    group: 'writing',
    render(root) {
      renderRetry(root);
      hook(root, () => renderRetry(root, { focus: true }));
    },
  });

  function renderFinalError(root, { focus = false } = {}) {
    fresh();
    const { btn } = renderWriting(root, {
      round: 5,
      value: FIVE,
      readonly: true,
      message: FINAL,
      messageTone: 'error',
      button: { label: 'Reload room', attrs: 'data-reload-room' },
    });
    btn.addEventListener('click', () => {
      if (!LJS.go('x-waiting-already-recorded')) location.reload();
    });
    if (focus) btn.focus();
  }

  LJS.add({
    id: 'x-writing-final-error',
    label: "Writing, round 5, still can't confirm",
    group: 'writing',
    render(root) {
      renderFinalError(root);
      hook(root, () => renderFinalError(root, { focus: true }));
    },
  });

  /* ---------- waiting ---------- */
  LJS.add({
    id: '23-waiting-ack-early',
    label: 'Waiting, round 1, before the room answers',
    group: 'waiting',
    render(root) {
      fresh();
      const id = LJS.uid('round');
      renderWaiting(root, {
        round: 1,
        body: `${LJS.waitingHero({ line: 'Lanterns', round: 1 })}
          <section class="ljs-round-roster" aria-labelledby="${id}">
            ${LJS.sectionHead({ title: 'This round', id })}
            <p class="ljs-secondary">Gathering this round.</p>
          </section>`,
      });
    },
  });

  LJS.add({
    id: '25-waiting-three-of-four',
    label: 'Waiting, round 1, three of four in',
    group: 'waiting',
    render(root) {
      fresh();
      renderWaiting(root, {
        round: 1,
        body: waitingBody({ round: 1, line: 'Lanterns', statuses: { juniper: 'in', wren: 'in', basil: 'in', marguerite: 'writing' }, spectators: [] }),
      });
    },
  });

  LJS.add({
    id: '33-waiting-player-away',
    label: 'Waiting, round 5, Marguerite away',
    group: 'waiting',
    render(root) {
      fresh();
      renderWaiting(root, {
        round: 5,
        body: waitingBody({ round: 5, line: FIVE, statuses: { juniper: 'in', wren: 'in', basil: 'in', marguerite: 'away' } }),
      });
    },
  });

  LJS.add({
    id: '32-late-joiner-spectator',
    label: 'Waiting, joined late (Pim)',
    group: 'waiting',
    render(root) {
      fresh();
      const id = LJS.uid('late');
      renderWaiting(root, {
        round: 5,
        you: 'pim',
        body: `<section class="ljs-hero" aria-labelledby="${id}">
            ${LJS.character('pim', { size: 112, outlined: true })}
            <h1 class="ljs-hero__title" id="${id}" tabindex="-1">You're in for the next game.</h1>
            <p class="ljs-hero__body">Watch the poems take shape. You'll write from the next game.</p>
          </section>
          ${LJS.waitingRoster({ statuses: { juniper: 'in', wren: 'in', basil: 'in', marguerite: 'writing' }, you: 'pim', spectators: [PIM] })}`,
      });
    },
  });

  LJS.add({
    id: '37-waiting-r9',
    label: 'Waiting, round 9, the last lines',
    group: 'waiting',
    render(root) {
      fresh();
      renderWaiting(root, {
        round: 9,
        body: waitingBody({ round: 9, line: 'Again', statuses: { juniper: 'in', wren: 'in', basil: 'writing', marguerite: 'in' } }),
      });
    },
  });

  LJS.add({
    id: 'x-waiting-already-recorded',
    label: 'Waiting, round 5, line was already in',
    group: 'waiting',
    render(root) {
      fresh();
      const pg = renderWaiting(root, {
        round: 5,
        body: waitingBody({ round: 5, line: FIVE, repeat: true, statuses: { juniper: 'in', wren: 'in', basil: 'writing', marguerite: 'away' } }),
      });
      pg.say('Your line was already tucked in.');
    },
  });

  /* ---------- the round turn (plays on load) ---------- */
  const R6_AFTER = { juniper: 'in', wren: 'writing', basil: 'writing', marguerite: 'writing' };

  function playRoundTurn(root) {
    const run = fresh();
    const pg = renderWaiting(root, {
      round: 5,
      body: waitingBody({ round: 5, line: FIVE, statuses: { juniper: 'in', wren: 'in', basil: 'in', marguerite: 'writing' } }),
    });
    const from = pg.main.querySelector('.ljs-stage-next');
    (async () => {
      await LJS.wait(900);
      if (stale(run)) return;
      /* The last line lands: an instant status change, no motion. */
      from.querySelector('li[data-player="marguerite"]').replaceWith(LJS.el(LJS.rosterRow({ player: 'marguerite', status: 'in' })));
      from.querySelector('.ljs-section-head__count').textContent = '4 of 4 lines in';
      await LJS.wait(800);
      if (stale(run)) return;
      await turnRound(pg, from, { round: 6, after: R6_AFTER, run });
    })();
  }

  LJS.add({
    id: 'x-round-turn',
    label: 'Round turn, waiting to round 6 (plays on load)',
    group: 'writing',
    render(root) {
      playRoundTurn(root);
      hook(root, () => playRoundTurn(root));
    },
  });

  /* ---------- the last submitter (plays on load) ---------- */
  function playLastSubmitter(root) {
    const run = fresh();
    const { pg, stage, noteEl, btn, input } = renderWriting(root, { round: 5, value: FIVE, focus: true });
    (async () => {
      await LJS.wait(900);
      if (stale(run)) return;
      const next = await LJS.tuckSequence({
        page: pg, stage, noteEl, button: btn,
        render: () => waitingBody({ round: 5, line: input.value.trim(), statuses: { juniper: 'in', wren: 'in', basil: 'in', marguerite: 'in' } }),
      });
      if (stale(run) || !next) return;
      await LJS.wait(1200);
      if (stale(run)) return;
      await turnRound(pg, next, { round: 6, after: R6_AFTER, run });
    })();
  }

  LJS.add({
    id: 'x-last-submitter',
    label: 'Last line in, round 5 to round 6 (plays on load)',
    group: 'writing',
    render(root) {
      playLastSubmitter(root);
      hook(root, () => playLastSubmitter(root));
    },
  });
})();
