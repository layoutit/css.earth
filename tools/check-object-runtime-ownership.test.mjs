import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { OBJECTS } from "../site/objects.mjs";
import { auditObjectRuntimeOwnership, inspectObjectRuntimeModule } from "./check-object-runtime-ownership.mjs";
import { objectControls } from "../src/planets/moon/site/control-content.mjs";
import { requireObjectRuntimeDefinition } from "../src/platform/object-runtime-contract.mjs";
import { PREPARED_OBJECT_RUNTIME_SCHEMA } from "../src/platform/prepared-presentation-contract.mjs";
import { readPreparedJsonModule } from "./check-prepared-presentation.mjs";

const root = "/ownership-fixture", prefix = "src/planets/moon/runtime/";
const client = prefix + "client.mjs", definitionPath = prefix + "definition.mjs";
const binding = `import { createObjectRuntime as bind } from '../../../platform/object-runtime.mjs';
import { runtimeDefinition as definition } from './definition.mjs';
export const mountMoonClient = bind(definition);`;
const definition = await readFile(new URL("../src/planets/moon/runtime/definition.mjs", import.meta.url), "utf8");
const prepared = await readFile(new URL("../src/planets/moon/runtime/preparedPresentation.mjs", import.meta.url), "utf8");
const registrySource = await readFile(new URL("../site/objects.mjs", import.meta.url), "utf8");
const objectSchema = await readFile(new URL("../site/object-schema.mjs", import.meta.url), "utf8");
const shared = `import { createPolyCamera } from '@layoutit/polycss';
export function createObjectRuntime(definition) { return createPolyCamera(definition); }`;
function fixture(extra = {}, definitionTail = "") {
  const files = { [client]: binding, [definitionPath]: definition + definitionTail,
    "site/objects.mjs": registrySource, "site/object-schema.mjs": objectSchema,
    "site/layouts/PlanetLayout.astro": "<main><slot /></main>",
    "site/components/PlanetShell.astro": "<aside><slot /></aside>",
    [prefix + "preparedPresentation.mjs"]: prepared,
    "src/planets/moon/site/control-content.mjs": `export const objectControls = ${JSON.stringify(objectControls)};`,
    "src/platform/prepared-presentation-contract.mjs": `export const PREPARED_OBJECT_RUNTIME_SCHEMA = "cssearth-object-runtime@2";`,
    "src/platform/object-runtime.mjs": shared, ...extra };
  return { root, objects: [{ id: "moon" }],
    verifyDefinition(object, plan) { requireObjectRuntimeDefinition({ ...plan, schema: PREPARED_OBJECT_RUNTIME_SCHEMA, id: object.id, controls: objectControls }); },
    listRuntimeFiles: async () => Object.keys(files).filter(file => file.startsWith(prefix)).map(file => file.slice(prefix.length)),
    readText: async path => { const source = files[path.slice(root.length + 1)]; assert.notEqual(source, undefined, path); return source; } };
}

test("accepts one bound factory and the real existing Moon plan; static proof never claims native observations", async () => {
  const report = await auditObjectRuntimeOwnership(fixture());
  assert.equal(report.complete, true); assert.equal(report.entries[0].factoryCalls, 1);
  assert.equal(report.entries[0].schema, PREPARED_OBJECT_RUNTIME_SCHEMA);
  assert.equal(report.cameraFactorySites.length, 1);
  assert.equal(report.nativeOwnership.status, "UNPROVEN");
  assert.match(report.sourceHashes[prefix + "preparedPresentation.mjs"], /^[a-f0-9]{64}$/);
  assert.match(report.sourceHashes["site/objects.mjs"], /^[a-f0-9]{64}$/);
  assert.deepEqual(report.entries[0].entry, { file: client, exported: "mountMoonClient", registry: "site/objects.mjs" });
});
test("follows imported helpers instead of trusting a thin client", async () => {
  const options = fixture({ [prefix + "hidden.mjs"]: "export function hidden() { return new Image(); }" },
    "\nimport { hidden } from './hidden.mjs'; hidden();");
  await assert.rejects(auditObjectRuntimeOwnership(options), /hidden.mjs.*Image/);
  const report = await auditObjectRuntimeOwnership({ ...options, strict: false });
  assert.ok(report.entries[0].closure.includes(prefix + "hidden.mjs"));
  assert.equal(report.entries[0].migrated, false);
});
test("private synchronous material publication is rejected even when its file is unreferenced", async () => {
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [prefix + "presentation.mjs"]:
    "export function publish(node, value) { node.style.backgroundPosition = value; }" })), /Unreferenced private runtime executor/);
  const facts = inspectObjectRuntimeModule("node.style.backgroundPosition = prepared.position;", prefix + "presentation.mjs");
  assert.ok(facts.violations.some(item => /native DOM or material/.test(item.reason)));
});

