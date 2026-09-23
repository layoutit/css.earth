import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import type { BrowserWindow } from '../browser-types.mts';
import { loadCatalogueFragment, loadCatalogueIndex, readCatalogueFragmentUrl, readCatalogueIndexUrl, scheduleWhenIdle } from '../catalogue-fragment-loader.mts';

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
test('loadCatalogueFragment fetches its path and returns the parsed list', async () => {
  const calls: string[] = [];
  const { windowTarget } = fixtureWindow(async url => { calls.push(String(url)); return new Response(rowsHtml); });
  const rows = await loadCatalogueFragment('/catalogue-fragment/', { windowTarget });
  assert.ok(rows instanceof FakeUListElement);
  assert.deepEqual(calls, ['/catalogue-fragment/']);
});

test('loadCatalogueFragment names the path of a failed request', async () => {
  const { windowTarget } = fixtureWindow(async () => new Response('', { status: 503 }));
  await assert.rejects(loadCatalogueFragment('/catalogue-fragment/', { windowTarget }), /request \/catalogue-fragment\/ failed: 503/u);
});

test('loadCatalogueFragment rejects a network failure', async () => {
  const { windowTarget } = fixtureWindow(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(loadCatalogueFragment('/catalogue-fragment/', { windowTarget }), /Failed to fetch/u);
});

test('loadCatalogueFragment rejects content missing the list', async () => {
  const { windowTarget } = fixtureWindow(async () => new Response('<p>nothing here</p>'));
  await assert.rejects(loadCatalogueFragment('/catalogue-fragment/', { windowTarget }), /missing its list/u);
});

test('loadCatalogueIndex fetches and validates compact catalogue data', async () => {
  const { windowTarget } = fixtureWindow(async () => new Response(indexJson));
  const index = await loadCatalogueIndex('/catalogue/index.json', { windowTarget });
  assert.equal(index.schema, 'cssearth-catalogue-index@1');
  assert.equal(index.entries[0]?.name, 'Saturn');
  assert.ok(Object.isFrozen(index.entries));
});

test('loadCatalogueIndex rejects a failed request or schema drift', async () => {
  const failed = fixtureWindow(async () => new Response('', { status: 404 }));
  await assert.rejects(loadCatalogueIndex('/catalogue/index.json', failed), /index request \/catalogue\/index\.json failed: 404/u);
  const badSchema = fixtureWindow(async () => new Response(JSON.stringify({ schema: 'wrong', entries: [] })));
  await assert.rejects(loadCatalogueIndex('/catalogue/index.json', badSchema), /Invalid object catalogue index/u);
});

test('a page names its transports by path; a page that inlines its rows names none', () => {
  assert.equal(readCatalogueFragmentUrl({ dataset: { catalogueSrc: '/catalogue-fragment/' } }), '/catalogue-fragment/');
  assert.equal(readCatalogueIndexUrl({ dataset: { catalogueIndexSrc: '/catalogue/index.json' } }), '/catalogue/index.json');
  assert.equal(readCatalogueFragmentUrl({ dataset: {} }), null);
  assert.equal(readCatalogueIndexUrl(null), null);
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
