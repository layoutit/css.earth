import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { drawnPageFromUrl, overviewPage, overviewScopeFromUrl, satelliteSystemFromUrl, withOverviewScope,
  WORLD_HOST_ID } from '../navigation/navigation-scope.mts';
import { withSceneDataset, readSceneDatasetUrl } from '../dataset-url.mts';

const at = (path: string) => new URL(path, 'https://css.earth');
const write = (path: string, scene: string, scope: Parameters<typeof withOverviewScope>[2]) => {
  const url = withOverviewScope(at(path), scene, scope);
  return url.pathname + url.search;
};

test('every page is /<id>/: a level is read from the path, and an object with a scene is its own page', () => {
  assert.equal(WORLD_HOST_ID, 'sun');
  assert.equal(overviewScopeFromUrl(at('/milky-way/'), 'sun'), 'milky-way');
  assert.equal(drawnPageFromUrl(at('/milky-way/'), 'sun'), 'milky-way');
  assert.equal(drawnPageFromUrl(at('/m31/'), 'm31'), null, 'a galaxy is the scene of its own page');
  assert.equal(overviewScopeFromUrl(at('/m31/'), 'm31'), null);
  assert.equal(overviewScopeFromUrl(at('/m31/?overview=system'), 'm31'), 'system');
  // The page wins over its query; only a star's system overview is a query.
  assert.equal(overviewScopeFromUrl(at('/milky-way/?overview=system'), 'sun'), 'milky-way');
  assert.equal(satelliteSystemFromUrl(at('/milky-way/?view=satellites')), false);
  assert.equal(overviewScopeFromUrl(at('/trappist-1/?overview=system'), 'trappist-1'), 'system');
  assert.equal(overviewScopeFromUrl(at('/sun/?overview=milky-way'), 'sun'), null, 'no page is a query');
});

test("an overview's page is the world host's scene; another star's overview stays its system overview", () => {
  assert.equal(write('/sun/?overview=system&view=satellites', 'sun', 'milky-way'), '/milky-way/');
  assert.equal(write('/milky-way/', 'sun', 'local-group'), '/local-group/');
  assert.equal(write('/milky-way/', 'sun', 'system'), '/sun/?overview=system');
  assert.equal(write('/milky-way/', 'sun', null), '/sun/');
  assert.equal(overviewPage('sun', 'milky-way'), 'milky-way');
  assert.equal(overviewPage('trappist-1', 'milky-way'), null);
  assert.equal(write('/trappist-1/?overview=system', 'trappist-1', 'milky-way'), '/trappist-1/?overview=system',
    'the URL reopens the scene it shows');
  // Leaving the overview for nothing keeps a catalogue focus's page.
  assert.equal(write('/m31/', 'sun', null), '/m31/');
});

test("a drawn subject's page carries none of the scene's own selections, so a cold open reads none", () => {
  assert.equal(write('/sun/?dataset=spectral-slope&feature=12&v=saved', 'sun', 'milky-way'), '/milky-way/?v=saved');
  assert.deepEqual(readSceneDatasetUrl(at('/milky-way/?dataset=spectral-slope'), 'sun'), { requested: false, id: null });
  assert.equal(withSceneDataset(at('/milky-way/'), 'sun', 'spectral-slope').search, '', 'the scene never writes its dataset there');
});

test("a drawn page keeps its own dataset while it is the page, and a page reached from elsewhere carries none", async () => {
  const { withPageDataset } = await import('../navigation/navigation-scope.mts');
  const path = (url: URL) => url.pathname + url.search;
  assert.equal(write('/observable-universe/?v=A&dataset=full', 'sun', 'observable-universe'), '/observable-universe/?v=A&dataset=full');
  assert.equal(write('/observable-universe/?v=A&dataset=full', 'sun', 'nearby-universe'), '/nearby-universe/?v=A');
  assert.equal(path(withPageDataset(at('/observable-universe/?v=A&dataset=full'), 'observable-universe', 'cutaway')), '/observable-universe/?v=A&dataset=cutaway');
  assert.equal(path(withPageDataset(at('/sun/?v=A&dataset=colour&feature=3&overview=system&view=satellites'), 'observable-universe', 'full')),
    '/observable-universe/?v=A&dataset=full');
});
