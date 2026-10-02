import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAGE_VIEWS, namesSystem, withView, WORLD_HOST_ID } from '../navigation/navigation-scope.mts';
import { systemHostId, systemObjectId, systemRoute } from '../navigation/system-address.mts';
import { objectIdAtPath, pageIdAtPath } from '../root-object.mts';

const url = (value: string) => new URL(value, 'https://css.earth');
const address = (value: URL) => value.pathname + value.search;

test('a system is an object with an address of its own, named after its host', () => {
  assert.equal(WORLD_HOST_ID, 'sun');
  assert.deepEqual(Object.keys(PAGE_VIEWS), ['body', 'moons', 'system']);
  assert.equal(systemObjectId('jupiter'), 'jupiter-system');
  assert.equal(systemObjectId('sun'), 'solar-system');
  assert.equal(systemRoute('trappist-1'), '/trappist-1-system/');
  assert.equal(systemHostId('jupiter-system'), 'jupiter');
  assert.equal(systemHostId('solar-system'), 'sun');
  assert.equal(systemHostId('jupiter'), null);
  assert.equal(systemHostId('-system'), null);
  assert.equal(namesSystem(url('/jupiter-system/')), true);
  assert.equal(namesSystem(url('/solar-system/?v=abc')), true);
  assert.equal(namesSystem(url('/jupiter/')), false);
  // A level is an object of its own, never a system; and no query names a view any more.
  assert.equal(namesSystem(url('/milky-way/')), false);
  assert.equal(namesSystem(url('/jupiter/?view=satellites')), false);
  assert.equal(namesSystem(url('/sun/?overview=system')), false);
  // A system's page shows its host's scene: the path names the system, the scene is the host's.
  assert.equal(pageIdAtPath('/jupiter-system/'), 'jupiter-system');
  assert.equal(objectIdAtPath('/jupiter-system/'), 'jupiter');
  assert.equal(objectIdAtPath('/solar-system/'), 'sun');
  assert.equal(objectIdAtPath('/jupiter/'), 'jupiter');
});

test('selecting a view moves the address between the object and its system and keeps the rest', () => {
  assert.equal(address(withView(url('/sun/?v=abc'), 'system')), '/solar-system/?v=abc');
  assert.equal(address(withView(url('/solar-system/?dataset=x'), 'body')), '/sun/?dataset=x');
  assert.equal(address(withView(url('/jupiter/'), 'moons')), '/jupiter-system/');
  assert.equal(address(withView(url('/jupiter-system/?v=abc'), 'body')), '/jupiter/?v=abc');
  assert.equal(address(withView(url('/jupiter-system/'), 'moons')), '/jupiter-system/');
});

test('a build of named pages builds the scene routes a system page mounts', async () => {
  const { builtScenePaths } = await import('../built-pages.mts');
  const { PAGES } = await import('../objects.mts');
  const paths = ['jupiter', 'earth', 'mars'].map(id => ({ params: { id } }));
  assert.deepEqual(builtScenePaths(paths, PAGES, 'earth', { CSSEARTH_BUILD_PAGES: '/jupiter-system/' }).map(path => path.params.id), ['jupiter']);
});

test('the front page keeps its own address for its body', () => {
  assert.equal(address(withView(url('/'), 'body')), '/');
  assert.equal(address(withView(url('/'), 'moons')), '/earth-system/');
});
