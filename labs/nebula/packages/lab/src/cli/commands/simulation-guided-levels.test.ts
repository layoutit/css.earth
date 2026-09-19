import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSimulationGuidedLevels, DEFAULT_SIMULATION_GUIDED_LEVELS } from './simulation-guided-levels.ts';

test('an omitted normalization block keeps the accepted display levels exactly', () => {
  // These three values were hardwired in the fit, so every accepted model replays through them; changing a
  // default would silently move every body's black point, white point and transfer.
  assert.deepEqual(DEFAULT_SIMULATION_GUIDED_LEVELS, { blackQuantile: .25, whiteQuantile: .995, gamma: .85 });
  assert.deepEqual(parseSimulationGuidedLevels(undefined), { blackQuantile: .25, whiteQuantile: .995, gamma: .85 });
  assert.deepEqual(parseSimulationGuidedLevels({}), { blackQuantile: .25, whiteQuantile: .995, gamma: .85 });
  // Each level is authored on its own; the others keep their accepted value.
  assert.deepEqual(parseSimulationGuidedLevels({ blackQuantile: .02 }), { blackQuantile: .02, whiteQuantile: .995, gamma: .85 });
  assert.deepEqual(parseSimulationGuidedLevels({ whiteQuantile: .99 }), { blackQuantile: .25, whiteQuantile: .99, gamma: .85 });
  assert.deepEqual(parseSimulationGuidedLevels({ gamma: .7 }), { blackQuantile: .25, whiteQuantile: .995, gamma: .7 });
  // The returned object is a copy, so a caller cannot mutate the accepted defaults for the next model.
  parseSimulationGuidedLevels(undefined).blackQuantile = .9;
  assert.equal(DEFAULT_SIMULATION_GUIDED_LEVELS.blackQuantile, .25);
});

test('authored display levels are validated, ordered and closed', () => {
  for (const bad of [null, 3, 'low', [], [.1, .9]])
    assert.throws(() => parseSimulationGuidedLevels(bad), `refuses ${JSON.stringify(bad)}`);
  assert.throws(() => parseSimulationGuidedLevels({ blackPoint: .1 }), /Unknown authored normalization level/);
  for (const bad of [-.01, 1.01, Number.NaN, '0.1', null])
    assert.throws(() => parseSimulationGuidedLevels({ blackQuantile: bad }), `refuses black ${String(bad)}`);
  for (const bad of [-.01, 1.01, Number.NaN, '0.9'])
    assert.throws(() => parseSimulationGuidedLevels({ whiteQuantile: bad }), `refuses white ${String(bad)}`);
  // A transfer must stay monotone and finite, and black must stay below white or the target inverts.
  for (const bad of [0, -1, 5, Number.NaN, '1'])
    assert.throws(() => parseSimulationGuidedLevels({ gamma: bad }), `refuses gamma ${String(bad)}`);
  assert.throws(() => parseSimulationGuidedLevels({ blackQuantile: .9, whiteQuantile: .5 }), /below whiteQuantile/);
  assert.throws(() => parseSimulationGuidedLevels({ blackQuantile: .5, whiteQuantile: .5 }), /below whiteQuantile/);
  assert.deepEqual(parseSimulationGuidedLevels({ blackQuantile: 0, whiteQuantile: 1, gamma: 4 }),
    { blackQuantile: 0, whiteQuantile: 1, gamma: 4 });
});
