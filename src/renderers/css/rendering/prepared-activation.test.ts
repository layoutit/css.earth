import { expect, test } from 'vitest';
import { prepareConnectedActivation } from './prepared-activation.js';

function fixture(batchSize = 1) {
  let nextId = 0;
  const callbacks = new Map<number, FrameRequestCallback>(), cleanup: (() => void)[] = [];
  const window = { requestAnimationFrame(fn: FrameRequestCallback) { callbacks.set(++nextId, fn); return nextId; }, cancelAnimationFrame(id: number) { callbacks.delete(id); } };
  const groups = Array.from({length: 5}, () => ({ style: {display: ''}, ownerDocument: {defaultView: window} })) as unknown as HTMLElement[];
  const batches = Array.from({ length: Math.ceil(groups.length / batchSize) }, (_, index) => groups.slice(index * batchSize, (index + 1) * batchSize));
  const activate = prepareConnectedActivation(batches, fn => cleanup.push(fn));
  return { groups, activate, callbacks, dispose() { cleanup.forEach(fn => fn()); },
    paint() { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(fn => fn(0)); } };
}

test('connected prepared groups retain identity and become layout-active across distinct paints', async () => {
  const f = fixture(), identities = [...f.groups];
  expect(f.groups.every(n => n.style.display === 'none')).toBe(true);
  const ready = f.activate();
  expect(f.activate()).toBe(ready);
  for (let i=0; i<f.groups.length; i++) {
    f.paint();
    expect(f.groups.filter(n=>n.style.display !== 'none')).toHaveLength(i+1);
    expect(f.groups).toEqual(identities);
  }
  expect(f.callbacks.size).toBe(1);
  f.paint();
  await ready;
  expect(f.callbacks.size).toBe(0);
});

test('one paint activates only its prepared batch, including the final shorter batch', async () => {
  const f = fixture(2), ready = f.activate();
  for (const count of [2, 4, 5]) {
    f.paint();
    expect(f.groups.filter(node => node.style.display !== 'none')).toHaveLength(count);
  }
  let settled = false;
  ready.then(() => { settled = true; });
  await Promise.resolve();
  expect(settled, 'The continuation cannot share the final batch publication frame').toBe(false);
  f.paint();
  await ready;
  expect(f.callbacks.size).toBe(0);
});

test('retiring a partly activated scene cancels pending work without activating its remaining groups', async () => {
  const f = fixture(), ready = f.activate();
  f.paint(); f.dispose(); f.paint();
  await ready;
  expect(f.groups.filter(n=>n.style.display !== 'none')).toHaveLength(1);
  expect(f.callbacks.size).toBe(0);
});
