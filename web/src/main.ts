import './telemetry.ts';
import {
  CODE_LENGTH,
  EMBLEMS,
  checkLine,
  countWords,
  isEmblem,
  isRoomCode,
  normalizeCode,
  normalizePenName,
  type Emblem,
} from '../../shared/rules.ts';
import type { ArchiveEntry, PoemView, RecapView, RoomView, ShareAttempt } from '../../shared/types.ts';
import { morph } from './morph.ts';
import { ApiError, NetworkError, RoomLink, api } from './net.ts';
import { cue, isMuted, setMuted } from './sound.ts';
import { lineBusyKey, type Route, type State, type Theme } from './state.ts';
import { view } from './views.ts';

const root = document.getElementById('app')!;
const dialogs = document.getElementById('dialogs')!;

// ───────────────────────── storage ─────────────────────────

function read(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function write(storage: Storage, key: string, value: string | null): void {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // Storage unavailable: the value lives in memory for this page only.
  }
}

// ───────────────────────── state ─────────────────────────

function parseRoute(): Route {
  const { pathname, searchParams } = new URL(location.href);
  const share = searchParams.get('share');
  let match: RegExpExecArray | null;
  if (pathname === '/') return { name: 'landing', code: '' };
  if (pathname === '/join')
    return { name: 'landing', code: normalizeCode(searchParams.get('code') ?? '').slice(0, CODE_LENGTH) };
  if ((match = /^\/room\/([^/]+)$/.exec(pathname)))
    return { name: 'room', code: normalizeCode(decodeURIComponent(match[1]!)) };
  if (pathname === '/poems') return { name: 'poems' };
  if ((match = /^\/poem\/([^/]+)$/.exec(pathname))) return { name: 'poem', id: decodeURIComponent(match[1]!), share };
  if ((match = /^\/recap\/([^/]+)$/.exec(pathname))) return { name: 'recap', id: decodeURIComponent(match[1]!), share };
  if (pathname === '/account') return { name: 'account' };
  return { name: 'notfound' };
}

/** True while the page on screen is the document the server answered with a 404. */
function servedNotFound(): boolean {
  const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  return entry?.responseStatus === 404 && new URL(entry.name).href === location.href;
}

const savedTheme = read(localStorage, 'linejam:theme');
const savedEmblem = read(localStorage, 'linejam:emblem');

const state: State = {
  route: parseRoute(),
  guest: { status: 'checking', guestId: null },
  theme: savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'system',
  muted: isMuted(),
  menuOpen: false,
  penName: read(localStorage, 'linejam:penName') ?? '',
  // A random supported emblem is preselected; the player can change it.
  emblem: isEmblem(savedEmblem) ? savedEmblem : EMBLEMS[Math.floor(Math.random() * EMBLEMS.length)]!,
  entryBusy: null,
  errors: {},
  room: null,
  roomError: null,
  roomGone: null,
  link: 'connecting',
  draft: '',
  tally: 0,
  lineError: null,
  selectedPoem: null,
  shares: {},
  archive: { status: 'loading', entries: [] },
  poem: { status: 'loading', view: null },
  recap: { status: 'loading', view: null },
  busy: {},
  flash: {},
  nudge: null,
};

let link: RoomLink | null = null;
let composeKey = '';
let readingPoem: string | null = null;

function render(): void {
  syncCompose();
  syncReading();
  morph(root, view(state));
  document.title =
    state.route.name === 'room' && state.room && state.room.phase !== 'closed'
      ? `${state.room.code} · Linejam`
      : 'Linejam';
}

function flash(key: string, text: string, kind: 'ok' | 'error' = 'ok'): void {
  state.flash[key] = { text, kind };
  render();
  window.setTimeout(() => {
    if (state.flash[key]?.text === text) {
      state.flash[key] = undefined;
      render();
    }
  }, 3200);
}

function nudge(key: string): void {
  state.nudge = key;
  render();
  window.setTimeout(() => {
    if (state.nudge === key) {
      state.nudge = null;
      render();
    }
  }, 260);
}

function describe(error: unknown): string {
  if (error instanceof ApiError || error instanceof NetworkError) return error.message;
  return 'Something went wrong. Try again';
}

async function busy<T>(key: string, run: () => Promise<T>): Promise<T | undefined> {
  if (state.busy[key]) return undefined;
  state.busy[key] = true;
  render();
  try {
    return await run();
  } finally {
    state.busy[key] = false;
    render();
  }
}

