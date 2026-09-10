import { loadObjectTestDefinition } from './object-test-data.mts';
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { OBJECTS } from "../site/objects.mts";
import { auditObjectRuntimeOwnership, inspectObjectRuntimeModule } from "./check-object-runtime-ownership.mts";
const moonDefinition = requireRecord(await loadObjectTestDefinition('moon'), 'Moon prepared definition');
const objectControls = requireArray(moonDefinition.controls, 'Moon prepared definition.controls');
import { requireObjectRuntimeDefinition } from "./object-runtime-contract.mts";
import { PREPARED_OBJECT_RUNTIME_SCHEMA } from "../src/platform/prepared-presentation-contract.mts";
import { readPreparedJsonModule } from "./check-prepared-presentation.mts";
import { requireArray, requireFiniteNumber, requireRecord, requireString } from "./source-values.mts";

type AuditOptions = NonNullable<Parameters<typeof auditObjectRuntimeOwnership>[0]>;
type SourceOverlay = Record<string, string>;
type ContextBody = Record<string, unknown> & { id: string; positionM: unknown; orbit?: Record<string, unknown> & { centerBodyId: string } };
type ContextValue = Record<string, unknown> & { bodies: ContextBody[]; orbitCenters: Record<string, Record<string, unknown> & { positionM: unknown; centerBodyId: string }>; volume: Record<string, unknown>; frame: Record<string, unknown>; stars: Record<string, unknown> };
const requirePresent = <T,>(value: T | undefined | null, label: string): T => {
  if (value === undefined || value === null) throw new TypeError(`${label} is missing.`);
  return value;
};

const root = "/ownership-fixture", prefix = "src/planets/moon/runtime/";
const client = prefix + "client.mjs", definitionPath = prefix + "definition.mjs";
const binding = `import { createObjectRuntime as bind } from '../../../platform/object-runtime.mts';
import { runtimeDefinition as definition } from './definition.mjs';
export const mountMoonClient = bind(definition);`;
// Legacy parser fixtures remain adversarial tests, not production dependencies.
const definition = `import { PREPARED_OBJECT_RUNTIME_SCHEMA } from '../../../platform/prepared-schema.mts';
import { objectControls } from '../site/control-content.mjs';
import { PREPARED_PRESENTATION } from './preparedPresentation.mjs';
export const runtimeDefinition = Object.freeze({ ...PREPARED_PRESENTATION, schema: PREPARED_OBJECT_RUNTIME_SCHEMA, id: 'moon', controls: objectControls });`;
const moonPresentation = { ...moonDefinition };
delete moonPresentation.id;
delete moonPresentation.controls;
moonPresentation.schema = 'cssearth-prepared-presentation@3';
const prepared = `export const PREPARED_PRESENTATION = Object.freeze(${JSON.stringify(moonPresentation)});`;
const registrySource = `import { defineObject, defineObjects } from './object-schema.mts';
export const OBJECTS = defineObjects([
  object("moon", "Moon", "satellite", "#aaa7a0", 1, "Moon fixture", async () => {
    const { mountMoonClient } = await import("../src/planets/moon/runtime/client.mjs");
    return mountMoonClient;
  }),
]);
function object(id, name, classification, color, distanceAu, description, loadScene, worldFrame = null, systemName = "Solar System") {
  return defineObject({ id, name, classification, color, distanceAu, description, systemName,
    route: \`/\${id}/\`,
    loadScene,
    worldFrame,
  });
}
`;
const sunContext = await readFile(new URL("../src/planets/sun/prepared/world-context.json", import.meta.url), "utf8");
const objectSchema = await readFile(new URL("../site/object-schema.mts", import.meta.url), "utf8");
const isArray = await readFile(new URL("../src/platform/is-array.mts", import.meta.url), "utf8");
const browserTypes = await readFile(new URL("../site/browser-types.mts", import.meta.url), "utf8");
const shared = `import { createPolyCamera } from '@layoutit/polycss';
export function createObjectRuntime(definition) { return createPolyCamera(definition); }`;
function fixture(extra: SourceOverlay = {}, definitionTail = ""): AuditOptions {
  const files: SourceOverlay = { [client]: binding, [definitionPath]: definition + definitionTail,
    "site/objects.mts": registrySource, "site/object-schema.mts": objectSchema, "site/browser-types.mts": browserTypes, "src/platform/is-array.mts": isArray,
    "site/layouts/PlanetLayout.astro": "<main><slot /></main>",
    "site/components/PlanetShell.astro": "<aside><slot /></aside>",
    "src/planets/sun/prepared/world-context.json": sunContext,
    [prefix + "preparedPresentation.mjs"]: prepared,
    "src/planets/moon/site/control-content.mjs": `export const objectControls = ${JSON.stringify(objectControls)};`,
    "src/platform/prepared-schema.mts": `export const PREPARED_OBJECT_RUNTIME_SCHEMA = "cssearth-object-runtime@3";`,
    "src/platform/object-runtime.mts": shared, ...extra };
  return { root, objects: [{ id: "moon" }],
    verifyDefinition(object: { id: string }, plan: unknown) { requireObjectRuntimeDefinition({ ...requireRecord(plan, 'fixture plan'), schema: PREPARED_OBJECT_RUNTIME_SCHEMA, id: object.id, controls: objectControls }); },
    listRuntimeFiles: async () => Object.keys(files).filter(file => file.startsWith(prefix)).map(file => file.slice(prefix.length)),
    readText: async (path: string) => { const source = files[path.slice(root.length + 1)]; assert.notEqual(source, undefined, path); return requirePresent(source, path); } };
}

