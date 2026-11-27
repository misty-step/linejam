import { EMBLEMS, ROUNDS, ROUND_WORDS, emblemName } from '../../shared/rules.ts';
import type { CirclePoemView, PoemLine, RoomView } from '../../shared/types.ts';
import { emblem, icons, mark } from './icons.ts';
import { esc } from './morph.ts';
import { qrSvg } from './qr.ts';
import type { State } from './state.ts';

export const DISCLOSURE = 'Anyone with this link can read this poem';
export const RECAP_DISCLOSURE = 'Anyone with this link can read every poem';

const THEME_ICON = { system: icons.system, light: icons.light, dark: icons.dark };
const THEME_NAME = { system: 'System', light: 'Light', dark: 'Dark' };
const PRESENCE_LABEL = { present: '', reconnecting: 'Reconnecting', away: 'Away' };

function flash(state: State, key: string): string {
  const f = state.flash[key];
  return `<p class="action-status${f?.kind === 'error' ? ' is-error' : ''}" role="status" data-flash="${key}">${f ? esc(f.text) : ''}</p>`;
}

function nudge(state: State, key: string): string {
  return state.nudge === key ? ' nudge' : '';
}

// ───────────────────────── top bar ─────────────────────────

function menu(state: State): string {
  const room = state.route.name === 'room' ? state.room : null;
  const items: string[] = [
    `<button class="menu-item" role="menuitem" data-action="help">How to play</button>`,
    `<a class="menu-item" role="menuitem" href="/poems" data-link>Your poems</a>`,
  ];
  if (room && room.phase !== 'closed') {
    if (room.you.isHost && room.phase === 'writing') {
      items.push(`<button class="menu-item is-danger" role="menuitem" data-action="end-game">End game</button>`);
    }
    if (room.you.isHost && (room.phase === 'lobby' || room.phase === 'complete')) {
      items.push(`<button class="menu-item is-danger" role="menuitem" data-action="close-room">Close room</button>`);
    }
    items.push(`<button class="menu-item is-danger" role="menuitem" data-action="leave-room">Leave room</button>`);
  }
  return `<div class="menu" role="menu" aria-label="Room options">${items.join('')}</div>`;
}

function topbar(state: State): string {
  const room = state.route.name === 'room' && state.room && state.room.phase !== 'closed' ? state.room : null;
  return `<header class="topbar">
    <a class="brand" href="/" data-link aria-label="Linejam home">${mark()}<span class="wordmark">Linejam</span></a>
    ${room ? `<span class="code-badge" aria-label="Room code ${esc(room.code)}">${esc(room.code)}</span>` : ''}
    <div class="topbar-actions">
      <button class="icon-btn" data-action="theme" aria-label="Theme: ${THEME_NAME[state.theme]}" title="Theme: ${THEME_NAME[state.theme]}">${THEME_ICON[state.theme]}</button>
      <button class="icon-btn" data-action="sound" aria-pressed="${state.muted}" aria-label="Mute sound" title="${state.muted ? 'Sound off' : 'Sound on'}">${state.muted ? icons.soundOff : icons.soundOn}</button>
      <div class="menu-wrap">
        <button class="icon-btn" id="menu-button" data-action="menu" aria-haspopup="menu" aria-expanded="${state.menuOpen}" aria-label="Room options" title="Room options">${icons.menu}</button>
        ${state.menuOpen ? menu(state) : ''}
      </div>
    </div>
  </header>`;
}

// ───────────────────────── landing ─────────────────────────

