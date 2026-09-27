import { expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { prepareTextureActivation } from './prepared-texture-activation.js';

function fixture() {
  const { document, window } = parseHTML('<html><body></body></html>');
  const root = document.createElement('div');
  root.innerHTML = '<div><u></u><u></u></div><div><u></u></div>';
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
  expect(f.leaves.every(node => node.isConnected && node.style.backgroundImage === 'none')).toBe(true);
  const ready = f.controller.activate(); expect(f.controller.activate()).toBe(ready);
  f.paint();
  expect(f.leaves.map(node => node.style.backgroundImage)).toEqual(['url(surface.webp)', 'url(surface.webp)', 'none']);
  // A selection supersedes the withheld image and immediately updates resident leaves.
  for (const leaf of f.leaves) f.controller.write(leaf, 'url(next.webp)');
  f.paint();
  expect(f.leaves.map(node => node.style.backgroundImage)).toEqual(Array(3).fill('url(next.webp)'));
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
  expect(f.leaves[2].style.backgroundImage).toBe('none');
  expect(f.leaves.every(leaf => leaf.isConnected)).toBe(true);
  expect(f.callbacks.size).toBe(0);
});

test('activating untextured leaves does not invalidate their retained styles', async () => {
  const f = fixture(), changes: MutationRecord[] = [];
  const observer = new f.root.ownerDocument.defaultView!.MutationObserver(records => changes.push(...records));
  observer.observe(f.root, { attributes: true, subtree: true });
  const ready = f.controller.activate();
  f.paint(); f.paint(); f.paint(); await ready; await Promise.resolve();
  expect(changes).toEqual([]);
  observer.disconnect(); f.dispose();
});
