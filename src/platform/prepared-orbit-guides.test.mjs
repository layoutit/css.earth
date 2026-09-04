import assert from "node:assert/strict";
import { readFile, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  PREPARED_ORBIT_GUIDE_SCHEMA,
  validatePreparedOrbitGuides,
} from "./orbit-guide-contract.mjs";
import { preparePlanetOrbitGuides } from "./prepared-orbit-guides.mjs";
import { preparedFixture } from "./orbit-guide-test-fixture.mjs";

test("prepares a planet-owned orbit-guide plan and vector assets", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "cssearth-orbit-guides-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const request = fixtureRequest(directory);
  const prepared = await preparePlanetOrbitGuides(request);

  assert.equal(validatePreparedOrbitGuides(prepared), prepared);
  assert.equal(prepared.schema, PREPARED_ORBIT_GUIDE_SCHEMA);
  assert.equal(prepared.planetId, "earth");
  assert.deepEqual(prepared.guides.map(({ id }) => id), ["luna", "probe"]);
  assert.equal(prepared.retainedLeafCount, 2);
  assert.equal(prepared.hitTest.orbitTestsPerCallback, 2);
  assert.equal(prepared.runtimeGeometryPreparation, false);
  assert.equal(prepared.runtimeJavaScriptWritesPerFrame, 0);
  assert.equal(prepared.guides[0].planeTransform, "");
  assert.equal(
    prepared.guides[1].planeTransform,
    "rotateY(-12deg) rotateZ(-45deg)",
  );

  const [svg, svg2x, moduleStat] = await Promise.all([
    readFile(request.asset.path, "utf8"),
    readFile(request.asset.path2x, "utf8"),
    stat(request.outputModulePath),
  ]);
  assert.match(svg, /<circle[^>]+stroke-width="0\.75"\/>/u);
  assert.match(svg2x, /<circle[^>]+stroke-width="0\.5"\/>/u);
  assert.ok(moduleStat.size > 0);
  const generated = await import(pathToFileURL(request.outputModulePath));
  assert.deepEqual(generated.PREPARED_ORBIT_GUIDES, prepared);
  assert.deepEqual(
    (await readdir(directory)).filter((name) => name.endsWith(".tmp")),
    [],
  );
});

test("rejects ambiguous bodies and planet-escaping assets before writing", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "cssearth-orbit-guides-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const request = fixtureRequest(directory);

  await assert.rejects(
    preparePlanetOrbitGuides({
      ...request,
      bodies: [request.bodies[0], request.bodies[0]],
    }),
    /body source is incompatible/u,
  );
  await assert.rejects(
    preparePlanetOrbitGuides({
      ...request,
      asset: {
        ...request.asset,
        url: "/scenes/earth/../saturn/orbits.svg",
      },
    }),
    /settings are incompatible/u,
  );
});

test("rejects drifted prepared contracts", () => {
  const plan = preparedFixture();
  assert.equal(validatePreparedOrbitGuides(plan), plan);
  assert.throws(
    () => validatePreparedOrbitGuides({
      ...plan,
      guides: [plan.guides[0], plan.guides[0]],
      guideCount: 2,
      retainedLeafCount: 2,
      hitTest: { ...plan.hitTest, orbitTestsPerCallback: 2 },
    }),
    /guide is incompatible/u,
  );
  assert.throws(
    () => validatePreparedOrbitGuides({
      ...plan,
      asset: { ...plan.asset, url: "/scenes/earth/../escape.svg" },
    }),
    /asset is incompatible/u,
  );
});

test("keeps the shared production capability planet-neutral", async () => {
  const sources = await Promise.all([
    "orbit-guide-contract.mjs",
    "orbit-guide-runtime.mjs",
    "prepared-orbit-guides.mjs",
  ].map((file) => readFile(new URL(file, import.meta.url), "utf8")));
  for (const source of sources) assert.doesNotMatch(source, /saturn/iu);
});

function fixtureRequest(directory) {
  return {
    planetId: "earth",
    bodies: [
      {
        id: "luna",
        displayOrbitRadius: 100,
        inclinationDeg: 0,
        nodeDeg: 0,
      },
      {
        id: "probe",
        displayOrbitRadius: 150,
        inclinationDeg: 12,
        nodeDeg: 45,
      },
    ],
    source: "prepared-test-satellite-orbits",
    asset: {
      url: "/scenes/earth/earth-orbit-guides.svg",
      url2x: "/scenes/earth/earth-orbit-guides@2x.svg",
      path: join(directory, "earth-orbit-guides.svg"),
      path2x: join(directory, "earth-orbit-guides@2x.svg"),
      size: 34,
      center: 17,
      referenceRadius: 16,
      transparentPaddingPixels: 1,
      strokeColor: "#b8bbc4",
      strokeWidth: 0.75,
      strokeWidth2x: 0.5,
    },
    presentation: { baseOpacity: 0.25, hoverOpacity: 0.65 },
    hitTest: {
      thresholdPixels: 6,
      touchTapMaxDurationMilliseconds: 350,
      touchTapMaxMovementPixels: 12,
    },
    outputModulePath: join(directory, "preparedOrbitGuides.mjs"),
  };
}
