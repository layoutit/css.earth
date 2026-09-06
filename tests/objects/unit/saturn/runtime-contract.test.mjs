import assert from "node:assert/strict";
import test from "node:test";
import { runtimeDefinition } from "../runtime/definition.mjs";
import { objectRuntimePackageTests } from "../../../platform/test/object-runtime-package.mjs";
import { OBJECTS } from "../../../../site/objects.mjs";
import { auditObjectRuntimeOwnership } from "../../../../tools/check-object-runtime-ownership.mjs";
objectRuntimePackageTests(runtimeDefinition);
test("Saturn's actual import closure has only shared runtime owners", async () => {
  const audit = await auditObjectRuntimeOwnership({ objects: OBJECTS.filter(object => object.id === "saturn") });
  assert.equal(audit.complete, true);
  for (const name of ["object-runtime", "prepared-residency", "object-selection-runtime", "object-control-binding", "prepared-playback", "cubic-sky-runtime"]) {
    assert.ok(audit.sharedClosure.includes(`src/platform/${name}.mjs`));
  }
});
