import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { createNavigationHistory, navigationHref } from '../navigation/navigation-history.mts';
import { ROOT_OBJECT_ID } from '../root-object.mts';

test('Back to the front page returns to the body it shows, not nowhere', () => {
  const listeners = new Map<string, (event: PopStateEvent) => void>(), calls: [string, unknown][] = [];
  let href = 'https://css.earth/', state: unknown = null;
  const windowTarget = {
    get location() { return { href }; },
    history: { get state() { return state; }, replaceState(value: unknown, _: string, url: string) { state = value; href = new URL(url, href).href; },
      pushState(value: unknown, _: string, url: string) { state = value; href = new URL(url, href).href; } },
    addEventListener(type: string, listener: (event: PopStateEvent) => void) { listeners.set(type, listener); },
    removeEventListener() {},
    // History writes run in a task of their own; the test runs them when it needs them.
    setTimeout(callback: () => void) { queued.push(callback); return queued.length; }, clearTimeout() {},
  } as unknown as Window;
  const queued: (() => void)[] = [], rest = () => { for (const callback of queued.splice(0)) callback(); };
  const history = createNavigationHistory({ windowTarget, capture: () => href.replace('https://css.earth', ''),
    navigate: (id, intent) => { calls.push([id, intent]); return Promise.resolve(true); } });
  const front = state;
  history.commit('/mars/'); rest();
  href = 'https://css.earth/'; state = front;
  listeners.get('popstate')!({ state: front } as PopStateEvent);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], ROOT_OBJECT_ID);
});

test("Back before an arrival's entry is written returns to the body the flight left, not the one before it", () => {
  const listeners = new Map<string, (event: PopStateEvent) => void>(), calls: [string, { url?: string }][] = [];
  let href = 'https://css.earth/earth/', state: unknown = null, view = '/earth/', forwards = 0;
  const windowTarget = {
    get location() { return { href }; },
    history: { forward() { forwards++; }, get state() { return state; }, replaceState(value: unknown, _: string, url: string) { state = value; href = new URL(url, href).href; },
      pushState(value: unknown, _: string, url: string) { state = value; href = new URL(url, href).href; } },
    addEventListener(type: string, listener: (event: PopStateEvent) => void) { listeners.set(type, listener); },
    removeEventListener() {},
    setTimeout(callback: () => void) { queued.push(callback); return queued.length; }, clearTimeout() {},
  } as unknown as Window;
  const queued: (() => void)[] = [], rest = () => { for (const callback of queued.splice(0)) callback(); };
  const history = createNavigationHistory({ windowTarget, capture: () => view,
    navigate: (id, intent) => { calls.push([id, intent as { url?: string }]); return Promise.resolve(true); } });
  const earth = state;
  view = '/mars/'; history.commit('/mars/'); rest();
  const mars = state;
  // The Moon's entry is still held when the reader presses Back: the browser leaves Mars's entry for Earth's.
  view = '/moon/'; history.commit('/moon/');
  href = 'https://css.earth/earth/'; state = earth;
  listeners.get('popstate')!({ state: earth } as PopStateEvent);
  assert.equal(calls.length, 0);
  assert.equal(forwards, 1, 'the browser steps forward to the entry it left');
  href = 'https://css.earth/mars/'; state = mars;
  listeners.get('popstate')!({ state: mars } as PopStateEvent);
  assert.deepEqual(calls.map(([id, intent]) => [id, intent.url]), [['mars', 'https://css.earth/mars/']]);
});

test('settled view checkpoints skip native history writes without losing real entries', () => {
  const writes: { kind: string; url: string }[] = [];
  const listeners = new Map<string, (event: PopStateEvent) => void>();
  const navigations: [string, unknown][] = [];
  let href = 'https://css.earth/earth/?v=initial', captured = '/earth/?v=initial';
  let state: Record<string, unknown> = { unrelated: 'kept' };
  const write = (kind: string, value: Record<string, unknown>, url: string) => {
    writes.push({ kind, url }); state = value; href = new URL(url, href).href;
  };
  const windowTarget = {
    get location() { return { href }; },
    history: { get state() { return state; },
      replaceState(value: Record<string, unknown>, _: string, url: string) { write('replace', value, url); },
      pushState(value: Record<string, unknown>, _: string, url: string) { write('push', value, url); } },
    addEventListener(type: string, listener: (event: PopStateEvent) => void) { listeners.set(type, listener); },
    removeEventListener() {},
    setTimeout(callback: () => void) { queued.push(callback); return queued.length; }, clearTimeout() {},
  } as unknown as Window;
  const queued: (() => void)[] = [], rest = () => { for (const callback of queued.splice(0)) callback(); };
  const history = createNavigationHistory({ windowTarget, capture: () => captured,
    navigate: (id, intent) => { navigations.push([id, intent]); } });
  assert.equal(writes.length, 1); // The initial entry still needs its identity.
  history.checkpoint(); rest();
  captured = href; // Absolute and relative views identify the same saved entry.
  history.checkpoint(); rest();
  history.commit(captured, { history: 'replace' }); rest();
  assert.equal(writes.length, 1);
  captured = '/earth/?v=dragged';
  history.commit(captured, { history: 'replace' }); rest();
  const departed = state;
  history.checkpoint(); rest();
  assert.equal(writes.length, 2);
  assert.equal(state.unrelated, 'kept');
  history.commit('/mars/'); rest();
  const mars = state.cssEarthEntry;
  history.commit('/mars/'); rest(); // Explicit pushes remain distinct, even at one URL.
  assert.notEqual(state.cssEarthEntry, mars);
  assert.deepEqual(writes.map(w => w.kind), ['replace', 'replace', 'push', 'push']);
  captured = '/mars/';
  href = 'https://css.earth/earth/?v=dragged'; state = departed;
  listeners.get('popstate')!({ state: departed } as PopStateEvent);
  assert.deepEqual(navigations, [['earth', { kind: 'history', url: href,
    history: { history: 'pop', entry: departed.cssEarthEntry } }]]);
  history.commit(href, { history: 'pop', entry: String(departed.cssEarthEntry) });
  assert.equal(writes.length, 4);
  state = { ...state, cssEarthView: '/earth/?v=stale' };
  captured = '/earth/?v=dragged';
  history.checkpoint(); rest(); // The same URL with stale saved state still needs repair.
  assert.equal(writes.length, 5);
  assert.equal(state.cssEarthView, captured);
  history.destroy();
});

