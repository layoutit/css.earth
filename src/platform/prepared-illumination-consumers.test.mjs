import assert from "node:assert/strict";
import test from "node:test";
import { runtimeDefinition as mars } from "../planets/mars/runtime/definition.mjs";
import { runtimeDefinition as earth } from "../planets/earth/runtime/definition.mjs";
import { preparedSelectionFixture } from "./test/object-runtime-package.mjs";
import { viewSunDirectionToPreparedLightDirection } from "./directional-sun-coordinate.mjs";

test("Earth starts directional atmosphere decoding without a stability wait", async () => {
  const f = await preparedSelectionFixture(earth);
  try {
    f.selection.setView({ ...f.view, skySunViewDirection: [1, 0, 0], revision: 2 });
    await f.flush();
    // Do not advance the fixture clock: short-lived phase rows must already be
    // decoding while the camera is moving, not only once its direction settles.
    assert.ok(f.jobs.some(job => !job.done && job.url.includes("earth-atmosphere-row-16")));
    await f.settle();
    assert.equal(f.presentation.observe().materials.atmosphere.frame, 64);
    assert.deepEqual(f.errors, []);
    assert.deepEqual(f.materialErrors, []);
  } finally { f.restore(); }
});

for (const definition of [mars, earth]) {
  test(`${definition.id}: actual shared selection preserves directional atmosphere across shadow toggles`, async () => {
    const f = await preparedSelectionFixture(definition);
    try {
      const nodes = f.stage.querySelectorAll("*");
      let revision = 1;
      const phases = new Set(), rolls = new Set();
      for (const skySunViewDirection of [[0, 0, 1], [1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, 0, -1]]) {
        f.selection.setView({ ...f.view, skySunViewDirection,
          sunViewDirection: viewSunDirectionToPreparedLightDirection(skySunViewDirection), revision: ++revision });
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
        assert.deepEqual(states[0], states[1]);
      }
      assert.equal(phases.size, 3); assert.ok(rolls.size >= 3);
      assert.deepEqual(f.errors, []); assert.deepEqual(f.materialErrors, []);
    } finally { f.restore(); }
  });
}
