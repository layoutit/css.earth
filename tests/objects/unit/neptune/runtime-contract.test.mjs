import assert from "node:assert/strict";
import test from "node:test";
import { runtimeDefinition } from "./prepared-fixture.mjs";
import { objectRuntimePackageTests } from "../../../../src/platform/test/object-runtime-package.mjs";
import { OBJECTS } from "../../../../site/objects.mjs";
import { auditObjectRuntimeOwnership } from "../../../../tools/check-object-runtime-ownership.mjs";
objectRuntimePackageTests(runtimeDefinition);
test("Neptune's actual import closure has only shared runtime owners", async () => {
  const audit = await auditObjectRuntimeOwnership({ objects: OBJECTS.filter(object => object.id === "neptune") });
  assert.equal(audit.complete, true);
  assert.ok(audit.sharedClosure.some(path => path.startsWith("src/renderers/css/")));
});