/** A window whose document and root element dispatch real events, with timers the test advances. */
function readerWindow(start: string) {
  const writes: { kind: string; url: string }[] = [], timers = new Map<number, { at: number; callback: () => void }>();
  let href = start, state: Record<string, unknown> = {}, now = 0, id = 0;
  const events = new EventTarget(), root = new EventTarget();
  const page = Object.assign(new EventTarget(), { documentElement: root, visibilityState: 'visible' });
  const write = (kind: string) => (value: Record<string, unknown>, _: string, url: string) => { writes.push({ kind, url }); state = value; href = new URL(url, href).href; };
  const windowTarget = {
    document: page,
    get location() { return { href }; },
    history: { get state() { return state; }, replaceState: write('replace'), pushState: write('push') },
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
    setTimeout(callback: () => void, delay: number) { timers.set(++id, { at: now + delay, callback }); return id; },
    clearTimeout(timer: number) { timers.delete(timer); },
  } as unknown as Window;
  const pointer = (type: string, pointerType: string) => (type === 'pointerdown' ? page : root).dispatchEvent(Object.assign(new Event(type), { pointerType }));
  return { windowTarget, writes, pointer,
    advance(ms: number) { now += ms; for (const [key, timer] of [...timers]) if (timer.at <= now) { timers.delete(key); timer.callback(); } },
    motion: (active: boolean) => page.dispatchEvent(new CustomEvent('objectmotionchange', { detail: { active, coasting: false } })),
    windowEvent: (type: string, detail: object = {}) => events.dispatchEvent(Object.assign(new Event(type), detail)),
    visibility(value: string) { page.visibilityState = value; page.dispatchEvent(new Event('visibilitychange')); } };
}

test('a view is held while the reader uses the page: the app reads it, and the History API hears it when they leave', () => {
  const { windowTarget, writes, pointer, advance, motion, windowEvent, visibility } = readerWindow('https://css.earth/venus/?v=a');
  const history = createNavigationHistory({ windowTarget, capture: () => '/venus/?v=a', navigate: () => {} });
  writes.length = 0;
  pointer('pointerenter', 'mouse'); motion(true);
  // A selection flies to the Solar System and the view keeps changing: nothing reaches the History API in flight.
  history.commit('/solar-system/');
  history.commit('/solar-system/?v=b', { history: 'replace' });
  advance(60_000);
  assert.deepEqual(writes, []);
  assert.equal(navigationHref(windowTarget), 'https://css.earth/solar-system/?v=b', 'the app reads the held URL');
  // The navigation's entry is written as soon as the camera rests, in its own task: Back has to find it.
  motion(false);
  assert.deepEqual(writes, []);
  advance(0);
  assert.deepEqual(writes, [{ kind: 'push', url: '/solar-system/?v=b' }], 'one push, with the final view');
  // A view is not: with the mouse over the page it waits, however long the camera rests.
  const view = (token: string) => { writes.length = 0; history.commit(`/solar-system/?v=${token}`, { history: 'replace' }); advance(60_000); assert.deepEqual(writes, [], token); };
  const written = (token: string, how: string) => assert.deepEqual(writes, [{ kind: 'replace', url: `/solar-system/?v=${token}` }], how);
  view('c'); pointer('pointerleave', 'mouse'); advance(0); written('c', 'the mouse left the page');
  pointer('pointerenter', 'mouse');
  view('d'); windowEvent('blur'); advance(0); written('d', 'the window lost focus');
  windowEvent('focus');
  view('e'); windowEvent('keydown', { key: 'a' }); advance(60_000); assert.deepEqual(writes, []);
  windowEvent('keydown', { key: 'Meta' }); advance(0); written('e', 'a shortcut of the browser starts');
  // The camera still moves when the reader leaves: the write waits for it to rest.
  view('f'); motion(true); windowEvent('blur'); advance(60_000); assert.deepEqual(writes, []);
  motion(false); advance(0); written('f', 'left in motion, written at rest');
  windowEvent('focus');
  // A hidden page may never run another task: it writes at once.
  view('g'); motion(true); visibility('hidden'); written('g', 'the page was hidden');
  history.destroy();
});

