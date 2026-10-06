import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
let placed: string[] = ['root']; const read = new Set<string>(); const loads: string[] = []; let changed = () => {};
mock.module(new URL('../directory/world-context-plan.mts', import.meta.url).href, { namedExports: {
  APPLICATION_WORLD_CONTEXT: { system: { fadeOutStartDistanceM: 10, hiddenDistanceM: 20 } },
  worldPlacedFiles: () => placed, worldHolderRead: (id: string) => read.has(id),
  loadWorldHolder: async (id: string) => { loads.push(id); if (id === 'failing') throw new Error('load failed'); read.add(id); },
  onWorldSystems(listener: () => void) { changed = listener; },
} });
const { createWorldApproach } = await import('./world-approach.mts');
test('approach reads each places file once, checks the latest eye and reads near unread holders', async t => {
  const urls: string[] = []; const errors: unknown[][] = []; 
  t.mock.method(console, 'error', (...args: unknown[]) => errors.push(args));
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    urls.push(url); const id = url.split('/').at(-1)!.slice(0, -5);
    if (id === 'bad-status') return new Response('', { status: 503 });
    if (id === 'bad-table') return new Response(JSON.stringify({ id: ['x'], positionM: [], orbitsWithinM: [1] }));
    if (id === 'bad-row') return new Response(JSON.stringify({ id: ['x'], positionM: [[1, 2]], orbitsWithinM: [1] }));
    return new Response(JSON.stringify({ id: ['near', 'far', 'failing'], positionM: [[0, 0, 0], [1000, 0, 0], [0, 0, 0]], orbitsWithinM: [null, null, null] }));
  });
  // Await actual fetch/json/catch microtasks, with a finite queue drain and no wall-clock delay.
  const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  const approach = createWorldApproach(); approach.observe([35, 0, 0]); approach.start(); approach.start(); await settle();
  assert.deepEqual(urls, ['/world/places/root.json']);
  assert.ok(loads.includes('near'));
  assert.ok(!loads.includes('far'));
  assert.ok(errors.some(args => String(args[0]).includes('file of failing')));
  const prior = loads.filter(id => id === 'near').length; approach.observe([0, 0, 0]);
  assert.equal(loads.filter(id => id === 'near').length, prior);
  approach.observe([1000, 0, 0]);
  assert.ok(loads.includes('far'));
  placed = ['root', 'bad-status', 'bad-table', 'bad-row']; changed(); changed(); await settle();
  assert.equal(urls.length, 4);
  assert.ok(errors.some(args => String(args[1]).includes('request failed: 503')));
  assert.ok(errors.some(args => String(args[1]).includes('columns of one length')));
  assert.ok(errors.some(args => String(args[1]).includes('row 0 (x)')));
});

test('approach uses exactly twice the fade distance and all three eye coordinates', async t => {
  placed = ['range'];
  read.clear();
  loads.length = 0;
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ id: ['host'], positionM: [[0, 0, 0]], orbitsWithinM: [null] })));
  const approach = createWorldApproach();
  approach.observe([0, 0, 41]);
  approach.start();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.deepEqual(loads, []);
  approach.observe([24, 0, 33]);
  assert.deepEqual(loads, []);
  approach.observe([24, 0, 32]);
  assert.deepEqual(loads, ['host']);
  approach.observe([0, 0, 0]);
  assert.deepEqual(loads, ['host']);
});
test('orbit columns reject both shorter and longer lists before rows are loaded', async t => {
  placed = ['short', 'long'];
  read.clear();
  loads.length = 0;
  const errors: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => errors.push(args));
  t.mock.method(globalThis, 'fetch', async (url: string) => new Response(JSON.stringify({ id: ['host'], positionM: [[0, 0, 0]], orbitsWithinM: url.includes('short') ? [] : [null, null] })));
  const approach = createWorldApproach();
  approach.observe([0, 0, 0]);
  approach.start();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.deepEqual(loads, []);
  assert.equal(errors.length, 2);
  for (const error of errors) assert.match(String(error[1]), /columns of one length/);
});

test('four-coordinate position rows are rejected before loading holders', async t => {
  placed = ['four-coordinates'];
  read.clear();
  loads.length = 0;
  const errors: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => errors.push(args));
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    id: ['host'], positionM: [[0, 0, 0, 4]], orbitsWithinM: [null],
  })));
  const approach = createWorldApproach();
  approach.observe([0, 0, 0]);
  approach.start();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.deepEqual(loads, []);
  assert.equal(errors.length, 1);
  assert.equal(String(errors[0][1]), 'TypeError: /world/places/four-coordinates.json row 0 (host) must be an id, three finite metres and a range or null.');
});
