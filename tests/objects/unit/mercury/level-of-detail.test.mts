import {parsePreparedObjectRuntime} from '../../../../src/renderers/css/dist/index.js';
const runtimeDefinition=parsePreparedObjectRuntime(runtimeSource);
import {required} from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('mercury');
import runtimeSource from "../../../../src/objects/mercury/prepared/runtime.json" with {type: "json"};
import { resolvePreparedPresentation } from "../../../../src/renderers/css/dist/testing.js";
import { preparedSelectionFixture } from "../../../../src/platform/test/object-runtime-package.mts";
import type { PreparedMaterialView } from "../../../../src/renderers/css/rendering/prepared-material";

const BILLBOARD_LIGHTING_KEY = "lighting-billboard";
const rows = (f: Awaited<ReturnType<typeof preparedSelectionFixture>>) => f.residency.stats().pools.find((pool: { id: string; }) => pool.id === "lighting");
const lit = { lensId: "normal", speed: 1, shadows: true, orbit: true };
const geometryView = { sunViewDirection: [1, 0, -1], levelOfDetail: { stage: "geometry", billboardOpacity: 0, markerOpacity: 0, silhouetteDiameter: 400 } };
const farView = (stage: string) => ({ ...geometryView, levelOfDetail: { stage, billboardOpacity: 1, markerOpacity: stage === "marker" ? 1 : 0, silhouetteDiameter: 6 } });
const lightingDemand = (selection: { lensId: string; speed: number; shadows: boolean; orbit: boolean; }, view: Partial<PreparedMaterialView>) => {
  const preparedView={ sceneMatrix:"matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)", ...view, sunViewDirection:view.sunViewDirection??null, controlPitch: 0, controlYaw: 0 };
  const plan = resolvePreparedPresentation(runtimeDefinition, { selection, view:preparedView });
  const lighting = (key: string) => key.startsWith("lighting") || key === "shadowless";
  return { required: plan.required.filter(lighting), prewarm: plan.prewarm.filter(lighting) };
};

test("far level-of-detail stages demand the billboard atlas instead of lighting rows", () => {
  const near = lightingDemand(lit, geometryView);
  assert.match(near.required[0], /^lighting:\d+$/u);
  assert.ok(near.prewarm.length > 0);
  for (const stage of ["crossfade", "billboard", "marker"]) {
    assert.deepEqual(lightingDemand(lit, farView(stage)), { required: [BILLBOARD_LIGHTING_KEY], prewarm: [] });
    assert.deepEqual(lightingDemand({ ...lit, shadows: false }, farView(stage)), { required: [BILLBOARD_LIGHTING_KEY], prewarm: [] });
  }
  // Before the camera's first perspective publication the geometry stage applies.
  assert.deepEqual(lightingDemand(lit, { sunViewDirection: [1, 0, -1] }), near);
  assert.deepEqual(lightingDemand({ ...lit, shadows: false }, geometryView), { required: ["shadowless"], prewarm: [] });
});

test("Mercury stops streaming rows from the crossfade on and keeps the phase, then resumes in close", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const enable = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); await enable;
    f.selection.setView({ ...f.view, ...geometryView, revision: 2 }); await f.settle();
    const near = f.presentation.observe().materials.lighting;
    assert.equal(near.bank, "rows");
    assert.match(required(f.selection.state().plan).required.join(" "), /lighting:\d+/u);
    assert.equal(f.stage.dataset.lod, "geometry");
    const nearFrame = near.frame;
    const residentRows = required(rows(f)).keys.length;
    assert.ok(residentRows > 0);

    for (const stage of ["crossfade", "billboard", "marker"]) {
      f.selection.setView({ ...f.view, ...farView(stage), revision: 3 }); await f.settle();
      const far = f.presentation.observe().materials.lighting;
      assert.equal(f.stage.dataset.lod, stage);
      assert.equal(far.bank, "billboard");
      // The same frame, the phase, drawn from the atlas (its one row).
      assert.equal(far.frame, nearFrame);
      assert.equal(far.appliedFrame, nearFrame);
      assert.equal(far.appliedRow, 0);
      assert.deepEqual(required(f.selection.state().plan).required.filter((key) => key.startsWith("lighting")), [BILLBOARD_LIGHTING_KEY]);
      // No further rows are requested, and the retained rows stay retained.
      assert.equal(required(rows(f)).pending, 0);
      assert.equal(required(rows(f)).keys.length, residentRows);
      // The billboard disc fades in on the material root (the stage's second child).
      assert.equal(f.stage.children[1].style.getPropertyValue("--mercury-billboard-opacity"), "1");
    }

    f.selection.setView({ ...f.view, ...geometryView, revision: 4 }); await f.settle();
    const back = f.presentation.observe().materials.lighting;
    assert.equal(f.stage.dataset.lod, "geometry");
    assert.equal(back.bank, "rows");
    assert.equal(back.frame, nearFrame);
    assert.match(required(f.selection.state().plan).required.join(" "), /lighting:\d+/u);
    assert.deepEqual(f.errors, []);
    assert.deepEqual(f.materialErrors, []);
  } finally { f.restore(); }
});

test("the overlay is fitted to the published silhouette, floored to the marker", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const fit = required(runtimeDefinition.viewBindings.find((binding) => binding.kind === "silhouette-fit"));
    const root = f.stage.children[1];
    const px = (value: number) => Number(value.toFixed(6)).toString();
    const silhouette = (radius: number) => ({ centre: [12, -8], radial: [1, 0], radialSemiAxis: radius, tangentialSemiAxis: radius * 0.5 });
    f.selection.setView({ ...f.view, ...geometryView, body: { silhouette: silhouette(100) }, revision: 2 }); await f.settle();
    assert.equal(root.style.transform, `translate(12px, -8px) rotate(0deg) scale(${px(100 * required(fit.unitScale))}, ${px(50 * required(fit.unitScale))}) rotate(0deg)`);
    f.selection.setView({ ...f.view, ...farView("marker"), body: { silhouette: silhouette(required(fit.minimumRadius) / 2) }, revision: 3 }); await f.settle();
    assert.equal(root.style.transform, `translate(12px, -8px) rotate(0deg) scale(${px(required(fit.minimumRadius) * required(fit.unitScale))}, ${px(required(fit.minimumRadius) * required(fit.unitScale))}) rotate(0deg)`);
    assert.equal(fit.minimumRadius, 0.6);
  } finally { f.restore(); }
});