function landing(state: State): string {
  const joining = state.route.name === 'landing' && state.route.code !== '';
  const code = state.route.name === 'landing' ? state.route.code : '';
  const guestBlocked = state.guest.status === 'invalid' || state.guest.status === 'offline';
  const disabled = state.entryBusy !== null || guestBlocked || state.guest.status === 'checking';
  const recovery =
    state.guest.status === 'invalid'
      ? `<div class="recovery" role="alert"><p>Session expired</p><button class="btn btn-secondary" data-action="fresh-guest">Start fresh</button></div>`
      : state.guest.status === 'offline'
        ? `<div class="recovery" role="alert"><p>No connection</p><button class="btn btn-secondary" data-action="retry-guest">Retry</button></div>`
        : '';
  const picker = EMBLEMS.map(
    (id) =>
      `<button type="button" class="emblem-option" role="radio" aria-checked="${state.emblem === id}" aria-label="${emblemName(id)}" tabindex="${state.emblem === id ? 0 : -1}" data-action="emblem" data-emblem="${id}">${emblem(id)}</button>`
  ).join('');
  return `<main class="screen landing" data-key="landing">
    <div class="spread spread-landing">
      <section class="col col-identity" aria-label="You">
        <h1 class="display">Linejam</h1>
        <div class="field${nudge(state, 'penName')}">
          <label for="pen-name">Pen name</label>
          <input id="pen-name" class="input" type="text" name="penName" value="${esc(state.penName)}" maxlength="40" autocomplete="nickname" autocapitalize="words" spellcheck="false" enterkeyhint="done" data-input="pen-name" aria-invalid="${Boolean(state.errors.penName)}" aria-describedby="pen-name-error" />
          <p class="field-error" id="pen-name-error" role="alert">${esc(state.errors.penName ?? '')}</p>
        </div>
        <div class="field">
          <span class="label" id="emblem-label">Emblem</span>
          <div class="emblems" role="radiogroup" aria-labelledby="emblem-label">${picker}</div>
        </div>
      </section>
      <section class="sheet col-actions" aria-label="Rooms">
        ${recovery}
        <button class="btn ${joining ? 'btn-secondary' : 'btn-primary'}" data-action="create" ${disabled ? 'disabled' : ''}>${state.entryBusy === 'create' ? 'Opening…' : 'New room'}</button>
        ${flash(state, 'create')}
        <hr class="rule" />
        <form class="join" data-form="join" novalidate>
          <div class="field${nudge(state, 'code')}">
            <label for="room-code">Room code</label>
            <input id="room-code" class="input code-input" type="text" name="code" value="${esc(code)}" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" data-input="code" aria-invalid="${Boolean(state.errors.code)}" aria-describedby="room-code-error" />
            <p class="field-error" id="room-code-error" role="alert">${esc(state.errors.code ?? '')}</p>
          </div>
          <button class="btn ${joining ? 'btn-primary' : 'btn-secondary'}" type="submit" ${disabled ? 'disabled' : ''}>${state.entryBusy === 'join' ? 'Joining…' : 'Join'}</button>
        </form>
      </section>
    </div>
  </main>`;
}

// ───────────────────────── lobby ─────────────────────────

function roster(room: RoomView): string {
  const seats = room.members
    .map(
      (m) => `<li class="member" data-key="m${m.seat}">
        ${emblem(m.emblem, { you: m.isYou })}
        <span class="member-name">${esc(m.penName)}</span>
        ${m.isYou ? '<span class="tag">You</span>' : ''}
        ${m.isHost ? '<span class="tag tag-host">Host</span>' : ''}
        ${m.presence !== 'present' ? `<span class="presence">${PRESENCE_LABEL[m.presence]}</span>` : ''}
      </li>`
    )
    .join('');
  // Open seats are blank ruled lines on the sheet (desktop only); the count says the rest.
  const open = Array.from({ length: Math.max(0, room.capacity - room.members.length) }, (_, i) => `<li class="member is-open" aria-hidden="true" data-key="open${i}"></li>`).join('');
  return seats + open;
}

