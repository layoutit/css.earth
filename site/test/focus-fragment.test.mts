import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { FOCUS_FRAGMENT_URL, fetchFocusFragment, focusBanksPending, spliceFocusBanks } from '../focus-fragment.mts';

const FRAGMENT = '<!DOCTYPE html><style>.x{}</style><div data-focus-banks="lenses"><div data-focus-lens-bank="m42" hidden>'
  + '<button data-focus-lens value="optical"></button></div><div data-focus-lens-bank="m1" hidden></div></div>'
  + '<div data-focus-banks="facts"><div data-focus-facts-bank="m42" hidden></div></div>';
const card = () => parseHTML('<html><body><div data-prepared-focus-card><p data-focus-name></p>'
  + '<div data-focus-banks-slot="lenses" hidden></div><div><div data-focus-banks-slot="facts" hidden></div></div></div></body></html>')
  .document.querySelector<HTMLElement>('[data-prepared-focus-card]')!;

test('the fragment is fetched from its one path, and a failed response names it', async () => {
  const requested: string[] = [];
  assert.equal(await fetchFocusFragment(async url => { requested.push(url); return new Response(FRAGMENT); }), FRAGMENT);
  assert.deepEqual(requested, [FOCUS_FRAGMENT_URL]);
  await assert.rejects(fetchFocusFragment(async () => new Response('', { status: 404 })), /Focus fragment \/focus-fragment\/ failed: HTTP 404/u);
});

test('splicing replaces each placeholder with its bank group and keeps the retained card', () => {
  const root = card();
  const name = root.querySelector('[data-focus-name]');
  assert.equal(focusBanksPending(root), true);
  spliceFocusBanks(root, parseHTML(FRAGMENT).document);
  assert.equal(focusBanksPending(root), false);
  assert.equal(root.querySelector('[data-focus-name]'), name);
  assert.deepEqual([...root.querySelectorAll<HTMLElement>('[data-focus-lens-bank]')].map(bank => bank.dataset.focusLensBank), ['m42', 'm1']);
  // The facts group lands where its placeholder was, inside the factsheet wrapper.
  assert.equal(root.querySelector('[data-focus-facts-bank="m42"]')?.parentElement?.parentElement, root);
  assert.equal(root.querySelector('style'), null);
  assert.throws(() => spliceFocusBanks(card(), parseHTML('<div data-focus-banks="lenses"></div>').document), /no "facts" bank group/u);
});