for (const source of [
  "import { createLatestSelection as renamed } from '../../../platform/latest-selection.mjs'; renamed({});",
  "import * as runtime from '../../../platform/latest-selection.mjs'; runtime.createLatestSelection({});",
  "node.addEventListener('click', handler);", "function hidden() { return Promise.resolve({}); }",
  "function hidden() { return work.then(commit); }", "const handle = setTimeout(pump, 120);",
  "animation.playbackRate = 2;", "animation.currentTime = 0;", "animation.play();",
  "async function hidden() { await loader(); }", "import('./loader.mjs');", "new Function('return 1')();",
  "createPolyCamera({});", "node.animate([], {});", "globalThis.secret = node;",
]) test(`rejects a private runtime owner: ${source.slice(0, 65)}`, () => {
  assert.ok(inspectObjectRuntimeModule(source, prefix + "presentation.mjs").violations.length > 0);
});

test("rejects extra entry code, side-effect imports, and duplicate factories", async () => {
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [client]: binding + " export function legacy() {}" })), /imports and one bound/);
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [client]: binding + " bind(definition);" })), /found 2/);
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [client]: binding + " import './extra.css';" })), /Unclosed object runtime import/);
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [definitionPath]: "export const runtimeDefinition = {};" })), /actual control-content/);
});

for (const dispatch of [
  "if (definition.id === 'saturn') return;", "const id = 'moon'; if (definition.id === id) return;",
  "const ids=['moon','saturn']; if(ids.includes(definition.id)) return;",
  "const ids=new Set(['moon','saturn']); if(ids.has(definition.id)) return;",
  "switch (definition.id) {case 'moon': return;}", "const table={moon:1,saturn:2}; return table[definition.id];",
]) test(`shared owners reject object-ID dispatch: ${dispatch.slice(0, 50)}`, async () => {
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ "src/platform/object-runtime.mjs": shared + `\nfunction hidden(definition) { ${dispatch} }` })), /object-ID dispatch/);
});
test("shared owners reject private packages, fixed asset namespaces, v1 hooks and an extra native camera", async () => {
  for (const [source, expected] of [
    [shared + "\nimport { runtimeDefinition } from '../planets/moon/runtime/definition.mjs';", /Shared runtime imports an object package/],
    [shared + '\nconst url = "/scenes/earth/wmts-data.pack";', /object-specific asset namespace/],
    [shared + '\nconst valid = /^\\/scenes\\/earth\\/wmts/;', /object-specific asset namespace/],
    [shared + '\nfunction hidden(value) { return value.createPresentation(); }', /Legacy object callbacks/],
    [shared + '\ncreatePolyCamera({});', /native camera factory site; found 2/],
    [shared + '\nimport("./hidden.mjs");', /Dynamic runtime imports/],
  ]) await assert.rejects(auditObjectRuntimeOwnership(fixture({ "src/platform/object-runtime.mjs": source })), expected);
});
test("object controls cannot hide an executor behind label projection", async () => {
  const controlsPath = "src/planets/moon/site/control-content.mjs";
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [controlsPath]:
    `export const objectControls = ${JSON.stringify(objectControls)};\nconst action = node => node.style.transform = 'none';` })), /static prepared content/);
});
test("common shell ownership follows actual Astro imports, template expressions, and client scripts", async () => {
  const shell = "site/components/PlanetShell.astro", helper = "site/shared-content.mjs";
  const files = { [shell]: `---
import { label } from '../shared-content.mjs';
interface Props { title: string }
---
<aside>{label}</aside>
<script>import '../shared-client.mjs';</script>`,
    [helper]: "export const label = freeze('Details'); function freeze(value) { return Object.freeze(value); }",
    "site/shared-client.mjs": "export function bind() {}" };
  const report = await auditObjectRuntimeOwnership(fixture(files));
  for (const file of Object.keys(files)) {
    assert.ok(report.sharedClosure.includes(file), file);
    assert.match(report.sourceHashes[file], /^[a-f0-9]{64}$/);
  }
  for (const [changed, expected] of [
    [{ [helper]: "export const label = 'Details'; if (object.id === 'moon') act();" }, /shared-content.mjs.*object-ID dispatch/],
    [{ "site/shared-client.mjs": "import { createPolyCamera } from '@layoutit/polycss'; createPolyCamera({});" }, /native camera factory site; found 2/],
    [{ [shell]: files[shell].replace("{label}", "{object.id === 'moon' ? label : ''}") }, /PlanetShell.astro.*object-ID dispatch/],
    [{ [shell]: files[shell].replace("import '../shared-client.mjs';", "import('../shared-client.mjs');") }, /PlanetShell.astro.*Dynamic runtime imports/],
    [{ [helper]: "export { data } from '../src/planets/moon/site/generated.mjs';" }, /Shared runtime imports an object package/],
    [{ [shell]: "<script>const broken = ;</script>" }, /Invalid runtime source/],
  ]) await assert.rejects(auditObjectRuntimeOwnership(fixture({ ...files, ...changed })), expected);
});
test("literal navigation content is allowed only through the shell closure, not runtime dispatch", async () => {
  const file = "site/navigation-content.mjs";
  const content = `export const MARKERS = Object.freeze(${JSON.stringify({moon:{label:"Moon"},saturn:{label:"Saturn"}})});`;
  const files = { [file]: content,
    "site/components/PlanetShell.astro": "---\nimport { MARKERS } from '../navigation-content.mjs';\n---\n<nav>{Object.values(MARKERS).map(marker => marker.label)}</nav>" };
  assert.equal((await auditObjectRuntimeOwnership(fixture(files))).complete, true);
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ ...files,
    "src/platform/object-runtime.mjs": shared + "\nimport { MARKERS } from '../../site/navigation-content.mjs';" })), /navigation-content.mjs.*object-ID dispatch/);
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ ...files, [file]: content + "\nexport function dispatch(id) { return MARKERS[id](); }" })), /navigation-content.mjs.*object-ID dispatch/);
});
test("malicious generated code is rejected without importing it", async () => {
  const key = "__executedPreparedOwnershipPayload"; delete globalThis[key];
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [prefix + "preparedPresentation.mjs"]:
    prepared + `\nglobalThis.${key} = true;` })), /serialized|JSON/);
  assert.equal(globalThis[key], undefined);
});
test("source overlays validate changed camera and material bindings, not cached imported definitions", async () => {
  const record = JSON.parse(prepared.slice(prepared.indexOf("Object.freeze(") + 14, prepared.lastIndexOf(");")));
  record.tree.nodes.push({ ...record.tree.nodes[record.tree.camera], parent: -1 });
  const changed = `export const PREPARED_PRESENTATION = Object.freeze(${JSON.stringify(record)});`;
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [prefix + "preparedPresentation.mjs"]: changed })), /exactly one camera/);
});
test("a content validation failure cannot be labeled migrated", async () => {
  await assert.rejects(auditObjectRuntimeOwnership({ ...fixture(), verifyDefinition() { throw new Error("actual content mismatch"); } }), /actual content mismatch/);
});