// ───────────────────────── drafts ─────────────────────────

// An unsubmitted draft survives refresh in this browser session and belongs
// to the verified identity that wrote it — the guest id is part of its key.
function draftKey(): string | null {
  const game = state.room?.game;
  if (!game?.assignment || !state.guest.guestId) return null;
  return `linejam:draft:${state.guest.guestId}:${game.id}:${game.assignment.lineIndex}`;
}

/** When a new assignment appears, the composer starts from that assignment's saved draft. */
function syncCompose(): void {
  const key = state.route.name === 'room' ? (draftKey() ?? '') : '';
  if (key === composeKey) return;
  composeKey = key;
  state.draft = key ? (read(sessionStorage, key) ?? '') : '';
  state.tally = countWords(state.draft);
  state.lineError = null;
  if (key && matchMedia('(pointer: fine)').matches) {
    queueMicrotask(() => document.getElementById('line-input')?.focus({ preventScroll: true }));
  }
}

/** A newly revealed poem becomes the poem on screen; share status loads once per poem. */
function syncReading(): void {
  const game = state.route.name === 'room' ? state.room?.game : null;
  const circle = game?.circle;
  if (!game || !circle) {
    readingPoem = null;
    return;
  }
  const reading = circle.poems.find((p) => p.state === 'reading')?.id ?? null;
  if (reading !== readingPoem) {
    readingPoem = reading;
    state.selectedPoem = reading;
  }
  if (game.role !== 'writer') return;
  const shown =
    circle.poems.find((p) => p.id === state.selectedPoem && p.lines) ?? circle.poems.find((p) => p.id === reading);
  if (shown) void loadShare(shown.id, `/api/poems/${shown.id}`);
  if (!circle.nextPoemId) void loadShare(`recap:${game.id}`, `/api/recaps/${game.id}`);
}

const shareLoads = new Set<string>();
async function loadShare(key: string, path: string): Promise<void> {
  if (state.shares[key] || shareLoads.has(key)) return;
  shareLoads.add(key);
  try {
    const loaded = await api<PoemView | RecapView>('GET', path);
    state.shares[key] = loaded.share;
    render();
  } catch {
    // The control stays absent rather than guessing a status; the next state update retries.
  } finally {
    shareLoads.delete(key);
  }
}

// ───────────────────────── guest identity ─────────────────────────

async function loadGuest(): Promise<void> {
  try {
    const guest = await api<{ status: 'ready' | 'none' | 'invalid'; guestId: string | null }>('GET', '/api/guest');
    // A refused credential shows recovery. It never silently becomes a different writer.
    state.guest = { status: guest.status, guestId: guest.guestId };
  } catch {
    state.guest = { status: 'offline', guestId: null };
  }
}

async function ensureGuest(fresh = false): Promise<void> {
  if (state.guest.status === 'ready' && !fresh) return;
  const guest = await api<{ guestId: string }>('POST', '/api/guest', fresh ? { fresh: true } : {});
  state.guest = { status: 'ready', guestId: guest.guestId };
}

// ───────────────────────── navigation ─────────────────────────

function navigate(path: string, replace = false): void {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  void enter();
}

async function enter(): Promise<void> {
  link?.stop();
  link = null;
  state.route = parseRoute();
  state.menuOpen = false;
  state.errors = {};
  state.room = null;
  state.roomError = null;
  state.roomGone = null;
  state.shares = {};
  state.selectedPoem = null;
  render();
  window.scrollTo(0, 0);
  const route = state.route;
  if (route.name === 'room') await enterRoom(route.code);
  else if (route.name === 'poems') await loadArchive();
  else if (route.name === 'poem') await loadPoem();
  else if (route.name === 'recap') await loadRecap();
}

function accept(room: RoomView): void {
  if (link) link.accept(room);
  else {
    state.room = room;
    render();
  }
}

