import assert from "node:assert/strict";
import test from "node:test";
import { runtimeDefinition } from "./prepared-fixture.mts";
import { objectRuntimePackageTests } from "../../../../src/platform/test/object-runtime-package.mts";
import { SCENE_OBJECTS } from "../../../../site/objects.mts";
import { auditObjectRuntimeOwnership } from "../../../../tools/ci/check-object-runtime-ownership.mts";
objectRuntimePackageTests(runtimeDefinition);
test("Neptune's actual import closure has only shared runtime owners", async () => {
  const audit = await auditObjectRuntimeOwnership({ objects: SCENE_OBJECTS.filter(object => object.id === "neptune") });
  assert.equal(audit.complete, true);
  assert.ok(audit.sharedClosure.some(path => path.startsWith("src/renderers/css/")));
});
