import assert from "node:assert/strict";
import test from "node:test";
import { OBJECTS } from "../site/objects.mjs";
import { censusPreparedLeafLayouts } from "./check-prepared-leaf-layouts.mjs";

test("all existing objects supply complete reachable prepared projective layouts", async () => {
  const result = await censusPreparedLeafLayouts();
  assert.equal(result.complete, true);
  assert.deepEqual(result.objects.map(object => object.id), OBJECTS.map(object => object.id));
  assert.ok(result.objects.every(object => object.count > 0 && object.failures.length === 0));
});
test("removing the supplied layout descriptor exposes the original Saturn omission", async () => {
  const result = await censusPreparedLeafLayouts({ ignoreLayouts: true });
  assert.equal(result.complete, false);
  const failures = result.objects.filter(object => object.failures.length);
  assert.deepEqual(failures.map(object => object.id), ["saturn"]);
  assert.equal(failures[0].failures.length, 162);
});
