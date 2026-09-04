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
  assert.match(client, /cameraRoot\.style\.scale/u);
  assert.match(client, /materialRoot\.style\.scale/u);
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
  assert.doesNotMatch(
    styles,
    /mercury-hide-shadows[^}]*mercury-material-root[^}]*visibility\s*:\s*hidden/iu,
  );
});
