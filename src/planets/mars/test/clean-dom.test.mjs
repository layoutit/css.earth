import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PREPARED_MARS_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_MARS_MOONS } from "../runtime/preparedMoons.mjs";

test("keeps the Mars scene as one fixed retained PolyCSS tree", async () => {
  const [client, css, overlay] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../site/MarsOverlay.astro", import.meta.url), "utf8"),
  ]);

  assert.equal(PREPARED_MARS_SCENE.leaves.length, 516);
  assert.equal(PREPARED_MARS_MOONS.moons.length, 2);
  assert.equal(PREPARED_MARS_MOONS.retainedDom.surfaceLeafCount, 2);
  assert.equal(PREPARED_MARS_MOONS.retainedDom.solidLeafCount, 0);
  assert.equal(PREPARED_MARS_MOONS.retainedDom.runtimeTopology, false);
  assert.ok(PREPARED_MARS_SCENE.leaves.every(({ tag, style }) =>
    ["b", "s", "u"].includes(tag) && typeof style === "string"));
  assert.ok(PREPARED_MARS_MOONS.moons.every(({ leaves }) =>
    leaves.length === 1 && leaves.every(({ tag, style }) =>
      ["b", "s", "u"].includes(tag) && typeof style === "string")));

  assert.match(client, /createDocumentFragment\(\)/u);
  assert.match(client, /scene\.appendChild\(materialCounter\)/u);
  assert.match(client, /stage\.replaceChildren\(camera\)/u);
  assert.match(client, /runtimeDomGrowthPolicy: "fixed-single-object-scene"/u);
  assert.match(client,
    /const materialBank = PREPARED_MARS_LIGHTING\.banks\[[\s\S]*?String\(CANONICAL_PREPARED_IMAGE_DENSITY\)[\s\S]*?\]/u);
  assert.match(client, /createRowShardCache\(materialBank\)/u);
  assert.match(client, /PLANET_SPEED_STATES/u);
  assert.doesNotMatch(client, /materialBank\s*\?\?|banks\["1"\]\s*\|\|/u);
  assert.match(client, /const materialLeaf = document\.createElement\("s"\)/u);
  assert.match(client,
    /PREPARED_MARS_CAMERA\.materialDepthContract\.planeTransform/u);
  assert.match(client,
    /createMesh\(\s*"mars-system mars-material-system",\s*plan\.systemTransform,?\s*\)/u);
  assert.doesNotMatch(client,
    /mounted\.materialLeaf\.style\.transform = zoomState\.materialTransform/u);
  assert.doesNotMatch(client, /function materialTransform/u);
  assert.doesNotMatch(client,
    /mounted\.material\.style\.transform = materialTransform/u);
  assert.doesNotMatch(client, /materialLeaves/u);
  assert.match(client, /idleJavaScriptLoops: 0/u);
  assert.match(client, /assertStableDomIdentity/u);
  assert.match(client, /lensDecodePromises\.get\(lens\.id\)/u);
  assert.match(client, /"\.planet-drawer-content \.planet-lenses"/u);
  assert.match(client, /"\.planet-settings-panel \.planet-settings"/u);
  assert.doesNotMatch(client, /document\.querySelector\("\.planet-header"\)/u);
  assert.match(client, /if \(destroyed\) return/u);
  assert.match(client,
    /resume\(\) \{[\s\S]*?shouldPlay = true;[\s\S]*?if \(!mounted\) return;/u);
  assert.match(client, /releaseScene\(\)/u);
  assert.match(client, /stage\.replaceChildren\(\)/u);
  assert.match(client, /events\.abort\(\)/u);
  assert.doesNotMatch(client, /style\.setProperty\(/u);
  assert.doesNotMatch(client, /canvas|getContext\(|requestIdleCallback/u);
  assert.doesNotMatch(client, /setInterval|setTimeout/u);
  assert.doesNotMatch(client,
    /preparedMoonPlaneBasis|preparedMoonBasisMatrix|preparedMoonProjectedRadii|preparedMoonLocalLabelMatrix/u);
  assert.doesNotMatch(client, /PREPARED_MARS_MOONS|mars-moon/u);
  assert.doesNotMatch(css, /mars-moon/u);
  assert.doesNotMatch(client, /Math\.(?:cos|sin)/u);
  assert.doesNotMatch(client,
    /matchMedia[^;]*addEventListener|devicePixelRatio.*addEventListener/u);
  assert.doesNotMatch(css,
    /filter\s*:|mask(?:-image)?\s*:|clip-path\s*:|mix-blend-mode\s*:|gradient\(/u);
  assert.doesNotMatch(css, /text-shadow\s*:/u);
  assert.doesNotMatch(overlay, /<\w+/u);
  assert.doesNotMatch(css, /mars-input-surface/u);
});
