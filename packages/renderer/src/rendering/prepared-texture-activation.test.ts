import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { prepareTextureActivation, TEXTURE_PENDING_ATTRIBUTE } from './prepared-texture-activation.js';

// The fake DOM has no cascade: a leaf's drawn image and display are its inline values unless its pending attribute's
// !important rules (triangle-faces.css) replace them.
const css = readFileSync(new URL('../styles/triangle-faces.css', import.meta.url), 'utf8');
const pendingValue = (node: HTMLElement) => node.getAttribute(TEXTURE_PENDING_ATTRIBUTE);
const image = (node: HTMLElement) => pendingValue(node) === null ? node.style.backgroundImage : 'none';
const display = (node: HTMLElement) => pendingValue(node) === 'withheld' ? 'none' : node.style.display || '';

test('the stylesheet holds a pending face without an image and a withheld one without a box', () => {
  expect(css).toContain(`[${TEXTURE_PENDING_ATTRIBUTE}] { background-image: none !important; }`);
  expect(css).toContain(`[${TEXTURE_PENDING_ATTRIBUTE}="withheld"] { display: none !important; }`);
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
  const controller = prepareTextureActivation([leaves.slice(0, 2), leaves.slice(2)], fn => cleanup.push(fn));
  document.body.append(root);
  return { root, leaves, controller, callbacks, dispose() { cleanup.forEach(fn => fn()); },
    paint() { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(fn => fn(0)); } };
}

test('complete connected topology stays fixed while selection images activate in batches', async () => {
  const f = fixture(), topology = [...f.root.querySelectorAll('*')].map(node => [node, node.parentNode]);
  for (const leaf of f.leaves) f.controller.write(leaf, 'url(surface.webp)');
  expect(f.leaves.every(node => node.isConnected && image(node) === 'none')).toBe(true);
  const ready = f.controller.activate(); expect(f.controller.activate()).toBe(ready);
  f.paint();
  expect(f.leaves.map(image)).toEqual(['url(surface.webp)', 'none', 'none']);
  // A selection supersedes the withheld image and immediately updates resident leaves.
  for (const leaf of f.leaves) f.controller.write(leaf, 'url(next.webp)');
  f.paint();
  expect(f.leaves.map(image)).toEqual(['url(next.webp)', 'url(next.webp)', 'none']);
  f.paint();
  expect(f.leaves.map(image)).toEqual(Array(3).fill('url(next.webp)'));
  let settled = false; ready.then(() => { settled = true; });
  await Promise.resolve(); expect(settled).toBe(false);
  f.paint(); await ready;
  expect([...f.root.querySelectorAll('*')].map(node => [node, node.parentNode])).toEqual(topology);
  expect(f.callbacks.size).toBe(0);
});

test('retiring during activation cancels image writes without changing membership', async () => {
  const f = fixture(); f.leaves.forEach(leaf => f.controller.write(leaf, 'url(surface.webp)'));
  const ready = f.controller.activate(); f.paint(); f.dispose();
  f.controller.write(f.leaves[2], 'url(stale.webp)'); f.paint(); await ready;
  expect(image(f.leaves[2])).toBe('none');
  expect(display(f.leaves[2])).toBe('none');
  expect(f.leaves.every(leaf => leaf.isConnected)).toBe(true);
  expect(f.callbacks.size).toBe(0);
});

test('untextured leaves still restore rendering in their prepared batches', async () => {
  const f = fixture(), ready = f.controller.activate();
  expect(f.leaves.map(display)).toEqual(['', 'none', 'none']);
  f.paint();
  expect(f.leaves.map(display)).toEqual(['', '', 'none']);
  f.paint(); f.paint(); await ready;
  expect(f.leaves.every(node => !display(node) && image(node) === 'none' && pendingValue(node) === null)).toBe(true);
  // An activated leaf without an image draws none inline, as before it was pending.
  expect(f.leaves.every(node => node.style.backgroundImage === 'none')).toBe(true);
  f.dispose();
});

test('each new atlas starts with one retained face before the regular batch resumes', async () => {
  const f = fixture();
  f.controller.write(f.leaves[0], 'url(first.webp)');
  f.controller.write(f.leaves[1], 'url(second.webp)');
  f.controller.write(f.leaves[2], 'url(second.webp)');
  const ready = f.controller.activate();
  f.paint();
  expect(f.leaves.map(image)).toEqual(['url(first.webp)', 'none', 'none']);
  f.paint();
  expect(f.leaves.map(image)).toEqual(['url(first.webp)', 'url(second.webp)', 'none']);
  f.paint(); f.paint(); await ready;
  expect(f.leaves.map(image)).toEqual(['url(first.webp)', 'url(second.webp)', 'url(second.webp)']);
  f.dispose();
});

test('pending faces retain membership and defer changed display selection until activation', async () => {
  const f = fixture();
  expect(f.leaves.map(display)).toEqual(['', 'none', 'none']);
  expect(f.controller.deferDisplay(f.leaves[1], 'block')).toBe(true);
  expect(f.controller.deferDisplay(f.leaves[2], 'none')).toBe(true);
  expect(display(f.leaves[1])).toBe('none');
  f.leaves.forEach(leaf => f.controller.write(leaf, 'url(surface.webp)'));
  const ready = f.controller.activate();
  f.paint();
  expect(f.leaves.map(display)).toEqual(['', 'none', 'none']);
  f.paint();
  expect(f.leaves.map(display)).toEqual(['', 'block', 'none']);
  f.paint(); f.paint(); await ready;
  expect(display(f.leaves[2])).toBe('none');
  expect(f.controller.deferDisplay(f.leaves[1], 'none')).toBe(false);
  expect(f.leaves.every(leaf => leaf.isConnected)).toBe(true);
  f.dispose();
});

test('each mesh parent retains a renderable anchor and exact prepared display is restored', async () => {
  const { document, window } = parseHTML('<html><body><div><u></u><u style="display:inline-block"></u></div><div><u></u><u style="display:none"></u></div></body></html>');
  const leaves = [...document.querySelectorAll('u')], callbacks: FrameRequestCallback[] = [];
  window.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length; };
  const activation = prepareTextureActivation([leaves], () => {});
  expect(leaves.map(display)).toEqual(['', 'none', '', 'none']);
  const ready = activation.activate();
  callbacks.shift()!(0); callbacks.shift()!(0); await ready;
  expect(leaves.map(pendingValue)).toEqual([null, null, null, null]);
  expect(leaves[1].style.display).toBe('inline-block');
  expect(leaves[3].style.display).toBe('none');
});
