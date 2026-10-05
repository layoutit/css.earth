import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { bindTabPanels, syncTabPanels } from './tab-panels.mts';
test('detached body tabs remain detached on narrow layout and external tabs follow their radio', () => {
  const { document } = parseHTML('<html><body><aside class="object-information-panel"><section class="object-card-tabpanel" id="a"></section><section class="object-card-tabpanel" id="b"></section></aside><section class="object-card-tabpanel" id="outside"></section><input class="object-native-tab" aria-controls="a"><input class="object-native-tab" aria-controls="b"><input class="object-native-tab" aria-controls="outside"><input class="object-native-tab"></body></html>');
  const radios = [...document.querySelectorAll<HTMLInputElement>('input')]; radios[0].checked = true;
  const a = document.querySelector('#a'), b = document.querySelector('#b'); syncTabPanels(document, radios, false);
  assert.equal(document.querySelector('#a') === a, true);
  assert.equal(Boolean(document.querySelector('#b')), false);
  assert.equal(Boolean(document.querySelector('#outside')), false);
  syncTabPanels(document, radios, true);
  assert.equal(Boolean(document.querySelector('#b')), false);
  assert.equal(b?.parentElement?.localName, 'template');
  assert.equal(Boolean(document.querySelector('#outside')), false);
});
test('binding syncs native tab changes and ignores unrelated change targets', () => {
  const { document, window } = parseHTML('<html><body><section class="object-card-tabpanel" id="a"></section><section class="object-card-tabpanel" id="b"></section><input name="tabs" class="object-native-tab" aria-controls="a"><input name="tabs" class="object-native-tab" aria-controls="b"><input id="other"></body></html>');
  let change = () => {}; Object.assign(window, { matchMedia: () => ({ matches: false, addEventListener(_type: string, listener: () => void) { change = listener; } }) });
  const radios = document.querySelectorAll<HTMLInputElement>('.object-native-tab'); radios[0].checked = true;
  const binding = bindTabPanels(document, new AbortController().signal);
  assert.ok(document.querySelector('#a'));
  assert.equal(Boolean(document.querySelector('#b')), false);
  document.body.dispatchEvent(new window.Event('change', { bubbles: true })); document.querySelector('#other')!.dispatchEvent(new window.Event('change', { bubbles: true }));
  radios[0].checked = false; radios[1].checked = true; radios[1].dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(Boolean(document.querySelector('#a')), false);
  assert.ok(document.querySelector('#b')); change();
   binding.sync();
  assert.ok(document.querySelector('#b'));
});
test('initial narrow body-card panels stay mounted regardless of their unchecked tabs', () => {
  const { document } = parseHTML('<aside class="object-information-panel"><section class="object-card-tabpanel" id="narrow"></section></aside><input class="object-native-tab" aria-controls="narrow">');
  syncTabPanels(document);
  assert.ok(document.querySelector('#narrow'));
});

test('binding without a layout matcher defaults to stacked body panels', () => {
  const { document } = parseHTML('<aside class="object-information-panel"><section class="object-card-tabpanel" id="a"></section></aside><input class="object-native-tab" aria-controls="a">');
  Object.defineProperty(document, 'defaultView', { value: null });
  const binding = bindTabPanels(document, new AbortController().signal);
  assert.ok(document.querySelector('#a'));
  binding.sync();
  assert.ok(document.querySelector('#a'));
});

test('layout listener belongs to the abort signal and stops synchronizing after abort', () => {
  const { document, window } = parseHTML('<section class="object-card-tabpanel" id="a"></section><input name="tabs" class="object-native-tab" aria-controls="a">');
  const layout = new EventTarget();
  Object.assign(layout, { matches: false });
  Object.assign(window, { matchMedia: () => layout });
  const radio = document.querySelector<HTMLInputElement>('input')!;
  radio.checked = true;
  const controller = new AbortController();
  bindTabPanels(document, controller.signal);
  radio.checked = false;
  layout.dispatchEvent(new Event('change'));
  assert.equal(document.querySelector('#a'), null);
  radio.checked = true;
  layout.dispatchEvent(new Event('change'));
  assert.ok(document.querySelector('#a'));
  controller.abort();
  radio.checked = false;
  layout.dispatchEvent(new Event('change'));
  assert.ok(document.querySelector('#a'));
});

test('a changed radio synchronizes only its own named group', () => {
  const { document, window } = parseHTML('<section class="object-card-tabpanel" id="a"></section><section class="object-card-tabpanel" id="b"></section><input name="first" class="object-native-tab" aria-controls="a"><input name="second" class="object-native-tab" aria-controls="b">');
  Object.assign(window, { matchMedia: () => ({ matches: false, addEventListener() {} }) });
  const [first, second] = document.querySelectorAll<HTMLInputElement>('input');
  first.checked = true;
  second.checked = true;
  bindTabPanels(document, new AbortController().signal);
  second.checked = false;
  first.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.ok(document.querySelector('#a'));
  assert.ok(document.querySelector('#b'));
  second.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(document.querySelector('#b'), null);
});
