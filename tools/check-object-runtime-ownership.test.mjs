import { loadObjectTestDefinition } from './object-test-data.mjs';
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { OBJECTS } from "../site/objects.mjs";
import { auditObjectRuntimeOwnership, inspectObjectRuntimeModule } from "./check-object-runtime-ownership.mjs";
const { controls: objectControls } = await loadObjectTestDefinition('moon');
import { requireObjectRuntimeDefinition } from "./object-runtime-contract.mjs";
import { PREPARED_OBJECT_RUNTIME_SCHEMA } from "../src/platform/prepared-presentation-contract.mjs";
import { readPreparedJsonModule } from "./check-prepared-presentation.mjs";

const root = "/ownership-fixture", prefix = "src/planets/moon/runtime/";
const client = prefix + "client.mjs", definitionPath = prefix + "definition.mjs";
const binding = `import { createObjectRuntime as bind } from '../../../platform/object-runtime.mjs';
import { runtimeDefinition as definition } from './definition.mjs';
export const mountMoonClient = bind(definition);`;
// Legacy parser fixtures remain adversarial tests, not production dependencies.
const definition = `import { PREPARED_OBJECT_RUNTIME_SCHEMA } from '../../../platform/prepared-schema.mjs';
import { objectControls } from '../site/control-content.mjs';
import { PREPARED_PRESENTATION } from './preparedPresentation.mjs';
export const runtimeDefinition = Object.freeze({ ...PREPARED_PRESENTATION, schema: PREPARED_OBJECT_RUNTIME_SCHEMA, id: 'moon', controls: objectControls });`;
const { id: _id, controls: _controls, ...moonPresentation } = await loadObjectTestDefinition('moon');
moonPresentation.schema = 'cssearth-prepared-presentation@3';
const prepared = `export const PREPARED_PRESENTATION = Object.freeze(${JSON.stringify(moonPresentation)});`;
const registrySource = (await readFile(new URL("../site/objects.mjs", import.meta.url), "utf8"))
  .replace(/defineObjects\(\[[\s\S]*?\]\);/, `defineObjects([
  object("moon", "Moon", "satellite", "#aaa7a0", 1, "Moon fixture", async () => {
    const { mountMoonClient } = await import("../src/planets/moon/runtime/client.mjs");
    return mountMoonClient;
  }),
]);`).replace(/^import \w+Descriptor from[^\n]+\n/gm, '');
const sunContext = await readFile(new URL("../src/planets/sun/prepared/world-context.json", import.meta.url), "utf8");
const objectSchema = await readFile(new URL("../site/object-schema.mjs", import.meta.url), "utf8");
const shared = `import { createPolyCamera } from '@layoutit/polycss';
export function createObjectRuntime(definition) { return createPolyCamera(definition); }`;
function fixture(extra = {}, definitionTail = "") {
  const files = { [client]: binding, [definitionPath]: definition + definitionTail,
    "site/objects.mjs": registrySource, "site/object-schema.mjs": objectSchema,
    "site/layouts/PlanetLayout.astro": "<main><slot /></main>",
    "site/components/PlanetShell.astro": "<aside><slot /></aside>",
    "src/planets/sun/prepared/world-context.json": sunContext,
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
test('nullable physical lighting projection is data while adjacent identity tables remain forbidden', () => {
  const file = 'src/renderers/css/navigation/perspective-dolly.ts';
  const inspect = (source, path = file) => inspectObjectRuntimeModule(source, path, { shared: true, objectIds: ['sun', 'moon'] }).violations;
  assert.deepEqual(inspect('const frame = { ...(projection === null ? {} : { sun: projection.sun }) };'), []);
  for (const expression of ['{ sun: renderSun }', '{ sun: projection.moon }', '{ moon: projection.moon }', '{ sun: projection.sun, moon: renderMoon }']) {
    assert.ok(inspect(`const table = ${expression};`).some(issue => /object-ID dispatch/.test(issue.reason)));
  }
  assert.ok(inspect('const table = { sun: projection.sun };', 'src/platform/object-runtime.mjs').some(issue => /object-ID dispatch/.test(issue.reason)));
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
    registrySource.replace(/\bloadScene,\n/u, "loadScene: () => loadScene(),\n"),
  ]) {
    assert.notEqual(source, registrySource, "The mutation must change the actual registry");
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

test('literal metadata defaults do not hide loader ownership, executable defaults are rejected', async () => {
  const changed = registrySource.replace('systemName = "Solar System"', 'systemName = resolveSystem()');
  assert.notEqual(changed, registrySource);
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ 'site/objects.mjs': changed })), /Actual OBJECTS registry/);
});

