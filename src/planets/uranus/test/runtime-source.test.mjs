import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps Uranus runtime free of acquisition and forbidden renderers", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(client, /\bfetch\s*\(|XMLHttpRequest|WebSocket/iu);
  assert.doesNotMatch(client, /createElement\(["'](?:canvas|svg)["']/iu);
  assert.doesNotMatch(styles, /clip-path|mask(?:-image)?\s*:|filter\s*:|linear-gradient|radial-gradient|mix-blend-mode/iu);
  assert.match(client, /createRetainedCubicSkyOrbit/u);
  assert.match(client, /mountRetainedCubicSky/u);
  assert.match(client, /for \(const band of plan\.bodyBands\)/u);
  assert.doesNotMatch(client, /uranus-material-composite planet-render-root/u);
  assert.match(client, /scene\.appendChild\(fixedMaterialCounter\)/u);
  assert.match(client, /PREPARED_URANUS_STARFIELD\.faces/u);
  assert.match(client, /createPlanetFeatureControls/u);
  assert.doesNotMatch(client, /uranus-moon|moonAtlas|OrbitGuide/u);
  assert.doesNotMatch(client, /mounted\.system\.style\.setProperty/u);
  assert.doesNotMatch(styles, /--uranus-label-counter-scale/u);
  assert.doesNotMatch(styles, /uranus-(?:moon|orbit-guide)/u);
  assert.doesNotMatch(client, /safeCamera\.update\(\{ zoom: 1\.6 \}\)/u);
  assert.doesNotMatch(client, /className, assets\.body|uranus-body-normal/u);
  assert.doesNotMatch(styles, /box-shadow\s*:/u);
});

test("uses the shared unbounded camera for the standalone Uranus scene", async () => {
  const client = await readFile(
    new URL("../runtime/client.mjs", import.meta.url),
    "utf8",
  );
  assert.match(client, /cameraModel: "accumulated-matrix3d"/u);
  assert.match(client, /pitchBounded: false/u);
  assert.match(client, /yawBounded: false/u);
  assert.match(client, /createRetainedCubicSkyOrbit\(\{/u);
  assert.doesNotMatch(client, /minorMoon|onMinorMoonsVisibilityChange/u);
  assert.match(client, /onPublish: publish/u);
});
