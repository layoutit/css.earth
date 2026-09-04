import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PREPARED_SATURN_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_SATURN_RUNTIME_SCENE } from
  "../runtime/preparedSceneRuntime.mjs";

test("mounts prepared PolyCSS texture leaves under retained planet groups", async () => {
  const [client, css, scenePreparer, moonPreparer, preparedSceneSource,
    preparedRuntimeSceneSource, preparedMoonSource] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../tools/prepare-scene.mjs", import.meta.url), "utf8"),
    readFile(new URL("../tools/prepare-moons.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/preparedScene.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/preparedSceneRuntime.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/preparedMoons.mjs", import.meta.url), "utf8"),
  ]);

  assert.equal(PREPARED_SATURN_RUNTIME_SCENE.schema,
    "csssaturn-prepared-runtime-scene@1");
  assert.equal(PREPARED_SATURN_RUNTIME_SCENE.transport.sourceSchema,
    PREPARED_SATURN_SCENE.schema);
  assert.ok(preparedRuntimeSceneSource.length < preparedSceneSource.length * 0.75);
  assert.deepEqual(
    Object.keys(PREPARED_SATURN_RUNTIME_SCENE.bodyBands[0].leaves[0]).sort(),
    ["className", "projectiveTextureLayer", "style", "tag"],
  );

  assert.match(client, /preparedSceneRuntime\.mjs/u);
  assert.match(client, /createRetainedCubicSkyOrbit\(/u);
  assert.match(client, /mountRetainedCubicSky\(/u);
  assert.match(client, /mountRetainedDirectionalSun\(/u);
  assert.match(client, /for \(const band of plan\.bodyBands\)/u);
  assert.match(client, /createPreparedInterior\(plan\)/u);
  assert.match(client, /runtimeDomGrowthPolicy: "none-retained-scene-complete-at-mount"/u);
  assert.match(client, /assertStableDomIdentity/u);
  assert.match(client, /createPreparedPlaybackClock\(sceneAnimations\)/u);
  assert.doesNotMatch(client,
    /bodyVisibility|createPreparedBodyVisibility/u);
  assert.match(client, /orbitMaterialCache\.presentation\(materialFrame/u);
  assert.doesNotMatch(client,
    /canvas|getContext\(|new DOMMatrix|loadPreparedOrbitBank|DecompressionStream/u);
  assert.doesNotMatch(client, /PREPARED_SATURN_MOON|saturn-moon/u);
  assert.equal((client.match(/devicePixelRatio/gu) ?? []).length, 0);

  assert.match(css, /\.saturn-ring-plane > s/u);
  assert.match(css, /\.saturn-body\s*\{/u);
  assert.match(css, /\.planet-stage\.saturn-hide-rings/u);
  assert.match(css, /\.planet-stage\.saturn-hide-shadows/u);
  assert.doesNotMatch(css, /saturn-moon/u);
  assert.doesNotMatch(css,
    /filter\s*:|mask(?:-image)?\s*:|clip-path\s*:|mix-blend-mode\s*:|gradient\(/u);

  assert.match(scenePreparer, /function preparedAtlasDimensions\(/u);
  assert.match(moonPreparer, /function preparedAtlasDimensions\(/u);
  assert.doesNotMatch(
    preparedSceneSource + preparedMoonSource,
    /--polycss-atlas-(?:width|height):64px|--saturn-surface-size/u,
  );
});
