import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import type { BrowserWindow } from '../browser-types.mts';
import { loadCatalogueFragment, loadCatalogueIndex, scheduleWhenIdle } from '../catalogue-fragment-loader.mts';
import type { CatalogueFragmentPin, CatalogueIndexPin } from '../catalogue-fragment-pin.mts';

class FakeUListElement { html: string; constructor(html: string) { this.html = html; } }
class FakeDocument {
  html: string;
  constructor(html: string) { this.html = html; }
  querySelector(selector: string) {
    return selector === 'ul.object-list' && this.html.includes('object-list') ? new FakeUListElement(this.html) : null;
  }
}
class FakeParser { parseFromString(html: string) { return new FakeDocument(html); } }

function fixtureWindow(fetchImpl: typeof fetch, { requestIdleCallback = false }: { requestIdleCallback?: boolean } = {}) {
  const timers: (() => void)[] = [];
  const windowTarget = {
    fetch: fetchImpl,
    DOMParser: FakeParser,
    HTMLUListElement: FakeUListElement,
    TextDecoder,
    crypto: globalThis.crypto,
    setTimeout: (callback: () => void) => { timers.push(callback); return timers.length; },
    ...(requestIdleCallback ? { requestIdleCallback: (callback: () => void) => { timers.push(callback); return timers.length; } } : {}),
  } as unknown as BrowserWindow;
  return { windowTarget, flush: () => { const pending = [...timers]; timers.length = 0; for (const callback of pending) callback(); } };
}

const rowsHtml = '<ul class="object-list"><li class="object-item">Saturn</li></ul>';
const indexJson = JSON.stringify({ schema: 'cssearth-catalogue-index@1', entries: [{
  kind: 'scene', id: 'saturn', name: 'Saturn', searchNames: [], classification: 'planet',
  classificationName: 'planet', systemName: 'solar system', route: '/saturn/', illustration: false, candidate: false,
  distanceMeters: 1, detail: { text: '1 au', title: 'from Earth', ariaLabel: '1 au. from Earth', value: '1', unit: 'au' },
  source: { subject: 'object:saturn', document: '/sources/saturn/', label: 'Sources for Saturn' },
  marker: { kind: 'scene', id: 'saturn', color: '#fff' },
}] });
const bytesOf = (text: string) => new TextEncoder().encode(text).byteLength;
async function shaOf(text: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}

test('loadCatalogueFragment fetches, verifies and returns the parsed list', async () => {
  const pin: CatalogueFragmentPin = { url: '/catalogue/deadbeef.html', sha256: await shaOf(rowsHtml), bytes: bytesOf(rowsHtml) };
  const calls: string[] = [];
  const { windowTarget } = fixtureWindow(async url => { calls.push(String(url)); return new Response(rowsHtml); });
  const rows = await loadCatalogueFragment(pin, { windowTarget });
  assert.ok(rows instanceof FakeUListElement);
  assert.deepEqual(calls, [pin.url]);
});

test('loadCatalogueFragment rejects a failed request', async () => {
  const pin: CatalogueFragmentPin = { url: '/catalogue/x.html', sha256: 'a'.repeat(64), bytes: 1 };
  const { windowTarget } = fixtureWindow(async () => new Response('', { status: 503 }));
  await assert.rejects(loadCatalogueFragment(pin, { windowTarget }), /request failed: 503/u);
});

test('loadCatalogueFragment rejects a network failure', async () => {
  const pin: CatalogueFragmentPin = { url: '/catalogue/x.html', sha256: 'a'.repeat(64), bytes: 1 };
  const { windowTarget } = fixtureWindow(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(loadCatalogueFragment(pin, { windowTarget }), /Failed to fetch/u);
});

test('loadCatalogueFragment rejects a size drift', async () => {
  const pin: CatalogueFragmentPin = { url: '/catalogue/x.html', sha256: await shaOf(rowsHtml), bytes: bytesOf(rowsHtml) + 1 };
  const { windowTarget } = fixtureWindow(async () => new Response(rowsHtml));
  await assert.rejects(loadCatalogueFragment(pin, { windowTarget }), /size drifted/u);
});

test('loadCatalogueFragment rejects a hash mismatch', async () => {
  const pin: CatalogueFragmentPin = { url: '/catalogue/x.html', sha256: 'f'.repeat(64), bytes: bytesOf(rowsHtml) };
  const { windowTarget } = fixtureWindow(async () => new Response(rowsHtml));
  await assert.rejects(loadCatalogueFragment(pin, { windowTarget }), /identity drifted/u);
});

test('loadCatalogueFragment rejects content missing the list', async () => {
  const body = '<p>nothing here</p>';
  const pin: CatalogueFragmentPin = { url: '/catalogue/x.html', sha256: await shaOf(body), bytes: bytesOf(body) };
  const { windowTarget } = fixtureWindow(async () => new Response(body));
  await assert.rejects(loadCatalogueFragment(pin, { windowTarget }), /missing its list/u);
});

test('loadCatalogueIndex fetches, verifies and validates compact catalogue data', async () => {
  const pin: CatalogueIndexPin = { url: '/catalogue/index.json', sha256: await shaOf(indexJson), bytes: bytesOf(indexJson) };
  const { windowTarget } = fixtureWindow(async () => new Response(indexJson));
  const index = await loadCatalogueIndex(pin, { windowTarget });
  assert.equal(index.schema, 'cssearth-catalogue-index@1');
  assert.equal(index.entries[0]?.name, 'Saturn');
  assert.ok(Object.isFrozen(index.entries));
});

test('loadCatalogueIndex rejects transport or schema drift', async () => {
  const pin: CatalogueIndexPin = { url: '/catalogue/index.json', sha256: await shaOf(indexJson), bytes: bytesOf(indexJson) };
  const badHash = fixtureWindow(async () => new Response(indexJson));
  await assert.rejects(loadCatalogueIndex({ ...pin, sha256: 'f'.repeat(64) }, badHash), /identity drifted/u);
  const invalid = JSON.stringify({ schema: 'wrong', entries: [] });
  const badSchema = fixtureWindow(async () => new Response(invalid));
  await assert.rejects(loadCatalogueIndex({ ...pin, sha256: await shaOf(invalid), bytes: bytesOf(invalid) }, badSchema), /Invalid object catalogue index/u);
});

test('scheduleWhenIdle prefers requestIdleCallback and falls back to a timer', () => {
  const ran: string[] = [];
  const idle = fixtureWindow(async () => new Response(''), { requestIdleCallback: true });
  scheduleWhenIdle(idle.windowTarget, () => ran.push('idle'));
  idle.flush();
  assert.deepEqual(ran, ['idle']);
  const timed = fixtureWindow(async () => new Response(''));
  scheduleWhenIdle(timed.windowTarget, () => ran.push('timer'));
  timed.flush();
  assert.deepEqual(ran, ['idle', 'timer']);
});
