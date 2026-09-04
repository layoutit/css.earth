import assert from "node:assert/strict";
import test from "node:test";

import { defineObject, defineObjects } from "../object-schema.mjs";
import { OBJECTS, requireObject } from "../objects.mjs";
import {
  discoverPlanetTests,
  planetAcquireScript,
  planetAssembleScript,
  planetBrowserSmokeScript,
  planetPrepareScript,
  planetTestDirectory,
  resolvePlanetAssembly,
  resolvePlanetCommand,
} from "../../tools/run-implemented-planets.mjs";

const loadScene = async () => () => {};
const fixture = Object.freeze({
  id: "fixture",
  name: "Fixture",
  classification: "dwarf-planet",
  color: "#abcdef",
  distanceAu: 1,
  route: "/fixture/",
  loadScene,
  description: "Prepared fixture object.",
});

test("defines one generic renderable-object contract", () => {
  const objectRecord = defineObject(fixture);
  assert.deepEqual(Object.keys(objectRecord), [
    "id",
    "name",
    "classification",
    "color",
    "distanceAu",
    "route",
    "loadScene",
    "description",
  ]);
  assert.equal(objectRecord.loadScene, loadScene);
  assert.equal(Object.isFrozen(objectRecord), true);
});

test("rejects invalid object definitions and renderer-specific fields", () => {
  assert.throws(() => defineObject(null), /must be an object/);
  assert.throws(() => defineObject({ ...fixture, id: "Saturn" }),
    /Invalid object definition/);
  assert.throws(() => defineObject({ ...fixture, color: "tan" }),
    /Invalid object definition/);
  assert.throws(() => defineObject({ ...fixture, distanceAu: -1 }),
    /Invalid object definition/);
  assert.throws(() => defineObject({ ...fixture, route: "/wrong/" }),
    /Invalid object definition/);
  assert.throws(() => defineObject({ ...fixture, loadScene: true }),
    /Invalid object definition/);
  for (const field of ["scene", "camera", "material", "moons", "lenses"]) {
    assert.throws(
      () => defineObject({ ...fixture, [field]: "unsupported" }),
      new RegExp(`Unsupported object field: ${field}`),
    );
  }
});

test("keeps one open-ended object registry with unique ids and routes", () => {
  const registry = defineObjects([defineObject(fixture)]);
  assert.equal(Object.isFrozen(registry), true);
  assert.throws(() => defineObjects([]), /at least one object/);
  assert.throws(
    () => defineObjects([defineObject(fixture), defineObject(fixture)]),
    /Duplicate object definition/,
  );
  assert.deepEqual(OBJECTS.map(({ id }) => id), [
    "sun",
    "mercury",
    "venus",
    "earth",
    "moon",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
    "pluto",
  ]);
  assert.ok(OBJECTS.every((objectRecord) =>
    Object.keys(objectRecord).join("\0") === Object.keys(OBJECTS[0]).join("\0")));
  assert.equal(requireObject("sun").name, "Sun");
  assert.throws(() => requireObject("missing"), /Unknown cssEarth object/);
});

test("derives deterministic test discovery from an object id", async () => {
  assert.equal(
    planetTestDirectory("fixture", "/project"),
    "/project/src/planets/fixture/test",
  );
  assert.deepEqual(
    await discoverPlanetTests("fixture", {
      projectRoot: "/project",
      readDirectory: async () => ["z.test.mjs", "notes.md", "a.test.mjs"],
    }),
    [
      "/project/src/planets/fixture/test/a.test.mjs",
      "/project/src/planets/fixture/test/z.test.mjs",
    ],
  );
  await assert.rejects(
    discoverPlanetTests("missing", {
      readDirectory: async () => { throw new Error("ENOENT"); },
    }),
    /test directory is missing/,
  );
  await assert.rejects(
    discoverPlanetTests("empty", { readDirectory: async () => ["README.md"] }),
    /has no tests/,
  );
});

test("derives and validates object-owned scripts", async () => {
  const assembly = "/project/src/planets/fixture/tools/compact-production-assets.mjs";
  assert.equal(planetAssembleScript("fixture", "/project"), assembly);
  assert.equal(
    await resolvePlanetAssembly("fixture", {
      projectRoot: "/project",
      accessFile: async (path) => assert.equal(path, assembly),
    }),
    assembly,
  );
  assert.equal(
    planetAcquireScript("fixture", "/project"),
    "/project/src/planets/fixture/tools/acquire.mjs",
  );
  assert.equal(
    planetPrepareScript("fixture", "/project"),
    "/project/src/planets/fixture/tools/prepare.mjs",
  );
  assert.equal(
    planetBrowserSmokeScript("fixture", "/project"),
    "/project/src/planets/fixture/test/smoke-browser.mjs",
  );
  for (const [mode, expected] of [
    ["acquire", "/project/src/planets/fixture/tools/acquire.mjs"],
    ["prepare", "/project/src/planets/fixture/tools/prepare.mjs"],
    ["browser", "/project/src/planets/fixture/test/smoke-browser.mjs"],
    ["assemble", assembly],
  ]) {
    assert.equal(await resolvePlanetCommand("fixture", mode, {
      projectRoot: "/project",
      accessFile: async (path) => assert.equal(path, expected),
    }), expected);
  }
  await assert.rejects(
    resolvePlanetCommand("missing", "prepare", {
      accessFile: async () => { throw new Error("ENOENT"); },
    }),
    /prepare script is missing/,
  );
  await assert.rejects(
    resolvePlanetCommand("fixture", "unknown"),
    /Unknown planet command mode/,
  );
});
