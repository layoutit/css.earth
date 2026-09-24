import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import packageJson from '../../package.json' with { type: 'json' };
import { PREPARATION_STEPS } from './prepare-object.mts';

test('deploy generation and object authoring place the object with the same world-context command', async () => {
  assert.ok(packageJson.scripts['prepare:world-context']);
  const world = PREPARATION_STEPS.find(step => step.name === 'world');
  assert.ok(world);
  assert.deepEqual(await world.commands(['sun']), [['pnpm', 'prepare:world-context']]);
});

test('presentation-only preparation reaches the authored preparation only when asked', async () => {
  const prepare = PREPARATION_STEPS.find(step => step.name === 'prepare');
  assert.ok(prepare);
  assert.deepEqual(await prepare.commands(['earth']), [['node', 'tools/objects/dist/prepare-authored.js', 'earth', '--write']]);
  assert.deepEqual(await prepare.commands(['earth'], { presentationOnly: true }),
    [['node', 'tools/objects/dist/prepare-authored.js', 'earth', '--write', '--presentation-only']]);
});

test('several objects run each tool once: the id-list tools take every id, the authored preparation runs per object, the Sun is re-pinned last', async () => {
  const ids = ['hd-219134', 'hd-219134b'];
  const scopes = Object.fromEntries(PREPARATION_STEPS.map(step => [step.name, step.scope]));
  assert.deepEqual(scopes, { builds: 'once', catalogue: 'once', geometry: 'once', prepare: 'each', discovery: 'once', sources: 'each', page: 'ids', text: 'ids', markers: 'ids', world: 'once', provenance: 'ids', pins: 'once' });
  assert.equal(PREPARATION_STEPS.find(step => step.name === 'prepare')?.parallel, true);
  for (const name of ['page', 'text', 'markers', 'provenance']) {
    const commands = await PREPARATION_STEPS.find(step => step.name === name)!.commands(ids);
    assert.equal(commands.length, 1, name); assert.deepEqual(commands[0]!.slice(-2), ids, name);
  }
  assert.deepEqual(await PREPARATION_STEPS.at(-1)!.commands(ids), [['node', 'tools/prepare/prepare-object-json.mts', 'sun']]);
});
