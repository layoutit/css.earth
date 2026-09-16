import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REGISTRATION_BLOCK_BEGIN, REGISTRATION_BLOCK_END, registrationBlock, withRegistrationBlock } from './report-registration.mts';

const OBJECTS = resolve(import.meta.dirname, '../../src/objects');

const surfaces = (lenses: unknown[]) => ({ objectId: 'x', surfaces: lenses });
const staged = (id: string, silhouette: Record<string, unknown>, reference: Record<string, unknown>) =>
  ({ id, observation: { registration: { stage: 'cssearth-registration-stage@1', silhouette: { frames: [{}, {}, {}], scored: 2, rmsDegrees: 3.28, noiseFloorDegrees: 3.41, systematicDegrees: 0, ...silhouette }, reference: { kind: 'frames', referenceFrames: 3, frames: [{}, {}, {}], decisive: 3, medianOffsetDegrees: -0.5, rule: { minimumFrames: 3 }, ...reference }, relief: { rule: { minimumFrames: 3 }, frames: [{}, {}, {}], decisive: 3, medianOffsetDegrees: 0.75 } } } });

test('the block states every staged lens and nothing for a body without one', () => {
  assert.equal(registrationBlock(surfaces([{ id: 'shape' }, { id: 'map', observation: { frames: [] } }])), null);
  const block = registrationBlock(surfaces([{ id: 'shape' }, staged('zimpol', {}, {}), staged('iss', { scored: 0, rmsDegrees: null, noiseFloorDegrees: null, systematicDegrees: null }, { kind: 'observation', observation: 'normal', decisive: 1, medianOffsetDegrees: 1.25, frames: [{}] })]));
  assert.ok(block);
  assert.match(block, /\| `zimpol` \| 3 \| 2 \| 3\.28° \| 3\.41° \| 0\.00° \| its other 3 frames \| 3 of 3 \| -0\.50° \| 3 of 3, 0\.75° \|/);
  assert.match(block, /\| `iss` \| 3 \| 0 \| — \| — \| — \| the `normal` map \| 1 of 1 \| — \| 3 of 3, 0\.75° \|/, 'one decisive frame states no median');
  assert.ok(!block.includes('shape'));
});

test('the block goes between the markers and leaves a README without them alone', () => {
  const readme = `# Body\n\n${REGISTRATION_BLOCK_BEGIN}\nold\n${REGISTRATION_BLOCK_END}\n\nMore.`;
  const { readme: written, replaced } = withRegistrationBlock(readme, 'new block');
  assert.equal(replaced, true);
  assert.equal(written, `# Body\n\n${REGISTRATION_BLOCK_BEGIN}\nnew block\n${REGISTRATION_BLOCK_END}\n\nMore.`);
  assert.deepEqual(withRegistrationBlock('# Body', 'new block'), { readme: '# Body', replaced: false });
});

test('every README that carries the markers states exactly what its prepared report gives', () => {
  let carried = 0;
  for (const id of readdirSync(OBJECTS)) {
    const path = resolve(OBJECTS, id, 'README.md'), prepared = resolve(OBJECTS, id, 'prepared/surfaces.json');
    if (!existsSync(path)) continue;
    const readme = readFileSync(path, 'utf8');
    if (!readme.includes(REGISTRATION_BLOCK_BEGIN)) continue;
    carried++;
    assert.ok(existsSync(prepared), `${id}: a README with registration markers has a prepared surfaces report`);
    const block = registrationBlock(JSON.parse(readFileSync(prepared, 'utf8')));
    const { readme: expected } = withRegistrationBlock(readme, block);
    assert.equal(readme, expected, `${id}/README.md: the registration block differs from the prepared report; run node tools/objects/report-registration.mts ${id} --write`);
  }
  assert.ok(carried >= 1, 'at least one body carries the generated block');
});