async function enterRoom(code: string): Promise<void> {
  if (!isRoomCode(code)) return navigate('/', true);
  if (state.guest.status === 'checking') await loadGuest();
  if (state.guest.status !== 'ready') return navigate(`/join?code=${code}`, true);
  try {
    const room = await api<RoomView>('GET', `/api/rooms/${code}`);
    if (state.route.name !== 'room' || state.route.code !== code) return;
    state.room = room;
    render();
    link = new RoomLink(code, {
      state(next) {
        state.room = next;
        render();
      },
      link(status) {
        state.link = status;
        render();
      },
      ended(reason) {
        link = null;
        if (reason === 'closed') {
          state.roomGone = 'closed';
          render();
        } else if (reason === 'left') navigate('/', true);
        else navigate(`/join?code=${code}`, true);
      },
    });
    link.accept(room);
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.code === 'not_a_member' || error.code === 'room_not_found' || error.code === 'guest_invalid')
    ) {
      if (error.code === 'guest_invalid') state.guest = { status: 'invalid', guestId: null };
      navigate(`/join?code=${code}`, true);
      if (error.code === 'room_not_found') {
        state.errors.code = error.message;
        render();
      }
      return;
    }
    state.roomError = describe(error);
    render();
  }
}

async function loadArchive(): Promise<void> {
  if (state.guest.status === 'checking') await loadGuest();
  if (state.guest.status !== 'ready') return render();
  state.archive = { status: 'loading', entries: [] };
  render();
  try {
    state.archive = { status: 'ready', entries: await api<ArchiveEntry[]>('GET', '/api/poems') };
  } catch {
    state.archive = { status: 'error', entries: [] };
  }
  render();
}

async function loadPoem(): Promise<void> {
  const route = state.route;
  if (route.name !== 'poem') return;
  // The server already decided an inactive share link is a not-found page.
  if (servedNotFound()) {
    state.poem = { status: 'missing', view: null };
    return render();
  }
  state.poem = { status: 'loading', view: null };
  render();
  if (state.guest.status === 'checking') await loadGuest();
  try {
    const query = route.share !== null ? `?share=${encodeURIComponent(route.share)}` : '';
    state.poem = {
      status: 'ready',
      view: await api<PoemView>('GET', `/api/poems/${encodeURIComponent(route.id)}${query}`),
    };
  } catch (error) {
    state.poem = { status: error instanceof ApiError && error.status === 404 ? 'missing' : 'error', view: null };
  }
  render();
}

async function loadRecap(): Promise<void> {
  const route = state.route;
  if (route.name !== 'recap') return;
  if (servedNotFound()) {
    state.recap = { status: 'missing', view: null };
    return render();
  }
  state.recap = { status: 'loading', view: null };
  render();
  try {
    const query = route.share !== null ? `?share=${encodeURIComponent(route.share)}` : '';
    state.recap = {
      status: 'ready',
      view: await api<RecapView>('GET', `/api/recaps/${encodeURIComponent(route.id)}${query}`),
    };
  } catch (error) {
    state.recap = { status: error instanceof ApiError && error.status === 404 ? 'missing' : 'error', view: null };
  }
  render();
}

// ───────────────────────── dialogs ─────────────────────────

/** A native modal dialog: traps focus, closes on Escape, returns focus to its opener. */
function dialog(options: { title: string; body: string; safe: string; confirm?: { label: string } }): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('dialog');
    el.className = 'dialog';
    el.setAttribute('aria-labelledby', 'dialog-title');
    const title = document.createElement('h2');
    title.id = 'dialog-title';
    title.className = 'dialog-title';
    title.textContent = options.title;
    const body = document.createElement('div');
    body.className = 'dialog-body';
    body.innerHTML = options.body;
    const actions = document.createElement('div');
    actions.className = 'dialog-actions';
    const safe = document.createElement('button');
    safe.className = 'btn btn-secondary';
    safe.textContent = options.safe;
    safe.value = 'safe';
    safe.autofocus = true;
    safe.addEventListener('click', () => el.close('safe'));
    actions.append(safe);
    if (options.confirm) {
      const confirm = document.createElement('button');
      confirm.className = 'btn btn-danger';
      confirm.textContent = options.confirm.label;
      confirm.addEventListener('click', () => el.close('confirm'));
      actions.append(confirm);
    }
    el.append(title, body, actions);
    el.addEventListener('click', (event) => {
      if (event.target === el) el.close('safe');
    });
    el.addEventListener('close', () => {
      el.remove();
      resolve(el.returnValue === 'confirm');
    });
    dialogs.append(el);
    el.showModal();
  });
}

// ───────────────────────── clipboard and sharing ─────────────────────────

const SHARE_TIMEOUT_MS = 30_000;

