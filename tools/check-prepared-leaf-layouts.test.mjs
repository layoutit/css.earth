import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from 'node:crypto';
import { resolve } from "node:path";
import { OBJECTS } from "../site/objects.mjs";
import { censusPreparedLeafLayouts, preparedStyleRecord } from "./check-prepared-leaf-layouts.mjs";
import { readPreparedPresentationModule } from "./check-prepared-presentation.mjs";
import { preparedObjectOverlay } from './test-prepared-object-overlay.mjs';

async function changedObject(id, mutate) {
  const { changed, readText } = await preparedObjectOverlay(id, mutate);
  const result = await censusPreparedLeafLayouts({ objects: OBJECTS.filter(object => object.id === id),
    readText });
  return { result, changed };
}
const firstTexture = plan => plan.tree.nodes.findIndex(node => node.attributes?.["data-prepared-projection"] === "single-leaf");
const omitProperties = (plan, node, names) => { node.properties = node.properties.filter(id => !names.includes(plan.tree.properties[id].name)); };

test("all existing objects supply complete reachable prepared texture layouts", async () => {
  const result = await censusPreparedLeafLayouts();
  assert.equal(result.complete, true, JSON.stringify(result.objects.flatMap(object => object.failures)));
  assert.equal(result.evidence, "validated-source-data");
  assert.deepEqual(result.objects.map(object => object.id), OBJECTS.map(object => object.id));
  assert.ok(result.objects.every(object => object.count > 0 && object.failures.length === 0 && /^[a-f0-9]{64}$/.test(object.sourceSha256)));
  assert.equal(result.objects.find(object => object.id === "saturn").completedByDescriptor, 162);
});
test("native raster triangle audit rejects missing dimensions, addresses, flattening and projective matrices", async () => {
  for (const [mutate, error] of [
    [node => { node.style = node.style.replace(/--polycss-atlas-width:[^;]+/, '--polycss-atlas-width:0px'); }, /explicit positive width/],
    [node => { node.style = node.style.replace(/background-position:[^;]+/, 'background-position:auto'); }, /texture address/],
    [node => { node.style += ';transform-style:flat'; }, /flattening/],
    [node => { node.style = node.style.replace(/matrix3d\(([^)]+)\)/, (_, text) => {
      const matrix = text.split(','); matrix[3] = '0.1'; return `matrix3d(${matrix.join(',')})`;
    }); }, /affine transform/],
  ]) {
    const { result } = await changedObject('phoebe', plan => mutate(plan.tree.nodes.find(node => node.tag === 'u')));
    assert.equal(result.complete, false);
    assert.ok(result.objects[0].failures.some(failure => error.test(failure.error)), JSON.stringify(result.objects[0].failures));
  }
});
test("removing Saturn's actual normalized layout assignments exposes all 162 original omissions", async () => {
  const { result, changed } = await changedObject("saturn", plan => {
    let count = 0;
    for (const node of plan.tree.nodes) {
      if (node.attributes?.["data-prepared-projection"] !== "single-leaf") continue;
      const parent = node;
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
      const texture = plan.tree.nodes[firstTexture(plan)], parent = texture;
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
    plan => { for (const node of plan.tree.nodes) if (node.attributes["data-prepared-projection"] === "single-leaf") delete node.attributes["data-prepared-projection"]; },
    plan => { plan.tree.nodes[firstTexture(plan)].properties.push(plan.tree.properties.length); },
    plan => { plan.tree.nodes.push({ parent: firstTexture(plan), tag: 'span', className: 'polycss-projective-texture', style: '', properties: [], attributes: {} }); },
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
    const parent = plan.tree.nodes[firstTexture(plan)];
    parent.properties.push(plan.tree.properties.length);
    plan.tree.properties.push({ name: "width", value: "auto", custom: false });
  });
  assert.equal(result.complete, false);
  assert.ok(result.objects[0].failures.some(failure => /explicit positive width/.test(failure.error)));
});

test('descriptor objects audit the transported JSON tree, including a source-matched invalid layout', async () => {
  const object = OBJECTS.find(object => object.id === 'mercury');
  const descriptorPath = resolve('src/planets/mercury/object.json');
  const sourcePath = resolve('src/planets/mercury/prepared/runtime.json');
  const payloadPath = resolve('src/planets/mercury/prepared/object.json');
  const descriptor = JSON.parse(await readFile(descriptorPath, 'utf8'));
  const payload = JSON.parse(await readFile(payloadPath, 'utf8'));
  const plan = JSON.parse(await readFile(sourcePath, 'utf8'));
  const first = await censusPreparedLeafLayouts({ objects: [object] });
  assert.equal(first.complete, true);
  assert.deepEqual(first.objects[0].modules, ['src/planets/mercury/prepared/object.json']);
  const parent = plan.tree.nodes[firstTexture(plan)];
  parent.properties.push(plan.tree.properties.length);
  plan.tree.properties.push({ name: 'width', value: 'auto', custom: false });
  payload.data.tree = plan.tree;
  const bytes = JSON.stringify(payload);
  descriptor.prepared.sha256 = createHash('sha256').update(bytes).digest('hex');
  const overlays = new Map([[descriptorPath, JSON.stringify(descriptor)], [payloadPath, bytes],
    [sourcePath, JSON.stringify(plan)]]);
  const changed = await censusPreparedLeafLayouts({ objects: [object], readText: path => overlays.get(path) ?? readFile(path, 'utf8') });
  assert.equal(changed.complete, false);
  assert.deepEqual(changed.objects[0].modules, ['src/planets/mercury/prepared/object.json']);
  assert.ok(changed.objects[0].failures.some(failure => /explicit positive width/.test(failure.error)));
});
