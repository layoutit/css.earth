import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createNavigationHistory } from '../navigation/navigation-history.mts';
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
  } as unknown as Window;
  const history = createNavigationHistory({ windowTarget, capture: () => href.replace('https://css.earth', ''),
    navigate: (id, intent) => { calls.push([id, intent]); return Promise.resolve(true); } });
  const front = state;
  history.commit('/mars/');
  href = 'https://css.earth/'; state = front;
  listeners.get('popstate')!({ state: front } as PopStateEvent);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], ROOT_OBJECT_ID);
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
  } as unknown as Window;
  const history = createNavigationHistory({ windowTarget, capture: () => captured,
    navigate: (id, intent) => { navigations.push([id, intent]); } });
  assert.equal(writes.length, 1); // The initial entry still needs its identity.
  history.checkpoint();
  captured = href; // Absolute and relative views identify the same saved entry.
  history.checkpoint();
  history.commit(captured, { history: 'replace' });
  assert.equal(writes.length, 1);
  captured = '/earth/?v=dragged';
  history.commit(captured, { history: 'replace' });
  const departed = state;
  history.checkpoint();
  assert.equal(writes.length, 2);
  assert.equal(state.unrelated, 'kept');
  history.commit('/mars/');
  const mars = state.cssEarthEntry;
  history.commit('/mars/'); // Explicit pushes remain distinct, even at one URL.
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
  history.checkpoint(); // The same URL with stale saved state still needs repair.
  assert.equal(writes.length, 5);
  assert.equal(state.cssEarthView, captured);
  history.destroy();
});
