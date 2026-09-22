import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import packageJson from '../../package.json' with { type: 'json' };
import { PREPARATION_STEPS } from './prepare-object.mts';

test('deploy generation and object authoring place the object with the same world-context command', async () => {
  assert.ok(packageJson.scripts['prepare:world-context']);
  const world = PREPARATION_STEPS.find(step => step.name === 'world');
  assert.ok(world);
  assert.deepEqual(await world.commands('sun'), [['pnpm', 'prepare:world-context']]);
});

test('presentation-only preparation reaches the authored preparation only when asked', async () => {
  const prepare = PREPARATION_STEPS.find(step => step.name === 'prepare');
  assert.ok(prepare);
  assert.deepEqual(await prepare.commands('earth'), [['node', 'tools/objects/dist/prepare-authored.js', 'earth', '--write']]);
  assert.deepEqual(await prepare.commands('earth', { presentationOnly: true }),
    [['node', 'tools/objects/dist/prepare-authored.js', 'earth', '--write', '--presentation-only']]);
});
