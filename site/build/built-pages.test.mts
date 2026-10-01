import assert from 'node:assert/strict';
import test from 'node:test';
import { builtObjectPages, builtScenePaths, namedPages } from './built-pages.mts';

const objects = [
  { id: 'earth', kind: 'scene' }, { id: 'moon', kind: 'scene' }, { id: 'mars', kind: 'scene' },
  { id: 'sun', kind: 'scene' }, { id: 'm31', kind: 'focus', sceneHostId: 'sun' },
];
const pages = objects.map(({ id }) => ({ params: { id } }));
const scenes = pages.filter(({ params }) => params.id !== 'm31');
const env = (list?: string) => (list === undefined ? {} : { CSSEARTH_BUILD_PAGES: list });
const ids = (paths: readonly { params: { id: string } }[]) => paths.map(path => path.params.id);

test('an unset or empty list builds every route', () => {
  assert.equal(namedPages(env()), null);
  assert.equal(namedPages(env('  ')), null);
  assert.equal(builtObjectPages(pages, objects, env()), pages);
  assert.equal(builtScenePaths(scenes, objects, 'earth', env()), scenes);
});

test('a list builds the object pages it names; "/" is the home page, not an object page', () => {
  assert.deepEqual(ids(builtObjectPages(pages, objects, env('/, /mars/'))), ['mars']);
  assert.deepEqual(ids(builtObjectPages(pages, objects, env('/'))), []);
  assert.deepEqual([...namedPages(env('/,/moon/,/moon/')) ?? []], ['/', '/moon/']);
});

test('scene routes build for the scenes the named pages mount: "/" mounts the root, a focus its host', () => {
  assert.deepEqual(ids(builtScenePaths(scenes, objects, 'earth', env('/'))), ['earth']);
  assert.deepEqual(ids(builtScenePaths(scenes, objects, 'earth', env('/,/earth/'))), ['earth']);
  assert.deepEqual(ids(builtScenePaths(scenes, objects, 'earth', env('/m31/,/moon/'))), ['moon', 'sun']);
});

test('a page no object has stops the build and names it', () => {
  assert.throws(() => builtObjectPages(pages, objects, env('/earth/,/pluto/,/vulcan/')), /no object has: \/pluto\/, \/vulcan\/\./u);
  assert.throws(() => builtScenePaths(scenes, objects, 'earth', env('/vulcan/')), /no object has: \/vulcan\/\./u);
});

test('an entry that is not a page path is refused', () => {
  for (const entry of ['earth', '/earth', '/earth/index.html', '/objects/earth/', ',']) {
    assert.throws(() => namedPages(env(entry)), /CSSEARTH_BUILD_PAGES/u, entry);
  }
});
