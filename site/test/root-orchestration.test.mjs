import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { OBJECTS } from "../objects.mjs";
import {
  discoverPlanetTests,
  resolvePlanetCommand,
} from "../../tools/run-implemented-planets.mjs";
import { loadPlanetBrowserProfile } from "./load-browser-profile.mjs";

const root = new URL("../../", import.meta.url);

test("derives every root planet lane from the validated catalog", async () => {
  const implemented = OBJECTS;
  for (const { id } of implemented) {
    assert.ok((await discoverPlanetTests(id, { projectRoot: root.pathname }))
      .length > 0);
    for (const mode of ["acquire", "prepare", "browser", "assemble"]) {
      assert.equal(typeof await resolvePlanetCommand(
        id,
        mode,
        { projectRoot: root.pathname },
      ), "string");
    }
  }
  const packageSource = await readFile(new URL("package.json", root), "utf8");
  const scripts = JSON.parse(packageSource).scripts;
  for (const lane of ["prepare", "test", "browser", "assemble"]) {
    for (const { id } of implemented) {
      assert.equal(scripts[`${lane}:${id}`], undefined);
    }
  }
  assert.ok(["test:platform", "test:shell", "test:planets"].every((lane) =>
    scripts.test.includes(`pnpm ${lane}`)));
});

test("loads object-owned browser and audit expectations for every implementation", async () => {
  const implemented = OBJECTS;
  const profiles = await Promise.all(implemented.map(loadPlanetBrowserProfile));
  assert.deepEqual(profiles.map(({ id }) => id), implemented.map(({ id }) => id));
  assert.ok(profiles.every(({ audit }) =>
    typeof audit.finalScope === "string" &&
    Array.isArray(audit.fullComparisonWidths)));
});
