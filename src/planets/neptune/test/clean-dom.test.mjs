import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps Neptune on retained DOM and prepared runtime transport", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /createRetainedCubicSkyOrbit/u);
  assert.match(client, /createPlanetFeatureControls/u);
  assert.match(client, /PREPARED_NEPTUNE_SCENE/u);
  assert.match(client, /assertStableDomIdentity/u);
  assert.match(client, /plan\.fixedMaterialPlane/u);
  assert.doesNotMatch(client, /neptune-material-composite/u);
  assert.match(client, /createPreparedOrbitMaterialCache/u);
  assert.match(client, /releaseResources\(\)/u);
  assert.match(client, /entry\.images\.forEach\(releaseDecodedImage\)/u);
  assert.match(client, /root\.classList\.remove\("is-loading"\)/u);
  assert.doesNotMatch(client, /mountPreparedOrbitGuide/u);
  assert.doesNotMatch(client, /createPreparedOrbitGuideInteraction/u);
  assert.match(client, /fetch\(descriptor\.asset\.url\)/u);
  assert.match(client, /float64LittleEndianValues/u);
  assert.doesNotMatch(client, /new DOMMatrix/u);
  assert.doesNotMatch(client, /\.split\(["']\\n["']\)/u);
  assert.doesNotMatch(client, /preparedMaterialPlaneMatrix/u);
  assert.doesNotMatch(client,
    /addEventListener\("change",\s*(?:publish|publishOrbitState)\)/u);
  assert.doesNotMatch(client, /materialDisk/u);
  assert.doesNotMatch(client, /createElement\(["']img["']\)/u);
  assert.doesNotMatch(styles, /neptune-material-composite/u);
  assert.doesNotMatch(styles, /material-disk/u);
  assert.doesNotMatch(styles, /box-shadow/u);
  assert.doesNotMatch(client, /moonPresentation|neptune-moon/u);
  assert.doesNotMatch(client, /createElement\(["']canvas["']\)/u);
  assert.doesNotMatch(client, /WebGL|clipPath|createElementNS/u);
  assert.doesNotMatch(styles, /neptune-moon/u);
  assert.doesNotMatch(styles,
    /(?:clip-path|(?:-webkit-)?mask(?:-image)?|(?:^|[;{\s])filter\s*:|gradient\(|mix-blend-mode)/imu);
});

test("keeps Neptune-specific behavior inside its adapter", async () => {
  const client = await readFile(
    new URL("../runtime/client.mjs", import.meta.url),
    "utf8",
  );
  assert.match(client,
    /\.\.\/\.\.\/\.\.\/platform\/planet-feature-controls\.mjs/u);
  assert.doesNotMatch(client, /planets\/(?:saturn|mars)/u);
});
