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
