import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { createFeatureBrowser, type FindResult } from './feature-browser.mts';
import { required } from './navigation/navigation-test-values.test-support.mts';

function fixture() {
  const { document, window } = parseHTML(`<details class="object-feature-results" open><span class="object-panel-heading-count"></span><p class="object-destination-hint"></p>${Array.from({ length: 2 }, () => '<div><a class="object-destination-result"><b class="object-destination-result-name"></b><span class="object-destination-result-context"></span></a></div>').join('')}</details>`);
  const selected: FindResult[] = [];
  const browser = required(createFeatureBrowser({ documentTarget: document, onSelected: row => selected.push(row) }));
  const root = required(document.querySelector<HTMLElement>('details'));
  const buttons = [...root.querySelectorAll<HTMLAnchorElement>('a')];
  const row: FindResult = { objectId: 'earth', id: 'city-1', name: 'Lima', context: 'Peru', label: 'Lima, Peru', href: '/earth/?feature=city-1' };
  return { document, window, browser, selected, root, buttons, row };
}

test('feature presentation truncates to retained rows, preserves an open repeated query and displays failures', () => {
  const f = fixture();
  assert.equal(f.browser.present('lima', [f.row, { ...f.row, id: '2', name: 'Other' }, f.row]), 2);
  assert.equal(f.root.hasAttribute('open'), false);
  assert.equal(f.buttons[0].getAttribute('href'), f.row.href);
  assert.equal(f.buttons[0].getAttribute('aria-label'), f.row.label);
  assert.equal(f.buttons[0].textContent, 'LimaPeru');
  assert.equal(f.root.querySelector('.object-panel-heading-count')?.textContent, '(2)');
  f.root.setAttribute('open', ''); f.browser.present('lima', [f.row]);
  assert.equal(f.root.hasAttribute('open'), true);
  assert.equal(f.buttons[1].parentElement?.hidden, true);
  assert.equal(f.browser.present('retry', null), 0);
  assert.equal(f.root.hidden, false);
  assert.equal(f.root.querySelector('.object-destination-hint')?.textContent, 'Feature names could not load. Change your search to retry.');
  f.browser.present('none', []); assert.equal(f.root.hidden, true);
  f.browser.destroy(); f.browser.destroy();
  assert.equal(f.browser.present('late', [f.row]), 0); assert.equal(f.root.hidden, true);
});

test('ordinary populated links select a feature while modified clicks and empty rows do nothing', () => {
  const f = fixture(); f.browser.present('lima', [f.row]);
  function click(index: number, modifiers: Record<string, unknown>) {
    f.buttons[index].dispatchEvent(Object.assign(new f.window.Event('click'), { button: 0, ...modifiers }));
  }
  for (const modifiers of [{ button: 1 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }]) click(0, modifiers);
  click(1, {}); assert.deepEqual(f.selected, []);
  click(0, {}); assert.deepEqual(f.selected, [f.row]);
  f.browser.destroy(); click(0, {}); assert.deepEqual(f.selected, [f.row]);
  const { document } = parseHTML('<div></div>');
  assert.equal(createFeatureBrowser({ documentTarget: document, onSelected() {} }), null);
});
