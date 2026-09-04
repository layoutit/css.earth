import assert from "node:assert/strict";
import test from "node:test";

import { createPlanetPreparationPaths } from "./preparation-paths.mjs";
import { runPreparationSteps } from "./preparation-runner.mjs";

test("runs an object-owned preparation plan in exact sequence", async () => {
  const calls = [];
  await runPreparationSteps({
    objectName: "Fixture",
    toolDirectory: "/project/tools",
    steps: [["first.mjs"], ["second.mjs", "--proof"]],
    async runCommand(call) {
      calls.push(call);
    },
  });
  assert.deepEqual(calls.map(({ script, argumentsList }) => [script, argumentsList]), [
    ["/project/tools/first.mjs", []],
    ["/project/tools/second.mjs", ["--proof"]],
  ]);
});

test("stops before later work when one preparation step fails", async () => {
  const calls = [];
  await assert.rejects(runPreparationSteps({
    objectName: "Fixture",
    toolDirectory: "/project/tools",
    steps: [["first.mjs"], ["second.mjs"], ["third.mjs"]],
    async runCommand({ script }) {
      calls.push(script);
      if (script.endsWith("second.mjs")) throw new Error("failed");
    },
  }), /failed/);
  assert.deepEqual(calls, ["/project/tools/first.mjs", "/project/tools/second.mjs"]);
});

test("derives safe object, source, staging, and public paths", () => {
  const paths = createPlanetPreparationPaths({
    planetId: "fixture",
    toolModuleUrl: new URL("file:///project/src/planets/fixture/tools/preparation-paths.mjs"),
  });
  assert.equal(paths.objectRoot, "/project/src/planets/fixture");
  assert.equal(paths.sourceRoot, "/project/src/planets/fixture/source");
  assert.equal(paths.stagingRoot, "/project/src/planets/fixture/.prepared");
  assert.equal(paths.publicRoot, "/project/public/scenes/fixture");
  assert.throws(() => createPlanetPreparationPaths({
    planetId: "../escape",
    toolModuleUrl: new URL("file:///project/tools/file.mjs"),
  }), /incompatible/);
});
