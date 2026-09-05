import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps Neptune on retained DOM and prepared runtime transport", async () => {
  const [client, styles, presentation] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../runtime/presentation.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(presentation, /PREPARED_NEPTUNE_SCENE/u);
  assert.match(presentation, /plan\.fixedMaterialPlane/u);
  assert.doesNotMatch(client, /neptune-material-composite/u);
  assert.doesNotMatch(client, /mountPreparedOrbitGuide/u);
  assert.doesNotMatch(client, /createPreparedOrbitGuideInteraction/u);
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
    /\.\.\/\.\.\/\.\.\/platform\/object-runtime\.mjs/u);
  assert.doesNotMatch(client, /planets\/(?:saturn|mars)/u);
});
