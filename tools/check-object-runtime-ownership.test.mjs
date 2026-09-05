import assert from "node:assert/strict";
import test from "node:test";
import { OBJECTS } from "../site/objects.mjs";
import { auditObjectRuntimeOwnership, inspectObjectRuntimeModule } from "./check-object-runtime-ownership.mjs";

const root = "/ownership-fixture";
const client = "src/planets/moon/runtime/client.mjs";
const binding = `import { createObjectRuntime as bind } from '../../../platform/object-runtime.mjs';
import { runtimeDefinition as definition } from './definition.mjs';
export const mountMoonClient = bind(definition);`;
function fixture(extra = {}, definitionTail = "") {
  const files = { [client]: binding,
    "src/planets/moon/runtime/definition.mjs": `import { objectControls } from '../site/control-content.mjs';
export const runtimeDefinition = { controls: objectControls }; ${definitionTail}`,
    "src/planets/moon/site/control-content.mjs": "export const objectControls = { lenses: null, settings: null };",
    "src/platform/object-runtime.mjs": "export function createObjectRuntime(definition) { return definition; }", ...extra };
  // These virtual files exercise syntax/closure traversal. Real CLI checks also
  // import and validate the actual definition and actual content by identity.
  return { root, objects: [{ id: "moon" }], verifyDefinition: async () => {}, readText: async path => {
    const source = files[path.slice(root.length + 1)];
    assert.notEqual(source, undefined, path); return source;
  } };
}

test("follows imported helpers; a thin client cannot conceal a private image coordinator", async () => {
  const options = fixture({ "src/planets/moon/runtime/hidden.mjs": "export function hidden() { return new Image(); }" },
    "import { hidden } from './hidden.mjs'; hidden();");
  await assert.rejects(auditObjectRuntimeOwnership(options), /hidden.mjs.*Image/);
  const inventory = await auditObjectRuntimeOwnership({ ...options, strict: false });
  assert.equal(inventory.complete, false); assert.equal(inventory.entries[0].migrated, false);
  assert.ok(inventory.entries[0].closure.some(path => path.endsWith("hidden.mjs")));
});

test("accepts retained element maps and synchronous prepared material writes", async () => {
  const result = await auditObjectRuntimeOwnership(fixture({},
    "const leaves = new Map(); export function publish(node, prepared) { leaves.set(prepared.id, node); node.style.backgroundPosition = prepared.position; }"));
  assert.equal(result.complete, true); assert.equal(result.entries[0].factoryCalls, 1);
});

for (const source of [
  "import { createLatestSelection as renamed } from '../../../platform/latest-selection.mjs'; renamed({});",
  "import * as runtime from '../../../platform/latest-selection.mjs'; runtime.createLatestSelection({});",
  "node.addEventListener('click', handler);",
  "function hidden() { return Promise.resolve({}); }",
  "function hidden() { return work.then(commit); }",
  "const handle = setTimeout(pump, 120);",
  "animation.playbackRate = 2;", "animation.currentTime = 0;", "animation.play();",
  "async function hidden() { await loader(); }",
  "import('./loader.mjs');",
]) test(`rejects a private runtime owner: ${source.slice(0, 70)}`, () => {
  assert.ok(inspectObjectRuntimeModule(source, "runtime/presentation.mjs").violations.length > 0);
});

test("rejects a wrapped legacy client, duplicate factory calls, and missing real content", async () => {
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [client]: binding + " export function legacy() {}" })), /imports and one bound/);
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ [client]: binding + " bind(definition);" })), /found 2/);
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ "src/planets/moon/runtime/definition.mjs": "export const runtimeDefinition = {};" })), /actual control-content/);
});

for (const dispatch of ["if (definition.id === 'saturn') return;", "const ids=['moon','saturn']; if(ids.includes(definition.id)) return;",
  "switch (definition.id) {case 'moon': return;}"]) test("shared owners reject object-ID dispatch", async () => {
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ "src/platform/object-runtime.mjs": `export function createObjectRuntime(definition) { ${dispatch} }` })), /object-ID dispatch/);
});

