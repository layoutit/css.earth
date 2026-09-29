import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { picasoLimbNodes } from '@cssearth/telescope/node';

const test = sourceTest();

// Needs the pinned PICASO toolchain (node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts picaso install); without it the test skips.
test('PICASO gives a Bobcat dwarf a V-band limb that darkens toward the edge and that the quadratic law fits', () => {
  const run = picasoLimbNodes([{ teffK: 1300, gravityMps2: 1780, file: 't1300g1780nc_m0.0.dat' }]);
  const node = run.nodes[0]!;
  assert.equal(node.mu.length, 8);
  assert.ok(node.mu.every(mu => mu > 0 && mu <= 1) && node.mu.every((mu, i) => i === 0 || mu < node.mu[i - 1]!), 'eight emission cosines from the centre outward');
  assert.ok(node.intensity.every((value, i) => i === 0 || value < node.intensity[i - 1]!), 'the intensity falls toward the limb');
  assert.ok(node.binsInBand >= 10, `${node.binsInBand} correlated-k windows inside Bessell V`);
  assert.ok(node.rms < 0.005, `the law fits the angles within ${node.rms}`);
  const edge = 1 - node.u1 - node.u2;
  assert.ok(edge > 0 && edge < 1, `the edge keeps ${edge} of the centre`);
});
