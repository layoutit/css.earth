import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { after } from 'node:test';
import { worldContextFixture } from './fixtures/world-context-characterization.mts';
const fixture = worldContextFixture();
after(() => fixture.remove());
const summary = fixture.read('summary');
const solar = fixture.read('solar');
const earth = fixture.read('earth');
const mars = fixture.read('mars');
const rowId = 'plain-star';
mock.module(new URL('./startup-world.mts', import.meta.url).href, { namedExports: {
  WORLD_SUMMARY_SOURCE: new URL('https://example.test/world.json'), WORLD_ANYWHERE_SOURCE: '/world/anywhere.json',
  startupWorld: () => ({ summary, files: [{ id: 'solar-system', value: solar }] }),
  anywhereFiles: () => [], pageWorldFiles: () => ({ files: [] }),
} });
mock.module(new URL('./object-entries.mts', import.meta.url).href, { namedExports: {
  readWorldPlace: async (id: string) => id === 'earth' ? { files: ['solar-system', 'earth-system'] }
    : id === rowId ? { files: [], row: fixture.read('row') } : null,
} });
const { APPLICATION_WORLD_CONTEXT, APPLICATION_WORLD_INDEX, worldSystemHeld, worldHolderRead, worldPlacedFiles, loadWorldSystemOf, loadWorldHolder, onWorldSystems } = await import('./world-context-plan.mts');
test('browser startup adopts supplied files and later system loads share requests, publish once and retry errors', async t => {
  assert.equal(APPLICATION_WORLD_INDEX, null);
  assert.ok(APPLICATION_WORLD_CONTEXT.bodies.some(body => body.id === 'earth'));
  assert.equal(worldHolderRead('solar-system'), true);
  assert.deepEqual(worldPlacedFiles(), ['solar-system']);
  assert.equal(worldSystemHeld('sun'), true);
  assert.equal(worldSystemHeld('venus'), true);
  assert.equal(worldSystemHeld('earth'), false);
  assert.equal(worldSystemHeld('unknown'), false);
  assert.equal(loadWorldSystemOf('sun'), null);
  const urls: string[] = [];
  let failMars = true;
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    urls.push(url);
    if (url.includes('mars-system') && failMars) {
      failMars = false;
      return new Response('', { status: 503 });
    }
    return new Response(JSON.stringify(url.includes('mars-system') ? mars : earth));
  });
  const published: string[][] = [];
  const stop = onWorldSystems(plan => published.push(plan.bodies.map(body => body.id)));
  await Promise.all([loadWorldSystemOf('earth'), loadWorldHolder('earth-system')]);
  assert.deepEqual(urls, ['/world/systems/earth-system.json']);
  assert.equal(published.length, 1);
  assert.ok(published[0].includes('moon'));
  assert.equal(worldSystemHeld('earth'), true);
  assert.equal(loadWorldSystemOf('earth'), null);
  await loadWorldHolder('earth-system');
  assert.equal(urls.length, 1);
  stop();
  await assert.rejects(loadWorldHolder('mars-system'), /Prepared world system request \/world\/systems\/mars-system.json failed: 503/);
  await loadWorldHolder('mars-system');
  assert.equal(worldHolderRead('mars-system'), true);
  assert.equal(urls.filter(url => url.includes('mars-system')).length, 2);
  assert.equal(published.length, 1);
  await loadWorldSystemOf('unknown');
  assert.equal(worldSystemHeld('unknown'), true);
  assert.equal(loadWorldSystemOf('unknown'), null);
  assert.equal(worldSystemHeld(rowId), false);
  await loadWorldSystemOf(rowId);
  assert.equal(worldSystemHeld(rowId), true);
  assert.equal(worldHolderRead(rowId), true);
});
