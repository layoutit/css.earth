import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { OBJECTS } from "../site/objects.mjs";
import { auditObjectRuntimeOwnership, inspectObjectRuntimeModule } from "./check-object-runtime-ownership.mjs";
import { objectControls } from "../src/planets/moon/site/control-content.mjs";
import { requireObjectRuntimeDefinition } from "./object-runtime-contract.mjs";
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
    "src/platform/prepared-schema.mjs": `export const PREPARED_OBJECT_RUNTIME_SCHEMA = "cssearth-object-runtime@3";`,
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
  "import { createObjectSelectionRuntime as renamed } from '../../../platform/object-selection-runtime.mjs'; renamed({});",
  "import * as runtime from '../../../platform/object-selection-runtime.mjs'; runtime.createObjectSelectionRuntime({});",
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
    registrySource.replace("    loadScene,", "    loadScene: () => loadScene(),"),
  ]) {
    assert.notEqual(source, registrySource, 'Mutation must change the actual registry');
    await assert.rejects(auditObjectRuntimeOwnership(fixture({ "site/objects.mjs": source })), /Actual OBJECTS registry|registered runtime loader/);
  }
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [client]: binding.replace("mountMoonClient", "differentExport") })), /one bound shared factory export/);
});
test("the actual OBJECTS registry has only normalized packages and one shared source closure", async () => {
  const report = await auditObjectRuntimeOwnership();
  assert.equal(report.complete, true);
  for (const file of ["src/platform/prepared-presentation-contract.mjs", "src/platform/cubic-sky-contract.mjs", "src/platform/directional-sun-contract.mjs", "tools/object-runtime-contract.mjs", "src/platform/latest-selection.mjs"])
    assert.ok(!report.sharedClosure.includes(file), `${file} must stay outside the browser`);
  assert.deepEqual(report.entries.map(entry => entry.id), OBJECTS.map(object => object.id));
  assert.ok(report.entries.every(entry => entry.factoryCalls === 1 && entry.owners.length === 0 && entry.orphanExecutors.length === 0));
  assert.ok(report.sharedClosure.includes("site/components/PlanetShell.astro"));
  assert.ok(report.sharedClosure.includes("site/prepared-shell-titles.mjs"));
  assert.ok(!report.sharedClosure.includes("src/planets/uranus/site/preparedLensControls.mjs"));
});

const descriptorObjects = OBJECTS.filter(object => ['mercury', 'venus'].includes(object.id));
async function descriptorOverlay(changes = {}) {
  return auditObjectRuntimeOwnership({ objects: descriptorObjects,
    readText: path => Object.hasOwn(changes, relativeFile(path)) ? changes[relativeFile(path)] : readFile(path, 'utf8') });
}
const relativeFile = path => path.slice(process.cwd().length + 1);

test('descriptor loaders prove the actual JSON transport and typed source build closure', async () => {
  const report = await descriptorOverlay();
  assert.equal(report.complete, true);
  assert.equal(report.cameraFactorySites.length, 1, 'one native camera factory in the selected renderer assembly');
  for (const entry of report.entries) {
    assert.equal(entry.entry.file, `src/planets/${entry.id}/object.json`);
    assert.equal(entry.factoryCalls, 1);
    assert.equal(entry.presentation.file, `objects/prepared/${entry.id}.json`);
    assert.ok(entry.closure.includes(entry.presentation.file));
  }
  for (const file of ['src/renderers/css/index.ts', 'src/renderers/css/runtime/object-runtime.ts',
    'src/renderers/css/runtime/deferred-object-mount.ts', 'packages/engine/src/runtime/scene-lifetime.ts',
    'packages/objects/src/parse.ts']) assert.ok(report.sharedClosure.includes(file), file);
  for (const file of ['src/renderers/css/tsup.config.ts', 'packages/engine/tsup.config.ts', 'packages/objects/package.json'])
    assert.match(report.sourceHashes[file], /^[a-f0-9]{64}$/, file);
  assert.ok(report.sharedClosure.every(file => !file.includes('/dist/')), 'source build entries, never emitted bundles, own the proof');
});

test('JSON transport rejects a mismatched descriptor, digest, payload or checked source', async () => {
  const file = 'src/planets/mercury/object.json', descriptor = JSON.parse(await readFile(file, 'utf8'));
  await assert.rejects(descriptorOverlay({ [file]: JSON.stringify({ ...descriptor, id: 'venus' }) }), /descriptor identity/);
  await assert.rejects(descriptorOverlay({ [file]: JSON.stringify({ ...descriptor, prepared: { ...descriptor.prepared, sha256: '0'.repeat(64) } }) }), /SHA-256/);
  const presentation = 'src/planets/mercury/runtime/preparedPresentation.mjs';
  const original = await readFile(presentation, 'utf8');
  const value = readPreparedJsonModule(original).value;
  value.camera.defaultZoom += .1;
  await assert.rejects(descriptorOverlay({ [presentation]: `export const PREPARED_PRESENTATION = ${JSON.stringify(value)};` }), /differ from the checked/);
  const controls = 'src/planets/mercury/site/control-content.mjs';
  await assert.rejects(descriptorOverlay({ [controls]: `${await readFile(controls, 'utf8')}\nnew Image();` }), /static prepared content/);
});

