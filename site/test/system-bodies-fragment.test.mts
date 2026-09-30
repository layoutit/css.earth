import assert from 'node:assert/strict';
import { parseHTML, DOMParser } from 'linkedom';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { createSystemBodiesPresentation } from '../system-bodies-fragment.mts';
import type { BrowserWindow } from '../browser/browser-types.mts';
const test = sourceTest();
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function fixture(fetch: (url: string) => Promise<Response>) {
  const { document, window } = parseHTML('<div data-system-results><div data-system-bodies-slot><div data-system-bodies="sun">Solar bodies</div></div></div>');
  const errors: unknown[] = [];
  const target = Object.assign(window, { fetch, DOMParser, reportError: (error: unknown) => errors.push(error) }) as unknown as BrowserWindow;
  const root = document.querySelector<HTMLElement>('[data-system-results]')!;
  return { controller: createSystemBodiesPresentation(root, target), slot: root.querySelector<HTMLElement>('[data-system-bodies-slot]')!, errors };
}

test('the native system list stays retained and needs no request', () => {
  const view = fixture(async () => { throw new Error('Unexpected request'); });
  const content = view.slot.firstElementChild;
  view.controller.show('sun');
  assert.equal(view.slot.firstElementChild, content);
  assert.equal(view.slot.hidden, false);
  view.controller.show(null);
  assert.equal(view.slot.hidden, true);
  assert.equal(view.slot.firstElementChild, content);
});

test('a late system response cannot replace the newly selected system', async () => {
  const pending = new Map<string, (response: Response) => void>();
  const view = fixture(url => new Promise(resolve => pending.set(url, resolve)));
  view.controller.show('trappist-1');
  view.controller.show('wasp-43');
  pending.get('/system-bodies-fragment/wasp-43/')!(new Response('<div data-system-bodies="wasp-43">WASP bodies</div>'));
  await flush();
  pending.get('/system-bodies-fragment/trappist-1/')!(new Response('<div data-system-bodies="trappist-1">TRAPPIST bodies</div>'));
  await flush();
  assert.equal(view.slot.querySelector<HTMLElement>('[data-system-bodies]')?.dataset.systemBodies, 'wasp-43');
  assert.equal(view.slot.hidden, false);
  assert.deepEqual(view.errors, []);
});

test('a fragment with another system identity is rejected', async () => {
  const view = fixture(async () => new Response('<div data-system-bodies="other">Wrong system</div>'));
  view.controller.show('trappist-1');
  await flush();
  assert.equal(view.slot.querySelector<HTMLElement>('[data-system-bodies]')?.dataset.systemBodies, 'sun');
  assert.equal(view.slot.hidden, true);
  assert.match(String(view.errors[0]), /wrong identity/);
});
