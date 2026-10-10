import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { worldContextFixture } from '../../directory/fixtures/world-context-characterization.mts';

const fixture = worldContextFixture();
after(() => fixture.remove());
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
/** A fixture file with its bodies packaged: a classification, a system name and a discovery make a body a world object. */
function packaged(name: string, classification: string): unknown {
  const file = fixture.read(name);
  assert.ok(isRecord(file) && isRecord(file.bodies) && Array.isArray(file.bodies.id));
  const ids = file.bodies.id;
  return { ...file, systemNames: ['Solar System'], discoveries: [{ featured: false, imagery: true, illustration: false }],
    bodies: { ...file.bodies, classification: ids.map(() => classification), system: ids.map(() => 0), discovery: ids.map(() => 0) } };
}
// A browser page that read the Solar System's file at startup, as world-context-plan.characterization.test.mts does.
mock.module(new URL('../../directory/startup-world.mts', import.meta.url).href, { namedExports: {
  WORLD_SUMMARY_SOURCE: new URL('https://example.test/world.json'), WORLD_ANYWHERE_SOURCE: '/world/anywhere.json',
  startupWorld: () => ({ summary: fixture.read('summary'), files: [{ id: 'solar-system', value: packaged('solar', 'planet') }] }),
  anywhereFiles: () => [], pageWorldFiles: () => ({ files: [] }),
} });
mock.module(new URL('../../directory/object-entries.mts', import.meta.url).href, { namedExports: { readWorldPlace: async () => null } });
const world = await import('./world-objects.mts');
const { loadWorldHolder } = await import('../../directory/world-context-plan.mts');

test('a body whose holder is read after startup joins the world objects, and a list kept from startup never has it', async t => {
  const startup = world.WORLD_OBJECTS;
  assert.equal(world.worldHolds('earth'), true);
  assert.equal(world.worldHolds('moon'), false);
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(packaged('earth', 'moon'))));
  // A flight to the Earth system reads its file: the Moon's row is in it.
  await loadWorldHolder('earth-system');
  assert.equal(world.worldHolds('moon'), true);
  assert.equal(world.worldHolds('phobos'), false);
  assert.ok(world.WORLD_OBJECTS.some(object => object.id === 'moon'));
  assert.equal(startup.some(object => object.id === 'moon'), false);
});
