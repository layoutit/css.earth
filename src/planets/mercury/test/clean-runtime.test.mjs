import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps Mercury runtime free of network, alternate renderers, and forbidden CSS", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(client, /\bfetch\s*\(|XMLHttpRequest|WebSocket/iu);
  assert.doesNotMatch(client, /createElement\(["'](?:canvas|svg)["']\)/iu);
  assert.doesNotMatch(
    `${client}\n${styles}`,
    /--mercury-(?:camera-zoom-scale|disc-zoom)/u,
  );
  // A perspective camera frames by dolly: the roots are never scaled, the
  // body is placed by a translate on the scene root, the eye is set through
  // the perspective origin, and the overlay follows the projected silhouette.
  assert.doesNotMatch(client, /(?:cameraRoot|materialRoot)\.style\.scale/u);
  assert.match(client, /sceneRoot\.style\.transform =[\s\S]*?translate3d\(/u);
  assert.match(client, /\.style\.perspectiveOrigin = origin/u);
  assert.match(client, /materialRoot\.style\.transform =/u);
  assert.match(client,
    /resume\(\) \{[\s\S]*?shouldPlay = true;[\s\S]*?if \(!mounted\) return;/u);
  assert.match(client, /PLANET_SPEED_STATES/u);
  assert.doesNotMatch(`${client}\n${styles}`, /dataset\.speed|data-speed/u);
  assert.doesNotMatch(
    styles,
    /(?:clip-path|(?:-webkit-)?mask|filter\s*:|gradient\(|mix-blend-mode)/iu,
  );
  assert.match(client, /full-phase-curvature/u);
  assert.match(client, /shadowlessPresentation/u);
  // Level of detail: the far view draws its phase from the billboard atlas
  // and stops the row cache streaming; its marker is the shell's own sprite.
  assert.match(client, /materialCache\.suspend\(\)/u);
  assert.match(client, /publishBillboardMaterialFrame/u);
  assert.match(client,
    /NAVIGATION_MARKER_ATLAS_URL = "\/navigation\/planet-markers@2x\.webp"/u);
  assert.match(styles, /\[data-lod="billboard"\] \.mercury-scene/u);
  assert.doesNotMatch(styles, /mercury-hide-orbit \.mercury-orbit\b/u);
  assert.doesNotMatch(
    styles,
    /mercury-hide-shadows[^}]*mercury-material-root[^}]*visibility\s*:\s*hidden/iu,
  );
});
