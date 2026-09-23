import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { SYSTEM_HEADERS_FRAGMENT_URL, fetchSystemHeaders, spliceSystemHeaders } from '../system-headers-fragment.mts';

const FRAGMENT = '<!DOCTYPE html><div data-system-headers><header data-system-header="sun" data-system-current>Sun</header>'
  + '<header data-system-header="wasp-43">WASP-43</header><header data-system-header="trappist-1">TRAPPIST-1</header></div>';
const card = () => parseHTML('<html><body><div data-system-results><header data-system-header="sun" data-system-current>Sun</header>'
  + '<span data-system-headers-slot hidden></span><div data-system-datasets hidden></div></div></body></html>')
  .document.querySelector<HTMLElement>('[data-system-results]')!;

test('the fragment is fetched from its one path, and a failed response names it', async () => {
  const requested: string[] = [];
  assert.equal(await fetchSystemHeaders(async url => { requested.push(url); return new Response(FRAGMENT); }), FRAGMENT);
  assert.deepEqual(requested, [SYSTEM_HEADERS_FRAGMENT_URL]);
  await assert.rejects(fetchSystemHeaders(async () => new Response('', { status: 503 })), /System headers \/system-headers-fragment\/ failed: HTTP 503/u);
});

test('splicing adds only the headers the card lacks, where the slot was, and keeps its own', () => {
  const root = card(), own = root.querySelector('[data-system-header="sun"]');
  const headers = spliceSystemHeaders(root, parseHTML(FRAGMENT).document);
  assert.deepEqual(headers.map(header => header.dataset.systemHeader), ['sun', 'wasp-43', 'trappist-1']);
  assert.equal(root.querySelector('[data-system-header="sun"]'), own);
  assert.equal(root.querySelector('[data-system-headers-slot]'), null);
  assert.equal(root.querySelector('[data-system-header="trappist-1"]')?.nextElementSibling?.hasAttribute('data-system-datasets'), true);
  assert.throws(() => spliceSystemHeaders(root, parseHTML(FRAGMENT).document), /no header slot/u);
});
