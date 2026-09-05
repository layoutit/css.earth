import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { OBJECTS } from "../site/objects.mjs";
import { censusPreparedLeafLayouts, preparedStyleRecord } from "./check-prepared-leaf-layouts.mjs";
import { readPreparedPresentationModule } from "./check-prepared-presentation.mjs";

async function changedObject(id, mutate) {
  const file = resolve(`src/planets/${id}/runtime/preparedPresentation.mjs`);
  const plan = readPreparedPresentationModule(await readFile(file, "utf8"));
  const changed = mutate(plan);
  const source = `export const PREPARED_PRESENTATION = ${JSON.stringify(plan)};`;
  const result = await censusPreparedLeafLayouts({ objects: OBJECTS.filter(object => object.id === id),
    readText: path => path === file ? source : readFile(path, "utf8") });
  return { result, changed };
}
const firstTexture = plan => plan.tree.nodes.findIndex(node => node.className?.split(/\s+/).includes("polycss-projective-texture"));
const omitProperties = (plan, node, names) => { node.properties = node.properties.filter(id => !names.includes(plan.tree.properties[id].name)); };

test("all existing objects supply complete reachable normalized projective layouts", async () => {
  const result = await censusPreparedLeafLayouts();
  assert.equal(result.complete, true, JSON.stringify(result.objects.flatMap(object => object.failures)));
  assert.equal(result.evidence, "validated-source-data");
  assert.deepEqual(result.objects.map(object => object.id), OBJECTS.map(object => object.id));
  assert.ok(result.objects.every(object => object.count > 0 && object.failures.length === 0 && /^[a-f0-9]{64}$/.test(object.sourceSha256)));
  assert.equal(result.objects.find(object => object.id === "saturn").completedByDescriptor, 162);
});
test("removing Saturn's actual normalized layout assignments exposes all 162 original omissions", async () => {
  const { result, changed } = await changedObject("saturn", plan => {
    let count = 0;
    for (const node of plan.tree.nodes) {
      if (!node.className?.split(/\s+/).includes("polycss-projective-texture")) continue;
      const parent = plan.tree.nodes[node.parent];
      if (/(?:^|;)(?:width|--polycss-atlas-width):/.test(parent.style)) continue;
      omitProperties(plan, parent, ["width", "height"]);
      omitProperties(plan, node, ["backgroundSize"]);
      count++;
    }
    return count;
  });
  assert.equal(changed, 162);
  assert.equal(result.complete, false);
  assert.equal(result.objects[0].failures.length, 162);
  assert.ok(result.objects[0].failures.every(failure => /explicit positive width/.test(failure.error)));
});
test("normalized leaf audit rejects missing atlas extent, missing texture address and flattened carrier", async () => {
  for (const [property, error] of [["--polycss-atlas-width", /explicit positive width/], ["backgroundSize", /explicit backgroundSize/], ["transformStyle", /flattening/]]) {
    const { result } = await changedObject("moon", plan => {
      const texture = plan.tree.nodes[firstTexture(plan)], parent = plan.tree.nodes[texture.parent];
      const node = property === "backgroundSize" ? texture : parent;
      const css = property === "backgroundSize" ? "background-size" : property === "transformStyle" ? "transform-style" : property;
      node.style = node.style.split(";").filter(declaration => !declaration.trim().startsWith(`${css}:`)).join(";");
      omitProperties(plan, node, [property]);
    });
    assert.equal(result.complete, false);
    assert.ok(result.objects[0].failures.some(failure => error.test(failure.error)), JSON.stringify(result.objects[0].failures));
  }
});
test("normalized leaf audit rejects empty projective coverage and undeclared dictionary references", async () => {
  for (const mutate of [
    plan => { for (const node of plan.tree.nodes) if (node.className === "polycss-projective-texture") node.className = null; },
    plan => { plan.tree.nodes[firstTexture(plan)].properties.push(plan.tree.properties.length); },
  ]) {
    const { result } = await changedObject("moon", mutate);
    assert.equal(result.complete, false);
    assert.ok(result.objects[0].failures.length > 0);
  }
});
test("retained property references preserve last-write order instead of checking an earlier valid value", async () => {
  assert.equal(preparedStyleRecord("width:64px", [{ name: "width", value: "128px", custom: false },
    { name: "width", value: "", custom: false }]).width, "");
  const { result } = await changedObject("mars", plan => {
    const parent = plan.tree.nodes[plan.tree.nodes[firstTexture(plan)].parent];
    parent.properties.push(plan.tree.properties.length);
    plan.tree.properties.push({ name: "width", value: "auto", custom: false });
  });
  assert.equal(result.complete, false);
  assert.ok(result.objects[0].failures.some(failure => /explicit positive width/.test(failure.error)));
});
