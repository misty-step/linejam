/* Tucked In: lobby slice. Every lobby composition follows the core host lobby (13):
   invitation card, "Players" gathering, then the one action at the end of the flow.
   In-game overlays (26, 27, 28, 93, 94) sit over the round's writing screen. */
(function () {
  'use strict';
  const { R, esc } = LJS;

  /* Local fixtures. Pim plays now that a new game is forming; three more friends fill the room. */
  const PIM = { ...R.lateJoiner, spectator: false };
  const FULL_EXTRA = [
    PIM,
    { id: 'otto', name: 'Otto', avatar: 'sprout' },
    { id: 'ines', name: 'Ines', avatar: 'sunny' },
    { id: 'lou', name: 'Lou', avatar: 'pip' },
  ];
  /* The room with a given host (the crown moves with the role). */
  const room = (hostId = 'juniper', extra = []) => [...R.players, ...extra].map((p) => ({ ...p, host: p.id === hostId }));
  const ALONE_TEXT = 'Share the code. You can start when a friend joins.';
  const START_ERROR = "That didn't go through. Check your connection and try again.";
  const ARRIVE_AFTER = 1100;

  /* ---------- lobby composition (matches 13) ---------- */
  function lobbyBody({ players, you, invite = {}, action, seat = false }) {
    const id = LJS.uid('players');
    /* A full room gathers closer: smaller characters, three to a row. */
    let gather = LJS.gathering(players, { you, size: players.length > 5 ? 56 : 72 });
    if (seat) {
      gather = gather.replace(
        /<\/ul>$/,
        '<li class="ljs-gather__item lobby-seat" aria-hidden="true"><span class="lobby-seat__place"></span></li></ul>'
      );
    }
    return `
      <h1 class="sr-only">Room ${R.codeDisplay}</h1>
      ${LJS.invitation(invite)}
      <section class="lobby-players" aria-labelledby="${id}">
        ${LJS.sectionHead({ title: 'Players', count: `${players.length} of ${R.capacity}`, id })}
        ${gather}
      </section>
      ${action}`;
  }

  const startAction = ({ error = false } = {}) =>
    `<div class="ljs-action">${
      error ? `<p class="lobby-error" role="alert">${LJS.icon('alert', 20)}<span>${esc(START_ERROR)}</span></p>` : ''
    }${LJS.button({ label: 'Start game', size: 'lg', block: true, attrs: 'data-start' })}</div>`;

  const aloneAction = () =>
    `<div class="ljs-action">
      <p class="lobby-hint" data-hint>${esc(ALONE_TEXT)}</p>
      ${LJS.button({ label: 'Start game', size: 'lg', block: true, disabled: true, attrs: 'data-start' })}
    </div>`;

  /* A guest's action area: who starts, with their character. No disabled button. */
  const guestAction = (host) =>
    `<div class="ljs-action">
      <p class="lobby-wait">${LJS.character(host, { size: 44 })}<span>${esc(LJS.first(host))} will start the game.</span></p>
    </div>`;

  function wireStart(pg) {
    const start = pg.main.querySelector('[data-start]');
    if (!start) return;
    start.addEventListener('click', async () => {
      if (start.disabled || start.getAttribute('aria-busy') === 'true') return;
      const restore = LJS.pending(start, 'Starting…');
      await LJS.wait(600);
      if (!LJS.go('20-writing-r1-empty')) restore();
    });
  }

  /* kind: 'host' (Juniper, Start game), 'guest' (someone else's phone), 'alone'. */
  function lobbyPage(root, { kind = 'host', players = room(), you = R.you, host = 'juniper', invite, notices = [], mainClass = '', error = false } = {}) {
    const action = kind === 'guest' ? guestAction(host) : kind === 'alone' ? aloneAction() : startAction({ error });
    const pg = LJS.page(root, {
      header: { left: 'wordmark', menu: kind === 'guest' ? 'lobbyGuest' : 'lobbyHost' },
      mainClass: `lobby${players.length > 5 ? ' lobby--many' : ''} ${mainClass}`,
      notices,
      body: lobbyBody({ players, you, invite, action, seat: kind === 'alone' }),
    });
    wireStart(pg);
    return pg;
  }

  const menuButton = (pg) => pg.el.querySelector('[data-ljs="menu"]');
  const chipButton = (pg) => pg.el.querySelector('[data-ljs="invite"]');

  /* Register a screen whose starting state can be restored in place (rule 9). */
  function screen(id, label, render) {
    LJS.add({
      id,
      label,
      group: 'lobby',
      render(root) {
        render(root);
        window.__replay = () => {
          LJS.closeOverlay({ returnFocus: false });
          window.scrollTo(0, 0);
          render(root);
        };
      },
    });
  }

  /* ---------- in game: the round's writing screen under the overlays ---------- */
  function writingPage(root, { round = 5, value = '', menu = 'game', you = R.you } = {}) {
    const pg = LJS.page(root, {
      header: { left: 'code', menu },
      mainClass: 'lobby-writing',
      body: `
        <h1 class="sr-only">Round ${round} of 9. Write your line.</h1>
        ${LJS.roundGlyph(round)}
        <div class="lobby-stage" data-stage>
          ${LJS.note({ round, value })}
          <div class="ljs-action lobby-stage__action">${LJS.button({ label: 'Tuck it in', size: 'lg', block: true, attrs: 'data-tuck' })}</div>
        </div>`,
    });
    const stage = pg.main.querySelector('[data-stage]');
    const noteEl = stage.querySelector('.ljs-note');
    const btn = stage.querySelector('[data-tuck]');
    const { input } = LJS.bindNote(noteEl, { button: btn });
    btn.addEventListener('click', () =>
      LJS.tuckSequence({
        page: pg,
        stage,
        noteEl,
        button: btn,
        render: () => `${LJS.waitingHero({ you, line: input.value.trim(), round })}${LJS.waitingRoster({ you })}`,
      })
    );
    return pg;
  }

  /* ---------- 08 host alone (also the 1280x800 hosting screen) ---------- */
  screen('08-lobby-host-alone', 'Lobby, host alone (Juniper)', (root) => {
    lobbyPage(root, { kind: 'alone', players: room().slice(0, 1), mainClass: 'lobby--wide' });
  });

  /* ---------- 12 guest ---------- */
  screen('12-lobby-guest', 'Lobby, guest (Wren, 4 players)', (root) => {
    lobbyPage(root, { kind: 'guest', you: 'wren' });
  });

  /* ---------- x full room ---------- */
  screen('x-lobby-full', 'Lobby, room full (8 of 8)', (root) => {
    lobbyPage(root, { players: room('juniper', FULL_EXTRA), invite: { full: true } });
  });

  /* ---------- x arrival: Wren settles into the empty place ---------- */
  screen('x-lobby-arrival', 'Lobby, Wren arrives (plays on load)', (root) => {
    const juniper = room()[0];
    const pg = lobbyPage(root, { kind: 'alone', players: [juniper] });
    (async () => {
      if (!LJS.reduced()) await LJS.wait(ARRIVE_AFTER);
      if (!document.contains(pg.el)) return; // replayed meanwhile
      const seat = pg.main.querySelector('.lobby-seat');
      const wren = LJS.el(LJS.gathering([juniper, R.byId.wren], { you: R.you, arriving: 'wren' })).querySelector('[data-arriving]');
      pg.main.querySelector('.ljs-section-head__count').textContent = `2 of ${R.capacity}`;
      pg.main.querySelector('[data-hint]').textContent = LJS.NOTICE.arrival.text;
      pg.main.querySelector('[data-start]').disabled = false;
      pg.say(LJS.NOTICE.arrival.text);
      await LJS.motion.swap(seat, wren);
    })();
  });

  /* ---------- invitation feedback on the host lobby ---------- */
  screen('16-lobby-code-copy-feedback', 'Lobby, code copied', (root) => {
    lobbyPage(root, { invite: { state: 'copied' } });
  });
  screen('17-lobby-share-invite-fallback', 'Lobby, invite link copied', (root) => {
    lobbyPage(root, { invite: { state: 'link-copied' } });
  });

  /* ---------- in-game invitation popover (Wren's phone, round 1) ---------- */
  screen('93-invite-copy-denied', "Invitation in game, couldn't copy (Wren)", (root) => {
    const pg = writingPage(root, { round: 1, menu: 'gameGuest', you: 'wren' });
    LJS.openInvite(chipButton(pg), { state: 'copy-refused' });
  });
  screen('94-invite-share-error', "Invitation in game, couldn't share (Wren)", (root) => {
    const pg = writingPage(root, { round: 1, menu: 'gameGuest', you: 'wren' });
    LJS.openInvite(chipButton(pg), { state: 'share-refused' });
  });
  screen('26-ingame-invite-panel', 'Invitation in game, round 5 (Juniper)', (root) => {
    const pg = writingPage(root, { value: 'and nobody asked' });
    LJS.openInvite(chipButton(pg));
  });

  /* ---------- menus ---------- */
  screen('14-lobby-room-options-host', 'Lobby, Room options (host)', (root) => {
    LJS.openMenu(menuButton(lobbyPage(root)));
  });
  screen('18-lobby-room-options-guest', 'Lobby, Room options (Wren)', (root) => {
    LJS.openMenu(menuButton(lobbyPage(root, { kind: 'guest', you: 'wren' })));
  });
  screen('27-ingame-room-options-host', 'In game, Room options (host)', (root) => {
    LJS.openMenu(menuButton(writingPage(root, { value: 'and nobody asked' })));
  });

  /* ---------- confirmations ---------- */
  screen('15-lobby-close-room-confirm', 'Lobby, close room?', (root) => {
    LJS.confirm('close', { opener: menuButton(lobbyPage(root)) });
  });
  screen('19-lobby-leave-confirm-guest', 'Lobby, leave room? (Wren)', (root) => {
    LJS.confirm('leave', { opener: menuButton(lobbyPage(root, { kind: 'guest', you: 'wren' })) });
  });
  screen('x-confirm-pending', 'Close room, pending', (root) => {
    LJS.confirm('close', { opener: menuButton(lobbyPage(root)), state: 'pending' });
  });
  screen('x-confirm-error', "Close room, didn't go through", (root) => {
    LJS.confirm('close', { opener: menuButton(lobbyPage(root)), state: 'error' });
  });
  screen('28-ingame-end-game-confirm', 'In game, end game?', (root) => {
    LJS.confirm('end', { opener: menuButton(writingPage(root, { value: 'and nobody asked' })) });
  });

  /* ---------- start failed ---------- */
  screen('x-lobby-start-error', 'Lobby, start game failed', (root) => {
    lobbyPage(root, { error: true });
  });

  /* ---------- host changes and game ended ---------- */
  screen('65-lobby-after-host-handoff-exhost', 'Lobby, Juniper back, Wren hosts', (root) => {
    lobbyPage(root, { kind: 'guest', host: 'wren', players: room('wren'), notices: ['handoffOldHost'] });
  });
  screen('66-lobby-new-host', 'Lobby, new host (Wren)', (root) => {
    lobbyPage(root, { players: room('wren'), you: 'wren', notices: ['handoffNewHost'] });
  });
  screen('72-lobby-after-end-game-guest', 'Lobby, game ended (Marguerite)', (root) => {
    lobbyPage(root, { kind: 'guest', you: 'marguerite', notices: ['gameEnded'] });
  });
})();
