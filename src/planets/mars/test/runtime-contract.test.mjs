import { viewSunDirectionToPreparedLightDirection } from "../../../platform/directional-sun-coordinate.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { mountPreparedPresentation } from "../../../platform/prepared-presentation.mjs";
import { runtimeDefinition } from "../runtime/definition.mjs";
import { PREPARED_MARS_LIGHTING } from "../runtime/preparedLighting.mjs";
import { objectRuntimePackageTests, preparedSelectionFixture, retainedPresentationFixture } from "../../../platform/test/object-runtime-package.mjs";
import { OBJECTS } from "../../../../site/objects.mjs";
import { auditObjectRuntimeOwnership } from "../../../../tools/check-object-runtime-ownership.mjs";

objectRuntimePackageTests(runtimeDefinition);
test("Mars's actual import closure has no private runtime owner", async () => {
  const audit = await auditObjectRuntimeOwnership({ objects: OBJECTS.filter(object => object.id === "mars") });
  assert.equal(audit.complete, true);
  for (const source of ["object-selection-runtime", "prepared-residency", "prepared-playback", "object-control-binding", "cubic-sky-runtime"]) {
    assert.ok(audit.sharedClosure.includes(`src/platform/${source}.mjs`));
  }
});

test("Mars retains a visible fallback through a row miss, recoverable decode failure and retry", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    assert.equal(f.residency.stats().pools.find(pool => pool.id === "lighting").nativeSlots, 3);
    assert.equal(f.presentation.observe().materials.lighting.appliedFrame,
      PREPARED_MARS_LIGHTING.shadowlessFrameOffset + PREPARED_MARS_LIGHTING.defaultFrame);
    const request = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); assert.equal(await request, true);
    const previous = f.presentation.observe().materials.lighting.appliedFrame;
    const view = { ...f.view, sunViewDirection: viewSunDirectionToPreparedLightDirection([0, 0, 1]), revision: 2 };
    f.selection.setView(view); await f.flush();
    assert.equal(f.selection.state().loadingMaterial, true);
    assert.equal(f.presentation.observe().materials.lighting.appliedFrame, previous);
    const failed = f.jobs.find(job => !job.done && job.url === runtimeDefinition.assets.entries.find(entry => entry.key === runtimeDefinition.materials[0].banks[0].frames[0].resource).url); assert.ok(failed); failed.done = true; failed.reject(new Error("row decode failed")); await f.flush();
    assert.equal(f.lifetime.disposed, false); assert.equal(f.materialErrors.length, 1);
    assert.equal(f.presentation.observe().materials.lighting.appliedFrame, previous);
    f.selection.setView({ ...view, revision: 3 }); await f.settle();
    assert.equal(f.presentation.observe().materials.lighting.appliedFrame, 0);
    const pool = f.residency.stats().pools.find(pool => pool.id === "lighting");
    assert.ok(pool.resident <= 3); assert.equal(pool.nativeSlots, 3);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Mars's new lens groups use shared warm receipts without retaining native images", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const nodes = f.stage.querySelectorAll("*");
    for (const id of ["elevation", "thermal", "normal", "thermal"]) {
      const request = f.selection.dispatch({ kind: "lens", id }); await f.settle(); assert.equal(await request, true);
      assert.equal(f.selection.state().committed.lensId, id);
      assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
      assert.equal(f.residency.stats().pools.find(pool => pool.id === "warm").resident, 0);
    }
    const surfaceJobs = f.jobs.filter(job => /mars-(?:elevation|thermal|surface|poles)/.test(job.url));
    assert.equal(new Set(surfaceJobs.map(job => job.url)).size, surfaceJobs.length);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

for (const replacement of [false, true]) test(`Mars retained-root retirement preserves ownership (${replacement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    mountPreparedPresentation(f.stage, f.context, runtimeDefinition); f.stage.dataset.lens = "selected";
    if (replacement) { f.stage.replaceChildren(f.document.createElement("div")); f.stage.dataset.lens = "replacement"; }
    assert.deepEqual(f.lifetime.destroy(), []);
    assert.equal(f.stage.dataset.lens, replacement ? "replacement" : undefined);
    assert.equal(f.stage.children.length, replacement ? 1 : 0);
  } finally { f.restore(); }
});


test("Mars atmosphere follows every Sun phase in both ground-shadow modes through one publisher", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const retained = f.stage.querySelectorAll("*");
    const cases = [
      { direction: [0, 0, 1], phase: 0 },
      { direction: [1, 0, 0], phase: 128 },
      { direction: [0, 0, -1], phase: 255 },
      { direction: [-1, 0, 0], phase: 128 },
    ];
    let revision = 2;
    for (const shadows of [false, true, false]) {
      const request = f.selection.dispatch({ kind: "toggle", name: "shadows", value: shadows });
      await f.settle(); assert.equal(await request, true);
      for (const { direction, phase } of cases) {
        f.selection.setView({ ...f.view, sunViewDirection: viewSunDirectionToPreparedLightDirection(direction), revision: revision++ });
        await f.settle();
        const observed = f.presentation.observe();
        assert.equal(observed.materials.lighting.calculatedFrame, phase);
        assert.equal(observed.materials.lighting.appliedFrame, phase + (shadows ? 0 : 256));
        assert.equal(observed.materials.lighting.appliedRow, observed.materials.lighting.appliedFrame);
        assert.equal(f.selection.state().committed.shadows, shadows);
        assert.equal(observed.materials.lighting.mode, shadows
          ? "directional-terminator-and-atmosphere" : "directional-atmosphere-without-ground-shadow");
        if (direction[0] === 1) assert.ok(Math.abs(observed.materials.lighting.lightRollDegrees +
          PREPARED_MARS_LIGHTING.baseLightAzimuthDegrees) < 1e-9,
        "disabling ground shadows preserves the directional atmosphere rotation");
        assert.deepEqual(f.stage.querySelectorAll("*"), retained);
        assert.equal(f.residency.stats().pools.find(pool => pool.id === "lighting").nativeSlots, 3);
      }
    }
    assert.equal(runtimeDefinition.materials.length, 1);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Mars ground-mode changes keep the published image and rotation until the replacement row is decoded", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    f.selection.setView({ ...f.view, sunViewDirection: [1, 0, 0], revision: 2 });
    await f.settle();
    const leaf = f.stage.querySelectorAll("*").find(node => node.tagName === "S" &&
      node.parentNode?.className === "polycss-mesh mars-material-plane");
    const original = { image: leaf.style.backgroundImage, rotate: leaf.style.rotate };
    assert.equal(f.presentation.observe().materials.lighting.appliedFrame, 384);
    const request = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true });
    await f.flush();
    assert.equal(f.selection.state().committed.shadows, false);
    assert.deepEqual({ image: leaf.style.backgroundImage, rotate: leaf.style.rotate }, original);
    assert.ok(f.jobs.some(job => !job.done), "the opposite ground-mode row must be awaiting decode");
    await f.settle(); assert.equal(await request, true);
    assert.equal(f.selection.state().committed.shadows, true);
    assert.equal(f.presentation.observe().materials.lighting.appliedFrame, 128);
    assert.notEqual(leaf.style.backgroundImage, original.image);
    assert.equal(leaf.style.rotate, original.rotate);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});
