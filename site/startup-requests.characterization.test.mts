import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { startFlightRequest, startStartupRequests, startupFetch, releaseStartupRequests, startupRequestsBootstrap } from './startup-requests.mts';

test('flight requests deduplicate, evict the oldest, and cancelled adoption leaves the response available', async t => {
  const previousWindow = Reflect.get(globalThis, 'window');
  t.after(() => { Reflect.set(globalThis, 'window', previousWindow); releaseStartupRequests(); });
  Reflect.set(globalThis, 'window', { location: new URL('https://example.test/earth/') });
  const fetched: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL) => { fetched.push(String(url)); return new Response(String(url)); });
  const paths = Array.from({ length: 5 }, (_, index) => `/characterization-flight/${index}`);
  for (const path of paths) startFlightRequest(path);
  startFlightRequest(paths[4]!);
  assert.deepEqual(fetched, paths);
  const abort = new AbortController(); abort.abort(new Error('cancelled reader'));
  assert.throws(() => startupFetch(paths[4]!, { signal: abort.signal }), /cancelled reader/);
  assert.equal(await (await startupFetch(paths[4]!)).text(), paths[4]);
  assert.equal(fetched.length, 5);
  await startupFetch(paths[0]!);
  assert.equal(fetched.length, 6, 'the fifth flight evicted the first unread response');
  for (const path of paths.slice(1, 4)) await startupFetch(path);
  assert.equal(fetched.length, 6);
  await startupFetch(paths[4]!);
  assert.equal(fetched.length, 7, 'adoption is one-shot');
});

test('head request wins over flights, custom paths skip transport, and rejected preloads remain observable', async t => {
  const previousWindow = Reflect.get(globalThis, 'window');
  t.after(() => Reflect.set(globalThis, 'window', previousWindow));
  Reflect.set(globalThis, 'window', { location: new URL('https://example.test/earth/system/') });
  const fetched: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL) => { fetched.push(String(url)); throw new Error('offline response'); });
  startStartupRequests(window, ['/characterization-entry'], '/transport', '/earth/');
  startFlightRequest('/characterization-entry');
  assert.deepEqual(fetched, ['/characterization-entry']);
  await assert.rejects(startupFetch('/characterization-entry'), /offline response/);
  releaseStartupRequests();
  assert.equal(window.__cssEarthStartupRequests, undefined);
  Reflect.deleteProperty(globalThis, 'window');
  startFlightRequest('/not-started');
  assert.equal(fetched.length, 1);
  await assert.rejects(startupFetch('/node-read', { method: 'POST' }), /offline response/);
  assert.deepEqual(fetched, ['/characterization-entry', '/node-read']);
  releaseStartupRequests();
});

test('bootstrap executes offline and escapes markup-bearing arguments while retaining bank and root requests', async t => {
  const fetched: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL) => { fetched.push(String(url)); return new Response('ok'); });
  const page = { location: new URL('https://example.test/') };
  const script = startupRequestsBootstrap({ objectId: 'mars', serverMarkup: true, systemView: false, summaryUrl: '/summary<.json', worldFiles: ['solar-system'], bankFiles: '/bank.json' });
  assert.equal(script.includes('/summary<.json'), false);
  new Function('window', script)(page);
  assert.deepEqual(fetched, ['/objects/mars/first-view.json', '/summary<.json', '/world/anywhere.json', '/world/systems/solar-system.json', '/objects/mars/entry.json', '/bank.json']);
  for (const key of ['dataset', 'feature', 'v', 'settings', 'q']) {
    fetched.length = 0;
    startStartupRequests({ location: new URL(`https://example.test/mars/?${key}=`) } as unknown as Window, [], '/transport', '/mars/');
    assert.deepEqual(fetched, [], key);
  }
});

test('an unread failed flight has no unhandled rejection and remains rejectable by its reader', async () => {
  // Isolate the process-level event so Node's test runner does not consume it first.
  const script = `
    const { startFlightRequest, startupFetch } = await import(${JSON.stringify(new URL('./startup-requests.mts', import.meta.url).href)});
    globalThis.window = { location: new URL('https://example.test/') };
    globalThis.fetch = async () => { throw new Error('failed flight'); };
    const unhandled = [];
    process.on('unhandledRejection', error => unhandled.push(String(error)));
    startFlightRequest('/unread-flight');
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    let readerError;
    try { await startupFetch('/unread-flight'); } catch (error) { readerError = error.message; }
    console.log(JSON.stringify({ unhandled, readerError }));
  `;
  const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', script]);
  assert.deepEqual(JSON.parse(stdout.trim()), { unhandled: [], readerError: 'failed flight' });
});
