import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from "node:fs/promises";
import { createHash } from 'node:crypto';
import { resolve } from "node:path";
import { SCENE_OBJECTS } from "../../site/objects.mts";
import { censusPreparedLeafLayouts, preparedStyleRecord } from "./check-prepared-leaf-layouts.mts";
import { readPreparedPresentationModule } from "./check-prepared-presentation.mts";
import { preparedObjectOverlay } from '../contract/test-prepared-object-overlay.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../sources/source-values.mts';

type PreparedProperty = { name: string; value: string; custom: boolean };
type PreparedNode = { parent: number; tag: string; style: string; properties: number[]; attributes: Record<string, string> };
type PreparedPlan = Record<string, unknown> & { tree: { nodes: PreparedNode[]; properties: PreparedProperty[] } };
const requireBoolean = (value: unknown, label: string): boolean => {
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be a boolean.`);
  return value;
};

const requirePreparedPlan = (value: unknown, label: string): PreparedPlan => {
  const plan = requireRecord(value, label), tree = requireRecord(plan.tree, `${label}.tree`);
  const properties = requireArray(tree.properties, `${label}.tree.properties`).map((value, index) => {
    const property = requireRecord(value, `${label}.tree.properties[${index}]`);
    return { name: requireString(property.name, `${label}.tree.properties[${index}].name`), value: requireString(property.value, `${label}.tree.properties[${index}].value`), custom: requireBoolean(property.custom, `${label}.tree.properties[${index}].custom`) };
  });
  const nodes = requireArray(tree.nodes, `${label}.tree.nodes`).map((value, index) => {
    const node = requireRecord(value, `${label}.tree.nodes[${index}]`);
    const attributes = Object.fromEntries(Object.entries(requireRecord(node.attributes, `${label}.tree.nodes[${index}].attributes`)).map(([key, entry]) => [key, requireString(entry, `${label}.tree.nodes[${index}].attributes.${key}`)]));
    return { parent: requireFiniteNumber(node.parent, `${label}.tree.nodes[${index}].parent`), tag: requireString(node.tag, `${label}.tree.nodes[${index}].tag`), style: requireString(node.style, `${label}.tree.nodes[${index}].style`), properties: requireArray(node.properties, `${label}.tree.nodes[${index}].properties`).map((entry, propertyIndex) => requireFiniteNumber(entry, `${label}.tree.nodes[${index}].properties[${propertyIndex}]`)), attributes };
  });
  return { ...plan, tree: { ...tree, nodes, properties } };
};
const requireSceneObject = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new TypeError(`${label} is missing.`);
  return value;
};

async function changedObject(id: string, mutate: (plan: PreparedPlan) => unknown) {
  const { changed, readText } = await preparedObjectOverlay(id, runtime => {
    const label = `${id} prepared runtime`, plan = requirePreparedPlan(runtime, label), result = mutate(plan);
    // The validated plan holds copies; write the mutated fields back so the census reads them.
    const tree = requireRecord(runtime.tree, `${label}.tree`);
    for (const key of ["nodes", "properties"] as const) {
      const original = requireArray(tree[key], `${label}.tree.${key}`);
      tree[key] = plan.tree[key].map((entry, index) => index < original.length ? Object.assign(requireRecord(original[index], `${label}.tree.${key}[${index}]`), entry) : entry);
    }
    return result;
  });
  const result = await censusPreparedLeafLayouts({ objects: SCENE_OBJECTS.filter(object => object.id === id),
    readText });
  return { result, changed };
}
const firstTexture = (plan: PreparedPlan): number => plan.tree.nodes.findIndex(node => node.attributes["data-prepared-projection"] === "single-leaf");
const omitProperties = (plan: PreparedPlan, node: PreparedNode, names: readonly string[]): void => { node.properties = node.properties.filter(id => !names.includes(requireSceneObject(plan.tree.properties[id], `property ${id}`).name)); };

test("all existing objects supply complete reachable prepared texture layouts", async () => {
  const result = await censusPreparedLeafLayouts();
  assert.equal(result.complete, true, JSON.stringify(result.objects.flatMap(object => object.failures)));
  assert.equal(result.evidence, "validated-source-data");
  assert.deepEqual(result.objects.map(object => object.id), SCENE_OBJECTS.map(object => object.id));
  assert.ok(result.objects.every(object => object.count > 0 && object.failures.length === 0 && object.sourceSha256 !== null && /^[a-f0-9]{64}$/.test(object.sourceSha256)));
  assert.equal(requireSceneObject(result.objects.find(object => object.id === "saturn"), "Saturn census").completedByDescriptor, 162);
});
test("projective leaves accept only their prepared seam outset after the matrix", async () => {
  const { result } = await changedObject("venus", plan => {
    const node = requireSceneObject(plan.tree.nodes[firstTexture(plan)], "Venus surface leaf");
    const id = node.properties.find(id => plan.tree.properties[id]?.name === "transform");
    const property = requireSceneObject(id === undefined ? undefined : plan.tree.properties[id], "Venus leaf transform");
    assert.match(property.value, / translate\(50%, 50%\) scale\(calc\(1 \+ var\(--surface-seam-outset, 0\)/u);
    property.value = property.value.replace(/ translate\(50%, 50%\).*$/u, " scale(1.02)");
  });
  assert.equal(result.complete, false);
  assert.match(JSON.stringify(result.objects.flatMap(object => object.failures)), /carrier transform is missing or invalid/);
});
test("native raster triangle audit rejects missing dimensions, addresses, flattening and projective matrices", async () => {
  const mutations: readonly [(node: PreparedNode) => void, RegExp][] = [
    [node => { node.style = node.style.replace(/--polycss-atlas-width:[^;]+/, '--polycss-atlas-width:0px'); }, /explicit positive width/],
    [node => { node.style = node.style.replace(/background-position:[^;]+/, 'background-position:auto'); }, /texture address/],
    [node => { node.style += ';transform-style:flat'; }, /flattening/],
    [node => { node.style = node.style.replace(/matrix3d\(([^)]+)\)/, (_: string, text: string) => {
      const matrix = text.split(','); matrix[3] = '0.1'; return `matrix3d(${matrix.join(',')})`;
    }); }, /affine transform/],
  ];
  for (const [mutate, error] of mutations) {
    const { result } = await changedObject('phoebe', plan => mutate(requireSceneObject(plan.tree.nodes.find(node => node.tag === 'u'), 'raster texture')));
    assert.equal(result.complete, false);
    assert.ok(result.objects[0].failures.some(failure => error.test(failure.error ?? "")), JSON.stringify(result.objects[0].failures));
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
  assert.ok(result.objects[0].failures.every(failure => /explicit positive width/.test(failure.error ?? "")));
});
test("normalized leaf audit rejects missing atlas extent, missing texture address and flattened carrier", async () => {
  const properties: readonly [string, RegExp][] = [["--polycss-atlas-width", /explicit positive width/], ["backgroundSize", /explicit backgroundSize/], ["transformStyle", /flattening/]];
  for (const [property, error] of properties) {
    const { result } = await changedObject("moon", plan => {
      const texture = requireSceneObject(plan.tree.nodes[firstTexture(plan)], 'prepared texture'), parent = texture;
      const node = property === "backgroundSize" ? texture : parent;
      const css = property === "backgroundSize" ? "background-size" : property === "transformStyle" ? "transform-style" : property;
      node.style = node.style.split(";").filter(declaration => !declaration.trim().startsWith(`${css}:`)).join(";");
      omitProperties(plan, node, [property]);
    });
    assert.equal(result.complete, false);
    assert.ok(result.objects[0].failures.some(failure => error.test(failure.error ?? "")), JSON.stringify(result.objects[0].failures));
  }
});
test("normalized leaf audit rejects empty projective coverage and undeclared dictionary references", async () => {
  for (const mutate of [
    (plan: PreparedPlan) => { for (const node of plan.tree.nodes) if (node.attributes["data-prepared-projection"] === "single-leaf") delete node.attributes["data-prepared-projection"]; },
    (plan: PreparedPlan) => { requireSceneObject(plan.tree.nodes[firstTexture(plan)], 'prepared texture').properties.push(plan.tree.properties.length); },
    (plan: PreparedPlan) => { plan.tree.nodes.push({ parent: firstTexture(plan), tag: 'span', style: '', properties: [], attributes: {} }); },
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
  assert.ok(result.objects[0].failures.some(failure => /explicit positive width/.test(failure.error ?? "")));
});

test('descriptor objects audit the transported JSON tree, including a source-matched invalid layout', async () => {
  const object = requireSceneObject(SCENE_OBJECTS.find(object => object.id === 'mercury'), 'Mercury object');
  const descriptorPath = resolve('src/objects/mercury/object.json');
  const sourcePath = resolve('src/objects/mercury/prepared/runtime.json');
  const payloadPath = resolve('src/objects/mercury/prepared/object.json');
  const descriptor = requireRecord(JSON.parse(await readFile(descriptorPath, 'utf8')), 'Mercury descriptor');
  const payload = requireRecord(JSON.parse(await readFile(payloadPath, 'utf8')), 'Mercury payload');
  const plan = requirePreparedPlan(JSON.parse(await readFile(sourcePath, 'utf8')), 'Mercury runtime');
  const first = await censusPreparedLeafLayouts({ objects: [object] });
  assert.equal(first.complete, true);
  assert.deepEqual(first.objects[0].modules, ['src/objects/mercury/prepared/object.json']);
  const parent = requireSceneObject(plan.tree.nodes[firstTexture(plan)], 'Mercury texture');
  parent.properties.push(plan.tree.properties.length);
  plan.tree.properties.push({ name: 'width', value: 'auto', custom: false });
  requireRecord(payload.data, 'Mercury payload.data').tree = plan.tree;
  const bytes = JSON.stringify(payload);
  requireRecord(descriptor.prepared, 'Mercury descriptor.prepared').sha256 = createHash('sha256').update(bytes).digest('hex');
  const overlays = new Map([[descriptorPath, JSON.stringify(descriptor)], [payloadPath, bytes],
    [sourcePath, JSON.stringify(plan)]]);
  const changed = await censusPreparedLeafLayouts({ objects: [object], readText: path => overlays.get(path) ?? readFile(path, 'utf8') });
  assert.equal(changed.complete, false);
  assert.deepEqual(changed.objects[0].modules, ['src/objects/mercury/prepared/object.json']);
  assert.ok(changed.objects[0].failures.some(failure => /explicit positive width/.test(failure.error ?? "")));
});