test('with no mouse over the page a view is written once the page has been still, and any use starts the wait again', () => {
  const { windowTarget, writes, pointer, advance, motion, windowEvent } = readerWindow('https://css.earth/venus/?v=a');
  const history = createNavigationHistory({ windowTarget, capture: () => '/venus/?v=a', navigate: () => {} });
  writes.length = 0;
  pointer('pointerdown', 'touch');
  history.commit('/venus/?v=b', { history: 'replace' });
  advance(2999); pointer('pointerdown', 'touch'); advance(2999);
  assert.deepEqual(writes, []);
  advance(1);
  assert.deepEqual(writes, [{ kind: 'replace', url: '/venus/?v=b' }]);
  history.commit('/venus/?v=c', { history: 'replace' });
  advance(1000); motion(true); advance(60_000); motion(false); advance(2999);
  assert.equal(writes.length, 1, 'a gesture starts the still period again');
  advance(1);
  assert.deepEqual(writes.at(-1), { kind: 'replace', url: '/venus/?v=c' });
  // A wheel turns under a mouse, though it never moved onto the page (it was there when the page loaded): held again.
  windowEvent('wheel');
  history.commit('/venus/?v=d', { history: 'replace' }); advance(60_000);
  assert.equal(writes.length, 2);
  windowEvent('blur'); advance(0);
  assert.deepEqual(writes.at(-1), { kind: 'replace', url: '/venus/?v=d' });
  history.destroy();
});

test('two flights before the camera rests are two entries, each left with the view it was departed from', () => {
  const { windowTarget, writes, advance, motion } = readerWindow('https://css.earth/venus/?v=a');
  let view = '/venus/?v=a';
  const history = createNavigationHistory({ windowTarget, capture: () => view, navigate: () => {} });
  writes.length = 0;
  // The router checkpoints the view it leaves, then commits the arrival (2026-10-01: Back from the second lands on the first).
  view = '/venus/?v=left'; history.checkpoint(); history.commit('/mars/'); motion(true);
  view = '/mars/?v=passing'; history.checkpoint(); history.commit('/moon/'); motion(false);
  assert.deepEqual(writes, []);
  advance(0);
  assert.deepEqual(writes, [{ kind: 'replace', url: '/venus/?v=left' }, { kind: 'push', url: '/mars/?v=passing' }, { kind: 'push', url: '/moon/' }]);
  history.destroy();
});

test('a view kept for the entry is the one Back returns to after the next push', () => {
  const listeners = new Map<string, (event: PopStateEvent) => void>(), calls: [string, { url?: string }][] = [];
  let href = 'https://css.earth/earth/?v=near', state: unknown = null, view = '/earth/?v=near';
  const queued: (() => void)[] = [], rest = () => { for (const callback of queued.splice(0)) callback(); }, writes: string[] = [];
  const windowTarget = {
    get location() { return { href }; },
    history: { get state() { return state; }, replaceState(value: unknown, _: string, url: string) { writes.push(url); state = value; href = new URL(url, href).href; },
      pushState(value: unknown, _: string, url: string) { writes.push(url); state = value; href = new URL(url, href).href; } },
    addEventListener(type: string, listener: (event: PopStateEvent) => void) { listeners.set(type, listener); },
    removeEventListener() {},
    setTimeout(callback: () => void) { queued.push(callback); return queued.length; }, clearTimeout() {},
  } as unknown as Window;
  const history = createNavigationHistory({ windowTarget, capture: () => view,
    navigate: (id, intent) => { calls.push([id, intent as { url?: string }]); return Promise.resolve(true); } });
  const earth = state;
  // A header pill flies the camera out; the view writer rewrites the entry on the way.
  view = '/earth/?v=far'; history.checkpoint(); rest();
  assert.equal(href, 'https://css.earth/earth/?v=far');
  // The hand-over the flight lands on keeps the view it left, then pushes its own entry.
  history.keep('/earth/?v=near');
  assert.equal(navigationHref(windowTarget), 'https://css.earth/earth/?v=near');
  history.commit('/solar-system/'); rest();
  assert.deepEqual(writes.slice(-2), ['/earth/?v=near', '/solar-system/'], 'the entry left is written with its kept view, then the push');
  assert.equal(href, 'https://css.earth/solar-system/');
  href = 'https://css.earth/earth/?v=near'; state = earth;
  listeners.get('popstate')!({ state: earth } as PopStateEvent);
  assert.equal(calls.at(-1)?.[1].url, 'https://css.earth/earth/?v=near');
});