function lobby(state: State, room: RoomView): string {
  const joinUrl = `${location.origin}/join?code=${room.code}`;
  const start = room.you.isHost
    ? `<button class="btn btn-primary" data-action="start" ${room.startBlocker || state.busy.start ? 'disabled' : ''} aria-describedby="start-note">${state.busy.start ? 'Starting…' : 'Start game'}</button>
       <p class="note" id="start-note">${room.startBlocker === 'need_players' ? 'Need 2 players' : ''}</p>`
    : `<p class="note" id="start-note">Waiting for host</p>`;
  return `<main class="screen lobby" data-key="lobby">
    <div class="spread spread-lobby">
      <section class="sheet invite" aria-label="Invitation">
        <h1 class="label">Room code</h1>
        <button class="code-copy" data-action="copy-code" aria-label="Copy room code ${esc(room.code)}">
          <span class="code-big">${esc(room.code)}</span>
          <span class="code-hint${state.flash['copy-code']?.kind === 'error' ? ' is-error' : ''}" role="status" data-flash="copy-code">${esc(state.flash['copy-code']?.text ?? 'Copy')}</span>
        </button>
        <div class="qr-plate" role="img" aria-label="QR code to join room ${esc(room.code)}" data-qr="${esc(joinUrl)}">${qrSvg(joinUrl)}</div>
        <button class="btn btn-secondary" data-action="share-invite">Share invite</button>
        ${flash(state, 'share-invite')}
      </section>
      <section class="sheet players" aria-label="Players">
        <div class="sheet-head">
          <h2 class="label">Players</h2>
          <span class="count" aria-label="${room.members.length} of ${room.capacity} players">${room.members.length}/${room.capacity}</span>
        </div>
        <ul class="roster">${roster(room)}</ul>
        ${start}
        ${flash(state, 'start')}
      </section>
    </div>
  </main>`;
}

// ───────────────────────── writing ─────────────────────────

function cadence(round: number): string {
  return `<ol class="cadence" aria-label="Words per round">${ROUND_WORDS.map(
    (words, i) =>
      `<li class="cadence-step${i < round ? ' is-done' : i === round ? ' is-current' : ''}"${i === round ? ' aria-current="step"' : ''}>${words}</li>`
  ).join('')}</ol>`;
}

function progress(room: RoomView): string {
  return `<ul class="progress" aria-label="Writers">${room
    .game!.writers.map((w) => {
      const status = w.submitted ? 'Tucked' : w.presence === 'present' ? 'Writing' : PRESENCE_LABEL[w.presence];
      return `<li class="member" data-key="w${w.seat}">${emblem(w.emblem, { you: w.isYou })}<span class="member-name">${esc(w.penName)}</span><span class="presence${w.submitted ? ' is-done' : ''}">${status}</span></li>`;
    })
    .join('')}</ul>`;
}

function writing(state: State, room: RoomView): string {
  const game = room.game!;
  const assignment = game.assignment;
  const round = game.round;
  let right: string;
  if (!assignment) {
    right = `<section class="sheet compose" aria-label="Writers" data-key="watch">
      <h2 class="label">Spectating</h2>
      <p class="note">You write next game</p>
      ${progress(room)}
    </section>`;
  } else if (assignment.submitted !== null) {
    right = `<section class="sheet compose is-tucked" aria-label="Your line" data-key="tucked-${game.id}-${round}">
      <p class="tucked" role="status">${icons.check}<span>Line tucked</span></p>
      <p class="my-line">${esc(assignment.submitted)}</p>
      <hr class="rule" />
      ${progress(room)}
    </section>`;
  } else {
    const over = state.tally > assignment.words;
    right = `<section class="sheet compose${nudge(state, 'compose')}" aria-label="Your line" data-key="compose-${game.id}-${round}">
      <form data-form="line" novalidate>
        <label class="label" for="line-input"><span class="mono">${assignment.words}</span> ${assignment.words === 1 ? 'word' : 'words'}</label>
        <textarea id="line-input" class="line-input" name="line" rows="3" maxlength="600" autocomplete="off" autocapitalize="sentences" enterkeyhint="send" data-input="line" aria-describedby="tally line-error" aria-invalid="${Boolean(state.lineError)}">${esc(state.draft)}</textarea>
        <p class="field-error" id="line-error" role="alert">${esc(state.lineError ?? '')}</p>
        <div class="compose-foot">
          <span class="tally${over ? ' is-over' : ''}" id="tally" aria-label="${state.tally} of ${assignment.words} words"><span class="tally-now" data-key="t${state.tally}">${state.tally}</span>/${assignment.words}</span>
          <button class="btn btn-primary" type="submit" ${state.busy.line ? 'disabled' : ''}>${state.busy.line ? 'Tucking…' : 'Tuck line'}</button>
        </div>
      </form>
    </section>`;
  }
  return `<main class="screen writing" data-key="writing">
    <div class="spread spread-writing">
      <section class="col col-round" aria-label="Round">
        <h1 class="round" aria-label="Round ${round + 1} of ${ROUNDS}"><span class="round-now" data-key="r${round}">${round + 1}</span><span class="round-of">/${ROUNDS}</span></h1>
        ${cadence(round)}
        ${
          assignment?.previous != null
            ? `<div class="previous" data-key="prev-${round}"><h2 class="label">Previous</h2><p class="previous-line">${esc(assignment.previous)}</p></div>`
            : ''
        }
      </section>
      ${right}
    </div>
  </main>`;
}

