import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import packageJson from '../../package.json' with { type: 'json' };
import { PREPARATION_STEPS } from '@cssearth/bake/prepare-object';

test('deploy generation and object authoring place the object with the same world-context command', async () => {
  assert.ok(packageJson.scripts['prepare:world-context']);
  const world = PREPARATION_STEPS.find(step => step.name === 'world');
  assert.ok(world);
  assert.deepEqual(await world.commands(['sun']), [['pnpm', 'prepare:world-context']]);
});

test('reuse-images preparation reaches the authored preparation only when asked', async () => {
  const prepare = PREPARATION_STEPS.find(step => step.name === 'prepare');
  assert.ok(prepare);
  assert.deepEqual(await prepare.commands(['earth']), [['node', 'site/build/prepare/prepare-authored.ts', 'earth', '--write']]);
  assert.deepEqual(await prepare.commands(['earth'], { reuseImages: true }),
    [['node', 'site/build/prepare/prepare-authored.ts', 'earth', '--write', '--reuse-images']]);
});

test('several objects run each tool once: the id-list tools take every id, the authored preparation runs per object, the Sun is re-pinned last', async () => {
  const ids = ['hd-219134', 'hd-219134b'];
  const scopes = Object.fromEntries(PREPARATION_STEPS.map(step => [step.name, step.scope]));
  assert.deepEqual(scopes, { builds: 'once', inputs: 'ids', catalogue: 'once', geometry: 'once', prepare: 'each', discovery: 'once', sources: 'each', page: 'ids', text: 'ids', markers: 'ids', billboard: 'ids', world: 'once', catalogues: 'once', pins: 'once' });
  assert.equal(PREPARATION_STEPS.find(step => step.name === 'prepare')?.parallel, true);
  for (const name of ['inputs', 'page', 'text', 'markers']) {
    const commands = await PREPARATION_STEPS.find(step => step.name === name)!.commands(ids);
    assert.equal(commands.length, 1, name); assert.deepEqual(commands[0]!.slice(-2), ids, name);
  }
  assert.deepEqual(await PREPARATION_STEPS.at(-1)!.commands(ids), [['node', 'site/build/prepare/prepare-object-json.mts', 'sun']]);
});

test('every baked body gets its arrival billboard before the world files read the catalogue, from a site that must answer', async () => {
  const order = PREPARATION_STEPS.map(step => step.name), billboard = PREPARATION_STEPS.find(step => step.name === 'billboard')!;
  assert.ok(order.indexOf('billboard') > order.indexOf('page') && order.indexOf('billboard') < order.indexOf('world'));
  const previous = process.env.CSSEARTH_BILLBOARD_ORIGIN;
  process.env.CSSEARTH_BILLBOARD_ORIGIN = 'http://127.0.0.1:9';
  try { await assert.rejects(billboard.commands(['hd-219134']), /No site answers at http:\/\/127\.0\.0\.1:9: start it with pnpm dev/u); }
  finally { if (previous === undefined) delete process.env.CSSEARTH_BILLBOARD_ORIGIN; else process.env.CSSEARTH_BILLBOARD_ORIGIN = previous; }
});

test('the reader text budgets and the Sun the later steps build on are checked before the bake, not after it', () => {
  const order = PREPARATION_STEPS.map(step => step.name);
  assert.ok(order.indexOf('inputs') < order.indexOf('prepare') && order.indexOf('inputs') > order.indexOf('builds'));
});
