import assert from "node:assert/strict";
import test from "node:test";
import { readPreparedFixture } from "../../fixtures.mts";
import { objectRuntimePackageTests } from "../../../../src/platform/test/object-runtime-package.mts";
import { SCENE_OBJECTS } from "../../../../site/objects.mts";
import { auditObjectRuntimeOwnership } from "../../../../tools/ci/check-object-runtime-ownership.mts";
const runtimeDefinition = await readPreparedFixture('saturn', 'runtime');
objectRuntimePackageTests(runtimeDefinition);
test("Saturn's actual import closure has only shared runtime owners", async () => {
  const audit = await auditObjectRuntimeOwnership({ objects: SCENE_OBJECTS.filter(object => object.id === "saturn") });
  assert.equal(audit.complete, true);
  for (const path of ["runtime/object-runtime", "rendering/prepared-residency", "rendering/object-selection-runtime", "rendering/object-control-binding", "rendering/prepared-playback", "solar-system/cubic-sky-runtime"]) {
    assert.ok(audit.sharedClosure.includes(`src/renderers/css/${path}.ts`));
  }
});
