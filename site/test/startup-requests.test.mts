import assert from 'node:assert/strict';
import test from 'node:test';
import { startStartupRequests, startupFetch, startupRequestsBootstrap, releaseStartupRequests } from '../startup-requests.mts';

function withPage(href: string, run: (fetched: string[]) => Promise<void>) {
  const fetched: string[] = [];
  const previousFetch = globalThis.fetch, previousWindow = Reflect.get(globalThis, 'window');
  globalThis.fetch = (async (input: RequestInfo | URL) => { fetched.push(String(input)); return new Response(String(input)); }) as typeof fetch;
  Reflect.set(globalThis, 'window', { location: new URL(href) });
  return run(fetched).finally(() => { globalThis.fetch = previousFetch; Reflect.set(globalThis, 'window', previousWindow); });
}

test('the head requests each first-view document once, and its reader adopts it once', () => withPage('https://example.test/earth/', async fetched => {
  startStartupRequests(window, ['/objects/earth/entry.json'], '/objects/earth/object.json', '/earth/');
  assert.deepEqual(fetched, ['/objects/earth/object.json', '/objects/earth/entry.json']);
  assert.equal(await (await startupFetch('/objects/earth/object.json')).text(), '/objects/earth/object.json');
  assert.equal(fetched.length, 2, 'the reader adopted the head request');
  await startupFetch('/objects/earth/object.json');
  assert.equal(fetched.length, 3, 'a second read fetches again');
  releaseStartupRequests();
  await startupFetch('/objects/earth/entry.json');
  assert.equal(fetched.length, 4, 'released requests are not adopted');
}));

test('a custom view leaves the object transport to its reader', () => withPage('https://example.test/earth/?dataset=clouds', async fetched => {
  startStartupRequests(window, ['/objects/earth/entry.json'], '/objects/earth/object.json', '/earth/');
  assert.deepEqual(fetched, ['/objects/earth/entry.json']);
  releaseStartupRequests();
}));

test('a cancelled reader does not adopt the head request', () => withPage('https://example.test/', async fetched => {
  startStartupRequests(window, [], '/objects/earth/first-view.json', '/earth/');
  const controller = new AbortController(); controller.abort();
  assert.throws(() => startupFetch('/objects/earth/first-view.json', { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(fetched.length, 1);
  releaseStartupRequests();
}));

test('the bootstrap names the transport the page reads', () => {
  assert.match(startupRequestsBootstrap({ objectId: 'earth', serverMarkup: false, systemView: true }),
    /\["\/objects\/earth\/entry\.json","\/world\/system-views\/earth\.json"\], "\/objects\/earth\/object\.json", "\/earth\/"\);$/u);
  assert.match(startupRequestsBootstrap({ objectId: 'ceres', serverMarkup: true, systemView: false }),
    /\["\/objects\/ceres\/entry\.json"\], "\/objects\/ceres\/first-view\.json"/u);
});
