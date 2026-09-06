import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps Mercury runtime free of network, alternate renderers, and forbidden CSS", async () => {
  const [client, styles, presentation] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../runtime/preparedPresentation.mjs", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(client, /\bfetch\s*\(|XMLHttpRequest|WebSocket/iu);
  assert.doesNotMatch(client, /createElement\(["'](?:canvas|svg)["']\)/iu);
  assert.doesNotMatch(
    `${client}\n${styles}`,
    /--mercury-(?:camera-zoom-scale|disc-zoom)/u,
  );
  assert.match(client, /createObjectRuntime/u);
  // A perspective camera frames by dolly: the roots are never scaled (the
  // shared orbit places the body by a translate on the scene root and sets
  // the eye through the perspective origin), and the overlay follows the
  // projected silhouette the camera publishes.
  assert.doesNotMatch(presentation, /"kind":"shell-scale"|"kind":"zoom-property"/u);
  assert.doesNotMatch(presentation, /"name":"perspective"/u);
  assert.match(presentation, /"kind":"silhouette-fit"/u);
  assert.doesNotMatch(styles, /\.mercury-camera\s*\{[^}]*\b(?:scale|perspective)\s*:/u);
  assert.doesNotMatch(`${client}\n${styles}`, /dataset\.speed|data-speed/u);
  assert.doesNotMatch(
    styles,
    /(?:clip-path|(?:-webkit-)?mask|filter\s*:|gradient\(|mix-blend-mode)/iu,
  );
  assert.match(presentation, /full-phase-curvature/u);
  assert.match(presentation, /"resource":"shadowless"/u);
  // Level of detail: the far view draws its phase from the billboard atlas,
  // demanded instead of the lighting rows so residency stops streaming them;
  // its marker is the shell's own sprite.
  assert.match(presentation, /"farBank":"billboard"/u);
  assert.match(presentation, /"key":"lighting-billboard"/u);
  assert.match(presentation, /"heliocentricView":\{"plan":/u);
  assert.match(presentation, /"url":"\/navigation\/planet-markers@2x\.webp"/u);
  assert.match(presentation, /"source":"level-of-detail-stage"/u);
  assert.match(styles, /\[data-lod="billboard"\] \.mercury-scene/u);
  assert.doesNotMatch(styles, /mercury-hide-orbit \.mercury-orbit\b/u);
  assert.doesNotMatch(
    styles,
    /mercury-hide-shadows[^}]*mercury-material-root[^}]*visibility\s*:\s*hidden/iu,
  );
});