const descriptorObjects = OBJECTS.filter(object => ['mercury', 'venus'].includes(object.id));
async function descriptorOverlay(changes = {}) {
  return auditObjectRuntimeOwnership({ objects: descriptorObjects,
    readText: path => Object.hasOwn(changes, relativeFile(path)) ? changes[relativeFile(path)] : readFile(path, 'utf8') });
}
const relativeFile = path => path.slice(process.cwd().length + 1);

test('the minimap dependency closure includes Cesium math and rejects imported rendering code', async () => {
  const report = await descriptorOverlay();
  const math = report.sharedClosure.find(file => file.endsWith('/@cesium/engine/Source/Core/Math.js'));
  assert.ok(math, 'Cesium dependencies must be inspected rather than skipped');
  assert.ok(report.sharedClosure.some(file => file.includes('/mersenne-twister/')), 'Transitive math dependencies are included');
  assert.equal(report.sharedClosure.some(file => /\/(?:FeatureDetection|getImagePixels|Resource)\.js$/.test(file)), false);
  const source = await readFile(math, 'utf8');
  await assert.rejects(descriptorOverlay({ [math]: source + '\ndocument.createElement("canvas");' }), /Forbidden runtime canvas/);
});

test('descriptor loaders prove the actual JSON transport and typed source build closure', async () => {
  const report = await descriptorOverlay();
  assert.equal(report.complete, true);
  assert.equal(report.cameraFactorySites.length, 1, 'one native camera factory in the selected renderer assembly');
  for (const entry of report.entries) {
    assert.equal(entry.entry.file, `src/planets/${entry.id}/object.json`);
    assert.equal(entry.factoryCalls, 1);
    assert.equal(entry.presentation.file, `src/planets/${entry.id}/prepared/object.json`);
    assert.ok(entry.closure.includes(entry.presentation.file));
  }
  for (const file of ['src/renderers/css/index.ts', 'src/renderers/css/runtime/object-runtime.ts',
    'src/renderers/css/runtime/deferred-object-mount.ts', 'packages/engine/src/runtime/scene-lifetime.ts',
    'packages/objects/src/parse.ts']) assert.ok(report.sharedClosure.includes(file), file);
  for (const file of ['src/renderers/css/tsup.config.ts', 'packages/engine/tsup.config.ts', 'packages/objects/package.json'])
    assert.match(report.sourceHashes[file], /^[a-f0-9]{64}$/, file);
  assert.ok(report.sharedClosure.every(file => !file.includes('/dist/')), 'source build entries, never emitted bundles, own the proof');
});

test('authored descriptors do not inspect deleted private runtime modules', async () => {
  const mercury = OBJECTS.find(object => object.id === 'mercury');
  const report = await auditObjectRuntimeOwnership({ objects: [mercury],
    listRuntimeFiles: async directory => { if (directory.endsWith('/mercury/runtime')) throw new Error('deleted authored runtime was read'); return []; } });
  assert.equal(report.complete, true);
});

