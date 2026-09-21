import assert from 'node:assert/strict';
import test from 'node:test';
import packageJson from '../package.json' with { type: 'json' };
import { PREPARATION_STEPS } from './prepare-object.mts';

test('deploy generation and object authoring use distinct world-context commands', async () => {
  assert.doesNotMatch(packageJson.scripts['prepare:world-context'], /--pin-references/u);
  assert.match(packageJson.scripts['prepare:world-context:author'], /--pin-references/u);
  const world = PREPARATION_STEPS.find(step => step.name === 'world');
  assert.ok(world);
  assert.deepEqual(await world.commands('sun'), [['pnpm', 'prepare:world-context:author']]);
});

test('presentation-only preparation reaches the authored preparation only when asked', async () => {
  const prepare = PREPARATION_STEPS.find(step => step.name === 'prepare');
  assert.ok(prepare);
  assert.deepEqual(await prepare.commands('earth'), [['node', 'tools/objects/dist/prepare-authored.js', 'earth', '--write']]);
  assert.deepEqual(await prepare.commands('earth', { presentationOnly: true }),
    [['node', 'tools/objects/dist/prepare-authored.js', 'earth', '--write', '--presentation-only']]);
});
