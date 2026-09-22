import { fixtureRecord, required } from "../contract/test-values.mts";
import { requireArray, requireFiniteNumber } from "../sources/source-values.mts";
import { requireObjectRuntimeDefinition } from "../contract/object-runtime-contract.mts";
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { preparedObjectOverlay } from '../contract/test-prepared-object-overlay.mts';
import { readPreparedPresentationModule, readPreparedJsonExports, requirePreparedDefinitionSource,
  requirePreparedControlSource, auditPreparedPresentations } from "./check-prepared-presentation.mts";
const definition = `import { PREPARED_OBJECT_RUNTIME_SCHEMA } from "../../../../platform/prepared-schema.mts";
import { objectControls } from "../../site/control-content.mjs";
import { PREPARED_PRESENTATION } from "../preparedPresentation.mjs";
export const runtimeDefinition = Object.freeze({ ...PREPARED_PRESENTATION, schema: PREPARED_OBJECT_RUNTIME_SCHEMA, id: "moon", controls: objectControls });`;
test("prepared modules are parsed as JSON, without importing executable payloads", () => {
  assert.deepEqual(readPreparedPresentationModule('export const PREPARED_PRESENTATION = Object.freeze({"tree":[]});'), { tree: [] });
  for (const source of [
    'export const PREPARED_PRESENTATION = Object.freeze({run(){}});',
    'export const PREPARED_PRESENTATION = Object.freeze(globalThis.payload());',
    'import "../private.mjs"; export const PREPARED_PRESENTATION = Object.freeze({});',
  ]) assert.throws(() => readPreparedPresentationModule(source));
});
test("runtime definitions only bind static prepared data and actual controls", () => {
  assert.equal(requirePreparedDefinitionSource(definition), "moon");
  for (const source of [
    definition.replace('id: "moon"', 'id: name()'),
    definition.replace('controls: objectControls', 'controls: objectControls, createPresentation() {}'),
    definition.replace('./preparedPresentation.mjs', './private.mjs'),
    definition + '\nfunction publishFrame() {}',
    definition.replace('...PREPARED_PRESENTATION', '...buildPlan()'),
    definition.replace('Object.freeze', 'Object[freeze]'),
    definition.replace('export const', 'export let'),
    definition.replace('id: "moon"', '["id"]: "moon"'),
    definition.replace('{ objectControls }', '{ objectControls, privatePublisher }'),
    definition.replace('{ PREPARED_PRESENTATION }', '{ PREPARED_PRESENTATION, Object }'),
  ]) assert.throws(() => requirePreparedDefinitionSource(source));
});
test("multiple prepared literal exports remain data, while a trailing helper is rejected", () => {
  assert.deepEqual(readPreparedJsonExports('export const A={"a":1};\nexport const B=Object.freeze([2]);'), [
    { name: "A", value: { a: 1 } }, { name: "B", value: [2] },
  ]);
  assert.throws(() => readPreparedJsonExports('export const A={};\nfunction hidden() {}'), /executable/);
});
test("control content permits prepared label projection and rejects callbacks, getters and effects", () => {
  const control = `import { PREPARED_LENSES } from '../../runtime/preparedLenses.mjs';
export const objectControls = Object.freeze({ lenses: PREPARED_LENSES.controls.map(lens => ({ id: lens.id, label: lens.label })), settings: null });`;
  assert.deepEqual(requirePreparedControlSource(control), ["../runtime/preparedLenses.mjs"]);
  for (const source of [
    control.replace('label: lens.label', 'label: load(lens.id)'),
    control.replace('label: lens.label', 'get label() { return lens.label; }'),
    control.replace('label: lens.label', 'label: (() => { node.style.opacity = 0; })()'),
    control.replace('lens =>', 'async lens =>'),
    control.replace('Object.freeze', 'Object.assign'),
    control + '\nglobalThis.publisher = node => node.style.transform = "none";',
  ]) assert.throws(() => requirePreparedControlSource(source), /static prepared content/);
});

const root = process.cwd(), moonPath = `${root}/src/objects/moon/prepared/runtime.json`;
const moonSource = await readFile(moonPath, "utf8");
const moonPlan = requireObjectRuntimeDefinition(JSON.parse(moonSource));
const writes=(plan: unknown)=>requireArray(fixtureRecord(plan,"variants",0).writes);
const mutations: [string,(plan:Record<string,unknown>)=>unknown,RegExp][] = [
  ["second camera", plan => { const tree=fixtureRecord(plan,"tree"),nodes=requireArray(tree.nodes);nodes.push({...fixtureRecord(nodes[requireFiniteNumber(tree.camera)]),parent:-1}); }, /exactly one camera/],
  ["undeclared texture resource", plan => writes(plan).push({kind:"texture",target:2,name:"backgroundImage",resource:"unprepared",quoted:true}), /undeclared resource/],
  ["undeclared native node", plan => fixtureRecord(plan,"viewBindings",0).target=requireArray(fixtureRecord(plan,"tree").nodes).length, /undeclared node/],
  ["selection camera write", plan => writes(plan).push({kind:"style",target:fixtureRecord(plan,"tree").camera,name:"opacity",value:"0"}), /camera\/scene/],
  ["unknown execution slot", plan => plan.publish={executor:"private"}, /unsupported plan/],
];
for (const [name, mutate, expected] of mutations) test(`source audit rejects ${name} in the actual Moon record`, async () => {
  const { readText } = await preparedObjectOverlay('moon', mutate);
  await assert.rejects(auditPreparedPresentations({ root, objects: [{ id: "moon" }], readText }), expected);
});
test("adapter differences report actual data counts and source hashes without fabricating observed owners", async () => {
  const report = await auditPreparedPresentations({ root, objects: [{ id: "moon" }] });
  const entry = report.entries[0];
  assert.equal(entry.nodes, moonPlan.tree.nodes.length);
  assert.equal(entry.cameraNodes, moonPlan.tree.nodes.filter((node) => /(?:^|\s)polycss-camera(?:\s|$)/.test(node.className ?? "")).length);
  assert.equal(entry.observedOwners, null); assert.equal(entry.evidence, "validated-authored-json");
  assert.match(required(entry.source.runtimeSha256), /^[a-f0-9]{64}$/);
});

test('authored JSON transport cannot escape its descriptor package', async () => {
  const descriptorPath = `${root}/src/objects/mercury/object.json`;
  const descriptor = JSON.parse(await readFile(descriptorPath, 'utf8'));
  for (const url of ['../venus/prepared/object.json', 'prepared/../prepared/object.json']) {
    const changed = JSON.stringify({ ...descriptor, prepared: { ...descriptor.prepared, url } });
    await assert.rejects(auditPreparedPresentations({ root, objects: [{ id: 'mercury' }],
      readText: path => path === descriptorPath ? changed : readFile(path, 'utf8') }), /owning object prepared directory/);
  }
});
