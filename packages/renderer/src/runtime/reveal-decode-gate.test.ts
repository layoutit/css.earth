import { expect, test } from 'vitest';
import { createRevealDecodeGate } from './reveal-decode-gate.js';

test('a hidden mesh shows only after its images decode, once per reveal', async () => {
  let decodes = 0, published = 0, finish!: () => void;
  const gate = createRevealDecodeGate({ decode: () => { decodes++; return new Promise<void>(resolve => { finish = resolve; }); }, onDecoded: () => { published++; } });
  expect(gate.ready()).toBe(false);
  expect(gate.ready()).toBe(false);
  expect(decodes).toBe(1);
  finish(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(published).toBe(1);
  expect(gate.ready()).toBe(true);
  // Shown, then hidden again: the next reveal decodes again.
  gate.reset();
  expect(gate.ready()).toBe(false);
  expect(decodes).toBe(2);
});

test('a decode left behind by a reset does not reveal, and a failed decode still reveals', async () => {
  let published = 0, finish!: () => void;
  const gate = createRevealDecodeGate({ decode: () => new Promise<void>(resolve => { finish = resolve; }), onDecoded: () => { published++; } });
  gate.ready(); const stale = finish;
  gate.reset(); stale(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(published).toBe(0);
  const errors: unknown[] = [];
  const failing = createRevealDecodeGate({ decode: () => Promise.reject(new Error('gone')), onDecoded: () => { published++; }, onError: error => errors.push(error) });
  failing.ready(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(errors).toHaveLength(1);
  expect(failing.ready()).toBe(true);
});
