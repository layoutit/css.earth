import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const hash = value => createHash("sha256").update(value).digest("hex");
const pixelLength = /^\d+(?:\.\d+)?px$/;
function declarations(stylesheet, selector) {
  const matches = [...stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(match => match[1].trim().split(/\s*,\s*/).includes(selector));
  assert.ok(matches.length, `Checked layout selector must exist: ${selector}`);
  return Object.assign({}, ...matches.map(match => Object.fromEntries(match[2].split(";").filter(value => value.includes(":"))
    .map(value => { const colon = value.indexOf(":"); return [value.slice(0, colon).trim(), value.slice(colon + 1).trim()]; }))));
}

export function prepareSaturnLeafLayouts(sceneModule, stylesheet) {
  const literal = sceneModule.match(/export const PREPARED_SATURN_RUNTIME_SCENE = (\{.*\});\s*$/s);
  assert.ok(literal, "Read the checked prepared runtime scene");
  const scene = JSON.parse(literal[1]);
  const common = declarations(stylesheet, ".polycss-scene s");
  const width = common.width.match(/^var\(--polycss-atlas-width,\s*([^)]*)\)$/)?.[1];
  const height = common.height.match(/^var\(--polycss-atlas-height,\s*([^)]*)\)$/)?.[1];
  assert.ok(pixelLength.test(width) && pixelLength.test(height), "Prepared leaf dimensions require checked positive CSS pixel defaults");
  const classes = {};
  for (const shell of scene.interior.shells) {
    const selector = `.${shell.className} > s:not(.saturn-interior-pole)`;
    const material = declarations(stylesheet, selector);
    assert.ok(material["background-size"].split(/\s+/).every(value => pixelLength.test(value)));
    let completedLeafCount = 0;
    for (const leaf of shell.leaves) {
      if (!(leaf.projectiveTextureLayer?.rasterScale > 1)) continue;
      const style = Object.fromEntries(leaf.style.split(";").filter(value => value.includes(":"))
        .map(value => { const colon = value.indexOf(":"); return [value.slice(0, colon), value.slice(colon + 1)]; }));
      if ((style.width || style["--polycss-atlas-width"]) && (style.height || style["--polycss-atlas-height"]) && style["background-size"]) continue;
      assert.equal(leaf.className?.includes("saturn-interior-pole") ?? false, false, "Polar leaves must carry their own layout");
      completedLeafCount++;
    }
    classes[shell.className] = { width, height, backgroundSize: material["background-size"], selector, completedLeafCount };
  }
  return { schema: "cssearth-prepared-leaf-layouts@1", sources: {
    "runtime/preparedSceneRuntime.mjs": hash(sceneModule), "runtime/styles.css": hash(stylesheet),
  }, classes };
}
export function serializeSaturnLeafLayouts(layouts) {
  return `// Prepared from the checked scene and stylesheet; regenerate with tools/prepare-leaf-layouts.mjs.\nexport const PREPARED_SATURN_LEAF_LAYOUTS = Object.freeze(${JSON.stringify(layouts)});\n`;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [scene, stylesheet] = await Promise.all([
    readFile(new URL("../runtime/preparedSceneRuntime.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
  ]);
  await writeFile(new URL("../runtime/leaf-layouts.mjs", import.meta.url), serializeSaturnLeafLayouts(prepareSaturnLeafLayouts(scene, stylesheet)));
}
