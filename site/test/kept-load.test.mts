import assert from 'node:assert/strict';
import test from 'node:test';
import { keptLoad } from '../server/kept-load.mts';

test('a value is loaded once and kept, with later callers waiting on the first load', async () => {
  let loads = 0, finish = (_value: string) => {};
  const read = keptLoad(() => { loads++; return new Promise<string>(resolve => { finish = resolve; }); });
  const first = read(), second = read();
  finish('catalogue');
  assert.deepEqual(await Promise.all([first, second]), ['catalogue', 'catalogue']);
  assert.equal(await read(), 'catalogue');
  assert.equal(loads, 1);
});

test('a load that fails is not kept: the next caller loads again', async () => {
  let loads = 0;
  const read = keptLoad(async () => { if (++loads === 1) throw new Error('unreadable'); return 'catalogue'; });
  await assert.rejects(read(), /unreadable/u);
  assert.equal(await read(), 'catalogue');
  assert.equal(loads, 2);
});

test('a load that never settles is started again by a caller that has waited its patience', async () => {
  // The host stopped the request that started the first load, so nothing will ever settle it.
  let loads = 0;
  const read = keptLoad(() => ++loads === 1 ? new Promise<string>(() => {}) : Promise.resolve('catalogue'), 20);
  void read();
  const waiters = [read(), read()];
  assert.deepEqual(await Promise.all(waiters), ['catalogue', 'catalogue']);
  // The two waiters shared one new load, and the value is kept from then on.
  assert.equal(loads, 2);
  assert.equal(await read(), 'catalogue');
  assert.equal(loads, 2);
});

test('a waiter gets a slow load that settles within its patience, without loading again', async () => {
  let loads = 0;
  const read = keptLoad(() => { loads++; return new Promise<string>(resolve => { setTimeout(resolve, 15, 'catalogue'); }); }, 1000);
  assert.deepEqual(await Promise.all([read(), read()]), ['catalogue', 'catalogue']);
  assert.equal(loads, 1);
});
