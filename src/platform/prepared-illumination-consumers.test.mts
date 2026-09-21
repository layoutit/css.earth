import {parsePreparedObjectRuntime} from '../renderers/css/dist/index.js';
import { loadObjectTestDefinition } from '../../tools/object-test-data.mts';
import assert from "node:assert/strict";
import test from "node:test";
const mars = parsePreparedObjectRuntime(await loadObjectTestDefinition('mars'));
const earth = parsePreparedObjectRuntime(await loadObjectTestDefinition('earth'));
import { preparedSelectionFixture } from "./test/object-runtime-package.mts";
import { viewSunDirectionToPreparedLightDirection } from "./directional-sun-coordinate.mts";

test("Earth starts directional atmosphere decoding without a stability wait", async () => {
  const f = await preparedSelectionFixture(earth);
  try {
    // Only a directional light turns the atmosphere with the Sun; flood lighting holds its full-phase frame.
    const shadows = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true });
    await f.settle(); assert.equal(await shadows, true);
    const requested = f.jobs.length, direction = [0.6, 0, -0.8];
    const changedView = { ...f.view, skySunViewDirection: direction, sunViewDirection: viewSunDirectionToPreparedLightDirection(direction), revision: 2 };
    f.selection.setView(changedView);
    await f.flush();
    // Do not advance the fixture clock: short-lived phase rows must already be
    // decoding while the camera is moving, not only once its direction settles.
    const started = f.jobs.slice(requested).map(job => job.url);
    await f.settle();
    const { frame, row } = f.presentation.observe().materials.atmosphere;
    assert.notEqual(frame, 64);
    assert.ok(started.some(url => url.includes(`earth-atmosphere-row-${row}@`)));
    assert.deepEqual(f.errors, []);
    assert.deepEqual(f.materialErrors, []);
  } finally { f.restore(); }
});

for (const definition of [mars, earth]) {
  test(`${definition.id}: actual shared selection keeps the prepared atmosphere across shadow toggles`, async () => {
    const f = await preparedSelectionFixture(definition);
    try {
      const nodes = f.stage.querySelectorAll("*");
      let revision = 1;
      const phases = new Set(), rolls = new Set();
      for (const skySunViewDirection of [[0, 0, 1], [1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, 0, -1]]) {
        const changedView = { ...f.view, skySunViewDirection,
          sunViewDirection: viewSunDirectionToPreparedLightDirection(skySunViewDirection), revision: ++revision };
        f.selection.setView(changedView);
        await f.settle();
        const states = [];
        for (const value of [true, false]) {
          const action = f.selection.dispatch({ kind: "toggle", name: "shadows", value });
          await f.settle(); assert.equal(await action, true);
          const material = f.presentation.observe().materials;
          const phase = definition === mars ? material.lighting.calculatedFrame : material.atmosphere.frame;
          const roll = definition === mars ? material.lighting.lightRollDegrees : material.atmosphere.lightRollDegrees;
          phases.add(phase); rolls.add(roll); states.push({ phase, roll });
          assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
          for (const pool of f.residency.stats().pools.filter(pool => ["lighting", "atmosphere"].includes(pool.id))) {
            assert.ok(pool.nativeSlots <= 3); assert.equal(pool.pending, 0);
          }
        }
        // Earth's flood lighting (shadows off, the second state) pins the atmosphere to its full-phase frame; Mars keeps its phase.
        if (definition === earth) assert.equal(states[1].phase, 127);
        else assert.deepEqual(states[0], states[1]);
      }
      assert.equal(phases.size, 3); assert.ok(rolls.size >= 3);
      assert.deepEqual(f.errors, []); assert.deepEqual(f.materialErrors, []);
    } finally { f.restore(); }
  });
}