/** Hand `url` to the native share sheet, or copy it. Resolves only when that really completed. */
async function deliver(url: string, title: string): Promise<'shared' | 'copied'> {
  const run = async (): Promise<'shared' | 'copied'> => {
    if (
      typeof navigator.share === 'function' &&
      navigator.canShare?.({ title, url }) &&
      matchMedia('(pointer: coarse)').matches
    ) {
      await navigator.share({ title, url });
      return 'shared';
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  };
  return Promise.race([
    run(),
    new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('timeout')), SHARE_TIMEOUT_MS)),
  ]);
}

function shareApi(key: string): string {
  return key.startsWith('recap:') ? `/api/recaps/${key.slice(6)}` : `/api/poems/${key}`;
}

function setShare(key: string, share: { active: boolean; path: string | null }): void {
  state.shares[key] = share;
  if (state.poem.view?.id === key) state.poem.view.share = share;
}

/**
 * Publishing is two steps on purpose: the server issues a link that exposes
 * nothing, and only after the copy or share really completes does this
 * confirm it. Cancel, clipboard failure or timeout leaves it inactive.
 */
async function share(key: string): Promise<void> {
  const flashKey = `share-${key}`;
  await busy(flashKey, async () => {
    let attempt: ShareAttempt;
    try {
      attempt = await api<ShareAttempt>('POST', `${shareApi(key)}/share`);
    } catch (error) {
      flash(flashKey, describe(error), 'error');
      return;
    }
    const url = location.origin + attempt.path;
    try {
      const how = await deliver(url, 'Linejam');
      if (!attempt.active) await api('POST', `${shareApi(key)}/share/confirm`, { token: attempt.token });
      setShare(key, { active: true, path: attempt.path });
      flash(flashKey, how === 'copied' ? 'Link copied' : 'Shared');
    } catch {
      if (!attempt.active)
        await api('POST', `${shareApi(key)}/share/cancel`, { token: attempt.token }).catch(() => undefined);
      flash(flashKey, 'Not shared. Try again', 'error');
    }
  });
}

// ───────────────────────── actions ─────────────────────────

function entryFields(): { penName: string; code: string } {
  const pen = document.getElementById('pen-name') as HTMLInputElement | null;
  const code = document.getElementById('room-code') as HTMLInputElement | null;
  return { penName: normalizePenName(pen?.value ?? ''), code: normalizeCode(code?.value ?? '') };
}

async function enterGame(kind: 'create' | 'join'): Promise<void> {
  if (state.entryBusy) return;
  const { penName, code } = entryFields();
  state.errors = {};
  if (!penName) {
    state.errors.penName = 'Enter a pen name';
    nudge('penName');
    document.getElementById('pen-name')?.focus();
    return;
  }
  if (kind === 'join' && !isRoomCode(code)) {
    state.errors.code = 'Enter the 4-character code';
    nudge('code');
    document.getElementById('room-code')?.focus();
    return;
  }
  write(localStorage, 'linejam:penName', penName);
  write(localStorage, 'linejam:emblem', state.emblem);
  state.penName = penName;
  state.entryBusy = kind;
  render();
  try {
    await ensureGuest();
    const body = { penName, emblem: state.emblem };
    const room =
      kind === 'create'
        ? await api<RoomView>('POST', '/api/rooms', body)
        : await api<RoomView>('POST', `/api/rooms/${code}/join`, body);
    cue('tap');
    state.entryBusy = null;
    navigate(`/room/${room.code}`);
  } catch (error) {
    state.entryBusy = null;
    if (error instanceof ApiError && error.code === 'guest_invalid') state.guest = { status: 'invalid', guestId: null };
    else if (error instanceof ApiError && (error.code === 'pen_name_required' || error.code === 'pen_name_too_long')) {
      state.errors.penName = error.message;
      nudge('penName');
    } else if (kind === 'join') {
      state.errors.code = describe(error);
      nudge('code');
    } else flash('create', describe(error), 'error');
    render();
  }
}

async function roomAction(key: string, path: string, body: unknown = {}, flashKey = key): Promise<boolean> {
  const code = state.room?.code;
  if (!code) return false;
  let ok = false;
  await busy(key, async () => {
    try {
      const result = await api<RoomView | { closed?: true; left?: true }>('POST', `/api/rooms/${code}/${path}`, body);
      if (result && 'version' in result) accept(result);
      ok = true;
    } catch (error) {
      flash(flashKey, describe(error), 'error');
    }
  });
  return ok;
}