// ───────────────────────── reveal ─────────────────────────

const READING_LABEL = { reading: 'reading now', next: 'up next', read: 'read', waiting: '' };

export function poemBody(lines: PoemLine[]): string {
  return `<ol class="poem">${lines.map((l) => `<li class="poem-line"><p class="verse">${esc(l.text)}</p><p class="byline">${esc(l.by)}</p></li>`).join('')}</ol>`;
}

function heartButton(hearted: boolean, hearts: number, busy: boolean): string {
  return `<button class="heart${hearted ? ' is-on' : ''}" data-action="heart" aria-pressed="${hearted}" aria-label="Heart this poem" ${busy ? 'disabled' : ''}>${icons.heart}<span class="heart-count" data-key="h${hearts}${hearted}">${hearts}</span></button>`;
}

export function shareControl(
  state: State,
  key: string,
  share: { active: boolean; path: string | null } | undefined,
  labels: { share: string; disclosure: string }
): string {
  if (!share) return `<div class="share" data-key="share-${key}"></div>`;
  const busy = state.busy[`share-${key}`];
  if (share.active && share.path) {
    return `<div class="share is-active" data-key="share-${key}">
      <a class="share-link" href="${esc(share.path)}" target="_blank" rel="noopener" data-share-link>Shared link</a>
      <button class="btn btn-quiet" data-action="copy-share" data-share="${key}">Copy link</button>
      <button class="btn btn-quiet is-danger" data-action="revoke-share" data-share="${key}" ${busy ? 'disabled' : ''}>Revoke link</button>
      <p class="disclosure">${labels.disclosure}</p>
      ${flash(state, `share-${key}`)}
    </div>`;
  }
  return `<div class="share" data-key="share-${key}">
    <button class="btn btn-secondary" data-action="share" data-share="${key}" ${busy ? 'disabled' : ''}>${busy ? 'Sharing…' : labels.share}</button>
    <p class="disclosure">${labels.disclosure}</p>
    ${flash(state, `share-${key}`)}
  </div>`;
}

function rail(room: RoomView, selected: CirclePoemView | null): string {
  const circle = room.game!.circle!;
  const items = circle.poems
    .map((p) => {
      const revealed = p.lines !== null;
      const label = READING_LABEL[p.state];
      return `<li class="order-item is-${p.state}" data-key="o${p.id}">
        <button class="order-button" data-action="open-poem" data-poem="${p.id}" ${revealed ? '' : 'disabled'} ${selected?.id === p.id ? 'aria-current="true"' : ''}>
          <span class="order-n">${p.ord + 1}</span>
          <span class="order-reader">${esc(p.readerName)}</span>
          ${circle.mostHeartedPoemId === p.id ? '<span class="tag">Most hearts</span>' : ''}
          <span class="order-state">${label}</span>
        </button>
      </li>`;
    })
    .join('');
  return `<nav class="sheet rail" aria-label="Reading order">
    <h1 class="label">Reading circle</h1>
    <ol class="order">${items}</ol>
    <p class="sr-only" role="status" aria-live="polite">${circle.nextReaderName ? `Up next: ${esc(circle.nextReaderName)}` : 'All poems read'}</p>
  </nav>`;
}

