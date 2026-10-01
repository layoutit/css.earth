import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createRevealDecodeGate } from './reveal-decode-gate.js';

test('a hidden mesh shows only after its images decode, once per reveal', async () => {
  let decodes = 0, published = 0, finish!: () => void;
  const gate = createRevealDecodeGate({ decode: () => { decodes++; return new Promise<void>(resolve => { finish = resolve; }); }, onDecoded: () => { published++; } });
  assert.equal(gate.ready(), false);
  assert.equal(gate.ready(), false);
  assert.equal(decodes, 1);
  finish(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(published, 1);
  assert.equal(gate.ready(), true);
  // Shown, then hidden again: the next reveal decodes again.
  gate.reset();
  assert.equal(gate.ready(), false);
  assert.equal(decodes, 2);
});

test('a decode left behind by a reset does not reveal, and a failed decode still reveals', async () => {
  let published = 0, finish!: () => void;
  const gate = createRevealDecodeGate({ decode: () => new Promise<void>(resolve => { finish = resolve; }), onDecoded: () => { published++; } });
  gate.ready(); const stale = finish;
  gate.reset(); stale(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(published, 0);
  const errors: unknown[] = [];
  const failing = createRevealDecodeGate({ decode: () => Promise.reject(new Error('gone')), onDecoded: () => { published++; }, onError: error => errors.push(error) });
  failing.ready(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(errors.length, 1);
  assert.equal(failing.ready(), true);
});