async function copy(text: string, flashKey: string, done: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    flash(flashKey, done);
  } catch {
    // Never claim success; offer the retry by leaving the control as it was.
    flash(flashKey, 'Not copied. Try again', 'error');
  }
}

function poemText(lines: { text: string }[]): string {
  return lines.map((l) => l.text).join('\n');
}

async function saveImage(poem: PoemView): Promise<void> {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  await document.fonts.load('40px Newsreader');
  const width = 1080;
  const pad = 96;
  const lineHeight = 78;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const wrap = (text: string): string[] => {
    ctx.font = '44px Newsreader, Georgia, serif';
    const out: string[] = [];
    let current = '';
    for (const word of text.split(' ')) {
      const next = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(next).width > width - pad * 2) {
        out.push(current);
        current = word;
      } else current = next;
    }
    if (current) out.push(current);
    return out;
  };
  const rows = poem.lines.flatMap((l) => wrap(l.text));
  canvas.width = width;
  canvas.height = pad * 2 + rows.length * lineHeight + 96;
  ctx.fillStyle = token('--bg');
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = token('--ink');
  ctx.textBaseline = 'top';
  ctx.font = '44px Newsreader, Georgia, serif';
  rows.forEach((row, i) => ctx.fillText(row, pad, pad + i * lineHeight));
  ctx.fillStyle = token('--ink-muted');
  ctx.font = '28px Newsreader, Georgia, serif';
  ctx.fillText('Linejam', pad, canvas.height - pad - 12);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('no image');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'linejam-poem.png';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function currentPoemId(): string | null {
  if (state.route.name === 'poem') return state.poem.view?.id ?? null;
  const circle = state.room?.game?.circle;
  if (!circle) return null;
  return (
    (
      circle.poems.find((p) => p.id === state.selectedPoem && p.lines) ??
      circle.poems.find((p) => p.state === 'reading')
    )?.id ?? null
  );
}

const THEMES: Theme[] = ['system', 'light', 'dark'];

