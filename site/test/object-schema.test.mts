import { testDistance } from './navigation-test-values.mts';
import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { required } from "./navigation-test-values.mts";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { authoredObjectFixture } from "./authored-object-fixture.mts";

import { defineObject, defineObjects, OBJECT_CLASSIFICATIONS } from "../object-schema.mts";
import { catalogEntry } from '../object-catalog.mts';
import { SCENE_OBJECTS, requireSceneObject } from "../objects.mts";
import { parsePreparedWorldCameraFrame } from '../../src/renderers/css/dist/index.js';
import {
  discoverPlanetTests,
  resolvePlanetAssembly,
  resolvePlanetCommand,
} from "../../tools/cli/run-implemented-planets.mts";

const loadScene = async () => () => { throw new Error('Registry fixture does not mount a scene.'); };
const fixture = Object.freeze({
  id: "fixture",
  name: "Fixture",
  systemName: "Test System",
  classification: "dwarf-planet",
  color: "#abcdef",
  distance: testDistance(1),
  route: "/fixture/",
  loadScene,
  description: "Prepared fixture object.",
});

test("defines one generic renderable-object contract", () => {
  const objectRecord = defineObject(fixture);
  assert.deepEqual(Object.keys(objectRecord), [
    "kind",
    "id",
    "name",
    "systemName",
    "classification",
    "color",
    "distance",
    "route",
    "loadScene",
    "description",
    "worldFrame",
    "discovery",
  ]);
  assert.equal(objectRecord.loadScene, loadScene);
  assert.equal(Object.isFrozen(objectRecord), true);
  assert.equal(objectRecord.worldFrame, null);
});

test('catalogue metadata carries only explicit scientific aliases', () => {
  const descriptor = { schema: 'cssearth-object@1', id: 'fixture', properties: { catalog: {
    name: 'Fixture', systemName: 'Test System', classification: 'dwarf-planet', color: '#abcdef', distanceAu: 1,
    description: 'Prepared fixture object.', aliases: ['274860', '2009 RE26'],
  } } };
  const entry = catalogEntry(descriptor, loadScene, testDistance(1));
  assert.deepEqual(entry.aliases, ['274860', '2009 RE26']);
  assert.throws(() => catalogEntry({ ...descriptor, properties: { catalog: { ...descriptor.properties.catalog, aliases: [''] } } }, loadScene, testDistance(1)), /Invalid catalogue aliases/);
});

test('world-frame capability is validated and copied at the registry boundary', () => {
  const frame = { referenceFrame: 'heliocentric-icrf', epochJdTt: 2451545,
    originM: [1, 2, 3], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1],
    metersPerUnit: 1000, bodyRadiusM: 1000000 };
  const value = defineObject({ ...fixture, worldFrame: frame });
  assert.deepEqual(value.worldFrame, frame);
  assert.deepEqual(value.worldFrame, parsePreparedWorldCameraFrame(frame));
  assert.notEqual(value.worldFrame, frame);
  assert.ok(Object.isFrozen(value.worldFrame));
  assert.ok(Object.isFrozen(required(value.worldFrame).originM));
  for (const changed of [{ ...frame, originM: [1, 2] }, { ...frame, epochJdTt: NaN },
    { ...frame, metersPerUnit: 0 }, { ...frame, bodyRadiusM: -1 },
    { ...frame, presentationToReference: [2, 0, 0, 0, 1, 0, 0, 0, 1] },
    { ...frame, referenceFrame: '' }, { ...frame, renderer: 'unexpected' },
    { ...frame, orbitUpReference: [0, 0, 2] }, { ...frame, orbitUpReference: [0, 1] }]) {
    assert.throws(() => defineObject({ ...fixture, worldFrame: changed }));
  }
  frame.originM[0] = 999;
  assert.equal(required(value.worldFrame).originM[0], 1);
  for (const object of SCENE_OBJECTS) assert.deepEqual(object.worldFrame, parsePreparedWorldCameraFrame(object.worldFrame));
});

test("rejects invalid object definitions and renderer-specific fields", () => {
  for (const classification of ["Planet", "planets", "dwarf-plannet", "", undefined]) {
    assert.throws(() => Reflect.apply(defineObject, undefined, [{ ...fixture, classification }]), /Invalid object definition/);
  }
  for (const classification of OBJECT_CLASSIFICATIONS) {
    const value: unknown = Reflect.apply(defineObject, undefined, [{ ...fixture, classification }]);
    assert.ok(value && typeof value === "object" && "classification" in value);
    assert.equal(value.classification, classification);
  }
  assert.throws(() => Reflect.apply(defineObject, undefined, [null]), /must be an object/);
  assert.throws(() => defineObject({ ...fixture, id: "Saturn" }),
    /Invalid object definition/);
  assert.throws(() => defineObject({ ...fixture, color: "tan" }),
    /Invalid object definition/);
  assert.throws(() => defineObject({ ...fixture, distance: testDistance(-1) }),
    /Invalid prepared navigation distance/);
  assert.throws(() => defineObject({ ...fixture, route: "/wrong/" }),
    /Invalid object definition/);
  assert.throws(() => Reflect.apply(defineObject, undefined, [{ ...fixture, loadScene: true }]),
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
  assert.equal(new Set(SCENE_OBJECTS.map(({ id }) => id)).size, SCENE_OBJECTS.length);
  assert.equal(new Set(SCENE_OBJECTS.map(({ route }) => route)).size, SCENE_OBJECTS.length);

  assert.ok(SCENE_OBJECTS.every((objectRecord) =>
    Object.keys(objectRecord).join("\0") === Object.keys(SCENE_OBJECTS[0]).join("\0")));
  assert.equal(requireSceneObject("sun").name, "Sun");
  assert.throws(() => requireSceneObject("missing"), /Unknown cssEarth object/);
});

async function authoredFixture(context: TestContext) {
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-discovery-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const directory = resolve(root, "src/objects/fixture");
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
    ["browser", "site/test/dom-cleanliness-browser.mts"],
    ["assemble", "tools/objects/dist/operations.js"],
  ] as const) {
    const expected = resolve(projectRoot, suffix);
    assert.equal(await resolvePlanetCommand("fixture", mode, {
      projectRoot, accessFile: async path => assert.equal(path, expected),
    }), expected);
    await assert.rejects(resolvePlanetCommand("fixture", mode, {
      projectRoot, accessFile: async () => { throw new Error("ENOENT"); },
    }), new RegExp(mode + " script is missing"));
  }
  await assert.rejects(Reflect.apply(resolvePlanetCommand, undefined, ["fixture", "unknown", { projectRoot }]),
    /Unknown planet command mode/);
});