test("shared closure rejects an imported object package", async () => {
  await assert.rejects(auditObjectRuntimeOwnership(fixture({ "src/platform/object-runtime.mjs":
    "import { runtimeDefinition } from '../planets/moon/runtime/definition.mjs'; export function createObjectRuntime() {}" })), /Shared runtime imports an object package/);
});

test("a declaration failure cannot be labeled migrated by the closure checker", async () => {
  const options = { ...fixture(), verifyDefinition() { throw new Error("actual content mismatch"); } };
  await assert.rejects(auditObjectRuntimeOwnership(options), /actual content mismatch/);
});

// Overlay controlled changes onto the real existing-object import graph. These
// never create a new object or modify the checkout used by the browser gates.
const actualRoot = process.cwd();
const actualPresentation = 'src/planets/moon/runtime/presentation.mjs';
const actualRuntime = 'src/platform/object-runtime.mjs';
const actualHelper = 'src/platform/private-moon-owner.mjs';
const { readFile } = await import('node:fs/promises');
const actualSource = await readFile(`${actualRoot}/${actualPresentation}`, 'utf8');
const sharedSource = await readFile(`${actualRoot}/${actualRuntime}`, 'utf8');
const regressions = [
  ['private mount', client, binding + '\nexport function mountPrivate() {}', /imports and one bound/],
  ['shell listener', actualPresentation, actualSource + '\ndocument.querySelector(".planet-lenses").addEventListener("click", () => {});', /shell controls|addEventListener/],
  ['image owner', actualPresentation, actualSource + '\nconst privateImage = new Image();', /Image/],
  ['selection scheduler', actualPresentation, actualSource + '\nconst privateSelection = Promise.resolve();', /Native resource\/scheduling/],
  ['playback coordinator', actualPresentation, actualSource + '\nfunction privatePlayback(animation) { animation.playbackRate = 2; animation.play(); }', /playback writes|play is a shared/],
  ['private control binder', actualPresentation, actualSource + '\nimport { createObjectControlBinding } from "../../../platform/object-control-binding.mjs"; createObjectControlBinding({});', /createObjectControlBinding/],
  ['hardcoded shared dispatch', actualRuntime, sharedSource + '\nfunction privateDispatch(definition) { if (definition.id === "moon") return true; }', /object-ID dispatch/],
];
for (const [name, path, source, expected] of regressions) test(`actual registered closure rejects ${name}`, async () => {
  await assert.rejects(auditObjectRuntimeOwnership({ root: actualRoot, objects: [{ id: 'moon' }],
    readText: file => file === `${actualRoot}/${path}` ? source : readFile(file, 'utf8') }), expected);
});
test('actual closure rejects an owner hidden outside the object package', async () => {
  const overlays = new Map([
    [`${actualRoot}/${actualPresentation}`, actualSource + '\nimport { hiddenOwner } from "../../../platform/private-moon-owner.mjs"; hiddenOwner();'],
    [`${actualRoot}/${actualHelper}`, 'export function hiddenOwner() { return new Image(); }'],
  ]);
  await assert.rejects(auditObjectRuntimeOwnership({ root: actualRoot, objects: [{ id: 'moon' }],
    readText: file => overlays.get(file) ?? readFile(file, 'utf8') }), /private-moon-owner.mjs.*Image/);
});
test('the unchanged actual registry has one complete common runtime closure', async () => {
  const report = await auditObjectRuntimeOwnership({ root: actualRoot });
  assert.equal(report.complete, true);
  assert.deepEqual(report.entries.map(entry => entry.id), OBJECTS.map(object => object.id));
  assert.ok(report.entries.every(entry => entry.factoryCalls === 1 && entry.owners.length === 0));
});
