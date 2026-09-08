'use strict';

// Disconnected design sketches. No gameplay, account or publication service is called.
const ids = {
  view: 'app-shell home host-entry join-entry room-lobby lobby-presentation room-writing room-waiting late-join-spectator reveal-circle poem-reading reveal-presentation session-recap room-unavailable room-recovery guest-session-recovery connection-notice deployment-update archive poem-detail public-poem poem-sharing recap-sharing poem-image-export poem-print public-recap sign-in sign-up auth-callback profile account-controls help appearance releases releases-feed not-found route-error global-error site-social-preview poem-social-preview recap-social-preview'.split(' '),
  component: 'root-layout header footer home-page host-page join-page room-page unexpected-room-state lobby writing-screen writing-composer waiting-screen reveal-phase poem-display session-recap-hub stage-shell lobby-stage lobby-join-qr reveal-stage room-chrome focused-entry-appearance color-mode-control help-modal connection-status deployment-skew-observer room-panel-error-boundary auth-error-state accounts-unavailable archive-page archive-info-strip archive-stats stat-line archive-stats-skeleton poem-card poem-card-skeleton empty-archive poem-silhouette poem-silhouette-compact author-dots author-dots-inline poem-detail recap-page recap-export-button auth-layout sign-in-page sign-up-page auth-callback-page auth-showcase profile-page releases-page release-card technical-details not-found-page route-error-page global-error-page button input label alert avatar host-badge loading-state round-clock stamp-animation word-slots heart-button site-social-card poem-preview-card poem-fallback-card poem-full-card recap-social-card'.split(' '),
  motion: 'global-reduced-motion color-mode-transition viewport-projection writing-focus-scroll button-press stamp-arrival loading-indicators fade-up-entrances archive-card-interaction silhouette-bars contributor-hover waiting-presence-pulse round-clock-drain word-slot-feedback ready-seal-loop submission-confirmation author-attribution-reveal help-open-close chrome-popover-feedback reading-target-focus stage-roster-highlight favorite-crown-ceremony ceremony-effects-hook profile-image-hover unmounted-motion-definitions'.split(' '),
  sensory: 'brand-identity wordmark-and-logo device-brand-assets paper-grain-and-depth typographic-voice player-identity word-pattern-shape icon-vocabulary ceremony-audio ceremony-haptics share-artifacts native-platform-surfaces public-auth-showcase'.split(' '),
};
const labels = {
  'app-shell': 'The room around the game', home: 'Start or join a game', 'host-entry': 'Create a room', 'join-entry': 'Join a room',
  'room-lobby': 'The cast gathers', 'lobby-presentation': 'Present the invitation', 'room-writing': 'Write your line', 'room-waiting': 'Your line is recorded',
  'late-join-spectator': 'Watch this game', 'reveal-circle': 'The reading order', 'poem-reading': 'Read the whole poem', 'reveal-presentation': 'Present the whole poem',
  'session-recap': 'The private recap', archive: 'Your collection', 'poem-detail': 'A saved poem', 'public-poem': 'A public poem',
  'poem-image-export': 'A complete poem image', 'poem-print': 'A paper copy', appearance: 'Daylight or evening',
  'global-reduced-motion': 'The still performance', 'favorite-crown-ceremony': 'No podium, just keeping', 'ready-seal-loop': 'Ready, without a pulse',
  'reading-target-focus': 'One curtain, one whole poem', 'wordmark-and-logo': 'The curtain-line mark', 'ceremony-audio': 'An optional warm bell',
};
const genericStates = ['default', 'loading', 'empty', 'error', 'recovery', 'pending', 'complete', 'long-text'];
const states = {
  'home': ['default', 'returning', 'long-text'],
  'host-entry': ['default', 'empty', 'loading', 'pending', 'error', 'recovery', 'long-text'],
  'join-entry': ['default', 'invited', 'empty', 'loading', 'pending', 'error', 'full', 'recovery'],
  'room-lobby': ['default', 'empty', 'participant', 'full', 'away', 'error', 'recovery', 'long-text'],
  'lobby-presentation': ['default', 'full', 'away', 'long-text'],
  'room-writing': ['default', 'first', 'empty', 'below', 'exact', 'over', 'overflow', 'long-text', 'restored', 'pending', 'recorded', 'already-recorded', 'final', 'offline', 'error', 'recovery', 'terminal', 'overtime'],
  'room-waiting': ['default', 'loading', 'complete', 'away', 'participant', 'confirming', 'pending', 'error'],
  'reveal-circle': ['default', 'loading', 'pending', 'error', 'fallback-reader', 'reread', 'spectator', 'complete'],
  'poem-reading': ['default', 'authors', 'kept', 'error', 'long-text'],
  'reveal-presentation': ['default', 'empty', 'waiting', 'ready', 'fallback-reader', 'pending', 'error', 'complete', 'long-text'],
  'session-recap': ['default', 'empty', 'kept', 'pending', 'error', 'public'],
  'connection-notice': ['offline', 'reconnecting', 'restored', 'healthy'],
  'deployment-update': ['default', 'healthy', 'error'],
  'archive': ['default', 'empty', 'loading', 'error', 'account', 'kept', 'public', 'long-text'],
  'poem-detail': ['default', 'loading', 'public', 'private', 'authors', 'kept', 'error', 'long-text'],
  'public-poem': ['public', 'loading', 'pending', 'private', 'revoked', 'unavailable', 'long-text'],
  'poem-sharing': ['default', 'pending', 'delivered', 'cancelled', 'error', 'public', 'revoked'],
  'recap-sharing': ['default', 'pending', 'delivered', 'cancelled', 'error', 'public', 'revoked'],
  'poem-image-export': ['default', 'pending', 'complete', 'error', 'long-text'],
  'poem-print': ['default', 'long-text'],
  'public-recap': ['public', 'unavailable', 'long-text'],
  'sign-in': ['default', 'local', 'loading', 'verification', 'error', 'recovery'],
  'sign-up': ['default', 'local', 'loading', 'verification', 'error'],
  'auth-callback': ['loading', 'local', 'error', 'recovery', 'complete'],
  'profile': ['default', 'account', 'local', 'long-text'],
  'account-controls': ['default', 'account', 'local'],
  'appearance': ['default', 'open', 'selected'],
  'help': ['default', 'open', 'closed'],
  'releases': ['default', 'empty', 'expanded'],
  'releases-feed': ['default', 'empty'],
  'poem-social-preview': ['public', 'private', 'pending', 'revoked', 'long-text'],
  'recap-social-preview': ['public', 'private', 'unavailable'],
};
const params = new URLSearchParams(location.search);
let surface = Object.hasOwn(ids, params.get('surface')) ? params.get('surface') : 'view';
let surfaceId = ids[surface].includes(params.get('id')) ? params.get('id') : ids[surface][surface === 'view' ? 1 : 0];
let state = params.get('state') || (states[surfaceId] || genericStates)[0];
let modeChoice = ['dark', 'light', 'system'].includes(params.get('mode')) ? params.get('mode') : 'dark';
let reduceOverride = params.get('reduced') === '1';
let soundEnabled = false;
let audioContext = null;
let dialogTrigger = null;
let countTimer;
let replayTimer;
let revealOnRender = ['poem-reading', 'reveal-presentation', 'reading-target-focus'].includes(surfaceId);
let lastCueAt = -Infinity;
const osMotion = matchMedia('(prefers-reduced-motion: reduce)');
const osColor = matchMedia('(prefers-color-scheme: dark)');
const wordPattern = [1, 2, 3, 4, 5, 4, 3, 2, 1];
const sample = ['Tonight', 'chairs whisper', 'beneath velvet umbrellas', 'a moon borrows slippers', 'and forgets its best manners', 'we offer it tea', 'the kettle bows', 'curtains breathe', 'Home'];
const sampleTwo = ['Somewhere', 'windows listen', 'a teacup dreams', 'of becoming a lighthouse', 'while the tiny spoons assemble', 'to borrow its scarf', 'morning changes costumes', 'nobody notices', 'Again'];
const sampleLong = ['Extraordinarily', 'chandeliers whisper', 'underneath unreasonablylongvelvetumbrellas tonight', 'the understudy rearranges constellations', 'while extraordinarily considerate caterpillars rehearse', 'their magnificently improbable entrances', 'everybody remembers eventually', 'theatre-goers reconsider', 'Encore'];
const castNames = ['Avery', 'Mina', 'Jules', 'Noor', 'Ren', 'Pip', 'Robin', 'Sasha'];
const cameoNames = ['Oval', 'Fan', 'Moon', 'Plume', 'Name only'];
const sketch = { active: false, role: 'host', name: 'Avery', cameo: 0, round: 0, draft: '', lines: [], lastSubmitted: '', kept: false, published: false, reader: 1, authors: false, note: '', verifiedPreview: false, arrivals: false };

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function title(id) { return labels[id] || id.replaceAll('-', ' ').replace(/^./, c => c.toUpperCase()); }
function is(...values) { return values.some(value => state === value); }
function wordCount(value) { const text = value.trim(); return text ? text.split(/\s+/u).length : 0; }
function normalizeLine(value) { return value.trim().replace(/\s+/gu, ' '); }
function actualMode() { return modeChoice === 'system' ? (osColor.matches ? 'dark' : 'light') : modeChoice; }
function reduced() { return reduceOverride || osMotion.matches; }
function link(view, text, className = 'button secondary') { return `<a class="${className}" href="?surface=view&amp;id=${view}&amp;mode=${actualMode()}" data-view="${view}">${text}</a>`; }
function button(action, text, className = 'button', extra = '') { return `<button type="button" class="${className}" data-action="${action}" ${extra}>${text}</button>`; }
function mark(className = 'brand-mark') { return `<svg class="${className}" viewBox="0 0 48 52" aria-hidden="true" fill="none"><path d="M6 44V18C6 8 13 4 24 4S42 8 42 18V44M12 42V18C12 12 17 9 24 9S36 12 36 18V42" stroke="currentColor" stroke-width="2.1"/><path d="M7 18C7 29 14 32 19 33M41 18C41 29 34 32 29 33M17 41H31" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`; }
function cameo(index = 0, className = 'cameo') {
  if (index === 4) return `<svg class="${className}" viewBox="0 0 48 58" aria-hidden="true"><rect x="5" y="4" width="38" height="49" rx="19" fill="none" stroke="currentColor"/><path d="M15 28H33M15 35H29" stroke="currentColor" stroke-width="2"/></svg>`;
  const shapes = [
    '<path d="M15 46C16 37 21 37 21 34C15 32 15 19 23 17C31 15 34 23 29 29L33 31L28 33V38C34 38 37 41 38 46Z"/>',
    '<path d="M10 45L15 31L10 21L19 25L21 13L26 24L37 16L32 30L39 37L29 39L31 46Z"/>',
    '<path d="M34 16C18 10 9 31 18 42C22 47 31 46 36 41C23 43 19 25 34 16Z"/><circle cx="32" cy="28" r="2"/>',
    '<path d="M15 46C15 35 24 36 20 29C8 27 16 8 24 16C28 5 40 17 32 24C42 28 31 34 28 36L35 46Z"/>',
  ];
  return `<svg class="${className}" viewBox="0 0 48 58" aria-hidden="true"><rect x="3" y="3" width="42" height="52" rx="22" fill="none" stroke="currentColor" stroke-width="1.2"/><g fill="currentColor">${shapes[index % 4]}</g></svg>`;
}
function icon(name) {
  const paths = {
    bell: '<path d="M8 16h16l-2-4V8a6 6 0 0 0-12 0v4l-2 4Zm5 4a3 3 0 0 0 6 0"/>',
    keep: '<path d="M10 4h12v24l-6-4-6 4V4Z"/>',
    print: '<path d="M10 10V3h12v7M10 24H6V11h20v13h-4M10 19h12v10H10V19Z"/>',
    archive: '<path d="M5 6h22v6H5zM8 12v15h16V12M13 18h6"/>',
    help: '<circle cx="16" cy="16" r="12"/><path d="M12 12a4 4 0 0 1 8 0c0 4-4 3-4 6M16 23h.01"/>',
  };
  return `<svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.keep}</svg>`;
}
function illustration() { return `<svg class="curtain-picture" viewBox="0 0 440 390" role="img" aria-label="Original illustration: an open pocket theatre, nine line shapes and four distinct cameo seats"><path d="M26 295V151C26 66 93 23 220 23S414 66 414 151V295Z" fill="var(--paper)" stroke="var(--line)"/><path d="M39 290V151C39 79 102 37 220 37S401 79 401 151V290" fill="none" stroke="var(--line)"/><path d="M27 152C31 87 95 27 177 27C141 65 131 137 122 186C107 242 52 253 27 248Z" fill="var(--curtain)"/><path d="M413 152C410 87 346 27 263 27C300 65 309 137 318 186C333 242 388 253 413 248Z" fill="var(--curtain)"/><path d="M61 104C66 175 74 204 47 231M94 68C89 145 95 181 79 219M379 104C374 175 366 204 393 231M346 68C351 145 345 181 361 219" fill="none" stroke="var(--line)" stroke-width="1.3"/><path d="M180 104h37M180 122h64M180 140h85M180 158h103M180 176h118M180 194h103M180 212h85M180 230h64M180 248h37" stroke="var(--ink)" stroke-width="4" stroke-linecap="round" opacity=".88"/><path d="M20 296H420M48 307H392" stroke="var(--lavender)" stroke-width="2"/><g fill="var(--raised)" stroke="var(--line)"><path d="M86 383v-29a24 24 0 0 1 48 0v29ZM152 383v-29a24 24 0 0 1 48 0v29ZM218 383v-29a24 24 0 0 1 48 0v29ZM284 383v-29a24 24 0 0 1 48 0v29Z"/></g><g fill="var(--lavender)"><ellipse cx="110" cy="350" rx="10" ry="13"/><path d="M164 361l2-24 11 8 13-7-5 24Z"/><path d="M251 336c-20-4-28 28-7 28-12-8-11-20 7-28Z"/><path d="M296 363l5-21-4-8 11 4 9-7-3 16 7 16Z"/></g></svg>`; }
function arc(active = -1) { return `<div class="word-arc" role="img" aria-label="Nine rounds: 1, 2, 3, 4, 5, 4, 3, 2, 1 words">${wordPattern.map((n, i) => `<span style="--words:${n}" class="${i === active ? 'active' : ''}" aria-hidden="true">${n}</span>`).join('')}</div>`; }
function statusTag(text, className = '') { return `<span class="status-tag ${className}"><span class="status-dot" aria-hidden="true"></span>${text}</span>`; }
function notice(text, variant = '', action = '') { return `<div class="notice ${variant}" role="${variant === 'error' ? 'alert' : 'status'}">${text}${action ? `<div class="button-row">${action}</div>` : ''}</div>`; }
function loading(text = 'Preparing the room…') { return `<div role="status" aria-live="polite" aria-busy="true" class="empty-scene">${mark()}<h2>${text}</h2><p>This is a loading-state sketch, not a connected request.</p><div aria-hidden="true"><div class="skeleton-line medium"></div><div class="skeleton-line short"></div></div>${button('recover', 'Show ready state', 'button secondary')}</div>`; }
function names() { const result = [...castNames]; result[0] = sketch.name; if (is('long-text')) result[1] = 'The remarkably long pen name of Minerva'; return result; }
function cast(count = 4, list = false, waiting = false) {
  const hostIndex = sketch.role === 'participant' || is('participant') ? 1 : 0;
  const watching = surfaceId === 'late-join-spectator';
  return `<div class="${list ? 'cast-list' : 'cast-strip'}" aria-label="Synthetic sample cast">${names().slice(0, count).map((name, i) => {
    const description = i === 0 && watching ? 'Watching, not writing' : waiting ? (i === 0 || i === 1 || is('complete') ? 'Recorded' : is('away') && i === 2 ? 'Away' : 'Writing') : i === hostIndex ? 'Host in this sketch' : is('away') && i === 2 ? 'Away' : sketch.arrivals && i === 3 ? 'Just joined this sketch' : 'Sample player';
    return `<div class="cast-member ${!list && i === sketch.reader && surfaceId.includes('reveal') ? 'reader' : ''}"><span ${i === 0 ? 'data-current-cameo' : ''}>${cameo(i === 0 ? sketch.cameo : i)}</span><div><div class="cast-name">${escapeHtml(name)}${i === 0 ? ' <span class="small">(you)</span>' : ''}</div><div class="cast-status">${description}</div></div>${list && i === hostIndex ? statusTag('Host') : ''}</div>`;
  }).join('')}</div>`;
}
function avatarOptions() { return `<div class="avatar-choices" role="group" aria-label="Optional cameo">${cameoNames.map((name, i) => `<button type="button" class="avatar-option" data-cameo="${i}" aria-pressed="${sketch.cameo === i}">${cameo(i)}<span>${name}</span></button>`).join('')}</div>`; }
function ticket(presenting = false) {
  return `<aside class="ticket" aria-label="Sample room invitation"><h2>${presenting ? 'Join this little room' : 'Your room invitation'}</h2><p class="ticket-code">SKETCH</p><p>Not a live room code</p><details class="ticket-qr" ${presenting ? 'open' : ''}><summary>Sample QR treatment</summary><img src="invitation-sample.svg" width="180" height="180" alt="Demonstration QR encoding the words LINEJAM DESIGN SKETCH, not a live room link"><p class="small">This original QR contains only “LINEJAM DESIGN SKETCH”. It never joins or publishes a room.</p></details><div class="ticket-footer"><p>Two to eight people.<br>Nine lines made together.</p>${button('invite', 'Open sketch invitation', 'button')}${button('copy-token', 'Copy sketch token', 'link-button')}<p class="small">A real room would put its own invitation in this place. This sample connects nowhere.</p></div></aside>`;
}
function roomTools() { return `<details class="details-block"><summary>Room tools</summary><div class="button-row">${link('lobby-presentation', 'Present invitation', 'quiet-button')}${button('invite', 'Invitation', 'quiet-button')}${button('help', 'How to play', 'quiet-button')}${button('appearance', 'Appearance', 'quiet-button')}</div></details>`; }
function pageIntro(heading, copy = '') { return `<div class="page-intro"><div><h1 tabindex="-1">${heading}</h1>${copy ? `<p>${copy}</p>` : ''}</div></div>`; }
function home() { return `<div class="home-grid"><section class="home-copy"><h1 tabindex="-1">A little room.<br>An unexpected poem.</h1><p>You write a line. Pass it on. Nine small contributions become something none of you could have written alone.</p><div class="button-row">${link('host-entry', 'Create a room', 'button')}${link('join-entry', 'Join a room')}</div><p class="small">Just people and their words. No account needed.</p>${is('returning') ? `<p class="small">Coming back for another look? ${link('archive', 'Open your collection', '')}</p>` : ''}</section><figure class="picture-wrap" style="margin-block:0">${illustration()}<figcaption class="picture-caption">A room of people. A poem no one planned.</figcaption></figure></div><section class="rule-row" aria-label="The shape of a game">${arc()}<p>One, two, three, four, five — then back to one. See only the previous line as you write. At the end, read every line together. ${button('help', 'How to play', 'link-button')}</p></section>`; }
function entry(join = false) {
  const pending = is('pending');
  if (is('loading')) return `<section class="stage focused compact">${loading(join ? 'Finding your place…' : 'Setting up your place…')}</section>`;
  return `<section class="stage focused compact"><div class="stage-title"><h1 tabindex="-1" style="font-size:2.6rem">${join ? 'There is a place for you.' : 'Bring a name.'}</h1><p>${join ? 'Join the people who invited you. No account needed.' : 'The room is yours to start. Everyone writes.'}</p></div>${is('error', 'full') ? notice(is('full') ? 'This sample room is full. Try another invitation or start your own room.' : 'The room could not open. Your name is still here; you can try again.', 'error') : ''}${is('recovery') ? notice('Your name is kept in this tab. Try the entry again.') : ''}<form id="entry-form" data-kind="${join ? 'join' : 'host'}">${join ? `<div class="field"><label for="room-code">Room code</label><input id="room-code" name="code" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${is('empty') ? '' : 'SKETCH'}" ${is('invited') ? 'readonly' : ''} maxlength="12" aria-describedby="code-help"><span id="code-help" class="field-help">${is('invited') ? 'Filled from the sketch invitation. ' : ''}Use SKETCH here. It is not a real four-letter room code.</span></div>` : ''}<div class="field"><label for="pen-name">Your name</label><input id="pen-name" name="name" type="text" autocomplete="nickname" maxlength="100" placeholder="The name your friends know" value="${is('empty') ? '' : escapeHtml(is('long-text') ? 'Avery with a wonderfully long pen name' : sketch.name)}" aria-describedby="name-help"><span class="field-help" id="name-help">Any name you are comfortable sharing with this room.</span><span id="entry-error" class="field-error" role="alert"></span></div><details class="details-block"><summary>Choose a cameo, if you like</summary>${avatarOptions()}</details><button class="button" type="submit" ${pending ? 'disabled' : ''}>${pending ? (join ? 'Joining…' : 'Creating…') : (join ? 'Join sketch room' : 'Create sketch room')}</button></form><p class="stage-foot">Design sketch only. No account, live room or network request is created. ${button('appearance', 'Appearance', 'link-button')}</p></section>`;
}
function lobby(presenting = false) {
  const count = is('empty') ? 1 : is('full') ? 8 : 4;
  if (presenting) return `${pageIntro('A place for everyone.', 'The same room invitation, made readable across the table.')}<div class="split-scene"><section class="stage"><h2>The cast so far</h2>${cast(count, true)}<div class="button-row">${link('room-lobby', 'Exit presentation')}</div></section>${ticket(true)}</div>`;
  const participant = is('participant') || sketch.role === 'participant';
  return `${pageIntro('The cast is gathering.', 'No need to be a poet. Just bring a line.')}${cast(count)}<div class="split-scene"><section class="stage"><h2>${count === 1 ? 'One more person, then begin.' : 'Everyone gets a turn.'}</h2><p style="margin-top:1rem">Nine rounds. A line from every person. Only the previous line travels with you.</p>${arc()}${is('error') ? notice('The game did not start. Everyone’s place is still here.', 'error') : ''}<div class="button-row">${participant ? statusTag('Waiting for the host to start') : button('start-game', 'Start nine-round sketch', 'button', count < 2 ? 'disabled' : '')}${button('leave', participant ? 'Leave room' : 'Close room', 'link-button')}</div>${participant ? `<p class="field-help">No live host is connected. ${button('start-game', 'Continue as host in this sketch', 'link-button')}</p>` : ''}<p class="stage-foot">${count} sample ${count === 1 ? 'person' : 'people'}. Real games need two to eight human participants.</p>${roomTools()}</section>${ticket()}</div>`;
}
function sendingBlocked() { return is('offline', 'pending', 'terminal') || (['connection-notice', 'connection-status'].includes(surfaceId) && !is('healthy', 'restored')); }
function roundIndex() { return sketch.active ? sketch.round : is('first', 'empty') ? 0 : is('final') ? 8 : 2; }
function startingDraft(target) {
  if (sketch.active) return sketch.draft;
  if (is('exact', 'recorded', 'already-recorded', 'pending')) return sample[roundIndex()];
  if (is('over')) return 'a moon in borrowed slippers';
  if (is('overflow')) return 'these are deliberately too many sample words for this short line and the count explains what to remove';
  if (is('long-text')) return 'antidisestablishmentarianism under unusuallylongunbrokenvelvetumbrellas';
  if (is('restored', 'error', 'offline', 'recovery', 'terminal')) return 'beneath velvet';
  if (is('below')) return 'beneath';
  return '';
}
function writing(withNotice = '', previewDraft) {
  if (is('loading')) return `<section class="stage focused">${loading('Finding your next line…')}</section>`;
  if (is('recorded', 'already-recorded')) return waiting();
  const round = roundIndex();
  const target = wordPattern[round];
  const draft = previewDraft ?? startingDraft(target);
  const count = wordCount(draft);
  const previous = sketch.active ? sketch.lines.at(-1) : round > 0 ? sample[round - 1] : null;
  const readonly = is('pending');
  return `${withNotice}<div class="round-strip"><p class="round-label">Round ${round + 1} of 9</p>${arc(round)}</div><section class="stage focused"><div class="stage-title"><h1 tabindex="-1" style="font-size:2.5rem">Write ${target} ${target === 1 ? 'word' : 'words'}.</h1></div>${previous ? `<div class="previous-line"><small>The previous line. Nothing before it.</small><p>${escapeHtml(previous)}</p></div>` : `<p class="field-help" style="margin-bottom:1.2rem">You are starting this poem. There is no previous line.</p>`}${is('restored', 'recovery') ? notice('Your draft is restored in this sketch. It has not been sent.') : ''}${is('error') ? notice('Your line was not sent. Your draft is safe in this tab; edit or try again.', 'error') : ''}${is('terminal') ? notice('The room cannot accept this line right now. Keep your draft, then rejoin.', 'error', button('recover', 'Reload sketch scene', 'quiet-button')) : ''}<form id="writing-form"><div class="field"><label for="line-input">Your line</label><textarea id="line-input" name="line" maxlength="500" rows="3" aria-describedby="word-guidance writing-privacy" ${readonly ? 'readonly' : ''}>${escapeHtml(draft)}</textarea></div><div class="word-meta"><p class="field-help" id="word-guidance">${count === target ? 'Ready to send.' : count > target ? `Remove ${count - target} ${count - target === 1 ? 'word' : 'words'}.` : `Add ${target - count} ${target - count === 1 ? 'word' : 'words'}.`}</p><p class="word-count ${count === target ? 'ready' : count > target ? 'over' : ''}" id="word-count">${count} / ${target} ${target === 1 ? 'word' : 'words'}</p></div><button id="submit-line" type="submit" class="button" ${count !== target || sendingBlocked() ? 'disabled' : ''}>${readonly ? 'Sending line…' : is('error') ? 'Try sending again' : 'Submit line'}</button><p class="field-help" id="writing-privacy">Only this previous line and your own words are visible here. ${sketch.active ? 'This disconnected sketch carries your own previous entry; no other humans are connected.' : 'Standalone fixture: the previous line is synthetic.'}</p></form><div class="stage-foot">${is('overtime') ? 'Take the time you need. There is no cut-off.' : 'A gentle pace, not a deadline. Take your time.'} ${button('help', 'Rules', 'link-button')}</div></section>`;
}
function waiting(spectator = false) {
  if (is('loading')) return `<section class="stage focused">${loading('Checking the room’s next step…')}</section>`;
  const last = sketch.active ? sketch.lines.at(-1) : sketch.lastSubmitted || sample[2];
  return `<section class="stage focused ${is('recorded', 'already-recorded') ? 'motion-receipt' : ''}"><div class="receipt"><div class="receipt-mark" aria-hidden="true">${mark()}</div><div><h1 tabindex="-1" style="font-size:2.5rem">${spectator ? 'Pull up a seat.' : 'Your line is in.'}</h1><p>${spectator ? 'You are watching this game.' : is('complete') ? 'Everyone’s line is recorded.' : 'Take a breath. The others are writing.'}</p></div></div>${spectator ? `<p>You joined after this game began. You can listen to the completed poems and write in the next game.</p><div class="waiting-seats" aria-hidden="true"><span></span><span></span><span></span><span></span></div>` : `<div class="previous-line"><small>${is('already-recorded') ? 'Already recorded — not sent twice' : 'Recorded in this local sketch'}</small><p>${escapeHtml(last)}</p></div>`}${cast(4, true, true)}${is('error') ? notice('Ending the game did not complete. Your place is unchanged.', 'error') : ''}${is('confirming') ? `<div class="inline-dialog"><h2>End this unfinished game?</h2><p>Return to the lobby without revealing partial poems.</p><div class="button-row">${button('end-game', 'End and return to lobby', 'button danger')}${button('recover', 'Keep waiting', 'button secondary')}</div></div>` : ''}<div class="button-row">${spectator ? link('reveal-circle', 'Preview completed reading order', 'button') : button('continue-round', sketch.active && sketch.round === 8 ? 'Open the completed poem' : 'Continue sketch', 'button')}${!spectator ? button('confirm-end', 'End game', 'link-button') : ''}</div><p class="stage-foot">${spectator ? 'Spectators are not counted among active writers.' : 'No live players are being simulated. Continue explicitly advances this design sketch.'}</p></section>`;
}
function currentPoem() { return sketch.lines.length === 9 ? sketch.lines : is('long-text') ? sampleLong : sample; }
function poemText(lines = currentPoem()) { return `<div class="poem-lines" aria-label="Complete nine-line poem">${lines.map((line, i) => `<p><span class="sr-only">Line ${i + 1}. </span>${escapeHtml(line)}</p>`).join('')}</div>`; }
function authorList() { return `<section class="poem-colophon" aria-label="Attribution"><h3>Who wrote the lines</h3>${sketch.lines.length === 9 ? `<p>All nine entries were typed by ${escapeHtml(sketch.name)} in this local interaction sketch. No sample cast member is claimed as their author.</p>` : `<p>Synthetic sample, not human gameplay evidence.</p><p>Attribution treatment: Avery, Mina, Jules and Noor would be listed here for their actual contributions in a real completed game.</p>`}</section>`; }
function keepButton() { return button('keep', `${icon('keep')} ${sketch.kept || is('kept') ? 'Kept privately' : 'Keep privately'}`, 'button secondary', `aria-pressed="${sketch.kept || is('kept')}"`); }
function playbill(lines = currentPoem(), options = {}) {
  const { reveal = false, publicView = false, showActions = true, printView = false } = options;
  return `<article class="stage focused playbill ${reveal && revealOnRender && !reduced() ? 'aperture' : ''}" data-playbill><div class="poem-meta">${statusTag(publicView ? 'Public-link sketch' : printView ? 'Print preview' : 'Private in this sketch', 'private')}<span>${sketch.lines.length === 9 ? 'Your locally entered nine lines' : 'Synthetic sample · nine lines'}</span></div>${poemText(lines)}${sketch.authors || is('authors') || printView || publicView ? authorList() : `<div class="poem-colophon">${button('authors', 'Show full attribution', 'link-button')}</div>`}${reveal ? '<div class="curtain-layer" aria-hidden="true"></div>' : ''}</article>${showActions ? `<div class="playbill-actions"><div class="button-row" style="margin-top:0">${publicView ? '' : keepButton()}${button('download', 'Save image', 'quiet-button')}${button('print', 'Print', 'quiet-button')}</div>${publicView ? link('home', 'Make a poem', 'link-button') : link('poem-sharing', 'Public-link options', 'link-button')}</div>` : ''}`;
}
function reading(presenting = false) {
  if (presenting && is('empty', 'waiting', 'ready', 'pending', 'error', 'complete')) {
    const heading = is('empty') ? 'No completed poem is open yet.' : is('waiting') ? 'Waiting for Mina to open her poem.' : is('complete') ? 'Every poem has been read.' : 'Mina’s complete poem is ready.';
    const readyContent = `<h2>${heading}</h2>${is('error') ? notice('The poem did not open. Try again; it has not been partly revealed.', 'error') : ''}<div class="button-row">${button('read-poem', is('complete') ? 'Reread the poem' : 'Open whole poem')}${link('reveal-circle', 'Exit presentation')}</div>${cast(4, true)}`;
    return `${pageIntro(is('complete') ? 'A lovely room of words.' : 'The stage is ready.', 'A human reader opens the entire poem; nothing advances a line at a time.')}<section class="stage focused">${is('pending') ? loading('Opening the completed poem…') : readyContent}</section>`;
  }
  return `<div class="${presenting ? 'shared-reading' : 'personal-reading'}"><div class="reader-strip"><div class="reader-label">${cameo(sketch.reader)}<div><h1 tabindex="-1" style="font-family:'DM Sans',sans-serif;font-size:1.1rem;letter-spacing:0">${escapeHtml(names()[sketch.reader])} is reading</h1><p>${sketch.active ? 'Your completed sketch poem' : 'Sample reader · complete sample poem'}</p></div></div><div class="reader-actions">${button('step-in', 'Someone else can read', 'quiet-button')}${presenting ? `${button('done-reading', 'Done reading')}${link('reveal-circle', 'Exit presentation', 'link-button')}` : ''}</div></div>${playbill(currentPoem(), { reveal: true, showActions: !presenting })}${presenting ? '' : `<div class="playbill-actions">${button('done-reading', 'Done reading')}${link('reveal-circle', 'Back to reading order', 'link-button')}</div>`}<p class="preview-caption">Read aloud if you like. There is no timer, no applause, and no obligation to be the reader.</p></div>`;
}
function revealCircle() {
  if (is('loading')) return `<section class="stage focused">${loading('Gathering the completed poems…')}</section>`;
  return `${pageIntro('Let the words have a room.', 'A whole poem, a human voice. Anyone can step in if a reader would rather listen.')}<div class="split-scene"><section class="stage"><h2>The reading order</h2><div class="library-list" style="margin-top:1.5rem">${names().slice(0, 4).map((name, i) => `<div class="library-item"><div><h3>${escapeHtml(name)}</h3><p>${is('complete') ? 'Read · available to reread' : i === 1 ? 'Ready to read' : i === 0 ? 'Read' : 'Up next'} · synthetic sample reader</p></div>${button('choose-reader', is('complete') || i === 0 ? 'Reread' : 'Open whole poem', 'quiet-button', `data-reader="${i}"`)}</div>`).join('')}</div><div class="button-row">${link('reveal-presentation', 'Present the reading', 'button secondary')}${link('session-recap', 'Private recap', 'link-button')}</div></section><aside class="ticket"><h2>${is('spectator') ? 'A seat in the audience.' : 'Your reading invitation.'}</h2><p style="margin-top:.8rem">${is('spectator') ? 'You are watching this game. Completed poems are yours to listen to.' : 'Open the complete poem when you are ready. You can ask someone else to read.'}</p>${is('error') ? '<p style="margin-top:.8rem">The poem did not open. Try again.</p>' : ''}<div class="ticket-footer">${button('read-poem', is('reread') ? 'Reread my poem' : is('fallback-reader') ? 'Step in and read' : 'Reveal and read', 'button', is('pending') ? 'disabled' : '')}${is('pending') ? '<p>Opening…</p>' : ''}</div></aside></div>`;
}
function recap(publicView = false) {
  if (publicView && is('unavailable', 'private')) return unavailable('This recap is private or no longer available.', 'No poem text or contributor details are shown.');
  if (publicView) return `${pageIntro('The poems from this room.', 'Public recap treatment · synthetic examples, not a published room.')}<div class="reading-columns">${[sample, sampleTwo].map((lines, i) => `<section><h2 style="margin-bottom:1rem">Poem ${i + 1}</h2>${playbill(lines, { publicView: true, showActions: false })}</section>`).join('')}</div><div class="button-row">${button('print', 'Print or save PDF')}${link('join-entry', 'Join a room')}${link('host-entry', 'Create a room')}</div>`;
  return `${pageIntro('Keep the words.<br>Leave the spotlight.', 'Your recap starts private. Keeping a poem is not a vote, a rank or a public link.')}<section class="stage focused"><h2>The programme</h2><div class="library-list" style="margin-top:1.5rem"><div class="library-item"><div><h3>${escapeHtml(currentPoem()[0])}</h3><p>All nine lines · ${sketch.lines.length === 9 ? 'your local entries' : 'synthetic sample'}</p>${statusTag(sketch.published || is('public') ? 'Public-link state is simulated' : 'Private in this sketch', 'private')}</div>${link('poem-reading', 'Replay whole poem', 'button')}</div></div>${is('error') ? notice('The next game did not start. This recap remains available.', 'error') : ''}${sketch.note ? notice(escapeHtml(sketch.note), 'success') : ''}<div class="button-row">${keepButton()}${link('recap-sharing', 'Whole-recap link options', 'link-button')}</div><p class="stage-foot">Nothing in this prototype is published. Local entries disappear when this page is reloaded unless you save an image or print.</p><div class="button-row">${button('new-game', is('pending') ? 'Starting…' : 'Start another sketch', 'button', is('pending') ? 'disabled' : '')}${link('room-lobby', 'Back to lobby')}${button('exit', 'Exit sketch', 'link-button')}</div></section>`;
}
function unavailable(heading = 'This room is no longer available.', copy = 'It may have closed, or the invitation may have expired. You can join another room.') { return `<section class="stage focused compact empty-scene">${mark()}<h1 tabindex="-1" style="font-size:2.5rem">${heading}</h1><p>${copy}</p><div class="button-row">${link('join-entry', 'Join another room', 'button')}${link('home', 'Return home')}</div></section>`; }
function recovery(kind = 'room') {
  if (is('loading')) return `<section class="stage focused compact">${loading(kind === 'guest' ? 'Finding your guest session…' : 'Preparing this page…')}</section>`;
  const heading = kind === 'global' ? 'Linejam could not open this page.' : kind === 'guest' ? 'Let’s reconnect your place.' : kind === 'route' ? 'This page lost its place.' : 'The room lost its place.';
  return `<section class="stage focused compact"><h1 tabindex="-1" style="font-size:2.5rem">${heading}</h1>${notice(kind === 'guest' ? 'The guest session could not connect. No account is required to try again.' : 'This is a recovery-state sketch. Any words you typed remain in this tab.', 'error')}<div class="button-row">${button('recover', 'Try again')}${link('home', 'Return home')}</div>${sketch.draft ? `<div class="previous-line" style="margin-top:1.5rem"><small>Your retained draft</small><p>${escapeHtml(sketch.draft)}</p></div>` : ''}</section>`;
}
function archive() {
  if (is('loading')) return `${pageIntro('Your little collection.')}<section class="stage focused">${loading('Preparing your collection…')}</section>`;
  if (is('error')) return recovery('guest');
  if (is('empty')) return `${pageIntro('Your little collection.')}<section class="stage focused empty-scene">${mark()}<h2>Your first poem is still ahead.</h2><p>Completed games belong here. Start a room or join friends to make something together.</p><div class="button-row">${link('host-entry', 'Create a room', 'button')}${link('join-entry', 'Join a room')}</div></section>`;
  return `${pageIntro('Your little collection.', is('account') ? 'An account collection treatment. No account service is connected to this sketch.' : 'In a real guest session, this browser holds your access. This sketch stores only in this tab.')}<section class="stage focused"><div class="small" style="color:var(--muted);margin-bottom:1.5rem">2 sample poems · 4 sample collaborators · no rankings</div><div class="library-list">${[currentPoem(), sampleTwo].map((lines, i) => `<article class="library-item"><div><h3>${escapeHtml(is('long-text') && i === 0 ? 'A remarkably long first line that still deserves room to breathe' : lines[0])}</h3><p>${escapeHtml(lines[1])} / ${escapeHtml(lines[2])}</p><p>${i === 0 && sketch.lines.length === 9 ? 'Your local sketch entries' : 'Synthetic nine-line sample'} · ${i === 0 && (sketch.kept || is('kept')) ? 'Kept privately' : 'Private sample'}</p></div>${link('poem-detail', 'Open poem', 'button secondary')}</article>`).join('')}</div>${is('public') ? notice('A public-link state is being previewed. Revoking it would stop future link access.', '', button('revoke', 'Revoke sketch link', 'quiet-button')) : ''}<div class="button-row">${link('host-entry', 'Make another poem', 'button')}</div></section>`;
}
function poemDetail(publicView = false) {
  if (is('loading')) return `<section class="stage focused">${loading('Opening the poem…')}</section>`;
  if (publicView && is('pending')) return `<section class="stage focused"><h1 tabindex="-1" style="font-size:2.5rem">Preparing this shared poem.</h1><p class="stage-foot">The link is not active. No poem text is shown while delivery is incomplete.</p>${link('home', 'Return home')}</section>`;
  if (publicView && is('private', 'revoked', 'unavailable', 'error')) return unavailable('This poem is private or no longer available.', 'A private, revoked or missing link does not reveal a preview.');
  return `${pageIntro(publicView ? 'A poem made together.' : 'A poem to come back to.', publicView ? 'Public permission-state sketch. This synthetic example is not a live shared link.' : 'Your saved playbill, with every line kept together.')}<p style="margin-bottom:1rem">${link(publicView ? 'home' : 'archive', publicView ? 'Back to Linejam' : 'Back to collection', 'link-button')}</p>${playbill(currentPoem(), { publicView })}${!publicView && (sketch.published || is('public')) ? `<div class="preview-caption">${notice('Public-link state is simulated. Revocation is separate from private saving.', '', button('revoke', 'Revoke sketch public link', 'quiet-button'))}</div>` : ''}${is('error') ? `<div class="preview-caption">${notice('That action did not complete. Your poem remains private and readable.', 'error')}</div>` : ''}`;
}
function sharing(whole = false) {
  const published = sketch.published || is('public', 'delivered');
  return `${pageIntro(whole ? 'Share the whole evening?' : 'Make a public link?', 'A private image or a printout is different from a link anyone could open.')}<section class="stage focused"><h2>${whole ? 'Every poem. Every contributor.' : 'The entire poem, not one line.'}</h2><p style="margin-top:1rem">${whole ? 'Anyone with a recap link could read every complete poem and its attribution. Check that the people in the room are comfortable with that.' : 'Anyone with the link could read all nine lines and their attribution. Check with the people who wrote it.'}</p>${notice(published ? 'Public-link state shown in this sketch only. Nothing was actually uploaded or published.' : is('cancelled', 'revoked') ? 'Still private. No active public link exists in this sketch.' : is('pending') ? 'Preparing a local delivery-state preview. A real link would remain inactive until delivery succeeds.' : 'This prototype has no publication service. The controls below explore consent, cancellation and recovery.', published ? 'success' : '')}${is('error') ? notice('Delivery or activation failed. Do not report a public-link success. Retry or keep the poem private.', 'error') : ''}<div class="button-row">${published ? button('revoke', 'Revoke sketch link', 'button danger') : button('publish-preview', 'Preview successful link delivery', 'button', is('pending') ? 'disabled' : '')}${button('cancel-share', 'Cancel — keep private', 'button secondary')}</div><details class="details-block"><summary>Native share and clipboard boundaries</summary><p>The operating system owns its share sheet. It is not drawn or opened as a fake dialog here. In the real flow, cancellation leaves the prepared link inactive; clipboard delivery is not success until activation succeeds.</p></details><div class="button-row">${button('download', 'Save a private image', 'quiet-button')}${link(whole ? 'session-recap' : 'poem-detail', 'Back to the poem', 'link-button')}</div></section>`;
}
function accountForm(signUp = false) {
  if (is('local')) return accountsUnavailable();
  if (is('loading')) return `<section class="stage focused">${loading('Opening account options…')}</section>`;
  return `${pageIntro(signUp ? 'Keep coming back.' : 'Your poems, between devices.', 'Account-form design sketch. No identity provider is connected; do not enter real credentials.')}<div class="reading-columns"><section class="stage"><h2>${is('verification') ? 'Check your email' : signUp ? 'Create an account' : 'Sign in'}</h2>${is('error', 'recovery') ? notice(is('recovery') ? 'Account recovery belongs to the configured provider. Your guest access remains available.' : 'The account step did not complete. Check the field and try again.', 'error') : ''}<form id="account-form" style="margin-top:1.3rem"><div class="field"><label for="account-email">${is('verification') ? 'Verification code — sketch only' : 'Email — sketch only'}</label><input id="account-email" type="text" autocomplete="off" value="${is('verification') ? '' : 'sample@example.invalid'}" aria-describedby="account-help"><span class="field-help" id="account-help">Nothing is submitted, saved or authenticated. Provider-managed forms would use the same readable palette and field hierarchy.</span></div><button class="button" type="submit">${is('verification') ? 'Finish form preview' : 'Preview verification step'}</button></form><div class="button-row">${link('home', 'Play as a guest', 'link-button')}${link(signUp ? 'sign-in' : 'sign-up', signUp ? 'Sign-in treatment' : 'Create-account treatment', 'link-button')}</div></section><aside class="auth-poem"><h2 style="margin-bottom:1rem">Something worth returning to.</h2>${playbill(sample, { showActions: false })}</aside></div>`;
}
function accountsUnavailable() { return `<section class="stage focused compact"><h1 tabindex="-1" style="font-size:2.5rem">Accounts are not connected.</h1><p style="margin-top:1rem">You can still explore guest play. This local design sketch does not save an account or synchronize poems between devices.</p><div class="button-row">${link('home', 'Play as a guest', 'button')}${link('profile', 'See guest identity')}</div></section>`; }
function callback() { if (is('local')) return accountsUnavailable(); if (is('error', 'recovery')) return `<section class="stage focused compact"><h1 tabindex="-1" style="font-size:2.5rem">Your guest poems stay with you.</h1>${notice('The account-transfer preview did not complete. Your local sketch entries have not been erased.', 'error')}<div class="button-row">${button('migration-retry', 'Retry transfer preview')}${link('home', 'Go home')}</div></section>`; return `<section class="stage focused compact">${is('complete') ? `<h1 tabindex="-1" style="font-size:2.5rem">Transfer-success treatment.</h1><p class="stage-foot">This is a visual state only. No account migration took place.</p>${link('home', 'Return home', 'button')}` : loading('Bringing your guest poems with you…')}</section>`; }
function profile() { return `${pageIntro('The name your room knows.', 'No stage persona required. A pen name is enough.')}<section class="stage focused compact"><div class="reader-label">${cameo(sketch.cameo)}<div><h2>${escapeHtml(is('long-text') ? 'Avery with a very long and wonderful pen name' : sketch.name)}</h2><p>${is('account') ? 'Account identity treatment · sample@example.invalid' : 'Guest in this tab'}</p></div></div><form id="profile-form" style="margin-top:1.5rem"><div class="field"><label for="profile-name">Name in this sketch</label><input id="profile-name" type="text" maxlength="100" value="${escapeHtml(sketch.name)}" required></div><div><p class="field-label">Optional cameo</p>${avatarOptions()}</div><button class="button" type="submit">Keep this name in the sketch</button></form><p class="stage-foot">${is('account') ? 'Provider account management would be separate from the room identity. This is not a signed-in session.' : 'Local guest mode. No account is connected; your words and name exist only in this tab.'}</p><div class="button-row">${is('account') ? button('sign-out', 'Preview sign out', 'button secondary') : link('sign-up', 'Explore optional account entry', 'link-button')}</div></section>`; }
function helpBody() { return `<h2 id="dialog-title">Nine lines.<br>One unexpected poem.</h2>${arc()}<div class="prose"><ol><li>Each person writes one line per round. The word counts go 1, 2, 3, 4, 5, 4, 3, 2, 1.</li><li>You only see the previous line. The rest stays hidden while you write.</li><li>At the end, open the complete poems and read them together. Anyone can help with the reading.</li></ol><p>The counter counts words separated by spaces. There are no scores, prompts or generated authors.</p></div><div class="button-row">${button('close-dialog', 'Got it')}</div>`; }
function appearanceBody() { return `<h2 id="dialog-title">Daylight or evening.</h2><p class="field-help" style="margin-top:.75rem">Same little room. Choose what feels readable.</p><fieldset style="border:0;padding:0;margin:1rem 0"><legend class="field-label">Color mode</legend>${['light', 'dark', 'system'].map(value => `<label class="settings-row"><span>${value === 'light' ? 'Daylight' : value === 'dark' ? 'Evening' : 'Follow system'}</span><input type="radio" name="appearance-mode" value="${value}" ${modeChoice === value ? 'checked' : ''}></label>`).join('')}</fieldset><label class="settings-row"><span>Reduce motion<p>${osMotion.matches ? 'Your system already asks for reduced motion.' : 'Remove the curtain aperture and cameo settle.'}</p></span><input type="checkbox" id="setting-reduced" ${reduceOverride || osMotion.matches ? 'checked' : ''} ${osMotion.matches ? 'disabled' : ''}></label><div class="settings-row"><div><span>Sound ${soundEnabled ? 'on' : 'off'}</span><p>Optional short bell. No music or applause.</p></div>${button('sound', soundEnabled ? 'Disable sound' : 'Enable sound', 'quiet-button')}</div>${avatarOptions()}<div class="button-row">${button('close-dialog', 'Done')}</div>`; }
function releaseCard() { return `<article><h2>Sketch edition</h2><p class="small" style="color:var(--muted);margin-top:.6rem">Illustrative release content · not real product history</p><p style="margin-top:1rem">A quieter place to write, and one complete poem to read together.</p><details class="details-block" ${is('expanded') ? 'open' : ''}><summary>Technical details</summary><div class="prose"><h3>Interface</h3><p>Original local artwork and locally bundled type. No external assets or account requests.</p><h3>Accessibility</h3><p>Sound begins off; reduced-motion preferences remove the aperture. Native controls keep keyboard navigation familiar.</p></div></details></article>`; }
function socialCard(kind = 'site') {
  const unavailablePreview = is('private', 'pending', 'revoked', 'unavailable') || kind === 'fallback';
  return `<div class="social-art" role="img" aria-label="Original ${unavailablePreview ? 'generic privacy-safe' : kind} social artwork design sketch"><div class="brand">${mark()}<span class="brand-name">Linejam</span></div>${kind === 'site' || unavailablePreview ? `<div class="social-copy"><h2>A little room.<br>An unexpected poem.</h2>${arc()}<p>No private poem text appears in this artwork.</p></div>` : kind === 'recap' ? `<div class="social-copy"><h2>The poems from this room.</h2><div class="reading-columns"><div><p class="display">Tonight<br>chairs whisper<br>beneath velvet umbrellas</p></div><div><p class="display">Somewhere<br>windows listen<br>a teacup dreams</p></div></div><p>Public permission-state sketch · synthetic samples</p></div>` : `<div class="social-copy"><h2>A poem made together.</h2><p class="display">Tonight<br>chairs whisper<br>beneath velvet umbrellas</p><p>Public permission-state sketch · synthetic sample</p></div>`}</div>`;
}
function renderView(id) {
  switch (id) {
    case 'home': return home();
    case 'app-shell': return `${pageIntro('A room, not a dashboard.', 'The curtain-line mark anchors one practical navigation. Guest play never sits behind an account.')}<section class="stage focused"><h2>Everything has its place.</h2><div class="button-row">${link('home', 'Home', 'button')}${link('archive', 'Collection')}${link('profile', 'Your name')}${button('help', 'Help', 'button secondary')}${button('appearance', 'Appearance', 'button secondary')}</div>${notice('Game navigation and sketch provenance stay visible even when exploration controls are embedded.')}</section>`;
    case 'host-entry': return entry();
    case 'join-entry': return entry(true);
    case 'room-lobby': return lobby();
    case 'lobby-presentation': return lobby(true);
    case 'room-writing': return writing();
    case 'room-waiting': return waiting();
    case 'late-join-spectator': return waiting(true);
    case 'reveal-circle': return revealCircle();
    case 'poem-reading': return reading();
    case 'reveal-presentation': return reading(true);
    case 'session-recap': return recap();
    case 'room-unavailable': return unavailable();
    case 'room-recovery': return recovery();
    case 'guest-session-recovery': return recovery('guest');
    case 'connection-notice': return writing(is('healthy') ? '' : notice(is('restored') ? 'Connection restored. Your draft is still here.' : is('reconnecting') ? 'Reconnecting. Keep your draft here while the room returns.' : 'Offline. Your draft stays in this tab; sending is unavailable.', is('offline') ? 'error' : ''));
    case 'deployment-update': return `${!is('healthy', 'error') ? notice('A new edition is ready. Reload when you can; keep your draft first.', '', button('recover', 'Reload sketch scene', 'quiet-button')) : ''}${home()}`;
    case 'archive': return archive();
    case 'poem-detail': return poemDetail();
    case 'public-poem': return poemDetail(true);
    case 'poem-sharing': return sharing();
    case 'recap-sharing': return sharing(true);
    case 'poem-image-export': return `${pageIntro('A poem you can take home.', 'A real local PNG download. No public link, no upload, and all nine lines included.')}<div class="export-preview">${playbill(currentPoem(), { showActions: false, printView: true })}</div><div class="playbill-actions">${button('download', is('pending') ? 'Saving…' : 'Save full poem PNG', 'button', is('pending') ? 'disabled' : '')}${is('error') ? notice('The image could not be saved. Try again; no public link was created.', 'error') : is('complete') ? statusTag('Saved-state preview', 'accepted') : ''}</div>`;
    case 'poem-print': return `${pageIntro('A paper copy.', 'The real browser print dialog opens only when you choose Print.')}<div class="print-preview">${playbill(currentPoem(), { showActions: false, printView: true })}</div><div class="playbill-actions">${button('print', 'Print or save PDF')}${link('poem-detail', 'Back to poem')}</div>`;
    case 'public-recap': return recap(true);
    case 'sign-in': return accountForm();
    case 'sign-up': return accountForm(true);
    case 'auth-callback': return callback();
    case 'profile': return profile();
    case 'account-controls': return is('local') ? accountsUnavailable() : `${pageIntro('Your account, outside the game.', 'Provider-managed controls are a design treatment, not a connected account.')}<section class="stage focused compact"><div class="reader-label">${cameo(sketch.cameo)}<h2>${escapeHtml(sketch.name)}</h2></div><div class="button-row">${button('manage-account', 'Manage account preview')}${button('sign-out', 'Preview sign out', 'button secondary')}</div><p class="stage-foot">Local guest mode does not claim authenticated account controls.</p></section>`;
    case 'help': return `<section class="stage focused compact">${is('closed') ? `<h1 tabindex="-1" style="font-size:2.5rem">Help stays out of the way.</h1><div class="button-row">${button('help', 'Open how to play')}</div>` : helpBody()}</section>`;
    case 'appearance': return `<section class="stage focused compact">${appearanceBody()}</section>`;
    case 'releases': return `${pageIntro('What changed in the room.', 'Illustrative release-note treatment. These are not real product release claims.')}<section class="stage focused">${is('empty') ? '<h2>No release notes yet.</h2><p class="stage-foot">When changes are published, they will appear here.</p>' : releaseCard()}<div class="button-row">${link('home', 'Back to Linejam')}${link('releases-feed', 'RSS preview', 'link-button')}</div></section>`;
    case 'releases-feed': return `${pageIntro('In your own reader.', 'RSS is an external artifact, not another application dashboard.')}<section class="stage focused"><h2>Synthetic feed preview</h2><pre class="feed-code">${escapeHtml(feedXml())}</pre><div class="button-row">${button('download-feed', 'Download sample RSS')}${link('releases', 'Back to release notes')}</div></section>`;
    case 'not-found': return unavailable('Nothing is playing at this address.', '404. There is no page here. Return home to start or join a room.');
    case 'route-error': return recovery('route');
    case 'global-error': return recovery('global');
    case 'site-social-preview': return `${pageIntro('An invitation, even as a thumbnail.', 'Original light social artwork. No remote imagery or private words.')} ${socialCard('site')}`;
    case 'poem-social-preview': return `${pageIntro('A public poem’s calling card.', 'Public content and generic privacy-safe fallback are deliberately different.')} ${socialCard('poem')}`;
    case 'recap-social-preview': return `${pageIntro('The programme cover.', 'A whole-session preview never borrows a private poem.')} ${socialCard('recap')}`;
    default: throw new Error(`Unimplemented view: ${id}`);
  }
}

