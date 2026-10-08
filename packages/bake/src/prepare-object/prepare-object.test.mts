import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord } from '@cssearth/core';
import { projectRoot } from '@cssearth/core/node';
const scripts = requireRecord(requireRecord(JSON.parse(await readFile(resolve(projectRoot(import.meta.url), 'package.json'), 'utf8'))).scripts);
import { PREPARATION_STEPS } from '@cssearth/bake/prepare-object';

test('deploy generation and object authoring place the object with the same world-context command', async () => {
  assert.ok(scripts['prepare:world-context']);
  const world = PREPARATION_STEPS.find(step => step.name === 'world');
  assert.ok(world);
  assert.deepEqual(await world.commands(['sun']), [['pnpm', 'prepare:world-context']]);
});

test('reuse-images preparation reaches the authored preparation only when asked', async () => {
  const prepare = PREPARATION_STEPS.find(step => step.name === 'prepare');
  assert.ok(prepare);
  assert.deepEqual(await prepare.commands(['earth']), [['node', 'site/build/prepare/authored/prepare-authored.ts', 'earth', '--write']]);
  assert.deepEqual(await prepare.commands(['earth'], { reuseImages: true }),
    [['node', 'site/build/prepare/authored/prepare-authored.ts', 'earth', '--write', '--reuse-images']]);
  assert.deepEqual(await prepare.commands(['earth'], { addDatasets: true }),
    [['node', 'site/build/prepare/authored/prepare-authored.ts', 'earth', '--write', '--reuse-images', '--add-datasets']]);
});

test('several objects run each tool once: the id-list tools take every id, the authored preparation runs per object, the Sun and the world files are re-pinned last', async () => {
  const ids = ['hd-219134', 'hd-219134b'];
  const scopes = Object.fromEntries(PREPARATION_STEPS.map(step => [step.name, step.scope]));
  assert.deepEqual(scopes, { builds: 'once', inputs: 'ids', catalogue: 'once', geometry: 'once', prepare: 'each', discovery: 'once', sources: 'each', page: 'ids', audit: 'each', text: 'ids', markers: 'ids', billboard: 'ids', world: 'once', systems: 'once', catalogues: 'once', pins: 'once' });
  assert.equal(PREPARATION_STEPS.find(step => step.name === 'prepare')?.parallel, true);
  for (const name of ['inputs', 'page', 'text', 'markers']) {
    const commands = await PREPARATION_STEPS.find(step => step.name === name)!.commands(ids);
    assert.equal(commands.length, 1, name); assert.deepEqual(commands[0]!.slice(-2), ids, name);
  }
  assert.deepEqual(await PREPARATION_STEPS.at(-1)!.commands(ids), [['node', 'site/build/prepare/authored/prepare-object-json.mts', 'sun'], ['node', 'site/build/prepare/world/pin-world-files.mts'], ['node', 'site/build/prepare/catalog/prepare-catalog.mts']]);
});

test('a site that does not know a new object stops the billboard step before any page is photographed', async () => {
  const { createServer } = await import('node:http'), billboard = PREPARATION_STEPS.find(step => step.name === 'billboard')!;
  const server = createServer((request, response) => { response.statusCode = request.url === '/' ? 200 : 404; response.end(); });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(), previous = process.env.CSSEARTH_BILLBOARD_ORIGIN;
  process.env.CSSEARTH_BILLBOARD_ORIGIN = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  try { await assert.rejects(billboard.commands(['new-star']), /does not know new-star \(404 for \/new-star\/\).*Restart it/u); }
  finally { server.close(); if (previous === undefined) delete process.env.CSSEARTH_BILLBOARD_ORIGIN; else process.env.CSSEARTH_BILLBOARD_ORIGIN = previous; }
});

test('every baked body gets its arrival billboard before the world files read the catalogue, from a site that must answer', async () => {
  const order = PREPARATION_STEPS.map(step => step.name), billboard = PREPARATION_STEPS.find(step => step.name === 'billboard')!;
  assert.ok(order.indexOf('billboard') > order.indexOf('page') && order.indexOf('billboard') < order.indexOf('world'));
  assert.ok(order.indexOf('systems') > order.indexOf('world') && order.indexOf('systems') < order.indexOf('pins'), 'a system is read from the world, and the catalogue registers it');
  const previous = process.env.CSSEARTH_BILLBOARD_ORIGIN;
  process.env.CSSEARTH_BILLBOARD_ORIGIN = 'http://127.0.0.1:9';
  try { await assert.rejects(billboard.commands(['hd-219134']), /No site answers at http:\/\/127\.0\.0\.1:9: start it with pnpm dev/u); }
  finally { if (previous === undefined) delete process.env.CSSEARTH_BILLBOARD_ORIGIN; else process.env.CSSEARTH_BILLBOARD_ORIGIN = previous; }
});

test('the reader text budgets and the Sun the later steps build on are checked before the bake, not after it', () => {
  const order = PREPARATION_STEPS.map(step => step.name);
  assert.ok(order.indexOf('inputs') < order.indexOf('prepare') && order.indexOf('inputs') > order.indexOf('builds'));
});