test('descriptor binding cannot bypass the shared factory or redirect the prepared inventory', async () => {
  const file = 'site/packaged-object-runtime.mjs', source = await readFile(file, 'utf8');
  for (const changed of [source.replace('return createNavigableObjectMount(', 'return differentFactory('),
    source.replace('../objects/prepared/*.json', '../objects/other/*.json'),
    source.replace('createNavigableObjectMount(descriptorInput,', 'createNavigableObjectMount(otherDescriptor,'),
    source.replace('}, bindPackagedObject)', '}, differentBinding)')]) {
    assert.notEqual(changed, source, 'Mutation must change the actual loader');
    await assert.rejects(descriptorOverlay({ [file]: changed }), /forward its prepared transport/);
  }
  const registry = await readFile('site/objects.mjs', 'utf8');
  await assert.rejects(descriptorOverlay({ 'site/objects.mjs': registry.replace('loadPackagedObject(mercuryDescriptor)', 'loadPackagedObject(venusDescriptor)') }), /own actual JSON descriptor/);
  for (const source of [registry.replace('mercuryDescriptor.properties.worldFrame', 'venusDescriptor.properties.worldFrame'),
    registry.replace(', mercuryDescriptor.properties.worldFrame', ''),
    registry.replace('    worldFrame,', '    worldFrame: null,')]) {
    assert.notEqual(source, registry, 'World-frame mutation must change the actual binding');
    await assert.rejects(descriptorOverlay({ 'site/objects.mjs': source }), /world frame/);
  }
});

test('typed renderer closure rejects forbidden scene APIs, styles, hidden imports and extra cameras', async () => {
  const file = 'src/renderers/css/runtime/object-runtime.ts', source = await readFile(file, 'utf8');
  for (const [injected, expected] of [
    ["document.createElement(('canvas' as const));", /Forbidden runtime canvas/],
    ["document.createElementNS('http://www.w3.org/2000/svg', 'svg');", /Forbidden runtime canvas/],
    ["function hidden(node: HTMLElement) { node.style.filter = 'blur(2px)'; }", /Forbidden runtime CSS/],
    ["function hidden(node: HTMLElement) { node.style.background = 'linear-gradient(red, blue)'; }", /Forbidden runtime CSS/],
    ["function hidden(node: HTMLElement) { node.style.setProperty('mask-image', 'url(mask.png)'); }", /Forbidden runtime CSS/],
    ["import('./hidden.js');", /Dynamic runtime imports/],
    ["import { createPolyCamera } from '@layoutit/polycss'; (createPolyCamera as typeof createPolyCamera)({});", /native camera factory site; found 2/],
  ]) await assert.rejects(descriptorOverlay({ [file]: `${source}\n${injected}` }), expected);
});

test('workspace runtime exports and renderer build entries remain source-bound', async () => {
  const file = 'src/renderers/css/tsup.config.ts', config = await readFile(file, 'utf8');
  const renamed = config.replace('    index:', '    other:');
  assert.notEqual(renamed, config, 'Mutation must rename the emitted renderer entry');
  await assert.rejects(descriptorOverlay({ [file]: renamed }), /does not match its build entry/);
  const manifestFile = 'packages/engine/package.json', manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  manifest.exports['.'].import = './dist/other.js';
  await assert.rejects(descriptorOverlay({ [manifestFile]: JSON.stringify(manifest) }), /does not match its build entry/);
});

test('the actual Sun-only shell consumes navigation without loading another native camera owner', async () => {
  const audit = changes => auditObjectRuntimeOwnership({ objects: OBJECTS.filter(object => object.id === 'sun'),
    readText: path => Object.hasOwn(changes, relativeFile(path)) ? changes[relativeFile(path)] : readFile(path, 'utf8') });
  const report = await audit({});
  assert.equal(report.complete, true);
  assert.equal(report.cameraFactorySites.length, 1);
  assert.ok(report.sharedClosure.includes('src/renderers/css/navigation/index.ts'));
  assert.ok(!report.sharedClosure.includes('src/renderers/css/index.ts'));
  assert.ok(!report.sharedClosure.includes('src/renderers/css/runtime/object-runtime.ts'));
  for (const file of ['site/scene-router.mjs', 'site/view-url-runtime.mjs', 'site/prepared-world-navigation.mjs']) {
    const source = await readFile(file, 'utf8');
    const changed = source.replace('/dist/navigation.js', '/dist/index.js');
    assert.notEqual(changed, source, 'Mutation must reconnect the native renderer entry');
    await assert.rejects(audit({ [file]: changed }), /native camera factory site; found 2/);
  }
  const configFile = 'src/renderers/css/tsup.config.ts', config = await readFile(configFile, 'utf8');
  const changed = config.replace("'./navigation/index.ts'", "'./index.ts'");
  assert.notEqual(changed, config, 'Mutation must redirect the actual navigation build entry');
  await assert.rejects(audit({ [configFile]: changed }), /native camera factory site; found 2/);
});

test('every independently selected registry object closes over exactly its own native camera assembly', async () => {
  for (const object of OBJECTS) {
    const report = await auditObjectRuntimeOwnership({ objects: [object] });
    assert.equal(report.complete, true, object.id);
    assert.equal(report.cameraFactorySites.length, 1, object.id);
  }
});
