import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("the retained sky stylesheet keeps no private Sun or catalogue stars", async () => {
  const css = await readFile(new URL("./cubic-sky.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /object-directional-sun|object-cubic-sky-star/u);
  assert.doesNotMatch(css,
    /filter\s*:|mask(?:-image)?\s*:|clip-path\s*:|mix-blend-mode\s*:|gradient\(/u);
});
