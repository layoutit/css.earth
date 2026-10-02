import assert from 'node:assert/strict';
import { test } from 'node:test';
import { overviewScopeFromUrl, satelliteSystemFromUrl, withOverviewScope, withSatelliteSystemView, WORLD_HOST_ID } from '../navigation/navigation-scope.mts';

const url = (value: string) => new URL(value, 'https://css.earth');
const address = (value: URL) => value.pathname + value.search;

test('every page is an object\'s own: only the system overview and the satellite view are views of a page', () => {
  assert.equal(WORLD_HOST_ID, 'sun');
  assert.equal(overviewScopeFromUrl(url('/sun/?overview=system')), 'system');
  assert.equal(overviewScopeFromUrl(url('/sun/')), null);
  // A level is an object: its page names no overview, and an unknown overview value selects none.
  assert.equal(overviewScopeFromUrl(url('/milky-way/')), null);
  assert.equal(overviewScopeFromUrl(url('/sun/?overview=milky-way')), null);
  assert.equal(satelliteSystemFromUrl(url('/jupiter/?view=satellites')), true);
  assert.equal(satelliteSystemFromUrl(url('/jupiter/?view=satellites&overview=system')), false);
  assert.equal(satelliteSystemFromUrl(url('/jupiter/')), false);
});

test('selecting one view of a page clears the other, and clearing a view leaves the rest of the address', () => {
  assert.equal(address(withOverviewScope(url('/sun/?view=satellites&v=abc'), true)), '/sun/?v=abc&overview=system');
  assert.equal(address(withOverviewScope(url('/sun/?overview=system&dataset=x'), false)), '/sun/?dataset=x');
  assert.equal(address(withSatelliteSystemView(url('/jupiter/?overview=system'), true)), '/jupiter/?view=satellites');
  assert.equal(address(withSatelliteSystemView(url('/jupiter/?view=satellites&v=abc'), false)), '/jupiter/?v=abc');
});
