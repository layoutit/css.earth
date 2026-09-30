import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { prepareTextureActivation, TEXTURE_PENDING_ATTRIBUTE } from './prepared-texture-activation.js';
import { createFramePacer, SETTLE_PACING } from './settle-pacer.js';

// The fake DOM has no cascade: a leaf's drawn image and display are its inline values unless its pending attribute's
// !important rules (triangle-faces.css) replace them.
const css = readFileSync(new URL('../styles/triangle-faces.css', import.meta.url), 'utf8');
const pendingValue = (node: HTMLElement) => node.getAttribute(TEXTURE_PENDING_ATTRIBUTE);
const image = (node: HTMLElement) => pendingValue(node) === null ? node.style.backgroundImage : 'none';
const display = (node: HTMLElement) => pendingValue(node) === 'withheld' ? 'none' : node.style.display || '';

test('the stylesheet holds a pending face without an image and a withheld one without a box', () => {
  assert.ok(css.includes(`[${TEXTURE_PENDING_ATTRIBUTE}] { background-image: none !important; }`));
  assert.ok(css.includes(`[${TEXTURE_PENDING_ATTRIBUTE}="withheld"] { display: none !important; }`));
});

function fixture() {
  const { document, window } = parseHTML('<html><body></body></html>');
  const root = document.createElement('div');
  root.innerHTML = '<div><u></u><u></u><u></u></div>';
  const leaves = [...root.querySelectorAll('u')];
  const callbacks = new Map<number, FrameRequestCallback>(), cleanup: (() => void)[] = [];
  let id = 0;
  window.requestAnimationFrame = fn => { callbacks.set(++id, fn); return id; };
  window.cancelAnimationFrame = id => { callbacks.delete(id); };
  // One batch a frame: a pacer whose budget never exceeds one unit admits exactly one whole batch each frame.
  const pacer = createFramePacer(callback => window.requestAnimationFrame(now => callback(now)), { ...SETTLE_PACING, startUnits: 1, maximumUnits: 1 });
  const controller = prepareTextureActivation([leaves.slice(0, 2), leaves.slice(2)], fn => cleanup.push(fn), pacer);
  document.body.append(root);
  return { root, leaves, controller, callbacks, dispose() { cleanup.forEach(fn => fn()); },
    paint() { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(fn => fn(0)); } };
}

test('complete connected topology stays fixed while selection images activate in batches', async () => {
  const f = fixture(), topology = [...f.root.querySelectorAll('*')].map(node => [node, node.parentNode]);
  for (const leaf of f.leaves) f.controller.write(leaf, 'url(surface.webp)');
  assert.equal(f.leaves.every(node => node.isConnected && image(node) === 'none'), true);
  const ready = f.controller.activate(); assert.equal(f.controller.activate(), ready);
  f.paint();
  assert.deepEqual(f.leaves.map(image), ['url(surface.webp)', 'none', 'none']);
  // A selection supersedes the withheld image and immediately updates resident leaves.
  for (const leaf of f.leaves) f.controller.write(leaf, 'url(next.webp)');
  f.paint();
  assert.deepEqual(f.leaves.map(image), ['url(next.webp)', 'url(next.webp)', 'none']);
  f.paint();
  assert.deepEqual(f.leaves.map(image), Array(3).fill('url(next.webp)'));
  let settled = false; ready.then(() => { settled = true; });
  await Promise.resolve(); assert.equal(settled, false);
  f.paint(); await ready;
  assert.deepEqual([...f.root.querySelectorAll('*')].map(node => [node, node.parentNode]), topology);
  assert.equal(f.callbacks.size, 0);
});

test('retiring during activation cancels image writes without changing membership', async () => {
  const f = fixture(); f.leaves.forEach(leaf => f.controller.write(leaf, 'url(surface.webp)'));
  const ready = f.controller.activate(); f.paint(); f.dispose();
  f.controller.write(f.leaves[2], 'url(stale.webp)'); f.paint(); await ready;
  assert.equal(image(f.leaves[2]), 'none');
  assert.equal(display(f.leaves[2]), 'none');
  assert.equal(f.leaves.every(leaf => leaf.isConnected), true);
  assert.equal(f.callbacks.size, 0);
});

test('untextured leaves still restore rendering in their prepared batches', async () => {
  const f = fixture(), ready = f.controller.activate();
  assert.deepEqual(f.leaves.map(display), ['', 'none', 'none']);
  f.paint();
  assert.deepEqual(f.leaves.map(display), ['', '', 'none']);
  f.paint(); f.paint(); await ready;
  assert.equal(f.leaves.every(node => !display(node) && image(node) === 'none' && pendingValue(node) === null), true);
  // An activated leaf without an image draws none inline, as before it was pending.
  assert.equal(f.leaves.every(node => node.style.backgroundImage === 'none'), true);
  f.dispose();
});

test('each new atlas starts with one retained face before the regular batch resumes', async () => {
  const f = fixture();
  f.controller.write(f.leaves[0], 'url(first.webp)');
  f.controller.write(f.leaves[1], 'url(second.webp)');
  f.controller.write(f.leaves[2], 'url(second.webp)');
  const ready = f.controller.activate();
  f.paint();
  assert.deepEqual(f.leaves.map(image), ['url(first.webp)', 'none', 'none']);
  f.paint();
  assert.deepEqual(f.leaves.map(image), ['url(first.webp)', 'url(second.webp)', 'none']);
  f.paint(); f.paint(); await ready;
  assert.deepEqual(f.leaves.map(image), ['url(first.webp)', 'url(second.webp)', 'url(second.webp)']);
  f.dispose();
});

test('pending faces retain membership and defer changed display selection until activation', async () => {
  const f = fixture();
  assert.deepEqual(f.leaves.map(display), ['', 'none', 'none']);
  assert.equal(f.controller.deferDisplay(f.leaves[1], 'block'), true);
  assert.equal(f.controller.deferDisplay(f.leaves[2], 'none'), true);
  assert.equal(display(f.leaves[1]), 'none');
  f.leaves.forEach(leaf => f.controller.write(leaf, 'url(surface.webp)'));
  const ready = f.controller.activate();
  f.paint();
  assert.deepEqual(f.leaves.map(display), ['', 'none', 'none']);
  f.paint();
  assert.deepEqual(f.leaves.map(display), ['', 'block', 'none']);
  f.paint(); f.paint(); await ready;
  assert.equal(display(f.leaves[2]), 'none');
  assert.equal(f.controller.deferDisplay(f.leaves[1], 'none'), false);
  assert.equal(f.leaves.every(leaf => leaf.isConnected), true);
  f.dispose();
});

test('each mesh parent retains a renderable anchor and exact prepared display is restored', async () => {
  const { document, window } = parseHTML('<html><body><div><u></u><u style="display:inline-block"></u></div><div><u></u><u style="display:none"></u></div></body></html>');
  const leaves = [...document.querySelectorAll('u')], callbacks: FrameRequestCallback[] = [];
  window.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length; };
  const activation = prepareTextureActivation([leaves], () => {});
  assert.deepEqual(leaves.map(display), ['', 'none', '', 'none']);
  const ready = activation.activate();
  callbacks.shift()!(0); callbacks.shift()!(0); await ready;
  assert.deepEqual(leaves.map(pendingValue), [null, null, null, null]);
  assert.equal(leaves[1].style.display, 'inline-block');
  assert.equal(leaves[3].style.display, 'none');
});
