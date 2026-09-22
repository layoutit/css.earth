import assert from "node:assert/strict";
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('earth');
import { runtimeDefinition } from "../../unit/earth/prepared-fixture.mts";
import { preparedSelectionFixture } from "../../../../src/platform/test/object-runtime-package.mts";

for (const failure of ["decode", "publication"]) test(`Earth deferred material ${failure} uses the shared error boundary`, async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    f.selection.setView(Object.assign({}, { ...f.view, sunViewDirection: [1, 0, 0], skySunViewDirection: [1, 0, 0], revision: 2 })); await f.flush();
    f.advanceTimers(); await f.flush();
    const jobs = f.jobs.filter(job => !job.done && job.url.includes("earth-atmosphere-")); assert.ok(jobs.length);
    if (failure === "decode") {
      jobs[0].done = true; jobs[0].reject(new Error("row decode failed")); await f.flush();
      assert.equal(f.lifetime.disposed, false); assert.deepEqual(f.errors, []); assert.equal(f.materialErrors.length, 1);
      f.selection.setView(Object.assign({}, { ...f.view, sunViewDirection: [1, 0, 0], skySunViewDirection: [1, 0, 0], revision: 3 })); await f.settle();
      assert.equal(f.presentation.observe().materials.atmosphere.frame, 64);
    } else {
      const leaf = f.stage.querySelectorAll("*").find(node => node.classList.contains("earth-atmosphere-material"));
      assert.ok(leaf);
      Object.defineProperty(leaf.style, "backgroundImage", { set() { throw new Error("native material publication failed"); } });
      await f.settle();
      assert.equal(f.lifetime.disposed, true); assert.equal(f.errors.length, 1); assert.equal(f.materialErrors.length, 0);
      assert.equal(f.residency.stats().images.entries.length, 0);
    }
  } finally { f.restore(); }
});
