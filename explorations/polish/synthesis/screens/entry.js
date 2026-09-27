/* Tucked In: entry slice. Home, How to play, host and join forms, the character sheet, the cold
   start shell, and the pages for lost rooms, lost pages and crashes. Builds only from LJS. */
(function () {
  'use strict';
  const { R, esc } = LJS;
  const NAMES = LJ.CAST_NAMES;
  const JOINER = 'wren'; // the guest joining room 9A UK
  const JOINER_CAST = R.byId[JOINER].avatar;

  /* Every entry screen replays from its starting state (rule 9): overlays closed, top of page. */
  function reg(id, label, group, render) {
    LJS.add({
      id,
      label,
      group,
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

  const busy = (btn) => btn.disabled || btn.getAttribute('aria-disabled') === 'true';
  const menuButton = (pg) => pg.el.querySelector('[data-ljs="menu"]');

  /* ---------- How to play (bottom sheet, opened in place from More options) ---------- */
  function howBody() {
    const nums = R.WORD_COUNTS.map((n) => `<span>${n}</span>`).join('');
    return `<ol class="entry-how">
      <li class="entry-how__step">
        ${LJS.character('orbit', { size: 48, prop: 'pencil' })}
        <div class="entry-how__text">
          <h3 class="entry-how__title">Write a line</h3>
          <p class="entry-how__body">Use this round's word count.</p>
          <figure class="entry-shape" aria-label="Words per round: ${R.WORD_COUNTS.join(', ')}">
            ${LJS.roundGlyph(10, { label: false })}
            <span class="entry-shape__nums" aria-hidden="true">${nums}</span>
          </figure>
        </div>
      </li>
      <li class="entry-how__step">
        ${LJS.character('pebble', { size: 48, prop: 'note' })}
        <div class="entry-how__text">
          <h3 class="entry-how__title">Pass it on</h3>
          <p class="entry-how__body">The next writer sees only your line.</p>
        </div>
      </li>
      <li class="entry-how__step">
        ${LJS.character('moss', { size: 48, prop: 'book' })}
        <div class="entry-how__text">
          <h3 class="entry-how__title">Read together</h3>
          <p class="entry-how__body">After nine rounds, everyone reads one whole poem aloud.</p>
        </div>
      </li>
    </ol>`;
  }

  function openHow(opener) {
    return LJS.openSheet({
      title: 'How to play',
      body: howBody(),
      actions: LJS.button({ label: 'Got it', variant: 'secondary', block: true, attrs: 'data-ljs="dismiss" data-autofocus' }),
      className: 'entry-howsheet',
      opener,
    });
  }

  /* On entry screens How to play opens where you are instead of leaving the page. */
  function useHowInPlace() {
    LJS.menuActions.how = (opener) => openHow(opener);
  }

  /* ---------- home ---------- */
  function homeBody() {
    return `
      <section class="entry-intro" aria-labelledby="entry-home-h">
        <h1 class="entry-headline" id="entry-home-h" tabindex="-1">A little room for words.</h1>
        <p class="entry-lede">A poetry game for people who don't have to be poets.</p>
      </section>
      <figure class="entry-cast">
        <span class="entry-cast__group" aria-hidden="true">
          ${LJS.character('sunny', { size: 58, className: 'entry-cast__c entry-cast__c--sunny' })}
          ${LJS.character('orbit', { size: 78, prop: 'pencil', className: 'entry-cast__c entry-cast__c--orbit' })}
          ${LJS.character('pebble', { size: 78, prop: 'note', className: 'entry-cast__c entry-cast__c--pebble' })}
          ${LJS.character('moss', { size: 58, className: 'entry-cast__c entry-cast__c--moss' })}
        </span>
        <figcaption class="entry-cast__caption">Write a line. Pass it on.</figcaption>
      </figure>
      <div class="ljs-action entry-home__action">
        ${LJS.button({ label: 'Start a game', size: 'lg', block: true, attrs: 'data-entry-start' })}
        ${LJS.button({ label: 'Join a room', variant: 'secondary', block: true, attrs: 'data-entry-join' })}
      </div>`;
  }

  function renderHome(root, { notices = [] } = {}) {
    useHowInPlace();
    const pg = LJS.page(root, {
      header: { left: 'wordmark', menu: 'more', signIn: true },
      notices,
      mainClass: 'entry-home',
      body: homeBody(),
    });
    pg.main.querySelector('[data-entry-start]').addEventListener('click', () => LJS.go('04-host-entry-empty'));
    pg.main.querySelector('[data-entry-join]').addEventListener('click', () => LJS.go('09-join-empty'));
    return pg;
  }

  reg('01-entry-home', 'Home', 'entry', (root) => renderHome(root));

  reg('02-entry-home-more-menu', 'Home, More options open', 'entry', (root) => {
    const pg = renderHome(root);
    LJS.openMenu(menuButton(pg));
  });

  reg('03-entry-how-to-play', 'How to play', 'entry', (root) => {
    const pg = renderHome(root);
    openHow(menuButton(pg));
  });

  reg('73-after-close-room-host', 'Home after closing the room (Juniper)', 'entry', (root) =>
    renderHome(root, { notices: ['roomClosedHost'] })
  );

  /* ---------- pen name field and character button (host and join) ---------- */
  function castButton(cast, { locked = false } = {}) {
    return `<button type="button" class="entry-castbtn" data-entry-cast="${cast}" aria-haspopup="dialog" aria-label="Change character, ${esc(NAMES[cast])} selected"${
      locked ? ' aria-disabled="true"' : ''
    }>${LJS.character(cast, { size: 56 })}</button>`;
  }

  function nameField({ value = '', cast, locked = false, helper = false }) {
    return `<div class="entry-field">
      <label class="ljs-label" for="entry-name">Your pen name</label>
      <div class="entry-field__row">
        <input id="entry-name" class="entry-input" type="text" value="${esc(value)}" maxlength="24" autocomplete="nickname" autocapitalize="words" spellcheck="false" enterkeyhint="go"${
          helper ? ' aria-describedby="entry-name-help"' : ''
        }${locked ? ' readonly' : ''} />
        ${castButton(cast, { locked })}
      </div>
      ${helper ? '<p class="entry-help" id="entry-name-help">Friends see this name next to your character.</p>' : ''}
    </div>`;
  }

  function errorLine(id, text) {
    return `<p class="entry-error" id="${id}">${LJS.icon('alert', 18)}<span>${esc(text)}</span></p>`;
  }

  /* The character sheet: selection is immediate, closes the sheet, focus returns to the trigger. */
  function setCast(trigger, cast) {
    trigger.dataset.entryCast = cast;
    trigger.setAttribute('aria-label', `Change character, ${NAMES[cast]} selected`);
    trigger.innerHTML = LJS.character(cast, { size: 56 });
  }

  function openPicker(pg, trigger) {
    const current = trigger.dataset.entryCast;
    const items = LJ.CAST_IDS.map((id) => {
      const on = id === current;
      return `<li><button type="button" class="entry-pick" data-pick="${id}" aria-pressed="${on}"${on ? ' data-autofocus' : ''}>
        ${LJS.character(id, { size: 60 })}
        <span class="entry-pick__name">${esc(NAMES[id])}</span>
        <span class="entry-pick__check" aria-hidden="true">${LJS.icon('check', 14)}</span>
      </button></li>`;
    }).join('');
    const sheet = LJS.openSheet({
      title: 'Choose your character',
      body: `<ul class="entry-picks">${items}</ul>`,
      className: 'entry-picksheet',
      opener: trigger,
    });
    sheet.el.addEventListener('click', (e) => {
      const pick = e.target.closest('[data-pick]');
      if (!pick) return;
      setCast(trigger, pick.dataset.pick);
      sheet.close();
      pg.say(`${NAMES[pick.dataset.pick]} selected.`);
    });
    return sheet;
  }

  function wirePicker(pg) {
    const trigger = pg.main.querySelector('[data-entry-cast]');
    trigger.addEventListener('click', () => {
      if (busy(trigger)) return;
      openPicker(pg, trigger);
    });
    return trigger;
  }

  /* Lock or unlock the form while the room answers. */
  function lockForm(form, locked) {
    form.querySelectorAll('.entry-input').forEach((i) => (i.readOnly = locked));
    const trigger = form.querySelector('[data-entry-cast]');
    if (locked) trigger.setAttribute('aria-disabled', 'true');
    else trigger.removeAttribute('aria-disabled');
  }

  /* ---------- host entry: Start a game ---------- */
  function renderHost(root, { name = '', cast = 'orbit', state = 'idle' } = {}) {
    useHowInPlace();
    const pending = state === 'pending';
    const failed = state === 'error';
    const pg = LJS.page(root, {
      header: { left: 'wordmark', menu: 'more' },
      mainClass: 'entry-form',
      body: `
        <header class="entry-head">
          <h1 class="ljs-title" tabindex="-1">Start a game</h1>
          <p class="entry-sub">Pick a pen name. Friends join with your room code.</p>
        </header>
        <form class="entry-stage" novalidate data-entry-form>
          ${nameField({ value: name, cast, locked: pending, helper: true })}
          <div class="ljs-action entry-stage__action">
            ${failed ? errorLine('entry-create-err', "That didn't go through. Check your connection and try again.") : ''}
            ${LJS.button({
              label: 'Create room',
              size: 'lg',
              block: true,
              type: 'submit',
              disabled: !pending && !name.trim(),
              pending: pending ? 'Creating room…' : null,
              attrs: `data-entry-create${failed ? ' aria-describedby="entry-create-err"' : ''}`,
            })}
          </div>
        </form>`,
    });
    const form = pg.main.querySelector('[data-entry-form]');
    const input = form.querySelector('#entry-name');
    const create = form.querySelector('[data-entry-create]');
    wirePicker(pg);
    input.addEventListener('input', () => {
      if (create.getAttribute('aria-busy') !== 'true') create.disabled = !input.value.trim();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy(create) || !input.value.trim()) return;
      const err = form.querySelector('.entry-error');
      if (err) {
        err.remove();
        create.removeAttribute('aria-describedby');
      }
      lockForm(form, true);
      const restore = LJS.pending(create, 'Creating room…');
      await LJS.wait(600);
      if (!LJS.go('08-lobby-host-alone')) {
        restore();
        lockForm(form, false);
      }
    });
    return pg;
  }

  reg('04-host-entry-empty', 'Start a game, empty (Juniper)', 'entry', (root) => renderHost(root));

  reg('05-host-avatar-picker', 'Choose your character (Juniper)', 'entry', (root) => {
    const pg = renderHost(root);
    openPicker(pg, pg.main.querySelector('[data-entry-cast]'));
  });

  reg('06-host-entry-filled', 'Start a game, filled (Juniper, Orbit)', 'entry', (root) => renderHost(root, { name: 'Juniper' }));

  reg('07-host-creating', 'Start a game, creating room (Juniper)', 'entry', (root) =>
    renderHost(root, { name: 'Juniper', state: 'pending' })
  );

  reg('x-host-create-error', "Start a game, room didn't go through (Juniper)", 'entry', (root) =>
    renderHost(root, { name: 'Juniper', state: 'error' })
  );

  /* ---------- cold start: the branded shell while the guest session starts ---------- */
  reg('98-host-loading', 'Start a game, slow link before the form is ready', 'entry', (root) => {
    useHowInPlace();
    const pg = LJS.page(root, {
      header: { left: 'wordmark', menu: 'more' },
      mainClass: 'entry-form',
      body: `
        <header class="entry-head">
          <h1 class="ljs-title" tabindex="-1">Start a game</h1>
          <p class="entry-sub">Pick a pen name. Friends join with your room code.</p>
        </header>
        <div class="entry-stage entry-skel" aria-hidden="true">
          <div class="entry-field">
            <span class="entry-skel__label"></span>
            <div class="entry-field__row"><span class="entry-skel__input"></span><span class="entry-skel__char"></span></div>
            <span class="entry-skel__help"></span>
          </div>
          <div class="ljs-action entry-stage__action"><span class="entry-skel__btn"></span></div>
        </div>`,
    });
    pg.main.setAttribute('aria-busy', 'true');
  });

  /* ---------- join ---------- */
  const cleanCode = (raw) => String(raw).replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4);
  const showCode = (raw) => {
    const c = cleanCode(raw);
    return c.length > 2 ? `${c.slice(0, 2)} ${c.slice(2)}` : c;
  };
  const JOIN_ERROR = {
    unknown: (code) => `No room ${showCode(code)} here. Check the code with your host.`,
    closed: () => `Room ${R.codeDisplay} has closed. Ask your host for a new code.`,
    full: () => `Room ${R.codeDisplay} is full. It holds ${R.capacity} players.`,
  };

  function codeField({ code = '', error = null, locked = false }) {
    return `<div class="entry-field" data-entry-codefield>
      <label class="ljs-label" for="entry-code">Room code</label>
      <input id="entry-code" class="entry-input entry-input--code" type="text" value="${esc(showCode(code))}" placeholder="AB CD" maxlength="5" inputmode="text" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="next"${
        error ? ' aria-invalid="true" aria-describedby="entry-code-err"' : ''
      }${locked ? ' readonly' : ''} />
      ${error ? errorLine('entry-code-err', error) : ''}
    </div>`;
  }

  function joiningLine() {
    return `<div class="entry-joining" data-entry-codefield>
      <p class="entry-joining__text">Joining room <strong class="entry-joining__code">${R.codeDisplay}</strong></p>
      ${LJS.button({ label: 'Change code', variant: 'quiet', size: 'sm', attrs: 'data-entry-change-code' })}
    </div>`;
  }

  /* outcome: what the (simulated) room answers for 9AUK on this screen. Any other code is unknown. */
  function renderJoin(root, { code = '', name = '', prefilled = false, error = null, outcome = 'ok' } = {}) {
    useHowInPlace();
    const errorText = error ? JOIN_ERROR[error](code) : null;
    const pg = LJS.page(root, {
      header: { left: 'wordmark', menu: 'more' },
      mainClass: 'entry-form',
      body: `
        <header class="entry-head">
          <h1 class="ljs-title" tabindex="-1">Join a room</h1>
        </header>
        <form class="entry-stage" novalidate data-entry-form>
          ${prefilled ? joiningLine() : codeField({ code, error: errorText })}
          ${nameField({ value: name, cast: JOINER_CAST })}
          <div class="ljs-action entry-stage__action">
            ${LJS.button({ label: 'Join room', size: 'lg', block: true, type: 'submit', disabled: cleanCode(code).length < 4 || !name.trim(), attrs: 'data-entry-joinroom' })}
          </div>
        </form>`,
    });
    const form = pg.main.querySelector('[data-entry-form]');
    const nameInput = form.querySelector('#entry-name');
    const join = form.querySelector('[data-entry-joinroom]');
    let currentCode = cleanCode(code);
    wirePicker(pg);

    const ready = () => currentCode.length === 4 && nameInput.value.trim().length > 0;
    const sync = () => {
      if (join.getAttribute('aria-busy') !== 'true') join.disabled = !ready();
    };

    function clearError() {
      const field = form.querySelector('[data-entry-codefield]');
      const err = field.querySelector('.entry-error');
      const input = field.querySelector('#entry-code');
      if (err) err.remove();
      if (input) {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      }
    }

    function showError(text) {
      const input = form.querySelector('#entry-code');
      clearError();
      input.insertAdjacentHTML('afterend', errorLine('entry-code-err', text));
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', 'entry-code-err');
      input.focus();
      pg.say(text);
    }

    function wireCode() {
      const input = form.querySelector('#entry-code');
      if (!input) return;
      input.addEventListener('input', () => {
        const formatted = showCode(input.value);
        if (input.value !== formatted) input.value = formatted;
        const next = cleanCode(formatted);
        if (next !== currentCode) clearError();
        currentCode = next;
        sync();
      });
    }

    function wireChange() {
      const change = form.querySelector('[data-entry-change-code]');
      if (!change) return;
      change.addEventListener('click', () => {
        form.querySelector('[data-entry-codefield]').outerHTML = codeField({ code: currentCode });
        wireCode();
        const input = form.querySelector('#entry-code');
        input.focus();
        input.select();
      });
    }

    wireCode();
    wireChange();
    nameInput.addEventListener('input', sync);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy(join) || !ready()) return;
      lockForm(form, true);
      const restore = LJS.pending(join, 'Joining…');
      await LJS.wait(600);
      const answer = currentCode === R.code ? outcome : 'unknown';
      if (answer === 'ok' && LJS.go('12-lobby-guest')) return;
      restore();
      lockForm(form, false);
      if (answer !== 'ok') {
        if (!form.querySelector('#entry-code')) {
          form.querySelector('[data-entry-codefield]').outerHTML = codeField({ code: currentCode });
          wireCode();
        }
        showError(JOIN_ERROR[answer](currentCode));
      }
    });
    return pg;
  }

  reg('09-join-empty', 'Join a room, empty (Wren)', 'entry', (root) => renderJoin(root));

  reg('11-join-prefilled-code', 'Join a room from an invite link (Wren)', 'entry', (root) =>
    renderJoin(root, { code: R.code, prefilled: true })
  );

  reg('10-join-error-unknown-code', 'Join a room, unknown code ZZ ZZ (Wren)', 'entry', (root) =>
    renderJoin(root, { code: 'ZZZZ', name: 'Wren', error: 'unknown' })
  );

  reg('76-join-error-closed-room', 'Join a room, room closed (Wren)', 'entry', (root) =>
    renderJoin(root, { code: R.code, name: 'Wren', error: 'closed', outcome: 'closed' })
  );

  reg('x-join-error-full-room', 'Join a room, room full (Wren)', 'entry', (root) =>
    renderJoin(root, { code: R.code, name: 'Wren', error: 'full', outcome: 'full' })
  );

  /* ---------- lost rooms, lost pages, crashes ---------- */
  function renderLost(root, { cast, title, body = '', actions }) {
    useHowInPlace();
    const pg = LJS.page(root, {
      header: { left: 'wordmark', menu: 'more' },
      mainClass: 'entry-lost',
      body: `<div class="entry-lost__stage">${LJS.emptyState({ cast, title, body })}</div>
        <div class="ljs-action">${actions}</div>`,
    });
    const on = (sel, fn) => {
      const b = pg.main.querySelector(sel);
      if (b) b.addEventListener('click', fn);
    };
    on('[data-entry-home]', () => LJS.go('01-entry-home'));
    on('[data-entry-join]', () => LJS.go('09-join-empty'));
    on('[data-entry-retry]', () => location.reload());
    return pg;
  }

  reg('77-room-not-found', 'Room not found', 'errors', (root) =>
    renderLost(root, {
      cast: 'plum',
      title: "This room isn't here.",
      body: 'The code may be wrong, or the room has closed.',
      actions: `${LJS.button({ label: 'Join a room', size: 'lg', block: true, attrs: 'data-entry-join' })}
        ${LJS.button({ label: 'Go home', variant: 'secondary', block: true, attrs: 'data-entry-home' })}`,
    })
  );

  reg('78-route-not-found', 'Page not found', 'errors', (root) =>
    renderLost(root, {
      cast: 'ziggy',
      title: 'This page wandered off.',
      actions: `${LJS.button({ label: 'Go home', size: 'lg', block: true, attrs: 'data-entry-home' })}
        ${LJS.button({ label: 'Join a room', variant: 'secondary', block: true, attrs: 'data-entry-join' })}`,
    })
  );

  reg('x-error-boundary', 'Something went wrong', 'errors', (root) =>
    renderLost(root, {
      cast: 'pebble',
      title: 'Something went wrong.',
      actions: LJS.button({ label: 'Try again', size: 'lg', block: true, attrs: 'data-entry-retry' }),
    })
  );

  /* ---------- update notice over a room screen (the host's lobby) ---------- */
  reg('x-update-notice', 'Lobby with the update notice (Juniper)', 'errors', (root) => {
    const pg = LJS.page(root, {
      header: { left: 'wordmark', menu: 'lobbyHost' },
      notices: ['update'],
      mainClass: 'entry-room',
      body: `
        <h1 class="sr-only">Room ${R.codeDisplay}</h1>
        ${LJS.invitation()}
        <section class="entry-room__players" aria-labelledby="entry-players-h">
          ${LJS.sectionHead({ title: 'Players', count: `${R.players.length} of ${R.capacity}`, id: 'entry-players-h' })}
          ${LJS.gathering(R.players, { you: R.you })}
        </section>
        <div class="ljs-action">${LJS.button({ label: 'Start game', size: 'lg', block: true, attrs: 'data-entry-startgame' })}</div>`,
    });
    const start = pg.main.querySelector('[data-entry-startgame]');
    start.addEventListener('click', async () => {
      if (busy(start)) return;
      const restore = LJS.pending(start, 'Starting…');
      await LJS.wait(600);
      if (!LJS.go('20-writing-r1-empty')) restore();
    });
  });
})();