const componentOwners = {
  'root-layout': 'app-shell', 'home-page': 'home', 'host-page': 'host-entry', 'join-page': 'join-entry', 'room-page': 'room-lobby',
  'unexpected-room-state': 'room-recovery', lobby: 'room-lobby', 'writing-screen': 'room-writing', 'writing-composer': 'room-writing',
  'waiting-screen': 'room-waiting', 'reveal-phase': 'reveal-circle', 'poem-display': 'poem-reading', 'session-recap-hub': 'session-recap',
  'stage-shell': 'reveal-presentation', 'lobby-stage': 'lobby-presentation', 'reveal-stage': 'reveal-presentation', 'connection-status': 'connection-notice',
  'deployment-skew-observer': 'deployment-update', 'room-panel-error-boundary': 'room-recovery', 'auth-error-state': 'guest-session-recovery',
  'archive-page': 'archive', 'poem-detail': 'poem-detail', 'recap-page': 'public-recap', 'auth-layout': 'sign-in', 'sign-in-page': 'sign-in',
  'sign-up-page': 'sign-up', 'auth-callback-page': 'auth-callback', 'profile-page': 'profile', 'releases-page': 'releases',
  'not-found-page': 'not-found', 'route-error-page': 'route-error', 'global-error-page': 'global-error',
};
function showcase(inner, caption = '') { return `<section class="stage preview-stage">${inner}</section>${caption ? `<p class="preview-caption">${caption}</p>` : ''}`; }
function renderComponent(id) {
  if (componentOwners[id]) return renderView(componentOwners[id]);
  switch (id) {
    case 'header': return showcase(`${header()}<p class="stage-foot">Labelled navigation wraps. Account status never blocks guest play.</p>`);
    case 'footer': return showcase(`<h2>The closing programme rule.</h2>${footer()}`);
    case 'lobby-join-qr': return `<div style="max-width:360px;margin-inline:auto">${ticket(true)}</div>`;
    case 'room-chrome': return showcase(`<div class="room-title">Sketch room <strong>SKETCH</strong> · Writing</div>${roomTools()}<p class="stage-foot">No valid QR or room code is fabricated. Invitation recovery stays labelled.</p>`);
    case 'focused-entry-appearance': return showcase(`<div class="field"><label for="preview-name">Your name</label><input id="preview-name" type="text" value="Avery"></div><div class="button-row">${button('appearance', 'Appearance', 'button secondary')}</div><p class="stage-foot">Close settings without losing the name or the invoking focus.</p>`);
    case 'color-mode-control': return showcase(appearanceBody());
    case 'help-modal': return showcase(`<h2>A short programme, not a tutorial.</h2><div class="button-row">${button('help', 'Open how to play')}</div>`);
    case 'accounts-unavailable': return accountsUnavailable();
    case 'archive-info-strip': return showcase(`<h2>Your collection stays personal.</h2>${notice(is('account') ? 'Account treatment: your saved poems follow your signed-in identity.' : is('empty') ? 'Play a game to make your first complete poem.' : 'Guest access belongs to this browser. This sketch itself keeps data in this tab only.')} ${link('archive', 'Open collection', 'button secondary')}`);
    case 'archive-stats': return showcase(`<h2>A few facts, not a scoreboard.</h2><div class="component-stack" style="margin-top:1.5rem"><div class="settings-row"><span>Sample poems</span><strong>2</strong></div><div class="settings-row"><span>Kept privately</span><strong>${sketch.kept ? 1 : 0}</strong></div><div class="settings-row"><span>Sample collaborators</span><strong>4</strong></div><div class="settings-row"><span>Sample lines</span><strong>18</strong></div></div>`);
    case 'stat-line': return showcase(`<div class="settings-row"><span>Poems in this sample collection</span><strong>2</strong></div><p class="stage-foot">A fact with a readable label; no score, crown or ranking.</p>`);
    case 'archive-stats-skeleton': return showcase(`<div aria-busy="true" role="status"><h2>Preparing collection facts…</h2><div aria-hidden="true">${[1, 2, 3, 4].map(() => '<div class="skeleton-line medium"></div>').join('')}</div></div>`);
    case 'poem-card': return showcase(`<article><h2>Tonight</h2><p class="sample-line" style="margin-top:1rem">chairs whisper<br>beneath velvet umbrellas</p><p class="stage-foot">Synthetic sample · nine lines · private</p><div class="button-row">${link('poem-detail', 'Open poem', 'button')}${keepButton()}</div>${is('error') ? notice('Keep did not complete. The previous private state is unchanged.', 'error') : ''}</article>`);
    case 'poem-card-skeleton': return showcase(loading('Preparing this poem…'));
    case 'empty-archive': return showcase(`${mark()}<h2>Your first poem is still ahead.</h2><p class="stage-foot">Completed human games will appear here.</p><div class="button-row">${link('host-entry', 'Create a room', 'button')}${link('join-entry', 'Join a room')}</div>`);
    case 'poem-silhouette': return showcase(`<h2>The actual shape of nine rounds.</h2>${arc()}<p class="stage-foot">One word, up to five, and back to one. Static at every size.</p>`);
    case 'poem-silhouette-compact': return showcase(`<h2>One readable rule shape.</h2>${arc()}<p class="stage-foot">The unused compact source variant is retired. This is its accessible replacement, not a second miniature effect.</p>`);
    case 'author-dots': return showcase(`<h2>Names, not anonymous dots.</h2>${cast(4, true)}<div class="button-row">${button('authors', 'Show full attribution', 'button secondary')}</div>${sketch.authors ? authorList() : ''}`);
    case 'author-dots-inline': return showcase(`<h2>Readable attribution.</h2><p style="margin-top:1rem">Avery, Mina, Jules and Noor</p><p class="stage-foot">Synthetic contributor labels. The unused gradient-underline variant is retired; attribution does not hide behind color or hover.</p>`);
    case 'recap-export-button': return showcase(`<h2>A whole programme on paper.</h2><p class="stage-foot">The operating system owns print and PDF destinations. Nothing resembling a fake native dialog appears here.</p><div class="button-row">${button('print', `${icon('print')} Print or save PDF`)}</div>`);
    case 'auth-showcase': return `<div class="preview-stage">${playbill(sample, { showActions: false })}<p class="stage-foot">Explicitly synthetic account-layout sample, never a private human poem.</p></div>`;
    case 'release-card': return showcase(releaseCard());
    case 'technical-details': return showcase(`<h2>What changed underneath.</h2>${releaseCard()}`);
    case 'button': return showcase(`<h2>Warm actions. Plain verbs.</h2><div class="button-row">${button('demo-feedback', 'Primary action')}${button('demo-feedback', 'Secondary action', 'button secondary')}${button('demo-feedback', 'Quiet utility', 'link-button')}${button('demo-feedback', 'Danger action', 'button danger')}${button('demo-feedback', 'Unavailable', 'button', 'disabled')}</div>${notice('Gold actions use dark plum text, never white. Keyboard focus adds a separate lavender outline.')}`);
    case 'input': return showcase(`<div class="component-stack"><div class="field"><label for="input-demo">Your name</label><input id="input-demo" type="text" value="${is('empty') ? '' : 'Avery'}" placeholder="The name your friends know" ${is('pending') ? 'disabled' : ''} ${is('error') ? 'aria-invalid="true"' : ''} aria-describedby="input-help"><span id="input-help" class="${is('error') ? 'field-error' : 'field-help'}">${is('error') ? 'Enter a name before joining. Your existing text has not been removed.' : 'Visible labels, generous padding and long-text wrapping.'}</span></div><div class="field"><label for="readonly-demo">Invitation destination</label><input id="readonly-demo" type="text" value="SKETCH — not a real room code" readonly></div></div>`);
    case 'label': return showcase(`<div class="field"><label for="label-demo">Your line — exactly 3 words</label><textarea id="label-demo" rows="3" aria-describedby="label-help"></textarea><span id="label-help" class="field-help">Sentence case, visible association, and no placeholder-as-label.</span></div>`);
    case 'alert': return showcase(`<h2>Feedback that says what to do.</h2>${notice('Your line was not sent. The draft is safe; try again.', 'error', button('demo-feedback', 'Try again', 'quiet-button'))}${notice('Your line is recorded. You can continue.', 'success')}${notice('A public link would expose the entire poem and attribution.')}${notice('Connection restored. Your draft is unchanged.')}`);
    case 'avatar': return showcase(`<h2>Choose a cameo, or just a name.</h2>${avatarOptions()}${cast(4, true)}`);
    case 'host-badge': return showcase(`<div class="reader-label">${cameo(0)}<div><h2>Avery</h2>${statusTag('Host')}</div></div><p class="stage-foot">A responsibility label, not a crown or a rank.</p>`);
    case 'loading-state': return showcase(loading(is('pending') ? 'Opening the complete poem…' : 'Preparing your place…'));
    case 'round-clock': return showcase(`<h2>Take your time.</h2><div class="pacing-line ${is('overtime') ? 'overtime' : ''}" aria-hidden="true"></div><p class="stage-foot">${is('overtime') ? 'The soft writing window has passed. There is still no cut-off.' : 'A quiet pacing cue. It never prevents a valid line from being sent.'}</p><div class="button-row">${button('overtime', 'Show overtime state', 'button secondary')}</div>`);
    case 'stamp-animation': return showcase(`<div class="motion-arrival">${cast(1, true)}</div><p class="stage-foot">Only the cameo settles; the name never waits for a staggered animation.</p><div class="button-row">${button('replay', 'Replay arrival', 'button secondary')}</div>`);
    case 'word-slots': return wordFeedback();
    case 'heart-button': return showcase(`<h2>Keep, without voting.</h2><div class="button-row">${keepButton()}</div>${is('error') ? notice('Keep failed. The previous state is unchanged.', 'error') : '<p class="stage-foot">A private collection choice, never a room score.</p>'}`);
    case 'site-social-card': return socialCard('site');
    case 'poem-preview-card': return socialCard('poem');
    case 'poem-fallback-card': return socialCard('fallback');
    case 'poem-full-card': return `${playbill(currentPoem(), { printView: true, showActions: false })}<div class="playbill-actions">${button('download', 'Save full poem PNG')}</div>`;
    case 'recap-social-card': return socialCard('recap');
    default: throw new Error(`Unimplemented component: ${id}`);
  }
}
function wordFeedback() { return showcase(`<h2>A count, not a tile parade.</h2><p class="field-help" style="margin:1rem 0">Try typing exactly three words. The sentence stays in one calm field.</p><div class="field"><label for="count-demo">Three-word line</label><textarea id="count-demo" rows="3" aria-describedby="count-demo-status">${is('exact') ? 'beneath velvet umbrellas' : is('over') ? 'a moon in borrowed slippers' : ''}</textarea><p id="count-demo-status" class="field-help" role="status">${is('exact') ? '3 / 3 words. Ready.' : is('over') ? '5 / 3 words. Remove 2 words.' : '0 / 3 words. Add 3 words.'}</p></div>`); }
const motionCopy = {
  'global-reduced-motion': 'No residual delay. No initial hidden words. The whole poem and focus are immediately available in the still version.',
  'color-mode-transition': 'An immediate palette choice, not a 300ms whole-screen wash. Radio selection carries the feedback.',
  'viewport-projection': 'The keyboard is a geometry constraint, not an animation. Focus the input and let normal document scrolling do its job.',
  'writing-focus-scroll': 'Manual focus brings the writing area into the nearest visible space without a smooth scroll or delayed jump.',
  'button-press': 'A tiny press with an inset outline. Reduced motion removes the transform, not the acknowledgement.',
  'stamp-arrival': 'One 160ms cameo settle; no staggered names, spins or stamping people into the room.',
  'loading-indicators': 'Still reserved space and a contextual status. No independent pulses or fake progress percentage.',
  'fade-up-entrances': 'Routine fade-up entrances are deliberately removed. The curtain is the single expressive entrance.',
  'archive-card-interaction': 'Open poem stays visible on touch and keyboard. Focus changes the outline, not the document position.',
  'silhouette-bars': 'The true nine-round arc is fully visible from first paint. There is no hover-only growing chart.',
  'contributor-hover': 'Names are persistent once opened. Hover and a two-second tooltip are not prerequisites for attribution.',
  'waiting-presence-pulse': 'No endless breathing or pulsing writer. People can take their time without a visible pressure signal.',
  'round-clock-drain': 'A gentle soft-time cue, never a deadline gate. Overtime is an ordinary, valid writing state.',
  'word-slot-feedback': 'One small count updates beside the input. No bouncing copies of every word and no repeated ready nudge.',
  'ready-seal-loop': 'Ready is a stable fact. A valid line does not need an infinite ring asking to be sent.',
  'submission-confirmation': 'A receipt follows a confirmed local commit. Continue is immediately available; there is no mandatory wait.',
  'author-attribution-reveal': 'Attribution remains readable until you close it. Nothing in the poem moves to make room for a tooltip.',
  'help-open-close': 'Immediate open, bounded scroll, focus trap, Escape and return focus. Lifecycle matters more than a fade.',
  'chrome-popover-feedback': 'Appearance opens where asked and returns focus when closed; there is no floating entrance.',
  'reading-target-focus': 'Only the curtain edges move, once for 340ms. The entire nine-line poem is already mounted and does not move.',
  'stage-roster-highlight': 'One cameo settles and a readable arrival label appears. This never ranks or judges the person.',
  'favorite-crown-ceremony': 'The crown and burst are not retained. A personal keep toggle is the whole acknowledgement.',
  'ceremony-effects-hook': 'Only explicit activation permits a short warm bell. No applause, haptic burst, timer sound or music.',
  'profile-image-hover': 'Identity stays stable. No grayscale-to-color hover or appearance transformation.',
  'unmounted-motion-definitions': 'Typewriter, breathing and line wipes are intentionally absent. Replay demonstrates the same complete stable poem.',
};
function renderMotion(id) {
  let content;
  switch (id) {
    case 'global-reduced-motion': case 'reading-target-focus': case 'unmounted-motion-definitions': content = playbill(sample, { reveal: true, showActions: false }); break;
    case 'color-mode-transition': case 'chrome-popover-feedback': content = showcase(`<h2>A practical choice.</h2><div class="button-row">${button('appearance', 'Open appearance', 'button secondary')}${button('toggle-mode', 'Switch palette', 'button secondary')}</div>`); break;
    case 'viewport-projection': case 'writing-focus-scroll': content = wordFeedback(); break;
    case 'button-press': content = renderComponent('button'); break;
    case 'stamp-arrival': case 'stage-roster-highlight': content = showcase(`<div class="motion-arrival">${cast(4, true)}</div>`); break;
    case 'loading-indicators': content = showcase(loading('Preparing the playbill…')); break;
    case 'fade-up-entrances': content = showcase(`<h2>Already here.</h2>${notice('No decorative entrance delays this information.')}<div class="field"><label for="quiet-input">Your name</label><input id="quiet-input" type="text" value="Avery"></div>`); break;
    case 'archive-card-interaction': content = renderComponent('poem-card'); break;
    case 'silhouette-bars': content = showcase(`<h2>One, up to five, back to one.</h2>${arc()}`); break;
    case 'contributor-hover': case 'author-attribution-reveal': content = `${playbill(sample, { showActions: false })}<div class="playbill-actions">${button('authors', sketch.authors ? 'Hide attribution' : 'Show attribution', 'button secondary')}</div>`; break;
    case 'waiting-presence-pulse': content = showcase(`<h2>People, not progress bars.</h2>${cast(4, true, true)}`); break;
    case 'round-clock-drain': content = renderComponent('round-clock'); break;
    case 'word-slot-feedback': content = wordFeedback(); break;
    case 'ready-seal-loop': content = writing('', is('default') ? sample[2] : undefined); break;
    case 'submission-confirmation': content = `<section class="stage focused motion-receipt"><div class="receipt"><div class="receipt-mark">${mark()}</div><div><h2>Your line is in.</h2><p>Confirmed-state design sketch.</p></div></div><div class="previous-line"><small>Recorded sample line</small><p>beneath velvet umbrellas</p></div>${button('demo-feedback', 'Continue immediately', 'button')}</section>`; break;
    case 'help-open-close': content = showcase(`<h2>Rules, when you need them.</h2><div class="button-row">${button('help', 'Open how to play')}</div>`); break;
    case 'favorite-crown-ceremony': content = renderComponent('heart-button'); break;
    case 'ceremony-effects-hook': content = soundPreview(); break;
    case 'profile-image-hover': content = showcase(`<h2>A steady identity.</h2>${cast(4, true)}${avatarOptions()}`); break;
    default: throw new Error(`Unimplemented motion: ${id}`);
  }
  return `<div class="preview-heading"><h1 tabindex="-1">${title(id)}</h1><p>${motionCopy[id]}</p></div><div id="motion-example">${content}</div><div class="playbill-actions">${button('replay', 'Replay motion', 'button')}${statusTag(reduced() ? 'Reduced motion — static alternative' : 'Motion enabled — deliberate replay only')}</div><p class="preview-caption" id="replay-status" role="status">Replay is a design demonstration, not a live room event.</p>`;
}
function soundPreview() { return showcase(`<div class="sound-disc">${icon('bell')}</div><h2>One warm bell.<br>Then the room is yours.</h2><p class="stage-foot">An original 380ms synthesized cue. No applause, music, speech or background sound.</p><div class="button-row">${button('sound', soundEnabled ? 'Disable sound' : 'Enable sound')}${button('play-cue', 'Play cue', 'button secondary', soundEnabled ? '' : 'disabled')}</div><p class="field-help" style="margin-top:.8rem">${soundEnabled ? 'Sound is enabled only for this tab. A cue plays only when you ask.' : 'Sound starts off. Enable it explicitly before playing the cue.'}</p>`); }
function sensoryControls() { return `<section class="stage preview-stage" style="margin-top:1.5rem"><h2 style="font-size:1.65rem">Try it your way.</h2><div class="button-row">${button('sound', soundEnabled ? 'Disable sound' : 'Enable sound', 'button secondary')}${button('play-cue', 'Play cue', 'button secondary', soundEnabled ? '' : 'disabled')}${button('toggle-reduced', reduced() ? 'Reduced motion is active' : 'Use reduced motion', 'quiet-button', osMotion.matches ? 'disabled' : '')}</div><p class="field-help" style="margin-top:1rem">Optional cameo. Your name is always enough.</p>${avatarOptions()}</section>`; }
function renderSensory(id) {
  let content;
  switch (id) {
    case 'brand-identity': content = `<div class="home-grid"><div class="home-copy"><h2>A pocket theatre,<br>not a grand performance.</h2><p>Plum paper, ordinary human names and one open curtain. Gold marks the next action, not status.</p><div class="button-row">${button('toggle-mode', 'See the companion palette', 'button')}</div></div><div class="picture-wrap">${illustration()}</div></div>`; break;
    case 'wordmark-and-logo': content = showcase(`<div class="logo-specimen"><div class="brand">${mark()}<span class="brand-name">Linejam</span></div>${mark('large-mark')}<p class="stage-foot">Original open curtains carry one line. The silhouette works without color.</p></div>`); break;
    case 'device-brand-assets': content = showcase(`<h2>A small opening.</h2><div class="icon-specimen"><div class="app-icon">${mark()}</div><div class="app-icon small-icon">${mark()}</div><div class="app-icon tiny-icon">${mark()}</div></div><p class="stage-foot">Installation, browser and compact icon treatments. No installation or production manifest is changed.</p>`); break;
    case 'paper-grain-and-depth': content = showcase(`<h2>Paper, without the noise.</h2><p style="margin-top:1rem">A single shadow grounds the stage. Two arch rules give it depth. Text sits on a plain field — no grain, blur or texture inside the words.</p><div class="button-row">${button('toggle-mode', 'Switch daylight / evening', 'button secondary')}</div>`); break;
    case 'typographic-voice': content = showcase(`<h2>Words deserve a little space.</h2><p style="margin-top:1rem">DM Serif Display holds the poem. DM Sans holds the practical conversation: a name, a count, the next action.</p><p class="sample-line" style="margin-top:1.5rem">beneath velvet umbrellas</p><div class="field" style="margin-top:1.5rem"><label for="type-example">A very long pen name remains a name</label><input id="type-example" type="text" value="Minerva with the wonderfully long name"></div><p class="stage-foot">Local licensed fonts. No all-caps microtype, remote fonts or compressed verse.</p>`); break;
    case 'player-identity': content = showcase(`<h2>A cameo, if you like.</h2>${avatarOptions()}${cast(4, true)}<p class="stage-foot">These are original silhouette sketches, not real participants. Names are primary and no costume is required.</p>`); break;
    case 'word-pattern-shape': content = showcase(`<h2>The room’s one rule shape.</h2>${arc()}<p class="stage-foot">Nine rounds: one word up to five and back to one. This is a word-count pattern, not an equalizer or a score.</p>`); break;
    case 'icon-vocabulary': content = showcase(`<h2>Little symbols. Plain words.</h2><div class="button-row">${button('sound', `${icon('bell')} Sound ${soundEnabled ? 'on' : 'off'}`, 'button secondary')}${keepButton()}${button('print', `${icon('print')} Print`, 'button secondary')}${link('archive', `${icon('archive')} Collection`, 'button secondary')}${button('help', `${icon('help')} Help`, 'button secondary')}</div>`); break;
    case 'ceremony-audio': content = soundPreview(); break;
    case 'ceremony-haptics': content = showcase(`<div class="receipt"><div class="receipt-mark">${mark()}</div><div><h2>Your line is in.</h2><p>A complete acknowledgement in silence.</p></div></div><p class="stage-foot">No vibration is used. A named status and still receipt carry the meaning without startling anyone holding a phone.</p>`); break;
    case 'share-artifacts': content = `${socialCard('poem')}<div class="button-row">${link('poem-image-export', 'See complete private image', 'button')}${link('recap-social-preview', 'See recap cover')}</div>`; break;
    case 'native-platform-surfaces': content = showcase(`<h2>The operating system takes it from here.</h2><p style="margin-top:1rem">No fake share sheet, download popup or print dialog is drawn. Private saving and public linking remain different actions.</p><div class="button-row">${button('download', 'Save local poem PNG')}${button('print', 'Open browser print', 'button secondary')}${link('poem-sharing', 'Explore link consent', 'link-button')}</div>`); break;
    case 'public-auth-showcase': content = `<div class="reading-columns"><section class="stage"><h2>An account is optional.</h2><p style="margin-top:1rem">The adjacent playbill is a synthetic sample. Real account showcases must use only explicitly public poems.</p><div class="button-row">${link('sign-in', 'See account treatment')}${link('home', 'Play as a guest', 'button')}</div></section>${playbill(sample, { showActions: false })}</div>`; break;
    default: throw new Error(`Unimplemented sensory surface: ${id}`);
  }
  return `<div class="preview-heading"><h1 tabindex="-1">${title(id)}</h1><p>Original Midnight Matinee sensory treatment. No external assets, live participants or telemetry.</p></div>${content}${sensoryControls()}`;
}
function header() { return `<header class="site-header"><a href="?surface=view&amp;id=home" data-view="home" class="brand" aria-label="Linejam home">${mark()}<span class="brand-name">Linejam</span></a><nav class="header-links" aria-label="Game navigation">${link('archive', 'Collection', 'link-button optional')}${button('help', 'Help', 'link-button')}${button('appearance', 'Appearance', 'quiet-button')}${sketch.active ? button('exit', 'Exit sketch', 'link-button') : ''}</nav></header>`; }
function footer() { return `<footer class="site-footer"><span>Midnight Matinee<br><span class="small">An unselected Linejam design exploration</span></span><nav class="footer-nav" aria-label="Footer navigation"><a href="../">All directions</a>${link('home', 'Home', '')}${link('profile', 'Your name', '')}</nav></footer>`; }
function explorer() {
  const stateValues = [...new Set([...(states[surfaceId] || genericStates), ...genericStates])];
  if (!stateValues.includes(state)) stateValues.unshift(state);
  return `<a href="../">Compare all five directions</a><label>Surface<select id="surface-picker">${Object.keys(ids).map(key => `<option value="${key}" ${surface === key ? 'selected' : ''}>${key === 'view' ? 'Views' : key === 'component' ? 'Components' : key === 'motion' ? 'Motion' : 'Sensory'}</option>`).join('')}</select></label><label>Scene<select id="scene-picker">${ids[surface].map(id => `<option value="${id}" ${surfaceId === id ? 'selected' : ''}>${title(id)}</option>`).join('')}</select></label><label>State<select id="state-picker">${stateValues.map(value => `<option value="${escapeHtml(value)}" ${state === value ? 'selected' : ''}>${title(value)}</option>`).join('')}</select></label><label>Palette<select id="mode-picker"><option value="dark" ${modeChoice === 'dark' ? 'selected' : ''}>Evening</option><option value="light" ${modeChoice === 'light' ? 'selected' : ''}>Daylight</option><option value="system" ${modeChoice === 'system' ? 'selected' : ''}>System</option></select></label><label class="check"><input id="reduce-picker" type="checkbox" ${reduceOverride || osMotion.matches ? 'checked' : ''} ${osMotion.matches ? 'disabled' : ''}>Reduce motion</label>`;
}
function syncUrl() { const query = new URLSearchParams(location.search); query.set('surface', surface); query.set('id', surfaceId); query.set('state', state); query.set('mode', modeChoice); if (reduceOverride) query.set('reduced', '1'); else query.delete('reduced'); history.replaceState(null, '', `${location.pathname}?${query}`); }
function applyPreferences() { const mode = actualMode(); document.documentElement.dataset.mode = mode; document.body.dataset.mode = mode; document.body.dataset.reduced = String(reduced()); document.querySelector('meta[name="theme-color"]').content = mode === 'dark' ? '#261c3b' : '#f0e8f5'; }
function render(focus = false) {
  const previousFocus = document.activeElement;
  const focusId = previousFocus?.id;
  const focusAction = previousFocus?.dataset.action;
  applyPreferences();
  document.body.dataset.direction = 'midnight-matinee';
  document.body.dataset.surfaceId = surfaceId;
  document.body.dataset.surface = surface;
  document.body.dataset.embed = String(params.get('embed') === '1');
  document.getElementById('explorer').innerHTML = explorer();
  const content = surface === 'view' ? renderView(surfaceId) : surface === 'component' ? `<div class="preview-heading"><h1 tabindex="-1">${title(surfaceId)}</h1></div>${renderComponent(surfaceId)}` : surface === 'motion' ? renderMotion(surfaceId) : renderSensory(surfaceId);
  document.getElementById('app').innerHTML = `<div class="shell">${header()}<p class="fixture-note">Design sketch · ${sketch.active ? 'your words stay in this tab; no connected players' : 'synthetic samples; no live room or account'}</p><div id="visible-feedback" role="status" aria-live="polite"></div><main id="scene" class="scene" tabindex="-1" data-direction="midnight-matinee" data-surface-id="${surfaceId}">${content}</main>${footer()}</div>`;
  revealOnRender = false;
  if (focus) {
    const heading = document.querySelector('#scene h1, #scene h2') || document.getElementById('scene');
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  } else {
    const nextFocus = focusId ? document.getElementById(focusId) : focusAction ? document.querySelector(`[data-action="${focusAction}"]`) : null;
    nextFocus?.focus({ preventScroll: true });
  }
}
function announce(message) { document.getElementById('announcement').textContent = message; }
function feedback(message, error = false) {
  const region = document.getElementById('visible-feedback');
  region.className = `notice ${error ? 'error' : 'success'}`;
  region.textContent = message;
}
function go(id, nextState = 'default') { closeDialog(false); surface = 'view'; surfaceId = id; state = nextState; sketch.note = ''; revealOnRender = ['poem-reading', 'reveal-presentation'].includes(id); syncUrl(); render(true); window.scrollTo({ top: 0, behavior: 'auto' }); }
function showDialog(content) {
  dialogTrigger = document.activeElement;
  const root = document.getElementById('dialog-root');
  root.innerHTML = `<div class="dialog-backdrop" data-backdrop><section class="dialog-box" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close dialog">×</button>${content}</section></div>`;
  document.getElementById('app').inert = true;
  document.getElementById('explorer').inert = true;
  document.body.style.overflow = 'hidden';
  root.querySelector('button, input, select, a').focus();
}
function closeDialog(restore = true) {
  const root = document.getElementById('dialog-root');
  const hadDialog = Boolean(root.firstElementChild);
  root.innerHTML = '';
  document.getElementById('app').inert = false;
  document.getElementById('explorer').inert = false;
  document.body.style.overflow = '';
  if (restore && hadDialog && dialogTrigger?.isConnected) dialogTrigger.focus();
}
function updateComposer(input) {
  const target = wordPattern[roundIndex()];
  const count = wordCount(input.value);
  sketch.draft = input.value;
  const countEl = document.getElementById('word-count');
  const guide = document.getElementById('word-guidance');
  const submit = document.getElementById('submit-line');
  if (!countEl) return;
  countEl.textContent = `${count} / ${target} ${target === 1 ? 'word' : 'words'}`;
  countEl.className = `word-count ${count === target ? 'ready' : count > target ? 'over' : ''}`;
  const message = count === target ? 'Ready to send.' : count > target ? `Remove ${count - target} ${count - target === 1 ? 'word' : 'words'}.` : `Add ${target - count} ${target - count === 1 ? 'word' : 'words'}.`;
  guide.textContent = message;
  submit.disabled = count !== target || sendingBlocked();
  input.setAttribute('aria-invalid', String(count > target));
  clearTimeout(countTimer);
  countTimer = setTimeout(() => announce(message), 500);
}
function replay() {
  clearTimeout(replayTimer);
  if (surfaceId === 'help-open-close') { showDialog(helpBody()); return; }
  if (surfaceId === 'chrome-popover-feedback') { showDialog(appearanceBody()); return; }
  if (surfaceId === 'color-mode-transition') { modeChoice = actualMode() === 'dark' ? 'light' : 'dark'; syncUrl(); render(); announce('Palette changed immediately.'); return; }
  if (surfaceId === 'viewport-projection' || surfaceId === 'writing-focus-scroll') { const field = document.getElementById('count-demo'); field?.focus(); field?.scrollIntoView({ block: 'nearest', behavior: 'auto' }); return; }
  if (surfaceId === 'contributor-hover' || surfaceId === 'author-attribution-reveal') { sketch.authors = !sketch.authors; render(); return; }
  if (surfaceId === 'favorite-crown-ceremony') { sketch.kept = !sketch.kept; render(); return; }
  if (surfaceId === 'round-clock-drain') { state = state === 'overtime' ? 'default' : 'overtime'; syncUrl(); render(); return; }
  if (surfaceId === 'ceremony-effects-hook') { announce(soundEnabled ? 'Choose Play cue to make a sound.' : 'Sound is off. Enable it explicitly before playing.'); return; }
  if (surfaceId === 'stamp-arrival' || surfaceId === 'stage-roster-highlight' || surfaceId === 'stamp-animation') { sketch.arrivals = true; render(); }
  const target = document.getElementById('motion-example') || document.getElementById('scene');
  target.classList.remove('aperture', 'motion-receipt', 'motion-arrival', 'motion-focus', 'motion-press');
  target.querySelectorAll('.aperture, .motion-receipt, .motion-arrival').forEach(node => node.classList.remove('aperture', 'motion-receipt', 'motion-arrival'));
  void target.offsetWidth;
  if (!reduced()) {
    if (['reading-target-focus', 'global-reduced-motion'].includes(surfaceId)) target.querySelector('[data-playbill]')?.classList.add('aperture');
    if (surfaceId === 'submission-confirmation') target.classList.add('motion-receipt');
    if (['stamp-arrival', 'stage-roster-highlight', 'stamp-animation'].includes(surfaceId)) target.classList.add('motion-arrival');
    if (surfaceId === 'button-press') target.classList.add('motion-press');
  }
  const replayStatus = document.getElementById('replay-status');
  if (replayStatus) replayStatus.textContent = reduced() ? 'Replayed the still alternative. No content waits for animation.' : 'Replayed the deliberate treatment. Retired effects remain still.';
  announce(reduced() ? 'Still alternative replayed.' : 'Design treatment replayed.');
}
async function playCue() {
  if (!soundEnabled || performance.now() - lastCueAt < 450) return;
  lastCueAt = performance.now();
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('Audio unavailable');
    audioContext ||= new Audio();
    await audioContext.resume();
    const now = audioContext.currentTime;
    [[392, 0.026], [784, 0.008]].forEach(([frequency, gain]) => {
      const tone = audioContext.createOscillator();
      const envelope = audioContext.createGain();
      tone.type = 'sine'; tone.frequency.value = frequency;
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(gain, now + 0.015);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
      tone.connect(envelope); envelope.connect(audioContext.destination);
      tone.start(now); tone.stop(now + 0.38);
      tone.onended = () => { tone.disconnect(); envelope.disconnect(); };
    });
    announce('Warm bell cue played. The visual reader label carries the same information.');
  } catch { soundEnabled = false; render(); announce('Sound is unavailable. Every interaction remains available silently.'); }
}
function downloadBlob(blob, name) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
function wrappedLines(context, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/u)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= width) { line = candidate; continue; }
    if (line) { lines.push(line); line = ''; }
    if (context.measureText(word).width <= width) { line = word; continue; }
    for (const char of word) { if (context.measureText(line + char).width > width) { lines.push(line); line = ''; } line += char; }
  }
  if (line) lines.push(line);
  return lines;
}
async function saveImage() {
  feedback('Preparing a private local poem image.');
  try {
    await document.fonts.ready;
    const canvas = document.createElement('canvas'); canvas.width = 1200;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.font = '52px "DM Serif Display", Georgia, serif';
    const rendered = currentPoem().map(line => wrappedLines(context, line, 920));
    const attribution = sketch.lines.length === 9 ? `All nine lines typed by ${sketch.name} in a local design sketch.` : 'Synthetic nine-line sample. Not real human gameplay. Attribution treatment: Avery, Mina, Jules and Noor.';
    context.font = '26px "DM Sans", sans-serif';
    const credits = wrappedLines(context, attribution, 920);
    canvas.height = 360 + rendered.reduce((sum, lines) => sum + lines.length * 78, 0) + credits.length * 38;
    const dark = actualMode() === 'dark';
    context.fillStyle = dark ? '#382A50' : '#FFFCF7'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = dark ? '#B5A3E5' : '#725197'; context.lineWidth = 2;
    context.beginPath(); context.moveTo(55, canvas.height - 55); context.lineTo(55, 170); context.quadraticCurveTo(55, 55, 170, 55); context.lineTo(1030, 55); context.quadraticCurveTo(1145, 55, 1145, 170); context.lineTo(1145, canvas.height - 55); context.stroke();
    context.fillStyle = dark ? '#FFF4E7' : '#332442'; context.font = '34px "DM Serif Display", Georgia, serif'; context.fillText('Linejam / Midnight Matinee', 140, 135);
    context.font = '24px "DM Sans", sans-serif'; context.fillText('Private local image · design sketch', 140, 183);
    let y = 277; context.font = '52px "DM Serif Display", Georgia, serif';
    for (const lines of rendered) for (const line of lines) { context.fillText(line, 140, y); y += 78; }
    y += 38; context.font = '26px "DM Sans", sans-serif';
    for (const credit of credits) { context.fillText(credit, 140, y); y += 38; }
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Image encoding failed');
    downloadBlob(blob, 'linejam-midnight-matinee-private-sketch.png');
    feedback('Private poem image download requested. No link was published.');
    sketch.note = 'Private image download requested. No link was published.';
  } catch { feedback('The image could not be saved. Try again or use Print; no public link was created.', true); }
}
function printPoems() {
  document.getElementById('print-artifact')?.remove();
  const artifact = document.createElement('div');
  artifact.id = 'print-artifact';
  const poems = surfaceId === 'public-recap' || surfaceId === 'recap-page' || surfaceId === 'recap-export-button' ? [currentPoem(), sampleTwo] : [currentPoem()];
  artifact.innerHTML = poems.map((lines, index) => `<article><h1>Linejam / Poem ${index + 1}</h1><p>Midnight Matinee design sketch · complete nine-line poem</p>${poemText(lines)}${authorList()}</article>`).join('');
  document.body.append(artifact);
  window.addEventListener('afterprint', () => artifact.remove(), { once: true });
  window.print();
}
function feedXml() { return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n<title>Linejam — synthetic design feed</title>\n<description>Release-feed treatment only; not real release history.</description>\n${is('empty') ? '' : '<item><title>Sketch edition</title><description>A quieter writing stage and a complete readable poem.</description></item>\n'}</channel></rss>`; }

document.addEventListener('click', event => {
  const backdrop = event.target.closest('[data-backdrop]');
  if (backdrop && event.target === backdrop) { closeDialog(); return; }
  const cameoButton = event.target.closest('[data-cameo]');
  if (cameoButton) { sketch.cameo = Number(cameoButton.dataset.cameo); document.querySelectorAll('[data-cameo]').forEach(node => node.setAttribute('aria-pressed', String(Number(node.dataset.cameo) === sketch.cameo))); document.querySelectorAll('[data-current-cameo]').forEach(node => { node.innerHTML = cameo(sketch.cameo); }); announce(`${cameoNames[sketch.cameo]} selected. Your name remains primary.`); return; }
  const view = event.target.closest('[data-view]');
  if (view) { event.preventDefault(); if (view.dataset.view === 'home') sketch.active = false; go(view.dataset.view); return; }
  const control = event.target.closest('[data-action]');
  if (!control || control.disabled) return;
  const action = control.dataset.action;
  switch (action) {
    case 'help': showDialog(helpBody()); break;
    case 'appearance': showDialog(appearanceBody()); break;
    case 'close-dialog': if (document.getElementById('dialog-root').firstElementChild) closeDialog(); else go('home'); break;
    case 'invite': go('join-entry', 'invited'); break;
    case 'copy-token':
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText('SKETCH').then(() => feedback('Copied SKETCH. This is a design token, not a live room code.'), () => feedback('Copy is unavailable. You can select the visible SKETCH text instead.', true));
      else feedback('Copy is unavailable. You can select the visible SKETCH text instead.', true);
      break;
    case 'start-game': sketch.active = true; sketch.round = 0; sketch.lines = []; sketch.draft = ''; sketch.role = 'host'; go('room-writing', 'first'); break;
    case 'continue-round':
      if (!sketch.active) { go('room-writing'); break; }
      if (sketch.round === 8) go('poem-reading'); else { sketch.round += 1; sketch.draft = ''; go('room-writing'); }
      break;
    case 'new-game': sketch.active = true; sketch.round = 0; sketch.lines = []; sketch.draft = ''; sketch.published = false; go('room-lobby'); break;
    case 'read-poem': go('reveal-presentation'); break;
    case 'choose-reader': sketch.reader = Number(control.dataset.reader); go('poem-reading'); break;
    case 'step-in': sketch.reader = (sketch.reader + 1) % 4; render(); announce(`${names()[sketch.reader]} can read the complete poem. Nothing in the poem moved.`); break;
    case 'done-reading': go('session-recap'); break;
    case 'confirm-end': showDialog(`<h2 id="dialog-title">End this unfinished game?</h2><p>Return to the lobby without revealing partial poems. Nothing has to be performed.</p><div class="button-row">${button('end-game', 'End and return to lobby', 'button danger')}${button('close-dialog', 'Keep writing', 'button secondary')}</div>`); break;
    case 'end-game': sketch.active = false; sketch.lines = []; sketch.round = 0; go('room-lobby'); break;
    case 'leave': case 'exit': showDialog(`<h2 id="dialog-title">Leave the sketch?</h2><p>No live room will be affected. Your current local entries remain in this tab, but they are not saved to an account.</p><div class="button-row">${button('confirm-exit', 'Exit sketch')}${button('close-dialog', 'Stay here', 'button secondary')}</div>`); break;
    case 'confirm-exit': sketch.active = false; go('home'); break;
    case 'keep': sketch.kept = !sketch.kept; if (is('kept')) state = 'default'; render(); announce(sketch.kept ? 'Kept privately in this tab. Not a vote or public link.' : 'Removed from your private kept state.'); break;
    case 'authors': sketch.authors = !sketch.authors; render(); announce(sketch.authors ? 'Full attribution shown. It remains until you close it.' : 'Attribution collapsed.'); break;
    case 'publish-preview': sketch.published = true; state = 'public'; syncUrl(); render(); announce('Public-link success state previewed. Nothing actually published.'); break;
    case 'cancel-share': sketch.published = false; state = 'cancelled'; syncUrl(); render(); announce('Still private. No public link was created.'); break;
    case 'revoke': sketch.published = false; state = 'revoked'; syncUrl(); render(); announce('Sketch public-link state revoked. The actual prototype never published anything.'); break;
    case 'recover': state = 'recovery'; if (['room-recovery', 'route-error', 'global-error'].includes(surfaceId)) go('room-writing', 'restored'); else if (surfaceId === 'guest-session-recovery') go('host-entry', 'recovery'); else { syncUrl(); render(); announce('Recovered-state preview. No backend request was made.'); } break;
    case 'migration-retry': go('auth-callback', 'complete'); break;
    case 'manage-account': showDialog(`<h2 id="dialog-title">Account management treatment.</h2><p>A configured identity provider owns the actual account form. This disconnected prototype does not create, alter or authenticate an account.</p><div class="button-row">${link('profile', 'See identity treatment', 'button secondary')}${button('close-dialog', 'Close')}</div>`); break;
    case 'sign-out': sketch.active = false; go('profile', 'local'); announce('Guest-state preview. No real account was signed out.'); break;
    case 'toggle-mode': modeChoice = actualMode() === 'dark' ? 'light' : 'dark'; syncUrl(); render(); break;
    case 'toggle-reduced': reduceOverride = !reduceOverride; syncUrl(); render(); break;
    case 'sound': soundEnabled = !soundEnabled; if (!soundEnabled && audioContext) { void audioContext.close(); audioContext = null; } if (document.getElementById('dialog-root').firstElementChild) { document.getElementById('dialog-root').querySelector('.dialog-box').innerHTML = `<button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close dialog">×</button>${appearanceBody()}`; document.querySelector('#dialog-root [data-action="sound"]').focus(); } else render(); announce(soundEnabled ? 'Sound enabled. Choose Play cue to hear it.' : 'Sound disabled.'); break;
    case 'play-cue': void playCue(); break;
    case 'download': void saveImage(); break;
    case 'print': printPoems(); break;
    case 'download-feed': downloadBlob(new Blob([feedXml()], { type: 'application/rss+xml' }), 'linejam-synthetic-design-feed.xml'); announce('Synthetic RSS preview download requested.'); break;
    case 'replay': replay(); break;
    case 'overtime': state = 'overtime'; syncUrl(); render(); break;
    case 'demo-feedback': announce('Action acknowledged in this local design sketch. No service was called.'); control.textContent = 'Acknowledged in sketch'; break;
  }
});
document.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  if (form.id === 'entry-form') {
    const name = form.elements.name.value.trim();
    const code = form.elements.code?.value.trim().toUpperCase();
    if (!name || (form.dataset.kind === 'join' && code !== 'SKETCH')) {
      const field = !name ? form.elements.name : form.elements.code;
      document.getElementById('entry-error').textContent = !name ? 'Enter the name you want this room to use.' : 'Use SKETCH for this disconnected preview. It is not a live room code.';
      field.setAttribute('aria-invalid', 'true'); field.focus(); return;
    }
    sketch.name = name; sketch.role = form.dataset.kind === 'join' ? 'participant' : 'host'; go('room-lobby');
  } else if (form.id === 'writing-form') {
    const input = form.elements.line;
    const line = normalizeLine(input.value);
    const target = wordPattern[roundIndex()];
    if (wordCount(line) !== target || line.length > 500 || sendingBlocked()) { updateComposer(input); input.focus(); return; }
    if (sketch.active) sketch.lines[sketch.round] = line;
    else sketch.lastSubmitted = line;
    sketch.draft = '';
    go('room-waiting', 'recorded'); announce('Your line is recorded in this local sketch. Continue when you are ready.');
  } else if (form.id === 'account-form') {
    if (is('verification')) { sketch.verifiedPreview = true; announce('Verification-complete treatment preview. No real account exists.'); go('profile', 'local'); } else { state = 'verification'; syncUrl(); render(); }
  } else if (form.id === 'profile-form') {
    const name = document.getElementById('profile-name').value.trim(); if (!name) return;
    sketch.name = name; render(); announce('Name kept in this tab only.');
  }
});
document.addEventListener('paste', event => {
  if (event.target.id !== 'line-input' || !event.clipboardData) return;
  event.preventDefault();
  const input = event.target;
  const available = 500 - input.value.length + input.selectionEnd - input.selectionStart;
  const pasted = normalizeLine(event.clipboardData.getData('text')).slice(0, Math.max(0, available));
  input.setRangeText(pasted, input.selectionStart, input.selectionEnd, 'end');
  updateComposer(input);
});
document.addEventListener('input', event => {
  if (event.target.id === 'line-input') updateComposer(event.target);
  if (event.target.id === 'room-code') event.target.value = event.target.value.toUpperCase();
  if (event.target.id === 'count-demo') {
    const count = wordCount(event.target.value);
    document.getElementById('count-demo-status').textContent = `${count} / 3 words. ${count === 3 ? 'Ready.' : count < 3 ? `Add ${3 - count} words.` : `Remove ${count - 3} words.`}`;
  }
});
document.addEventListener('change', event => {
  const target = event.target;
  if (target.id === 'surface-picker') { surface = target.value; surfaceId = ids[surface][surface === 'view' ? 1 : 0]; state = 'default'; sketch.active = false; syncUrl(); render(); }
  else if (target.id === 'scene-picker') { surfaceId = target.value; state = (states[surfaceId] || genericStates)[0]; sketch.active = false; syncUrl(); render(); }
  else if (target.id === 'state-picker') { state = target.value; syncUrl(); render(); }
  else if (target.id === 'mode-picker' || target.name === 'appearance-mode') { modeChoice = target.value; syncUrl(); applyPreferences(); if (target.id === 'mode-picker') render(); else document.getElementById('mode-picker').value = modeChoice; }
  else if (target.id === 'reduce-picker' || target.id === 'setting-reduced') { reduceOverride = target.checked; syncUrl(); applyPreferences(); if (target.id === 'reduce-picker') render(); else document.getElementById('reduce-picker').checked = reduceOverride; }
});
document.addEventListener('keydown', event => {
  if (event.target.id === 'line-input' && event.key === 'Enter') { event.preventDefault(); return; }
  if (event.target.id === 'room-code' && event.key === 'Enter') { event.preventDefault(); document.getElementById('pen-name').focus(); return; }
  const root = document.getElementById('dialog-root');
  if (!root.firstElementChild) return;
  if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
  if (event.key === 'Tab') {
    const focusable = [...root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary')].filter(node => node.getClientRects().length);
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
osMotion.addEventListener('change', () => { applyPreferences(); render(); });
osColor.addEventListener('change', () => { if (modeChoice === 'system') applyPreferences(); });
render();