test('authored JSON transport rejects mismatched bytes, controls, source pins and physical frames', async () => {
  const file = 'src/planets/mercury/object.json', descriptor = JSON.parse(await readFile(file, 'utf8'));
  await assert.rejects(descriptorOverlay({ [file]: JSON.stringify({ ...descriptor, id: 'venus' }) }), /descriptor identity/);
  await assert.rejects(descriptorOverlay({ [file]: JSON.stringify({ ...descriptor, prepared: { ...descriptor.prepared, url: '../venus/prepared/object.json' } }) }), /owning object prepared directory/);
  await assert.rejects(descriptorOverlay({ [file]: JSON.stringify({ ...descriptor, prepared: { ...descriptor.prepared, url: 'prepared/../prepared/object.json' } }) }), /owning object prepared directory/);
  await assert.rejects(descriptorOverlay({ [file]: JSON.stringify({ ...descriptor, prepared: { ...descriptor.prepared, sha256: '0'.repeat(64) } }) }), /SHA-256/);
  const runtimePath = 'src/planets/mercury/prepared/runtime.json';
  const runtime = JSON.parse(await readFile(runtimePath, 'utf8'));
  runtime.camera.defaultZoom += .1;
  await assert.rejects(descriptorOverlay({ [runtimePath]: JSON.stringify(runtime) }), /differ from the checked authored runtime/);
  const sourcePath = 'src/planets/mercury/source/content/object.json';
  await assert.rejects(descriptorOverlay({ [sourcePath]: `${await readFile(sourcePath, 'utf8')} ` }), /source digest drifted/);
  const payloadPath = 'src/planets/mercury/prepared/object.json', payload = JSON.parse(await readFile(payloadPath, 'utf8'));
  runtime.controls.lenses.controls[0].id = '';
  payload.data = runtime;
  const bytes = JSON.stringify(payload);
  descriptor.prepared.sha256 = createHash('sha256').update(bytes).digest('hex');
  await assert.rejects(descriptorOverlay({ [file]: JSON.stringify(descriptor), [payloadPath]: bytes,
    [runtimePath]: JSON.stringify(runtime) }), /control|lens/i);
  const scenePath = 'src/planets/mercury/prepared/scene.json', scene = JSON.parse(await readFile(scenePath, 'utf8'));
  scene.worldFrame.bodyRadiusM += 1;
  await assert.rejects(descriptorOverlay({ [scenePath]: JSON.stringify(scene) }), /physical frame/);
});

