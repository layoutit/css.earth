import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PREPARED_JUPITER_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_JUPITER_MOONS } from "../runtime/preparedMoons.mjs";
import { PREPARED_JUPITER_RINGS } from "../runtime/preparedRings.mjs";

test("keeps the Jupiter scene as one fixed retained PolyCSS tree", async () => {
  const [client, css, overlay] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../site/JupiterOverlay.astro", import.meta.url), "utf8"),
  ]);

  assert.equal(PREPARED_JUPITER_SCENE.leaves.length, 772);
  assert.equal(PREPARED_JUPITER_MOONS.moons.length, 4);
  assert.equal(PREPARED_JUPITER_MOONS.minorMoonDots.length, 111);
  assert.equal(PREPARED_JUPITER_MOONS.counts.moonSurfaceLeafCount, 115);
  assert.equal(PREPARED_JUPITER_RINGS.retainedDom.leafCount, 16);
  assert.equal(PREPARED_JUPITER_MOONS.presentation.runtimeGeometryPreparation,
    false);
  assert.ok(PREPARED_JUPITER_SCENE.leaves.every(({ tag, style }) =>
    ["b", "s", "u"].includes(tag) && typeof style === "string"));
  assert.ok(PREPARED_JUPITER_MOONS.moons.every(({ leaves }) =>
    leaves.length === 1 && leaves.every(({ tag, style }) =>
      ["b", "s", "u"].includes(tag) && typeof style === "string")));

  assert.match(client, /createDocumentFragment\(\)/u);
  assert.match(client,
    /createMesh\("polycss-camera planet-render-root", plan\.camera\.style\)/u);
  assert.match(client,
    /createMesh\(\s*"jupiter-fixed-material-counter"/u);
  assert.match(client,
    /PREPARED_JUPITER_CAMERA\.materialDepthPresentation\.materialMeshTransform/u);
  assert.match(client, /scene\.appendChild\(materialSystem\)/u);
  assert.match(client, /stage\.replaceChildren\(camera\)/u);
  assert.doesNotMatch(client, /jupiter-render-composite/u);
  assert.match(client, /runtimeDomGrowthPolicy: "none"/u);
  assert.match(client, /const stableNodes = Object\.freeze\(\[/u);
  assert.match(client, /PREPARED_JUPITER_RINGS\.leaves/u);
  assert.match(client, /createRowShardCache\(PREPARED_JUPITER_LIGHTING\)/u);
  assert.match(client, /createRetainedCubicSkyOrbit\(/u);
  assert.match(client, /mountRetainedCubicSky\(/u);
  assert.doesNotMatch(client, /loadPreparedOrbitBank|DecompressionStream/u);
  assert.match(client, /const materialLeaf = document\.createElement\("s"\)/u);
  assert.doesNotMatch(client, /materialLeaves/u);
  assert.match(client, /idleJavaScriptLoops: 0/u);
  assert.match(client, /assertStableDomIdentity/u);
  assert.match(client, /lensDecodePromises\.get\(lens\.id\)/u);
  assert.match(client, /if \(destroyed\) return/u);
  assert.match(client,
    /resume\(\) \{[\s\S]*?shouldPlay = true;[\s\S]*?if \(!mounted\) return;/u);
  assert.match(client, /releaseScene\(\)/u);
  assert.match(client, /stage\.replaceChildren\(\)/u);
  assert.match(client, /events\.abort\(\)/u);
  assert.equal((client.match(/style\.setProperty\(/gu) ?? []).length, 0);
  assert.doesNotMatch(client, /PREPARED_JUPITER_MOONS|jupiter-moon/u);
  assert.doesNotMatch(css, /jupiter-moon/u);
  assert.doesNotMatch(client,
    /DOMMatrix|Math\.(?:cos|sin)|materialTransform\s*\(|preparedMoonLocalLabelMatrix/u);
  assert.doesNotMatch(client, /canvas|getContext\(|requestIdleCallback/u);
  assert.doesNotMatch(client, /setInterval|setTimeout/u);
  assert.doesNotMatch(client,
    /matchMedia[^;]*addEventListener|devicePixelRatio.*addEventListener/u);
  assert.doesNotMatch(css,
    /filter\s*:|mask(?:-image)?\s*:|clip-path\s*:|mix-blend-mode\s*:|gradient\(|text-shadow\s*:|box-shadow\s*:/u);
  assert.doesNotMatch(overlay, /<\w+/u);
  assert.doesNotMatch(css, /jupiter-input-surface/u);
});
