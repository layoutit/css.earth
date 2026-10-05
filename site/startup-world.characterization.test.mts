import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { parseHTML } from 'linkedom';

let row: unknown = { row: { id: 'star', color: '#fff' } };
mock.module(new URL('./directory/object-entries.mts', import.meta.url).href, { namedExports: { readWorldPlace: async () => row } });
const { anywhereFiles, pageWorldFiles, startupWorld, loadStartupWorld } = await import('./startup-world.mts');

test('world startup rejects malformed files and preserves opaque file values and duplicate ids', () => {
  for (const value of [null, false, [], {}, { files: [null] }, { files: [{ id: 5, value: {} }] }, { files: [{ id: 'x' }] }]) {
    assert.throws(() => anywhereFiles(value), /must hold files, each an id and a value/);
  }
  const files = [{ id: 'x', value: null }, { id: 'x', value: 5 }];
  assert.equal(anywhereFiles({ files }), files);
  assert.deepEqual(pageWorldFiles(undefined), { files: [] });
  const { document } = parseHTML('<meta name="cssearth-world-files" content=" solar-system  earth-system " data-row="star">');
  assert.deepEqual(pageWorldFiles(document), { files: ['solar-system', 'earth-system'], row: 'star' });
  document.querySelector('meta')!.setAttribute('data-row', '');
  assert.deepEqual(pageWorldFiles(document), { files: ['solar-system', 'earth-system'] });
});

test('startupWorld validates the page global but does not validate its opaque summary or file values', t => {
  const previous = Reflect.get(globalThis, 'window');
  t.after(() => Reflect.set(globalThis, 'window', previous));
  Reflect.deleteProperty(globalThis, 'window');
  assert.equal(startupWorld(), undefined);
  for (const value of [null, 1, {}, { summary: {}, files: 5 }, { summary: {}, files: [null] }, { summary: {}, files: [{ id: false, value: 2 }] }, { summary: {}, files: [{ id: 'x' }] }]) {
    Reflect.set(globalThis, 'window', { __cssEarthWorld: value });
    assert.equal(startupWorld(), undefined);
  }
  const value = { summary: null, files: [{ id: 'x', value: false }] };
  Reflect.set(globalThis, 'window', { __cssEarthWorld: value });
  assert.deepEqual(startupWorld(), value);
});

test('startup world publishes anywhere files first, page files next and the plain-dot star row last', async t => {
  const { document, window: page } = parseHTML('<meta name="cssearth-world-files" content="earth-system" data-row="star">');
  t.after(() => Reflect.deleteProperty(page, '__cssEarthWorld'));
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL) => {
    const path = String(url); requests.push(path);
    return Response.json(path === '/world/anywhere.json' ? { files: [{ id: 'root', value: 'anywhere' }] } : path === '/world/systems/earth-system.json' ? 'own' : 'summary');
  });
  row = { row: { id: 'star', color: '#fff' } };
  await loadStartupWorld(page as unknown as Window);
  assert.equal(requests.length, 3);
  assert.ok(requests.includes('/world/systems/earth-system.json'));
  assert.deepEqual(Reflect.get(page, '__cssEarthWorld'), { summary: 'summary', files: [{ id: 'root', value: 'anywhere' }, { id: 'earth-system', value: 'own' }, { id: 'star', value: { id: 'star', color: '#fff' } }] });
  document.querySelector('meta')!.remove();
  await loadStartupWorld(page as unknown as Window);
  assert.deepEqual(Reflect.get(page, '__cssEarthWorld'), { summary: 'summary', files: [{ id: 'root', value: 'anywhere' }] });
});

test('failed requests or absent star rows reject without publishing a partial world', async t => {
  const { window: page } = parseHTML('<meta name="cssearth-world-files" data-row="star">');
  const marker = { summary: 'previous', files: [] };
  Reflect.set(page, '__cssEarthWorld', marker);
  t.after(() => Reflect.deleteProperty(page, '__cssEarthWorld'));
  t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL) => String(url) === '/world/anywhere.json' ? Response.json({ files: [] }) : new Response('', { status: 503 }));
  row = {};
  await assert.rejects(loadStartupWorld(page as unknown as Window), /request .* failed: 503/);
  assert.equal(Reflect.get(page, '__cssEarthWorld'), marker);
  t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL) => Response.json(String(url) === '/world/anywhere.json' ? { files: [] } : {}));
  await assert.rejects(loadStartupWorld(page as unknown as Window), /carries no world row for a plain-dot star/);
  assert.equal(Reflect.get(page, '__cssEarthWorld'), marker);
});

test('a failed own-world file carries its exact diagnostic label', async t => {
  const { window: page } = parseHTML('<meta name="cssearth-world-files" content="earth-system">');
  t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL) => String(url) === '/world/systems/earth-system.json' ? new Response(null, { status: 503 }) : Response.json(String(url) === '/world/anywhere.json' ? { files: [] } : {}));
  await assert.rejects(loadStartupWorld(page as unknown as Window), { name: 'Error', message: 'Prepared world file request /world/systems/earth-system.json failed: 503.' });
});
