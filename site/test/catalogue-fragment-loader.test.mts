import assert from 'node:assert/strict';
import test from 'node:test';
import type { BrowserWindow } from '../browser-types.mts';
import { loadCatalogueFragment, scheduleWhenIdle } from '../catalogue-fragment-loader.mts';
import type { CatalogueFragmentPin } from '../catalogue-fragment-pin.mts';

class FakeUListElement { html: string; constructor(html: string) { this.html = html; } }
class FakeDocument {
  html: string;
  constructor(html: string) { this.html = html; }
  querySelector(selector: string) {
    return selector === 'ul.planet-object-list' && this.html.includes('planet-object-list') ? new FakeUListElement(this.html) : null;
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

const rowsHtml = '<ul class="planet-object-list"><li class="planet-object-item">Saturn</li></ul>';
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
