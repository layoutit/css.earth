import {required} from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import test from "node:test";
import runtimeDefinition from "../../../../src/objects/mercury/prepared/runtime.json" with {type: "json"};
import { objectRuntimePackageTests, preparedSelectionFixture } from "../../../../src/platform/test/object-runtime-package.mts";
import { SCENE_OBJECTS } from "../../../../site/objects.mts";
import { auditObjectRuntimeOwnership } from "../../../../tools/ci/check-object-runtime-ownership.mts";
objectRuntimePackageTests(runtimeDefinition);
test("Mercury's actual import closure has only shared runtime owners", async () => {
  const audit = await auditObjectRuntimeOwnership({ objects: SCENE_OBJECTS.filter(object => object.id === "mercury") });
  assert.equal(audit.complete, true);
  for (const name of ["runtime/object-runtime", "rendering/prepared-residency", "rendering/object-selection-runtime", "rendering/object-control-binding", "rendering/prepared-playback", "solar-system/cubic-sky-runtime"]) {
    assert.ok(audit.sharedClosure.includes(`src/renderers/css/${name}.ts`));
  }
});

test("Mercury uses one shared exclusive lens and the prepared playback owner for cutaway pose", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    // The playback owner animates the body spin (rotateZ) and the cutaway pose (rotateX); the pose is the exclusive lens's.
    const pose = required(f.animations.find(animation => JSON.stringify(animation.keyframes).includes("rotateX"))), records = f.stage.querySelectorAll("*");
    for (const id of ["interior", "interior", "enhanced", "interior", "normal"]) {
      const request = f.selection.dispatch({ kind: "lens", id }); await f.settle(); assert.equal(await request, true);
      assert.equal(required(f.selection.state().committed).lensId, id);
      assert.deepEqual(required(f.selection.state().plan).pressedLenses, [id]);
      assert.deepEqual(f.stage.querySelectorAll("*"), records);
      assert.equal(f.stage.dataset.view, id === "interior" ? "interior" : undefined);
    }
    for (const [pitch, expectedTime] of [[-1, 0], [34.5, 34500], [89, 89000], [110, 89000]] as const) {
      f.selection.setView({ ...f.view, controlPitch: pitch }); await f.settle();
      assert.equal(pose.currentTime, expectedTime);
    }
    f.lifetime.destroy(); assert.equal(pose.playState, "idle");
    assert.equal(f.playback.stats().registeredCount, 0); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Mercury frame metadata changes with a decoded material and preserves the last valid address on a row miss", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const leaf = required(f.stage.querySelectorAll("*").find(node => node.className === "mercury-material"));
    const off = f.selection.dispatch({ kind: "toggle", name: "shadows", value: false }); await f.settle(); await off;
    assert.equal(leaf.dataset.materialMode, "full-phase-curvature"); assert.equal(leaf.dataset.materialFrame, undefined);
    const on = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); await on;
    const frame = leaf.dataset.materialFrame, image = leaf.style.backgroundImage;
    f.selection.setView({ ...f.view, sunViewDirection: [1, 0, -1] }); await f.flush();
    assert.equal(leaf.dataset.materialFrame, frame); assert.equal(leaf.style.backgroundImage, image);
    await f.settle(); assert.equal(leaf.dataset.materialFrame, "0"); assert.equal(leaf.dataset.materialMode, undefined);
  } finally { f.restore(); }
});