const actions: Record<string, (el: HTMLElement) => void | Promise<void>> = {
  theme() {
    state.theme = THEMES[(THEMES.indexOf(state.theme) + 1) % THEMES.length]!;
    if (state.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = state.theme;
    write(localStorage, 'linejam:theme', state.theme === 'system' ? null : state.theme);
    render();
  },
  sound() {
    state.muted = !state.muted;
    setMuted(state.muted);
    render();
    cue('tap');
  },
  menu() {
    state.menuOpen = !state.menuOpen;
    render();
    if (state.menuOpen) (root.querySelector('.menu-item') as HTMLElement | null)?.focus();
  },
  async help() {
    closeMenu(true);
    await dialog({
      title: 'How to play',
      body: `<ol class="help"><li><strong>Write</strong> one line each round. You see the line before yours, nothing else.</li><li><strong>Pass</strong> for nine rounds: <span class="mono">1 2 3 4 5 4 3 2 1</span> words.</li><li><strong>Read</strong> the finished poems aloud.</li></ol>`,
      safe: 'Close',
    });
  },
  async 'leave-room'() {
    closeMenu(true);
    const confirmed = await dialog({ title: 'Leave room?', body: '', safe: 'Stay', confirm: { label: 'Leave room' } });
    if (!confirmed) return;
    const code = state.room?.code;
    try {
      await api('POST', `/api/rooms/${code}/leave`);
      navigate('/');
    } catch (error) {
      flash('circle', describe(error), 'error');
    }
  },
  async 'end-game'() {
    closeMenu(true);
    const confirmed = await dialog({
      title: 'End game?',
      body: '<p>Unfinished poems are discarded.</p>',
      safe: 'Keep playing',
      confirm: { label: 'End game' },
    });
    if (confirmed) await roomAction('end', 'end');
  },
  async 'close-room'() {
    closeMenu(true);
    const confirmed = await dialog({
      title: 'Close room?',
      body: '<p>The room code stops working.</p>',
      safe: 'Keep open',
      confirm: { label: 'Close room' },
    });
    if (confirmed && (await roomAction('close', 'close'))) {
      state.roomGone = 'closed';
      render();
    }
  },
  emblem(el) {
    const id = el.dataset.emblem;
    if (!isEmblem(id)) return;
    state.emblem = id;
    write(localStorage, 'linejam:emblem', id);
    render();
  },
  create: () => enterGame('create'),
  async 'fresh-guest'() {
    try {
      await ensureGuest(true);
    } catch {
      state.guest = { status: 'offline', guestId: null };
    }
    render();
  },
  async 'retry-guest'() {
    state.guest = { status: 'checking', guestId: null };
    render();
    await loadGuest();
    render();
  },
  'retry-room': () => enter(),
  'copy-code': () => copy(state.room!.code, 'copy-code', 'Code copied'),
  async 'share-invite'() {
    const url = `${location.origin}/join?code=${state.room!.code}`;
    try {
      const how = await deliver(url, 'Join my Linejam room');
      flash('share-invite', how === 'copied' ? 'Link copied' : 'Shared');
    } catch {
      flash('share-invite', 'Not shared. Try again', 'error');
    }
  },
  async start() {
    if (await roomAction('start', 'start')) cue('tap');
  },
  async 'play-again'() {
    if (await roomAction('start', 'start', {}, 'circle')) cue('tap');
  },
  'to-lobby': async () => void (await roomAction('lobby', 'lobby', {}, 'circle')),
  async reveal() {
    const poemId = state.room?.game?.circle?.nextPoemId;
    if (poemId && (await roomAction('reveal', 'reveal', { poemId }, 'circle'))) cue('reveal');
  },
  'open-poem'(el) {
    state.selectedPoem = el.dataset.poem ?? null;
    render();
  },
  async heart() {
    const poemId = currentPoemId();
    if (!poemId) return;
    const onPage = state.route.name === 'poem' ? state.poem.view : null;
    const hearted = onPage
      ? onPage.favorited
      : (state.room?.game?.circle?.poems.find((p) => p.id === poemId)?.hearted ?? false);
    await busy('heart', async () => {
      try {
        const shareToken = state.route.name === 'poem' ? state.route.share : null;
        const result = await api<{ favorited: boolean; hearts: number }>('POST', `/api/poems/${poemId}/favorite`, {
          on: !hearted,
          ...(shareToken ? { share: shareToken } : {}),
        });
        if (onPage) Object.assign(onPage, { favorited: result.favorited, hearts: result.hearts });
        if (result.favorited) cue('heart');
      } catch (error) {
        flash(onPage ? 'export' : 'circle', describe(error), 'error');
      }
    });
  },
  async 'archive-heart'(el) {
    const entry = state.archive.entries.find((p) => p.id === el.dataset.poem);
    if (!entry) return;
    try {
      const result = await api<{ favorited: boolean }>('POST', `/api/poems/${entry.id}/favorite`, {
        on: !entry.favorited,
      });
      entry.favorited = result.favorited;
      // Favorites first, then newest.
      state.archive.entries.sort((a, b) => Number(b.favorited) - Number(a.favorited) || b.completedAt - a.completedAt);
      render();
    } catch {
      await loadArchive();
    }
  },
  share: (el) => share(el.dataset.share!),
  async 'copy-share'(el) {
    const key = el.dataset.share!;
    const path = state.shares[key]?.path ?? state.poem.view?.share.path;
    if (path) await copy(location.origin + path, `share-${key}`, 'Link copied');
  },
  async 'revoke-share'(el) {
    const key = el.dataset.share!;
    await busy(`share-${key}`, async () => {
      try {
        await api('DELETE', `${shareApi(key)}/share`);
        setShare(key, { active: false, path: null });
        flash(`share-${key}`, 'Link revoked');
      } catch (error) {
        flash(`share-${key}`, describe(error), 'error');
      }
    });
  },
  'copy-text': () => copy(poemText(state.poem.view!.lines), 'export', 'Text copied'),
  async 'save-image'() {
    try {
      await saveImage(state.poem.view!);
      flash('export', 'Image saved');
    } catch {
      flash('export', 'Not saved. Try again', 'error');
    }
  },
  'load-archive': () => loadArchive(),
  'load-poem': () => loadPoem(),
  'load-recap': () => loadRecap(),
};

/** True while the assignment on screen is still `busyKey`'s. */
function onAssignment(busyKey: string): boolean {
  const game = state.room?.game;
  return Boolean(game?.assignment && lineBusyKey(game.id, game.assignment.lineIndex) === busyKey);
}

async function submitLine(): Promise<void> {
  const room = state.room;
  const game = room?.game;
  const assignment = game?.assignment;
  const input = document.getElementById('line-input') as HTMLTextAreaElement | null;
  if (!room || !game || !assignment || !input) return;
  const busyKey = lineBusyKey(game.id, assignment.lineIndex);
  if (state.busy[busyKey]) return;
  const problem = checkLine(input.value, assignment.lineIndex);
  if (problem) {
    state.lineError = problem.message;
    nudge('compose');
    input.focus();
    return;
  }
  state.lineError = null;
  const key = draftKey();
  // Pending feedback at once; the acknowledgement only after the server accepts.
  await busy(busyKey, async () => {
    try {
      await api('POST', `/api/rooms/${room.code}/lines`, {
        poemId: assignment.poemId,
        lineIndex: assignment.lineIndex,
        text: input.value,
      });
      if (key) write(sessionStorage, key, null);
      cue('tucked');
      accept(await api<RoomView>('GET', `/api/rooms/${room.code}`));
    } catch (error) {
      // The draft stays exactly as typed. A retry of an accepted line is harmless.
      // A failure that settles after the round moved on belongs to no composer on screen.
      if (!onAssignment(busyKey)) return;
      state.lineError = error instanceof NetworkError ? 'Not sent. Try again' : describe(error);
      nudge('compose');
    }
  });
}

function closeMenu(refocus: boolean): void {
  if (!state.menuOpen) return;
  state.menuOpen = false;
  render();
  if (refocus) document.getElementById('menu-button')?.focus();
}

// ───────────────────────── events ─────────────────────────

root.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const link = target.closest<HTMLAnchorElement>('a[data-link]');
  if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) {
    event.preventDefault();
    navigate(link.getAttribute('href')!);
    return;
  }
  const el = target.closest<HTMLElement>('[data-action]');
  if (el && !(el as HTMLButtonElement).disabled) {
    void actions[el.dataset.action!]?.(el);
    return;
  }
});