function reveal(state: State, room: RoomView): string {
  const game = room.game!;
  const circle = game.circle!;
  const writer = game.role === 'writer';
  const selected =
    circle.poems.find((p) => p.id === state.selectedPoem && p.lines) ?? circle.poems.find((p) => p.state === 'reading') ?? null;

  const actions: string[] = [];
  if (circle.nextPoemId) {
    if (circle.canReveal) {
      actions.push(
        `<button class="btn btn-primary" data-action="reveal" ${state.busy.reveal ? 'disabled' : ''}>Next poem</button>`
      );
    }
  } else if (room.you.isHost) {
    actions.push(
      `<button class="btn btn-primary" data-action="play-again" ${room.startBlocker || state.busy.start ? 'disabled' : ''}>Play again</button>`,
      `<button class="btn btn-secondary" data-action="to-lobby">Back to lobby</button>`
    );
  }
  const note = circle.nextPoemId
    ? `<p class="note up-next" data-key="next-${circle.nextPoemId}"><span class="label">Up next</span><span class="up-next-name">${esc(circle.nextReaderName ?? '')}</span></p>`
    : room.you.isHost
      ? room.startBlocker === 'need_players'
        ? '<p class="note">Need 2 players</p>'
        : ''
      : '<p class="note">Waiting for host</p>';

  const sheet = selected
    ? `<article class="sheet poem-sheet" aria-label="Poem ${selected.ord + 1}" data-key="poem-${selected.id}">
        ${poemBody(selected.lines!)}
        ${
          writer
            ? `<div class="poem-actions">
                ${heartButton(selected.hearted, selected.hearts, Boolean(state.busy.heart))}
                ${shareControl(state, selected.id, state.shares[selected.id], { share: 'Share poem', disclosure: DISCLOSURE })}
              </div>`
            : ''
        }
      </article>`
    : `<article class="sheet poem-sheet is-empty" aria-label="Poem" data-key="poem-none"></article>`;

  const recapShare =
    writer && !circle.nextPoemId
      ? shareControl(state, `recap:${game.id}`, state.shares[`recap:${game.id}`], { share: 'Share recap', disclosure: RECAP_DISCLOSURE })
      : '';

  return `<main class="screen reveal" data-key="reveal">
    <div class="spread spread-reveal">
      ${rail(room, selected)}
      ${sheet}
      <div class="circle-actions">
        ${note}
        ${actions.join('')}
        ${flash(state, 'circle')}
        ${recapShare}
      </div>
    </div>
  </main>`;
}

// ───────────────────────── archive, poem, recap, misc ─────────────────────────

const day = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function message(title: string, body = '', action = ''): string {
  return `<main class="screen message" data-key="message-${esc(title)}"><div class="column">
    <h1 class="title">${esc(title)}</h1>
    ${body ? `<p class="note">${esc(body)}</p>` : ''}
    ${action}
  </div></main>`;
}

const HOME = `<a class="btn btn-secondary" href="/" data-link>Home</a>`;