test("accepts one bound factory and the real existing Moon plan; static proof never claims native observations", async () => {
  const report = await auditObjectRuntimeOwnership(fixture());
  assert.equal(report.complete, true); assert.equal(report.entries[0].factoryCalls, 1);
  assert.equal(report.entries[0].schema, PREPARED_OBJECT_RUNTIME_SCHEMA);
  assert.equal(report.cameraFactorySites.length, 1);
  assert.equal(report.nativeOwnership.status, "UNPROVEN");
  assert.match(report.sourceHashes[prefix + "preparedPresentation.mjs"], /^[a-f0-9]{64}$/);
  assert.match(report.sourceHashes["site/objects.mts"], /^[a-f0-9]{64}$/);
  assert.deepEqual(report.entries[0].entry, { file: client, exported: "mountMoonClient", registry: "site/objects.mts" });
});
test("follows imported helpers instead of trusting a thin client", async () => {
  const options = fixture({ [prefix + "hidden.mjs"]: "export function hidden() { return new Image(); }" },
    "\nimport { hidden } from './hidden.mjs'; hidden();");
  await assert.rejects(auditObjectRuntimeOwnership(options), /hidden.mjs.*Image/);
  const report = await auditObjectRuntimeOwnership({ ...options, strict: false });
  assert.match(JSON.stringify(report.entries[0].closure), /hidden\.mjs/);
  assert.equal(report.entries[0].migrated, false);
});
test("private synchronous material publication is rejected even when its file is unreferenced", async () => {
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [prefix + "presentation.mjs"]:
    "export function publish(node, value) { node.style.backgroundPosition = value; }" })), /Unreferenced private runtime executor/);
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [prefix + "presentation.mts"]:
    "export function publish(node: HTMLElement, value: string): void { node.style.backgroundPosition = value; }" })), /Unreferenced private runtime executor/);
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
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ "src/platform/object-runtime.mts": shared + `\nfunction hidden(definition) { ${dispatch} }` })), /object-ID dispatch/);
});
test('nullable physical lighting projection is data while adjacent identity tables remain forbidden', () => {
  const file = 'src/renderers/css/navigation/perspective-dolly.ts';
  const inspect = (source: string, path: string = file) => inspectObjectRuntimeModule(source, path, { shared: true, objectIds: ['sun', 'moon'] }).violations;
  assert.deepEqual(inspect('const frame = { ...(projection === null ? {} : { sun: projection.sun }) };'), []);
  for (const expression of ['{ sun: renderSun }', '{ sun: projection.moon }', '{ moon: projection.moon }', '{ sun: projection.sun, moon: renderMoon }']) {
    assert.ok(inspect(`const table = ${expression};`).some(issue => /object-ID dispatch/.test(issue.reason)));
  }
  assert.ok(inspect('const table = { sun: projection.sun };', 'src/platform/object-runtime.mts').some(issue => /object-ID dispatch/.test(issue.reason)));
});
test("shared owners reject private packages, fixed asset namespaces, v1 hooks and an extra native camera", async () => {
  const cases: readonly [string, RegExp][] = [
    [shared + "\nimport { runtimeDefinition } from '../planets/moon/runtime/definition.mjs';", /Shared runtime imports an object package/],
    [shared + '\nconst url = "/scenes/earth/wmts-data.pack";', /object-specific asset namespace/],
    [shared + '\nconst valid = /^\\/scenes\\/earth\\/wmts/;', /object-specific asset namespace/],
    [shared + '\nfunction hidden(value) { return value.createPresentation(); }', /Legacy object callbacks/],
    [shared + '\ncreatePolyCamera({});', /native camera factory site; found 2/],
    [shared + '\nimport("./hidden.mjs");', /Dynamic runtime imports/],
  ];
  for (const [source, expected] of cases) await assert.rejects(auditObjectRuntimeOwnership(fixture({ "src/platform/object-runtime.mts": source })), expected);
});
test("object controls cannot hide an executor behind label projection", async () => {
  const controlsPath = "src/planets/moon/site/control-content.mjs";
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [controlsPath]:
    `export const objectControls = ${JSON.stringify(objectControls)};\nconst action = node => node.style.transform = 'none';` })), /static prepared content/);
});
test("common shell ownership follows actual Astro imports, template expressions, and client scripts", async () => {
  const shell = "site/components/PlanetShell.astro", helper = "site/shared-content.mjs";
  const files: SourceOverlay = { [shell]: `---
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
  const shellMutations: readonly [SourceOverlay, RegExp][] = [
    [{ [helper]: "export const label = 'Details'; if (object.id === 'moon') act();" }, /shared-content.mjs.*object-ID dispatch/],
    [{ "site/shared-client.mjs": "import { createPolyCamera } from '@layoutit/polycss'; createPolyCamera({});" }, /native camera factory site; found 2/],
    [{ [shell]: files[shell].replace("{label}", "{object.id === 'moon' ? label : ''}") }, /PlanetShell.astro.*object-ID dispatch/],
    [{ [shell]: files[shell].replace("import '../shared-client.mjs';", "import('../shared-client.mjs');") }, /PlanetShell.astro.*Dynamic runtime imports/],
    [{ [helper]: "export { data } from '../src/planets/moon/site/generated.mjs';" }, /Shared runtime imports an object package/],
    [{ [shell]: "<script>const broken = ;</script>" }, /Invalid runtime source/],
  ];
  for (const [changed, expected] of shellMutations) await assert.rejects(auditObjectRuntimeOwnership(fixture({ ...files, ...changed })), expected);
});
test("Astro server builtins do not hide the same imports in browser scripts", async () => {
  const shell = 'site/components/PlanetShell.astro';
  const frontmatter = "---\nimport { existsSync } from 'node:fs';\nimport { resolve } from 'node:path';\nconst hasImage = existsSync(resolve('public/social/moon.jpg'));\n---\n<aside>{hasImage}</aside>";
  assert.equal((await auditObjectRuntimeOwnership(fixture({ [shell]: frontmatter }))).complete, true);
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [shell]:
    frontmatter + "<script>import { existsSync } from 'node:fs';</script>" })), /(?:Unclosed runtime source|Runtime import escapes the source root:) node:fs/);
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [shell]:
    "<script>import '../shared-client.mjs';</script>",
    'site/shared-client.mjs': "import { resolve } from 'node:path';" })), /(?:Unclosed runtime source|Runtime import escapes the source root:) node:path/);
});
test("transitive Astro server helpers cannot hide Node imports on a client path", async () => {
  const shell = 'site/components/PlanetShell.astro';
  const files = {
    [shell]: "---\nimport { label } from '../server-helper.mjs';\n---\n<aside>{label}</aside>",
    'site/server-helper.mjs': "export { label } from './source-reader.mjs';",
    'site/source-reader.mjs': "import { readFile } from 'node:fs/promises'; export const label = 'Source';",
  };
  assert.equal((await auditObjectRuntimeOwnership(fixture(files))).complete, true);
  for (const client of ["<script>import '../server-helper.mjs';</script>",
    "<script>import '../other-client.mjs';</script>"]) {
    await assert.rejects(auditObjectRuntimeOwnership(fixture({ ...files,
      [shell]: files[shell] + client, 'site/other-client.mjs': "import './server-helper.mjs';" })),
      /(?:Unclosed runtime source|Runtime import escapes the source root:) node:fs/);
  }
});
test("literal navigation content is allowed only through the shell closure, not runtime dispatch", async () => {
  const file = "site/navigation-content.mts";
  const content = `export const MARKERS = Object.freeze(${JSON.stringify({moon:{label:"Moon"},saturn:{label:"Saturn"}})});`;
  const files = { [file]: content,
    "site/components/PlanetShell.astro": "---\nimport { MARKERS } from '../navigation-content.mts';\n---\n<nav>{Object.values(MARKERS).map(marker => marker.label)}</nav>" };
  assert.equal((await auditObjectRuntimeOwnership(fixture(files))).complete, true);
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ ...files,
    "src/platform/object-runtime.mts": shared + "\nimport { MARKERS } from '../../site/navigation-content.mts';" })), /navigation-content.mts.*object-ID dispatch/);
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ ...files, [file]: content + "\nexport function dispatch(id) { return MARKERS[id](); }" })), /navigation-content.mts.*object-ID dispatch/);
});
test("malicious generated code is rejected without importing it", async () => {
  const key = "__executedPreparedOwnershipPayload"; Reflect.deleteProperty(globalThis, key);
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [prefix + "preparedPresentation.mjs"]:
    prepared + `\nglobalThis.${key} = true;` })), /serialized|JSON/);
  assert.equal(Reflect.get(globalThis, key), undefined);
});
test("source overlays validate changed camera and material bindings, not cached imported definitions", async () => {
  const record = requireRecord(JSON.parse(prepared.slice(prepared.indexOf("Object.freeze(") + 14, prepared.lastIndexOf(");"))), 'prepared Moon record');
  const tree = requireRecord(record.tree, 'prepared Moon record.tree'), nodes = requireArray(tree.nodes, 'prepared Moon record.tree.nodes');
  nodes.push({ ...requireRecord(nodes[requireFiniteNumber(tree.camera, 'prepared Moon record.tree.camera')], 'prepared Moon camera'), parent: -1 });
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
    await assert.rejects(auditObjectRuntimeOwnership(fixture({ "site/objects.mts": source })), /Actual OBJECTS registry|registered runtime loader/);
  }
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [client]: binding.replace("mountMoonClient", "differentExport") })), /one bound shared factory export/);
});
test("the actual OBJECTS registry has only normalized packages and one shared source closure", async () => {
  const report = await auditObjectRuntimeOwnership();
  assert.equal(report.complete, true);
  for (const file of ["src/platform/prepared-presentation-contract.mts", "src/platform/cubic-sky-contract.mts", "src/platform/directional-sun-contract.mts", "tools/object-runtime-contract.mts", "src/platform/latest-selection.mjs"])
    assert.ok(!report.sharedClosure.includes(file), `${file} must stay outside the browser`);
  assert.deepEqual(report.entries.map(entry => entry.id), OBJECTS.map(object => object.id));
  for (const entry of report.entries) {
    assert.match(report.sourceHashes[requirePresent(entry.presentation, 'completed presentation').file], /^[a-f0-9]{64}$/, 'Completed body keeps its source receipt');
  }
  assert.ok(report.entries.every(entry => entry.factoryCalls === 1 && entry.owners.length === 0 && entry.orphanExecutors.length === 0));
  assert.ok(report.sharedClosure.includes("site/components/PlanetShell.astro"));
  assert.ok(report.sharedClosure.includes("site/prepared-shell-titles.mjs"));
  assert.ok(!report.sharedClosure.includes("src/planets/uranus/site/preparedLensControls.mjs"));
});

test('literal metadata defaults do not hide loader ownership, executable defaults are rejected', async () => {
  const changed = registrySource.replace('systemName = "Solar System"', 'systemName = resolveSystem()');
  assert.notEqual(changed, registrySource);
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ 'site/objects.mts': changed })), /Actual OBJECTS registry/);
});

const descriptorObjects = OBJECTS.filter(object => ['mercury', 'venus'].includes(object.id));
async function descriptorOverlay(changes: SourceOverlay = {}) {
  return auditObjectRuntimeOwnership({ objects: descriptorObjects,
    readText: (path: string) => Object.hasOwn(changes, relativeFile(path)) ? requirePresent(changes[relativeFile(path)], relativeFile(path)) : readFile(path, 'utf8') });
}
const relativeFile = (path: string) => path.slice(process.cwd().length + 1);

test('the minimap dependency closure includes Cesium math and rejects imported rendering code', async () => {
  const report = await descriptorOverlay();
  const math = report.sharedClosure.find(file => file.endsWith('/@cesium/engine/Source/Core/Math.js'));
  assert.ok(math, 'Cesium dependencies must be inspected rather than skipped');
  assert.ok(report.sharedClosure.some(file => file.includes('/mersenne-twister/')), 'Transitive math dependencies are included');
  assert.equal(report.sharedClosure.some(file => /\/(?:FeatureDetection|getImagePixels|Resource)\.js$/.test(file)), false);
  const source = await readFile(requirePresent(math, 'Cesium Math source'), 'utf8');
  await assert.rejects(descriptorOverlay({ [math]: source + '\ndocument.createElement("canvas");' }), /Forbidden runtime canvas/);
});

test('descriptor loaders prove the actual JSON transport and typed source build closure', async () => {
  const report = await descriptorOverlay();
  assert.equal(report.complete, true);
  assert.equal(report.cameraFactorySites.length, 1, 'one native camera factory in the selected renderer assembly');
  for (const entry of report.entries) {
    assert.equal(requirePresent(entry.entry, `${entry.id} entry`).file, `src/planets/${entry.id}/object.json`);
    assert.equal(entry.factoryCalls, 1);
    const presentation = requirePresent(entry.presentation, `${entry.id} presentation`);
    assert.equal(presentation.file, `src/planets/${entry.id}/prepared/object.json`);
    assert.match(JSON.stringify(entry.closure), new RegExp(presentation.file));
  }
  for (const file of ['src/renderers/css/index.ts', 'src/renderers/css/runtime/object-runtime.ts',
    'src/renderers/css/runtime/deferred-object-mount.ts', 'packages/engine/src/runtime/scene-lifetime.ts',
    'packages/objects/src/parse.ts']) assert.ok(report.sharedClosure.includes(file), file);
  for (const file of ['src/renderers/css/tsup.config.ts', 'packages/engine/tsup.config.ts', 'packages/objects/package.json'])
    assert.match(report.sourceHashes[file], /^[a-f0-9]{64}$/, file);
  assert.ok(report.sharedClosure.every(file => !file.includes('/dist/')), 'source build entries, never emitted bundles, own the proof');
});

test('authored descriptors do not inspect deleted private runtime modules', async () => {
  const mercury = requirePresent(OBJECTS.find(object => object.id === 'mercury'), 'Mercury object');
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
  const file = 'site/packaged-object-runtime.mts', source = await readFile(file, 'utf8');
  for (const changed of [source.replace('return createNavigableObjectMount(', 'return differentFactory('),
    source.replace('`/objects/${descriptorInput.id}/${descriptorInput.prepared.sha256}.json`', '`/elsewhere/${descriptorInput.id}/${descriptorInput.prepared.sha256}.json`'),
    source.replace('`/objects/${descriptorInput.id}/${descriptorInput.prepared.sha256}.json`', '`/objects/${otherDescriptor.id}/${descriptorInput.prepared.sha256}.json`'),
    source.replace('${descriptorInput.prepared.sha256}.json', '${otherDescriptor.prepared.sha256}.json'),
    source.replace("reference !== 'prepared/object.json'", "reference === 'prepared/object.json'"),
    source.replace('createNavigableObjectMount(descriptorInput,', 'createNavigableObjectMount(otherDescriptor,'),
    source.replace('bindContextualObject(definition, applicationContext,', 'bindContextualObject(definition, otherContext,'),
    source.replace('definition => descriptorInput.properties.worldFrame', 'definition => true'),
    source.replace('bindContextualObject(definition, applicationContext, parsePreparedWorldCameraFrame(descriptorInput.properties.worldFrame) ?? undefined)',
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
  const catalogPath = 'site/prepared-object-catalog.mts', catalog = await readFile(catalogPath, 'utf8');
  const wrongDescriptor = catalog.replace('../src/planets/mercury/object.json', '../src/planets/venus/object.json');
  assert.notEqual(wrongDescriptor, catalog, 'Descriptor mutation must change the actual import');
  await assert.rejects(descriptorOverlay({ [catalogPath]: wrongDescriptor }), /unique JSON descriptor imports/);
  const helperPath = 'site/object-catalog.mts', helper = await readFile(helperPath, 'utf8');
  for (const source of [helper.replace('input.properties.worldFrame', 'other.properties.worldFrame'),
    helper.replace('worldFrame: input.properties.worldFrame, ', ''),
    helper.replace('worldFrame: input.properties.worldFrame', 'worldFrame: null')]) {
    assert.notEqual(source, helper, 'World-frame mutation must change the actual binding');
    await assert.rejects(descriptorOverlay({ [helperPath]: source }), /world frame/);
  }
});

test('typed renderer closure rejects forbidden scene APIs, styles, hidden imports and extra cameras', async () => {
  const file = 'src/renderers/css/runtime/object-runtime.ts', source = await readFile(file, 'utf8');
  const rendererMutations: readonly [string, RegExp][] = [
    ["document.createElement(('canvas' as const));", /Forbidden runtime canvas/],
    ["document.createElementNS('http://www.w3.org/2000/svg', 'svg');", /Forbidden runtime canvas/],
    ["function hidden(node: HTMLElement) { node.style.filter = 'blur(2px)'; }", /Forbidden runtime CSS/],
    ["function hidden(node: HTMLElement) { node.style.background = 'linear-gradient(red, blue)'; }", /Forbidden runtime CSS/],
    ["function hidden(node: HTMLElement) { node.style.setProperty('mask-image', 'url(mask.png)'); }", /Forbidden runtime CSS/],
    ["import('./hidden.js');", /Dynamic runtime imports/],
    ["import { createPolyCamera } from '@layoutit/polycss'; (createPolyCamera as typeof createPolyCamera)({});", /native camera factory site; found 2/],
    ["function hidden() { createObjectRuntime({}); }", /actual shared factory call/],
  ];
  for (const [injected, expected] of rendererMutations) await assert.rejects(descriptorOverlay({ [file]: `${source}\n${injected}` }), expected);
});

test('typed shell compatibility exports remain inside the checked runtime closure', async () => {
  const report = await descriptorOverlay();
  for (const file of ['site/runtime-policy.mts', 'site/scene-contract.mts']) {
    assert.ok(report.sharedClosure.includes(file), file);
    assert.match(report.sourceHashes[file], /^[a-f0-9]{64}$/, file);
    const source = await readFile(file, 'utf8');
    await assert.rejects(descriptorOverlay({
      [file]: `${source}\ndocument.createElement(('canvas' as const));`,
    }), /Forbidden runtime canvas/);
  }
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
  const audit = (changes: SourceOverlay) => auditObjectRuntimeOwnership({ objects: OBJECTS.filter(object => object.id === 'sun'),
    readText: (path: string) => Object.hasOwn(changes, relativeFile(path)) ? requirePresent(changes[relativeFile(path)], relativeFile(path)) : readFile(path, 'utf8') });
  const report = await audit({});
  assert.equal(report.complete, true);
  assert.equal(report.cameraFactorySites.length, 1);
  assert.ok(report.sharedClosure.includes('src/renderers/css/index.ts'));
  assert.ok(report.sharedClosure.includes('src/renderers/css/universe/world-context-runtime.ts'));
  assert.ok(report.sharedClosure.includes('src/renderers/css/universe/prepared-world-context.ts'));
  assert.ok(!report.sharedClosure.includes('src/platform/object-runtime.mts'));
  assert.ok(report.sharedClosure.includes('src/renderers/css/navigation/index.ts'));
  assert.ok(report.sharedClosure.includes('src/renderers/css/runtime/object-runtime.ts'));
  assert.ok(!report.sharedClosure.some(file => /^src\/planets\/[^/]+\/runtime\//u.test(file)));
  for (const file of ['site/scene-router.mts', 'site/view-url-runtime.mts', 'site/prepared-world-navigation.mts']) {
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

test('a shared registry loader factory must forward one unchanged descriptor without side effects', async () => {
  const path = 'site/objects.mts', original = await readFile(path, 'utf8');
  const options = (overrides: string): AuditOptions => ({ objects: [requirePresent(OBJECTS[0], 'first registry object')], readText: async (file: string) =>
    file === resolve(path) ? overrides : readFile(file, 'utf8') });
  const accepted = await auditObjectRuntimeOwnership(options(original));
  assert.equal(accepted.entries[0].factoryCalls, 1);
  const loaderMutations: readonly [string, string, RegExp][] = [
    ['async () => {', 'async () => { console.log(descriptor);', /loader factory/],
    ['return loadPackagedObject(descriptor);', 'return loadPackagedObject({ ...descriptor });', /bound descriptor unchanged/],
    ['return loadPackagedObject(descriptor);', 'return loadPackagedObject(venusDescriptor);', /bound descriptor unchanged/],
    ['catalogEntry(descriptor,', 'catalogEntry(otherDescriptor,', /bound descriptor unchanged/],
  ];
  for (const [before, after, reason] of loaderMutations) {
    const changed = original.replace(before, after);
    assert.notEqual(changed, original, 'The mutation must alter the actual shared loader');
    await assert.rejects(auditObjectRuntimeOwnership(options(changed)), reason);
  }
});

test('every independently selected registry object closes over exactly its own native camera assembly', async () => {
  for (const object of OBJECTS) {
    const report = await auditObjectRuntimeOwnership({ objects: [object] });
    assert.equal(report.complete, true, object.id);
    assert.equal(report.cameraFactorySites.length, 1, object.id);
  }
});

test('the generated catalogue is checked as data without executing source overlays', async () => {
  const file = 'site/prepared-object-catalog.mts', source = await readFile(file, 'utf8');
  const payload = '__cataloguePayloadExecuted';
  Reflect.deleteProperty(globalThis, payload);
  for (const changed of [source + `\nglobalThis.${payload} = true;`,
    source.replace('= [', '= [unknownDescriptor,')]) {
    assert.notEqual(changed, source);
    await assert.rejects(descriptorOverlay({ [file]: changed }), /prepared catalogue/);
  }
  assert.equal(Reflect.get(globalThis, payload), undefined);
  const descriptor = 'src/planets/mercury/object.json';
  const value = JSON.parse(await readFile(descriptor, 'utf8'));
  await assert.rejects(descriptorOverlay({ [descriptor]: JSON.stringify({ ...value, id: 'other-body' }) }), /own actual JSON descriptor/);
});

test('descriptor context binding pins both prepared contexts to the shared factories and physical references', async () => {
  const contextFile = 'src/planets/sun/prepared/world-context.json';
  const packagedFile = 'site/packaged-object-runtime.mts', applicationFile = 'site/application-world-context.mts', starsDescriptorFile = 'src/objects/stellar-neighbourhood/object.json';
  const starsPayloadFile = 'src/objects/stellar-neighbourhood/prepared/stars.json';
  const [contextText, packaged, application, starDescriptorText, starsPayloadText] = await Promise.all([
    readFile(contextFile, 'utf8'), readFile(packagedFile, 'utf8'), readFile(applicationFile, 'utf8'),
    readFile(starsDescriptorFile, 'utf8'), readFile(starsPayloadFile, 'utf8'),
  ]);
  const contextInput = requireRecord(JSON.parse(contextText), 'world context');
  const context: ContextValue = {
    ...contextInput,
    bodies: requireArray(contextInput.bodies, 'world context.bodies').map((value, index): ContextBody => {
      const body = requireRecord(value, `world context.bodies[${index}]`);
      const orbit = body.orbit === undefined ? undefined : requireRecord(body.orbit, `world context.bodies[${index}].orbit`);
      return { ...body, id: requireString(body.id, `world context.bodies[${index}].id`), positionM: body.positionM, ...(orbit === undefined ? {} : { orbit: { ...orbit, centerBodyId: requireString(orbit.centerBodyId, `world context.bodies[${index}].orbit.centerBodyId`) } }) };
    }),
    orbitCenters: Object.fromEntries(Object.entries(requireRecord(contextInput.orbitCenters, 'world context.orbitCenters')).map(([id, value]) => {
      const center = requireRecord(value, `world context.orbitCenters.${id}`);
      return [id, { ...center, positionM: center.positionM, centerBodyId: requireString(center.centerBodyId, `world context.orbitCenters.${id}.centerBodyId`) }];
    })),
    volume: requireRecord(contextInput.volume, 'world context.volume'), frame: requireRecord(contextInput.frame, 'world context.frame'), stars: requireRecord(contextInput.stars, 'world context.stars'),
  };
  const starDescriptor = requireRecord(JSON.parse(starDescriptorText), 'stellar-neighbourhood descriptor');
  const starPrepared = requireRecord(starDescriptor.prepared, 'stellar-neighbourhood descriptor.prepared');
  const starProperties = requireRecord(starDescriptor.properties, 'stellar-neighbourhood descriptor.properties');
  const starFrame = requireRecord(starProperties.frame, 'stellar-neighbourhood descriptor.properties.frame');
  const audit = (changes: SourceOverlay) => auditObjectRuntimeOwnership({ objects: OBJECTS.filter(object => object.id === 'sun'),
    readText: (path: string) => Object.hasOwn(changes, relativeFile(path)) ? requirePresent(changes[relativeFile(path)], relativeFile(path)) : readFile(path, 'utf8') });
  const report = await audit({});
  assert.equal(report.complete, true);
  assert.ok(report.sharedClosure.includes(contextFile));
  // Patroclus now has a visible package. Retain coverage of the supported
  // coordinate-only parent form using the same physical source position.
  const primary = context.bodies.find(body => body.id === 'patroclus');
  assert.ok(primary);
  const coordinateContext = { ...context,
    bodies: context.bodies.filter(body => body !== primary),
    orbitCenters: { ...context.orbitCenters,
      patroclus: { positionM: primary.positionM, centerBodyId: requirePresent(primary.orbit, 'Patroclus orbit').centerBodyId } } };
  assert.equal((await audit({ [contextFile]: JSON.stringify(coordinateContext) })).complete, true);
  const orbitless = { ...context, bodies: context.bodies.map((body, index) => {
    if (index) return body;
    const { orbit, ...point } = body;
    return point;
  }) };
  assert.equal((await audit({ [contextFile]: JSON.stringify(orbitless) })).complete, true,
    'An orbitless physical point does not require fabricated orbital geometry');
  const contextMutations: [SourceOverlay, RegExp][] = [
    [{ [packagedFile]: packaged.replace("with { type: 'json' }", '') }, /forward its prepared transport/],
    [{ [contextFile]: JSON.stringify({ ...context, volume: { ...context.volume, objectId: '../milky-way' } }) }, /volume identity is not pinned/],
    [{ [contextFile]: JSON.stringify({ ...context, frame: { ...context.frame, originM: [1, 0, 0] } }) }, /physical frame/],
    [{ [contextFile]: JSON.stringify({ ...context, bodies: [] }) }, /body inventory/],
    [{ [contextFile]: JSON.stringify({ ...coordinateContext, orbitCenters: undefined }) }, /body orbit parent/],
    [{ [contextFile]: JSON.stringify({ ...coordinateContext, orbitCenters: { patroclus: { ...coordinateContext.orbitCenters.patroclus, positionM: [0, 0, 0] } } }) }, /body orbit parent/],
    [{ [contextFile]: JSON.stringify({ ...coordinateContext, orbitCenters: { patroclus: { ...coordinateContext.orbitCenters.patroclus, centerBodyId: 'patroclus' } } }) }, /parent hierarchy/],
    [{ [contextFile]: JSON.stringify({ ...context, orbitCenters: { ...context.orbitCenters, unused: { positionM: [0, 0, 0], centerBodyId: 'missing' } } }) }, /parent hierarchy/],
    [{ [contextFile]: JSON.stringify({ ...context, orbitCenters: { ...context.orbitCenters, sun: { positionM: [0, 0, 0], centerBodyId: 'sun' } } }) }, /orbit centre identity/],
    [{ [contextFile]: JSON.stringify({ ...coordinateContext, orbitCenters: { patroclus: { ...coordinateContext.orbitCenters.patroclus, radiusM: 1 } } }) }, /orbit centre identity/],
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
    [{ [applicationFile]: application.replace('loadPreparedCssSurfaceShell', 'loadPreparedCssVolume') }, /Application world context/],
    [{ [starsDescriptorFile]: JSON.stringify({ ...starDescriptor, prepared: { ...starPrepared, sha256: '0'.repeat(64) } }) }, /point field.*(?:identity|hash).*drifted/],
    [{ [starsDescriptorFile]: JSON.stringify({ ...starDescriptor, properties: { ...starProperties, frame: { ...starFrame, epochJdTt: 0 } } }) }, /point field.*frame/],
    (() => {
      const payload = requireRecord(JSON.parse(starsPayloadText), 'stellar-neighbourhood payload'); requireRecord(payload.data, 'stellar-neighbourhood payload.data').id = 'wrong-field';
      const bytes = JSON.stringify(payload), descriptor = { ...starDescriptor, prepared: { ...starPrepared,
        sha256: createHash('sha256').update(bytes).digest('hex') } };
      return [{ [starsDescriptorFile]: JSON.stringify(descriptor), [starsPayloadFile]: bytes }, /point field.*identity/];
    })(),
  ];
  for (const [changes, expected] of contextMutations) await assert.rejects(audit(changes), expected);
});


test('shell-only JSON is parsed as data and malformed or executable content is rejected', () => {
  const inspect = (source: string) => inspectObjectRuntimeModule(source, 'site/source/example.json', { shared: true, shellContent: true });
  assert.equal(inspect('{"label":"Solar System"}').dataOnly, true);
  for (const invalid of ['{"label":}', 'document.createElement("canvas")']) {
    assert.equal(inspect(invalid).violations.length, 1);
  }
});