document.addEventListener('click', (event) => {
  if (state.menuOpen && !(event.target as HTMLElement).closest('.menu-wrap')) closeMenu(false);
});

root.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = (event.target as HTMLElement).dataset.form;
  if (form === 'join') void enterGame('join');
  else if (form === 'line') void submitLine();
});

root.addEventListener('input', (event) => {
  const el = event.target as HTMLInputElement | HTMLTextAreaElement;
  switch (el.dataset.input) {
    case 'pen-name':
      if (state.errors.penName) {
        state.errors.penName = undefined;
        render();
      }
      break;
    case 'code': {
      const clean = normalizeCode(el.value).slice(0, CODE_LENGTH);
      if (clean !== el.value) el.value = clean;
      if (state.errors.code) {
        state.errors.code = undefined;
        render();
      }
      break;
    }
    case 'line': {
      const key = draftKey();
      if (key) write(sessionStorage, key, el.value || null);
      const target = state.room?.game?.assignment?.words ?? 0;
      const before = state.tally;
      state.tally = countWords(el.value);
      state.lineError = null;
      if (state.tally > target && before <= target) nudge('compose');
      else render();
      break;
    }
  }
});

root.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement;
  if (event.key === 'Escape' && state.menuOpen) {
    event.preventDefault();
    closeMenu(true);
    return;
  }
  // Enter tucks the line; Shift+Enter is not needed — a line has no line breaks.
  if (event.key === 'Enter' && target.id === 'line-input' && !event.isComposing) {
    event.preventDefault();
    void submitLine();
    return;
  }
  if (
    target.getAttribute('role') === 'radio' &&
    ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)
  ) {
    event.preventDefault();
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const index = EMBLEMS.indexOf(state.emblem);
    const next = EMBLEMS[(index + step + EMBLEMS.length) % EMBLEMS.length] as Emblem;
    state.emblem = next;
    write(localStorage, 'linejam:emblem', next);
    render();
    (root.querySelector(`[data-emblem="${next}"]`) as HTMLElement | null)?.focus();
  }
  if (target.classList.contains('menu-item') && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault();
    const items = [...root.querySelectorAll<HTMLElement>('.menu-item')];
    const next = items[(items.indexOf(target) + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
    next?.focus();
  }
});

window.addEventListener('popstate', () => void enter());

// A mute change in another tab applies here too.
window.addEventListener('storage', (event) => {
  if (event.key === 'linejam:muted') {
    state.muted = isMuted();
    render();
  }
});

render();
void loadGuest().then(() => {
  render();
  return enter();
});