function archive(state: State): string {
  const a = state.archive;
  let body: string;
  if (a.status === 'loading') body = `<p class="note" role="status">Loading…</p>`;
  else if (a.status === 'error')
    body = `<p class="note" role="alert">Poems did not load</p><button class="btn btn-secondary" data-action="load-archive">Retry</button>`;
  else if (a.entries.length === 0) body = `<p class="note">No poems yet</p>${HOME}`;
  else
    body = `<ul class="poem-list">${a.entries
      .map(
        (p) => `<li class="poem-row" data-key="a${p.id}">
          <a class="poem-row-link" href="/poem/${esc(p.id)}" data-link>
            <span class="poem-first">${esc(p.firstLine)}</span>
            <span class="poem-meta">${esc(p.writers.join(', '))} · ${day.format(p.completedAt)}${p.shared ? ' · Shared' : ''}</span>
          </a>
          <button class="heart${p.favorited ? ' is-on' : ''}" data-action="archive-heart" data-poem="${esc(p.id)}" aria-pressed="${p.favorited}" aria-label="Heart this poem">${icons.heart}</button>
        </li>`
      )
      .join('')}</ul>`;
  return `<main class="screen archive" data-key="archive"><div class="column">
    <h1 class="title">Your poems</h1>
    ${body}
  </div></main>`;
}

function poemPage(state: State): string {
  const p = state.poem;
  if (p.status === 'loading') return message('Loading…');
  if (p.status === 'missing' || !p.view) return message('Poem not found', '', HOME);
  if (p.status === 'error') return message('Poem did not load', '', `<button class="btn btn-secondary" data-action="load-poem">Retry</button>`);
  const view = p.view;
  const canHeart = state.guest.status === 'ready';
  return `<main class="screen poem-page" data-key="poem-page"><div class="column">
    <article class="sheet poem-sheet" aria-label="Poem">
      ${poemBody(view.lines)}
      <div class="poem-actions">
        ${canHeart ? heartButton(view.favorited, view.hearts, Boolean(state.busy.heart)) : ''}
        ${
          view.participant
            ? `<button class="btn btn-quiet" data-action="copy-text">Copy text</button>
               <button class="btn btn-quiet" data-action="save-image">Save image</button>
               ${flash(state, 'export')}
               ${view.revealed ? shareControl(state, view.id, view.share, { share: 'Share poem', disclosure: DISCLOSURE }) : ''}`
            : ''
        }
      </div>
    </article>
  </div></main>`;
}

function recapPage(state: State): string {
  const r = state.recap;
  if (r.status === 'loading') return message('Loading…');
  if (r.status === 'missing' || !r.view) return message('Recap not found', '', HOME);
  if (r.status === 'error') return message('Recap did not load', '', `<button class="btn btn-secondary" data-action="load-recap">Retry</button>`);
  const view = r.view;
  return `<main class="screen recap-page" data-key="recap-page"><div class="column">
    <h1 class="title">${esc(view.writers.join(', '))}</h1>
    <p class="note">${day.format(view.completedAt)}</p>
    ${view.poems.map((p) => `<article class="sheet poem-sheet" aria-label="Poem ${p.ord + 1}">${poemBody(p.lines)}</article>`).join('')}
  </div></main>`;
}

function roomScreen(state: State): string {
  const room = state.room;
  if (state.roomGone === 'closed' || room?.phase === 'closed') return message('Room closed', '', HOME);
  if (!room) {
    return state.roomError
      ? message(state.roomError, '', `<button class="btn btn-secondary" data-action="retry-room">Retry</button>`)
      : message('Loading…');
  }
  if (room.phase === 'lobby') return lobby(state, room);
  if (room.phase === 'writing') return writing(state, room);
  return reveal(state, room);
}

export function view(state: State): string {
  let screen: string;
  switch (state.route.name) {
    case 'landing':
      screen = landing(state);
      break;
    case 'room':
      screen = roomScreen(state);
      break;
    case 'poems':
      screen = state.guest.status === 'ready' || state.guest.status === 'checking' ? archive(state) : message('No poems yet', '', HOME);
      break;
    case 'poem':
      screen = poemPage(state);
      break;
    case 'recap':
      screen = recapPage(state);
      break;
    case 'account':
      screen = message('Account', 'Accounts are not connected', HOME);
      break;
    default:
      screen = message('Page not found', '', HOME);
  }
  const offline =
    state.route.name === 'room' && state.room && state.link === 'reconnecting'
      ? `<p class="link-status" role="status">Reconnecting…</p>`
      : '';
  return `${topbar(state)}${offline}${screen}`;
}
