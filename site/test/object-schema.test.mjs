import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { authoredObjectFixture } from "./authored-object-fixture.mjs";

import { defineObject, defineObjects, OBJECT_CLASSIFICATIONS } from "../object-schema.mjs";
import { OBJECTS, requireObject } from "../objects.mjs";
import { parsePreparedWorldCameraFrame } from '../../src/renderers/css/dist/index.js';
import {
  discoverPlanetTests,
  resolvePlanetAssembly,
  resolvePlanetCommand,
} from "../../tools/run-implemented-planets.mjs";

const loadScene = async () => () => {};
const fixture = Object.freeze({
  id: "fixture",
  name: "Fixture",
  systemName: "Test System",
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
    "systemName",
    "classification",
    "color",
    "distanceAu",
    "route",
    "loadScene",
    "description",
    "worldFrame",
  ]);
  assert.equal(objectRecord.loadScene, loadScene);
  assert.equal(Object.isFrozen(objectRecord), true);
  assert.equal(objectRecord.worldFrame, null);
});

test('world-frame capability is validated and copied at the registry boundary', () => {
  const frame = { referenceFrame: 'heliocentric-icrf', epochJdTt: 2451545,
    originM: [1, 2, 3], presentationToReference: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    metersPerUnit: 1000, bodyRadiusM: 1000000 };
  const value = defineObject({ ...fixture, worldFrame: frame });
  assert.deepEqual(value.worldFrame, frame);
  assert.deepEqual(value.worldFrame, parsePreparedWorldCameraFrame(frame));
  assert.notEqual(value.worldFrame, frame);
  assert.ok(Object.isFrozen(value.worldFrame));
  assert.ok(Object.isFrozen(value.worldFrame.originM));
  for (const changed of [{ ...frame, originM: [1, 2] }, { ...frame, epochJdTt: NaN },
    { ...frame, metersPerUnit: 0 }, { ...frame, bodyRadiusM: -1 },
    { ...frame, presentationToReference: [2, 0, 0, 0, 1, 0, 0, 0, 1] },
    { ...frame, referenceFrame: '' }, { ...frame, renderer: 'unexpected' },
    { ...frame, orbitUpReference: [0, 0, 2] }, { ...frame, orbitUpReference: [0, 1] }]) {
    assert.throws(() => defineObject({ ...fixture, worldFrame: changed }));
  }
  frame.originM[0] = 999;
  assert.equal(value.worldFrame.originM[0], 1);
  for (const object of OBJECTS) assert.deepEqual(object.worldFrame, parsePreparedWorldCameraFrame(object.worldFrame));
});

test("rejects invalid object definitions and renderer-specific fields", () => {
  for (const classification of ["Planet", "planets", "dwarf-plannet", "", undefined]) {
    assert.throws(() => defineObject({ ...fixture, classification }), /Invalid object definition/);
  }
  for (const classification of OBJECT_CLASSIFICATIONS) {
    assert.equal(defineObject({ ...fixture, classification }).classification, classification);
  }
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
  assert.throws(() => defineObject({ ...fixture, systemName: "" }),
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
  assert.equal(new Set(OBJECTS.map(({ id }) => id)).size, OBJECTS.length);
  assert.equal(new Set(OBJECTS.map(({ route }) => route)).size, OBJECTS.length);

  assert.ok(OBJECTS.every((objectRecord) =>
    Object.keys(objectRecord).join("\0") === Object.keys(OBJECTS[0]).join("\0")));
  assert.equal(requireObject("sun").name, "Sun");
  assert.throws(() => requireObject("missing"), /Unknown cssEarth object/);
});

async function authoredFixture(context) {
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-discovery-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const directory = resolve(root, "src/planets/fixture");
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "object.json"), JSON.stringify(authoredObjectFixture("fixture")));
  return root;
}

test("derives deterministic test discovery from an authored object id", async context => {
  const projectRoot = await authoredFixture(context);
  const directory = resolve(projectRoot, "tests/objects/unit/fixture");
  assert.deepEqual(
    await discoverPlanetTests("fixture", {
      projectRoot,
      readDirectory: async path => {
        assert.equal(path, directory);
        return ["z.test.mjs", "notes.md", "a.test.mjs"];
      },
    }),
    [resolve(directory, "a.test.mjs"), resolve(directory, "z.test.mjs")],
  );
  await assert.rejects(discoverPlanetTests("fixture", {
    projectRoot, readDirectory: async () => { throw new Error("ENOENT"); },
  }), /test directory is missing/);
  await assert.rejects(discoverPlanetTests("fixture", {
    projectRoot, readDirectory: async () => ["README.md"],
  }), /has no tests/);
});

test("derives shared preparation and external browser scripts from the descriptor", async context => {
  const projectRoot = await authoredFixture(context);
  const assembly = resolve(projectRoot, "tools/objects/dist/operations.js");
  assert.equal(await resolvePlanetAssembly("fixture", {
    projectRoot, accessFile: async path => assert.equal(path, assembly),
  }), assembly);
  for (const [mode, suffix] of [
    ["acquire", "tools/objects/dist/operations.js"],
    ["prepare", "tools/objects/dist/prepare-authored.js"],
    ["browser", "site/test/dom-cleanliness-browser.mjs"],
    ["assemble", "tools/objects/dist/operations.js"],
  ]) {
    const expected = resolve(projectRoot, suffix);
    assert.equal(await resolvePlanetCommand("fixture", mode, {
      projectRoot, accessFile: async path => assert.equal(path, expected),
    }), expected);
    await assert.rejects(resolvePlanetCommand("fixture", mode, {
      projectRoot, accessFile: async () => { throw new Error("ENOENT"); },
    }), new RegExp(mode + " script is missing"));
  }
  await assert.rejects(resolvePlanetCommand("fixture", "unknown", { projectRoot }),
    /Unknown planet command mode/);
});
