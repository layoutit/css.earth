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

test("a drawn page's dataset button navigates in place to that page with the dataset, keeping the camera", async () => {
  const { parseHTML } = await import('linkedom');
  const { bindNavigationLinks } = await import('../navigation/navigation-history.mts');
  const { document, window } = parseHTML(`<html><body>
    <form id="page-observable-universe-datasets" action="/observable-universe/" data-dataset-form data-drawn-page="observable-universe" hidden></form>
    <button type="submit" form="page-observable-universe-datasets" name="dataset" value="full"><span>Full sphere</span></button></body></html>`);
  // As a browser does: the button's form owner through its `form` attribute (linkedom has none), and that form's controls
  // named `dataset` shadowing `form.dataset`, so the page must be read from the attribute.
  const form = document.querySelector('form')!, button = document.querySelector('button')!;
  Object.defineProperty(button, 'form', { value: form });
  Object.defineProperty(form, 'dataset', { value: [button] });
  const calls: [string, unknown][] = [];
  const windowTarget = Object.assign(window, { location: { href: 'https://css.earth/observable-universe/?v=CAMERA&overview=system', origin: 'https://css.earth' } });
  const unbind = bindNavigationLinks({ documentTarget: document, windowTarget: windowTarget as never, navigable: id => id === 'observable-universe',
    navigate: (id, intent) => { calls.push([id, intent]); return true; } });
  // linkedom has no MouseEvent: a primary-button click is a click event with button 0.
  const click = Object.assign(new window.Event('click', { bubbles: true, cancelable: true }), { button: 0 });
  document.querySelector('span')!.dispatchEvent(click);
  unbind();
  assert.equal(click.defaultPrevented, true);
  assert.deepEqual(calls, [['observable-universe', { kind: 'link', url: 'https://css.earth/observable-universe/?v=CAMERA&dataset=full' }]]);
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
