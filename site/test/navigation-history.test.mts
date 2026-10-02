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
    // History writes wait for rest (REST_WRITE_MS); the test runs them when it needs them.
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

test('Back within the rest period of an arrival returns to the body the flight left, not the one before it', () => {
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

test('history written while the camera moves is held and applied once at rest; the app reads the held URL meanwhile', () => {
  const writes: { kind: string; url: string }[] = [];
  let href = 'https://css.earth/venus/?v=a', state: Record<string, unknown> = {}, now = 0, id = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const documentTarget = new EventTarget();
  const windowTarget = {
    document: documentTarget,
    get location() { return { href }; },
    history: { get state() { return state; },
      replaceState(value: Record<string, unknown>, _: string, url: string) { writes.push({ kind: 'replace', url }); state = value; href = new URL(url, href).href; },
      pushState(value: Record<string, unknown>, _: string, url: string) { writes.push({ kind: 'push', url }); state = value; href = new URL(url, href).href; } },
    addEventListener() {}, removeEventListener() {},
    setTimeout(callback: () => void, delay: number) { timers.set(++id, { at: now + delay, callback }); return id; },
    clearTimeout(timer: number) { timers.delete(timer); },
  } as unknown as Window;
  const advance = (ms: number) => { now += ms; for (const [key, timer] of [...timers]) if (timer.at <= now) { timers.delete(key); timer.callback(); } };
  const motion = (active: boolean) => documentTarget.dispatchEvent(new CustomEvent('objectmotionchange', { detail: { active, coasting: false } }));
  const history = createNavigationHistory({ windowTarget, capture: () => '/venus/?v=a', navigate: () => {} });
  writes.length = 0;
  motion(true);
  // A pinch hands Venus over to the Solar System overview, then the view keeps changing: nothing reaches the History API.
  history.commit('/solar-system/');
  history.commit('/solar-system/?v=b', { history: 'replace' });
  assert.deepEqual(writes, []);
  assert.equal(navigationHref(windowTarget), 'https://css.earth/solar-system/?v=b', 'the app reads the held URL');
  motion(false); advance(999);
  assert.deepEqual(writes, []);
  advance(1);
  assert.deepEqual(writes, [{ kind: 'push', url: '/solar-system/?v=b' }], 'one push for the handoff, with the final view');
  assert.equal(navigationHref(windowTarget), href);
  // At rest a write still waits the quiet period, in its own task.
  history.commit('/solar-system/?v=c', { history: 'replace' });
  assert.equal(writes.length, 1);
  advance(1000);
  assert.deepEqual(writes.at(-1), { kind: 'replace', url: '/solar-system/?v=c' });
  // Two flights inside one rest period are two entries: Back from the second lands on the first (2026-10-01).
  writes.length = 0;
  history.commit('/mars/'); advance(300);
  motion(true); history.commit('/moon/'); motion(false); advance(1000);
  assert.deepEqual(writes, [{ kind: 'push', url: '/mars/' }, { kind: 'push', url: '/moon/' }]);
  history.destroy();
});

test('a view kept for the entry is the one Back returns to after the next push', () => {
  const listeners = new Map<string, (event: PopStateEvent) => void>(), calls: [string, { url?: string }][] = [];
  let href = 'https://css.earth/earth/?v=near', state: unknown = null, view = '/earth/?v=near';
  const queued: (() => void)[] = [], rest = () => { for (const callback of queued.splice(0)) callback(); };
  const windowTarget = {
    get location() { return { href }; },
    history: { get state() { return state; }, replaceState(value: unknown, _: string, url: string) { state = value; href = new URL(url, href).href; },
      pushState(value: unknown, _: string, url: string) { state = value; href = new URL(url, href).href; } },
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
  assert.equal(href, 'https://css.earth/earth/?v=near');
  history.commit('/solar-system/'); rest();
  assert.equal(href, 'https://css.earth/solar-system/');
  href = 'https://css.earth/earth/?v=near'; state = earth;
  listeners.get('popstate')!({ state: earth } as PopStateEvent);
  assert.equal(calls.at(-1)?.[1].url, 'https://css.earth/earth/?v=near');
});