test('descriptor binding cannot bypass the shared factory or redirect the prepared inventory', async () => {
  const file = 'site/packaged-object-runtime.mjs', source = await readFile(file, 'utf8');
  for (const changed of [source.replace('return createNavigableObjectMount(', 'return differentFactory('),
    source.replace('../src/planets/*/prepared/object.json', '../src/planets/other/*.json'),
    source.replace('`../src/planets/${descriptorInput.id}/${reference}`', '`../src/planets/${otherDescriptor.id}/${reference}`'),
    source.replace('createNavigableObjectMount(descriptorInput,', 'createNavigableObjectMount(otherDescriptor,'),
    source.replace('bindContextualObject(definition, applicationContext,', 'bindContextualObject(definition, otherContext,'),
    source.replace('definition => descriptorInput.properties.worldFrame', 'definition => true'),
    source.replace('bindContextualObject(definition, applicationContext, descriptorInput.properties.worldFrame)',
      'bindContextualObject(definition, applicationContext, applicationContext.frame)'),
    source.replace(': bindPackagedObject(definition)', ': bindPackagedObject(otherDefinition)'),
    source.replace('mount = createObjectRuntime(definition)', 'mount = createObjectRuntime(otherDefinition)'),
    source.replace('createPreparedObjectNavigation(async () => definition, frame)', 'createPreparedObjectNavigation(async () => otherDefinition, frame)'),
    source.replace('createPreparedObjectNavigation(async () => definition, frame)', 'createPreparedObjectNavigation(async () => definition, context.frame)'),
    source.replace('fetch(url, { signal })', 'fetch(url, { signal: otherSignal })'),
    source.replace('=> mount(stage,', '=> differentMount(stage,')]) {
    assert.notEqual(changed, source, 'Mutation must change the actual loader');
    await assert.rejects(descriptorOverlay({ [file]: changed }), /forward its prepared transport|Contextual binding/);
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
    ["function hidden() { createObjectRuntime({}); }", /actual shared factory call/],
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

test('the actual Sun-only shell and navigation share exactly one typed camera owner', async () => {
  const audit = changes => auditObjectRuntimeOwnership({ objects: OBJECTS.filter(object => object.id === 'sun'),
    readText: path => Object.hasOwn(changes, relativeFile(path)) ? changes[relativeFile(path)] : readFile(path, 'utf8') });
  const report = await audit({});
  assert.equal(report.complete, true);
  assert.equal(report.cameraFactorySites.length, 1);
  assert.ok(report.sharedClosure.includes('src/renderers/css/index.ts'));
  assert.ok(report.sharedClosure.includes('src/renderers/css/universe/world-context-runtime.ts'));
  assert.ok(report.sharedClosure.includes('src/renderers/css/universe/prepared-world-context.ts'));
  assert.ok(!report.sharedClosure.includes('src/platform/object-runtime.mjs'));
  assert.ok(report.sharedClosure.includes('src/renderers/css/navigation/index.ts'));
  assert.ok(report.sharedClosure.includes('src/renderers/css/runtime/object-runtime.ts'));
  assert.ok(!report.sharedClosure.some(file => /^src\/planets\/[^/]+\/runtime\//u.test(file)));
  for (const file of ['site/scene-router.mjs', 'site/view-url-runtime.mjs', 'site/prepared-world-navigation.mjs']) {
    const source = await readFile(file, 'utf8');
    const changed = source.replace('/dist/navigation.js', '/dist/index.js');
    assert.notEqual(changed, source, 'Mutation must reconnect the native renderer entry');
    const shared = await audit({ [file]: changed });
    assert.equal(shared.cameraFactorySites.length, 1, 'Importing the same shared renderer cannot create another camera owner');
  }
  const configFile = 'src/renderers/css/tsup.config.ts', config = await readFile(configFile, 'utf8');
  const changed = config.replace("'./navigation/index.ts'", "'./index.ts'");
  assert.notEqual(changed, config, 'Mutation must redirect the actual navigation build entry');
  const shared = await audit({ [configFile]: changed });
  assert.equal(shared.cameraFactorySites.length, 1);

});

test('every independently selected registry object closes over exactly its own native camera assembly', async () => {
  for (const object of OBJECTS) {
    const report = await auditObjectRuntimeOwnership({ objects: [object] });
    assert.equal(report.complete, true, object.id);
    assert.equal(report.cameraFactorySites.length, 1, object.id);
  }
});

test('descriptor context binding pins both prepared contexts to the shared factories and physical references', async () => {
  const contextFile = 'src/planets/sun/prepared/world-context.json';
  const packagedFile = 'site/packaged-object-runtime.mjs', applicationFile = 'site/application-world-context.mjs', starsDescriptorFile = 'src/objects/stellar-neighbourhood/object.json';
  const starsPayloadFile = 'src/objects/stellar-neighbourhood/prepared/stars.json';
  const [contextText, packaged, application, starDescriptorText, starsPayloadText] = await Promise.all([
    readFile(contextFile, 'utf8'), readFile(packagedFile, 'utf8'), readFile(applicationFile, 'utf8'),
    readFile(starsDescriptorFile, 'utf8'), readFile(starsPayloadFile, 'utf8'),
  ]);
  const context = JSON.parse(contextText), starDescriptor = JSON.parse(starDescriptorText);
  const audit = changes => auditObjectRuntimeOwnership({ objects: OBJECTS.filter(object => object.id === 'sun'),
    readText: path => Object.hasOwn(changes, relativeFile(path)) ? changes[relativeFile(path)] : readFile(path, 'utf8') });
  const report = await audit({});
  assert.equal(report.complete, true);
  assert.ok(report.sharedClosure.includes(contextFile));
  const orbitless = { ...context, bodies: context.bodies.map((body, index) => {
    if (index) return body;
    const { orbit, ...point } = body;
    return point;
  }) };
  assert.equal((await audit({ [contextFile]: JSON.stringify(orbitless) })).complete, true,
    'An orbitless physical point does not require fabricated orbital geometry');
  for (const [changes, expected] of [
    [{ [packagedFile]: packaged.replace("with { type: 'json' }", '') }, /forward its prepared transport/],
    [{ [contextFile]: JSON.stringify({ ...context, volume: { ...context.volume, objectId: '../milky-way' } }) }, /volume identity is not pinned/],
    [{ [contextFile]: JSON.stringify({ ...context, frame: { ...context.frame, originM: [1, 0, 0] } }) }, /physical frame/],
    [{ [contextFile]: JSON.stringify({ ...context, bodies: [] }) }, /body inventory/],
    [{ [contextFile]: JSON.stringify({ ...orbitless, bodies: orbitless.bodies.map((body, index) => index ? body : { ...body, radiusM: undefined }) }) }, /physical point/],
    [{ [contextFile]: JSON.stringify({ ...orbitless, bodies: orbitless.bodies.map((body, index) => index ? body : { ...body, orbit: null }) }) }, /body orbit parent/],
    [{ [contextFile]: JSON.stringify({ ...context, bodies: context.bodies.map((body, index) => index ? body : { ...body,
      orbit: { ...body.orbit, centerBodyId: 'missing-parent' } }) }) }, /body orbit parent/],
    [{ [contextFile]: JSON.stringify({ ...context, bodies: context.bodies.map((body, index) => index ? body : { ...body,
      orbit: { ...body.orbit, centerPositionM: [1, 0, 0] } }) }) }, /body orbit parent/],
    [{ [contextFile]: JSON.stringify({ ...context, stars: { ...context.stars, objectId: '../stellar-neighbourhood' } }) }, /star field identity/],
    [{ [contextFile]: JSON.stringify({ ...context, stars: { ...context.stars, fullDistanceM: context.volume.fadeStartDistanceM } }) }, /star field identity/],
    [{ [packagedFile]: packaged.replace('createWorldContextObjectRuntime', 'createObjectRuntime') }, /Contextual binding/],
    [{ [packagedFile]: packaged.replace('world-context.json', 'other-context.json') }, /Contextual binding/],
    [{ [applicationFile]: application.replace('createPreparedUniverse', 'createObjectRuntime') }, /Application world context/],
    [{ [applicationFile]: application.replace('../src/objects/*/prepared/**/*.{json,png,webp}', '../src/objects/*/prepared/**/*.{json,png}') }, /Application world context/],
    [{ [applicationFile]: application.replace('loadPreparedCssPointField', 'loadPreparedCssVolume') }, /Application world context/],
    [{ [starsDescriptorFile]: JSON.stringify({ ...starDescriptor, prepared: { ...starDescriptor.prepared, sha256: '0'.repeat(64) } }) }, /point field.*(?:identity|hash).*drifted/],
    [{ [starsDescriptorFile]: JSON.stringify({ ...starDescriptor, properties: { ...starDescriptor.properties, frame: { ...starDescriptor.properties.frame, epochJdTt: 0 } } }) }, /point field.*frame/],
    (() => {
      const payload = JSON.parse(starsPayloadText); payload.data.id = 'wrong-field';
      const bytes = JSON.stringify(payload), descriptor = { ...starDescriptor, prepared: { ...starDescriptor.prepared,
        sha256: createHash('sha256').update(bytes).digest('hex') } };
      return [{ [starsDescriptorFile]: JSON.stringify(descriptor), [starsPayloadFile]: bytes }, /point field.*identity/];
    })(),
  ]) await assert.rejects(audit(changes), expected);
});


test('shell-only JSON is parsed as data and malformed or executable content is rejected', () => {
  const inspect = source => inspectObjectRuntimeModule(source, 'site/source/example.json', { shared: true, shellContent: true });
  assert.equal(inspect('{"label":"Solar System"}').dataOnly, true);
  for (const invalid of ['{"label":}', 'document.createElement("canvas")']) {
    assert.equal(inspect(invalid).violations.length, 1);
  }
});
