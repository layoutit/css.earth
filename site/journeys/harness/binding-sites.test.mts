import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindingSites, parseWrappers } from './binding-sites.mts';
test('S0 owner/event/ordinal ids survive moving the source and bind separate same-line listeners', () => {
  const file = 'site/test.mts';
  const source = 'function bind() { a.addEventListener("click", first); b.addEventListener("click", second); }';
  const before = bindingSites(file, source, []), moved = bindingSites(file, '\n\n' + source, []);
  assert.deepEqual(before.sites.map(row => row.id), ['handler:site:test:bind:click:1', 'handler:site:test:bind:click:2']);
  assert.deepEqual(moved.sites.map(row => row.id), before.sites.map(row => row.id));
  assert.equal(moved.sites[0]?.line, 3);
  const position = before.offset(1, source.indexOf('b.addEventListener'));
  assert.deepEqual(before.sites.filter(row => position >= row.start && position < row.end).map(row => row.id), ['handler:site:test:bind:click:2']);
});
test('forwarded camera and control bindings reuse S0 wrapper event positions', () => {
  const wrappers = parseWrappers({ wrappers: [{ file: 'site/camera.mts', name: 'listen', eventIndex: 0 }, { file: 'site/controls.mts', name: 'listen', eventIndex: 1 }] });
  assert.deepEqual(bindingSites('site/camera.mts', 'function bind() { listen("pointerdown", callback); }', wrappers).sites.map(row => row.id), ['handler:site:camera:bind:pointerdown:1']);
  assert.deepEqual(bindingSites('site/controls.mts', 'function bind() { listen(button, "click", callback); }', wrappers).sites.map(row => row.id), ['handler:site:controls:bind:click:1']);
  assert.throws(() => parseWrappers({ wrappers: [{ eventIndex: -1 }] }), /Invalid/u);
});
test('RAF registrations keep owner identity and never alias ordinary listeners', () => {
  const source = 'function start() { w.requestAnimationFrame(tick); w.addEventListener("error", error); } const tick = () => { w.requestAnimationFrame(tick); };';
  const ids = bindingSites('site/diagnostic-recorder.mts', source, []).sites.map(row => row.id);
  assert.deepEqual(ids, ['handler:site:diagnostic-recorder:start:animation-frame:1', 'handler:site:diagnostic-recorder:start:error:1', 'handler:site:diagnostic-recorder:tick:animation-frame:1']);
  assert.deepEqual(bindingSites('site/diagnostic-recorder.mts', '\n\n' + source, []).sites.map(row => row.id), ids);
});
