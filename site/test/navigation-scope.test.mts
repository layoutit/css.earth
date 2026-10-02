import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAGE_VIEWS, viewFromUrl, withView, WORLD_HOST_ID } from '../navigation/navigation-scope.mts';

const url = (value: string) => new URL(value, 'https://css.earth');
const address = (value: URL) => value.pathname + value.search;

test('a page shows its object in one of three views, each named by one row of the table', () => {
  assert.equal(WORLD_HOST_ID, 'sun');
  assert.deepEqual(Object.keys(PAGE_VIEWS), ['body', 'moons', 'system']);
  assert.equal(viewFromUrl(url('/sun/?overview=system')), 'system');
  assert.equal(viewFromUrl(url('/sun/')), 'body');
  // A level is an object: its page names no view of another, and an unknown overview value selects none.
  assert.equal(viewFromUrl(url('/milky-way/')), 'body');
  assert.equal(viewFromUrl(url('/sun/?overview=milky-way')), 'body');
  assert.equal(viewFromUrl(url('/jupiter/?view=satellites')), 'moons');
  assert.equal(viewFromUrl(url('/jupiter/?view=satellites&overview=system')), 'system');
  assert.equal(viewFromUrl(url('/jupiter/?view=satellites&overview=other')), 'body');
});

test('selecting a view clears the others and leaves the rest of the address', () => {
  assert.equal(address(withView(url('/sun/?view=satellites&v=abc'), 'system')), '/sun/?v=abc&overview=system');
  assert.equal(address(withView(url('/sun/?overview=system&dataset=x'), 'body')), '/sun/?dataset=x');
  assert.equal(address(withView(url('/jupiter/?overview=system'), 'moons')), '/jupiter/?view=satellites');
  assert.equal(address(withView(url('/jupiter/?view=satellites&v=abc'), 'body')), '/jupiter/?v=abc');
});