test("the actual Moon registry import must point to the audited client and return its bound export", async () => {
  for (const source of [
    registrySource.replace("../src/planets/moon/runtime/client.mjs", "../src/planets/moon/site/private-loader.mjs"),
    registrySource.replace("return mountMoonClient;", "return () => mountMoonClient();"),
    registrySource.replace("return mountMoonClient;", "mountMoonClient(); return mountMoonClient;"),
    registrySource.replace("loadScene,\n    description:", "loadScene: () => loadScene(),\n    description:"),
  ]) await assert.rejects(auditObjectRuntimeOwnership(fixture({ "site/objects.mjs": source })), /Actual OBJECTS registry|registered runtime loader/);
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [client]: binding.replace("mountMoonClient", "differentExport") })), /one bound shared factory export/);
});
test("an actual generated Uranus site module cannot execute preparation through a literal-looking export", async () => {
  const file = resolve("src/planets/uranus/site/control-content.mjs");
  const { objectControls } = await import("../src/planets/uranus/site/control-content.mjs");
  const executable = `export const objectControls = (() => (${JSON.stringify(objectControls)}))();`;
  await assert.rejects(auditObjectRuntimeOwnership({ objects: OBJECTS.filter(object => object.id === "uranus"),
    readText: path => path === file ? executable : readFile(path, "utf8") }), /control-content.mjs.*Object controls must only project static prepared content/);
});

test("the actual OBJECTS registry has only normalized packages and one shared source closure", async () => {
  const report = await auditObjectRuntimeOwnership();
  assert.equal(report.complete, true);
  assert.deepEqual(report.entries.map(entry => entry.id), OBJECTS.map(object => object.id));
  assert.ok(report.entries.every(entry => entry.factoryCalls === 1 && entry.owners.length === 0 && entry.orphanExecutors.length === 0));
  assert.ok(report.sharedClosure.includes("site/components/PlanetShell.astro"));
  assert.ok(report.sharedClosure.includes("site/prepared-shell-titles.mjs"));
  assert.ok(!report.sharedClosure.includes("src/planets/uranus/site/preparedLensControls.mjs"));
});
