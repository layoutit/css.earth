import assert from "node:assert/strict";
import test from "node:test";
import { runtimeDefinition } from "../runtime/definition.mjs";
import { BILLBOARD_LIGHTING_KEY, materialDemand } from "../runtime/material.mjs";
import { preparedSelectionFixture } from "../../../platform/test/object-runtime-package.mjs";

const rows = (f) => f.residency.stats().pools.find((pool) => pool.id === "lighting");
const lit = { lensId: "normal", speed: 1, shadows: true, orbit: true };
const geometryView = { sunViewDirection: [1, 0, -1], levelOfDetail: { stage: "geometry", billboardOpacity: 0, markerOpacity: 0, silhouetteDiameter: 400 } };
const farView = (stage) => ({ ...geometryView, levelOfDetail: { stage, billboardOpacity: 1, markerOpacity: stage === "marker" ? 1 : 0, silhouetteDiameter: 6 } });

test("far level-of-detail stages demand the billboard atlas instead of lighting rows", () => {
  const near = materialDemand(lit, geometryView);
  assert.match(near.required[0], /^lighting:\d+$/u);
  assert.ok(near.prewarm.length > 0);
  for (const stage of ["crossfade", "billboard", "marker"]) {
    assert.deepEqual(materialDemand(lit, farView(stage)), { required: [BILLBOARD_LIGHTING_KEY], prewarm: [] });
    assert.deepEqual(materialDemand({ ...lit, shadows: false }, farView(stage)), { required: [BILLBOARD_LIGHTING_KEY], prewarm: [] });
  }
  // Before the camera's first perspective publication the geometry stage applies.
  assert.deepEqual(materialDemand(lit, { sunViewDirection: [1, 0, -1] }), near);
  assert.deepEqual(materialDemand({ ...lit, shadows: false }, geometryView), { required: ["shadowless"], prewarm: [] });
});

test("Mercury stops streaming rows from the crossfade on and keeps the phase, then resumes in close", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const enable = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); await enable;
    f.selection.setView({ ...f.view, ...geometryView, revision: 2 }); await f.settle();
    const near = f.presentation.observe();
    assert.equal(near.sky.lod.stage, "geometry");
    assert.equal(near.sky.lod.rowStreaming, true);
    assert.equal(near.material.materialSource, "rows");
    assert.match(f.selection.state().plan.required.join(" "), /lighting:\d+/u);
    assert.equal(f.stage.dataset.lod, "geometry");
    const nearFrame = near.material.materialFrame;
    const residentRows = rows(f).keys.length;
    assert.ok(residentRows > 0);

    for (const stage of ["crossfade", "billboard", "marker"]) {
      f.selection.setView({ ...f.view, ...farView(stage), revision: 3 }); await f.settle();
      const far = f.presentation.observe();
      assert.equal(far.sky.lod.stage, stage);
      assert.equal(f.stage.dataset.lod, stage);
      assert.equal(far.sky.lod.rowStreaming, false);
      assert.equal(far.material.materialSource, "billboard");
      // The same frame, the phase, drawn from the atlas.
      assert.equal(far.material.materialFrame, nearFrame);
      assert.equal(far.material.appliedRow, null);
      assert.deepEqual(f.selection.state().plan.required.filter((key) => key.startsWith("lighting")), [BILLBOARD_LIGHTING_KEY]);
      // No further rows are requested, and the retained rows stay retained.
      assert.equal(rows(f).pending, 0);
      assert.equal(rows(f).keys.length, residentRows);
      // The billboard disc fades in on the material root (the stage's second child).
      assert.equal(f.stage.children[1].style.getPropertyValue("--mercury-billboard-opacity"), "1");
    }

    f.selection.setView({ ...f.view, ...geometryView, revision: 4 }); await f.settle();
    const back = f.presentation.observe();
    assert.equal(back.sky.lod.stage, "geometry");
    assert.equal(back.sky.lod.rowStreaming, true);
    assert.equal(back.material.materialSource, "rows");
    assert.equal(back.material.materialFrame, nearFrame);
    assert.match(f.selection.state().plan.required.join(" "), /lighting:\d+/u);
    assert.deepEqual(f.errors, []);
    assert.deepEqual(f.materialErrors, []);
  } finally { f.restore(); }
});

test("the orbit toggle only hides the line through a stage class", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    assert.equal(f.presentation.observe().sky.orbitEnabled, true);
    assert.equal(f.stage.classList.contains("mercury-hide-orbit"), false);
    const hide = f.selection.dispatch({ kind: "toggle", name: "orbit", value: false }); await f.settle(); await hide;
    assert.equal(f.presentation.observe().sky.orbitEnabled, false);
    assert.equal(f.stage.classList.contains("mercury-hide-orbit"), true);
    const show = f.selection.dispatch({ kind: "toggle", name: "orbit", value: true }); await f.settle(); await show;
    assert.equal(f.stage.classList.contains("mercury-hide-orbit"), false);
  } finally { f.restore(); }
});
