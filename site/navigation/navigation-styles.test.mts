import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { createNavigationStyles } from './navigation-styles.mts';

const shared = '<style data-object-style="site/object-shell.css">.object-stage { position: relative }</style>';
const body = (id: string) => `<style data-object-style="src/objects/${id}/style.css">[data-object-id="${id}"] { color: red }</style>`;
const page = (styles: string) => parseHTML(`<html><head>${styles}</head><body></body></html>`);

test('visited object styles stay installed and round trips reuse their nodes', async () => {
  const { document, window } = page(shared + body('earth'));
  const shell = document.head.firstElementChild, earth = document.head.lastElementChild;
  const styles = createNavigationStyles(document, window);
  const apply = async (id: string) => {
    const incoming = await styles.prepare(page(body(id)).document, new URL(`https://site.test/${id}/`), new AbortController().signal);
    assert.ok(document.head.querySelector(`[data-object-style="src/objects/${id}/style.css"]`), 'first installation happens before handoff');
    const prepared = [...document.head.children];
    incoming.apply();
    assert.deepEqual([...document.head.children], prepared, 'handoff does not touch prepared styles');
  };
  await apply('lutetia');
  const lutetia = document.head.lastElementChild;
  assert.equal(earth?.parentNode, document.head);
  assert.equal(shell, document.head.firstElementChild);
  assert.equal(document.head.children.length, 3);
  await apply('earth');
  await apply('lutetia');
  assert.deepEqual([...document.head.children], [shell, earth, lutetia]);
});

test('cancelled navigation retains prepared styles for reuse without activating route styles', async () => {
  const { document, window } = page(shared + body('earth'));
  const before = [...document.head.children];
  const styles = createNavigationStyles(document, window), controller = new AbortController();
  const destination = shared + body('lutetia') + '<style>body { color: green }</style>';
  const incoming = await styles.prepare(page(destination).document, new URL('https://site.test/lutetia/'), controller.signal);
  const lutetia = document.head.lastElementChild;
  assert.deepEqual([...document.head.children], [...before, lutetia]);
  controller.abort();
  assert.throws(() => incoming.apply(), /no longer own/);
  incoming.dispose();
  assert.deepEqual([...document.head.children], [...before, lutetia]);
  const again = await styles.prepare(page(shared + body('lutetia')).document, new URL('https://site.test/lutetia/'), new AbortController().signal);
  again.apply();
  assert.deepEqual([...document.head.children], [...before, lutetia]);
});

test('unscoped route styles still leave with their route', async () => {
  const { document, window } = page(shared + body('earth') + '<style>body { color: green }</style>');
  const route = document.head.lastElementChild;
  const styles = createNavigationStyles(document, window);
  const incoming = await styles.prepare(page(shared + body('lutetia')).document, new URL('https://site.test/lutetia/'), new AbortController().signal);
  incoming.apply();
  assert.equal(route?.parentNode, null);
  assert.equal(document.head.children.length, 3);
});

test("a destination's no-script styles stay out of the scripted page", async () => {
  const { document, window } = page(shared + body('earth'));
  const styles = createNavigationStyles(document, window);
  // The fetched page is parsed without script: its `<noscript>` holds elements, where the live page's holds text.
  const destination = shared + body('lutetia') + '<noscript><style>body:has(input:checked) { color: green }</style></noscript>';
  const incoming = await styles.prepare(page(destination).document, new URL('https://site.test/lutetia/'), new AbortController().signal);
  incoming.apply();
  assert.deepEqual([...document.head.querySelectorAll('style')].map(style => style.textContent?.includes(':has(')), [false, false, false]);
});
