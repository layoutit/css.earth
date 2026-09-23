import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseHTML } from 'linkedom';
import { createDestinationBrowser } from '../destination-browser.mts';
import type { PreparedDestinationRuntime } from '../../src/renderers/css/runtime/object-runtime-types.js';

function mount() {
  const { document } = parseHTML(`<section class="object-destination-panel" hidden><button class="object-destination-back"></button>
    <h2 class="object-destination-name"></h2><p class="object-destination-context"></p><p class="object-destination-status"></p></section>`);
  const browser = createDestinationBrowser({ documentTarget: document, onSelected() {}, onReset() {} })!;
  return { browser, panel: document.querySelector<HTMLElement>('.object-destination-panel')! };
}
function provider(selected: string[]): PreparedDestinationRuntime {
  return { select: async (place: { name: string }) => { selected.push(place.name); return { status: 'Arrived.' }; }, reset() {} } as unknown as PreparedDestinationRuntime;
}
const placeResponse = (name: string) => new Response(JSON.stringify({ place: { name, context: 'Earth', coverage: 'global' } }));

test('a selected city stays with its body: another body starts without the panel', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => placeResponse('Lima'));
  const { browser, panel } = mount();
  const earth: string[] = [];
  browser.bind(provider(earth), { id: 'earth', name: 'Earth' });
  await browser.selectById('3936456');
  assert.deepEqual(earth, ['Lima']);
  assert.equal(panel.hidden, false);

  browser.bind(null);
  assert.equal(panel.hidden, true, 'the next body does not show the previous body city');
  browser.setOpen(false);
  assert.equal(panel.hidden, true, 'closing the sheet does not bring the old city back');
});

test('a city lookup that finishes after the body changed selects nothing', async (t) => {
  let respond!: (response: Response) => void;
  t.mock.method(globalThis, 'fetch', () => new Promise<Response>(resolve => { respond = resolve; }));
  const { browser, panel } = mount();
  const earth: string[] = [], next: string[] = [];
  browser.bind(provider(earth), { id: 'earth', name: 'Earth' });
  const pending = browser.selectById('3936456');
  browser.bind(provider(next), { id: 'moon', name: 'Moon' });
  respond(placeResponse('Lima'));
  await pending;
  assert.deepEqual([earth, next], [[], []], 'neither body flies to the stale city');
  assert.equal(panel.hidden, true);
});
