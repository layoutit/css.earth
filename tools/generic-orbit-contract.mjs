import { auditObjectRuntimeOwnership } from "./check-object-runtime-ownership.mjs";
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { parseAst } from 'vite';
import { OBJECTS } from '../site/objects.mjs';

const controller = 'createRetainedCubicSkyOrbit';
const sharedPath = 'src/platform/cubic-sky-runtime.mjs';
const sharedOnly = new Set([
  'createPolyOrbitControls', 'createUnboundedMatrixDragControls',
  'createCubicSkyCameraOrientation', 'createPreparedCameraPublisher',
  'bindResponsiveOrbitPolicy', 'selectPreparedResponsiveZoom',
  'measureRetainedPlanetTrackball', 'measureRetainedPlanetFlyToDisc',
]);
const inputEvents = new Set(['pointerdown', 'pointermove', 'pointerup', 'pointercancel',
  'lostpointercapture', 'wheel', 'dblclick', 'resize']);

export function inspectObjectOrbitModule(source, file, root = process.cwd()) {
  // Generated JSON cannot own code or listeners. Parse it as data rather than
  // building a large syntax tree for every prepared geometry/atlas record.
  const data = source.match(/^\s*(?:\/\/[^\n]*\n)*export const \w+ = Object\.freeze\(([\s\S]*)\);\s*$/);
  if (data) { try { JSON.parse(data[1]); return { imports: [], calls: 0 }; } catch {} }
  const ast = parseAst(source), imports = [], controllerNames = new Set();
  for (const node of ast.body) if (node.type === 'ImportDeclaration') {
    const path = node.source.value;
    imports.push(path);
    for (const specifier of node.specifiers) {
      const name = specifier.imported?.name;
      assert.ok(!sharedOnly.has(name), `${file}: ${name} belongs to the shared controller`);
      if (name === controller) {
        assert.equal(relative(root, resolve(dirname(resolve(root, file)), path)), sharedPath,
          `${file}: orbit must come from the shared implementation`);
        controllerNames.add(specifier.local.name);
      }
    }
  }
  let calls = 0;
  walk(ast, (node) => {
    if (node.type !== 'CallExpression') return;
    if (node.callee.type === 'Identifier' && controllerNames.has(node.callee.name)) calls += 1;
    const property = node.callee.type === 'MemberExpression'
      ? node.callee.property.name ?? node.callee.property.value : null;
    assert.ok(!sharedOnly.has(property), `${file}: ${property} belongs to the shared controller`);
    if (property === 'addEventListener') assert.ok(!inputEvents.has(node.arguments[0]?.value),
      `${file}: ${node.arguments[0]?.value} listener belongs to the shared controller`);
  });
  return { imports, calls };
}

export async function auditGenericOrbitOwnership({ objects = OBJECTS, root = process.cwd(), readText = (path) => readFile(path, 'utf8') } = {}) {
  const ownership = await auditObjectRuntimeOwnership({ objects, root, readText });
  const runtimeFile = 'src/platform/object-runtime.mjs';
  const ast = parseAst(await readText(resolve(root, runtimeFile)));
  const imported = ast.body.filter(node => node.type === 'ImportDeclaration').flatMap(node =>
    node.specifiers.filter(specifier => specifier.imported?.name === controller).map(specifier => ({
      name: specifier.local.name, path: relative(root, resolve(dirname(resolve(root, runtimeFile)), node.source.value)),
    })));
  assert.equal(imported.length, 1, 'Common runtime must import exactly one shared orbit implementation');
  assert.equal(imported[0].path, sharedPath, 'Common runtime orbit import must use the shared controller');
  let bindings = 0, calls = 0;
  walk(ast, node => {
    if (node.type === 'Property' && node.key?.name === 'createOrbit' && node.value?.type === 'Identifier' && node.value.name === imported[0].name) bindings++;
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' &&
        node.callee.object.name === 'environment' && node.callee.property.name === 'createOrbit') calls++;
  });
  assert.equal(bindings, 1, 'Exactly one shared orbit construction binding is required');
  assert.equal(calls, 1, 'Exactly one shared orbit construction call is required');
  const entries = [];
  for (const entry of ownership.entries) {
    const files = entry.closure.filter(file => !ownership.sharedClosure.includes(file));
    for (const file of files) {
      const facts = inspectObjectOrbitModule(await readText(resolve(root, file)), file, root);
      assert.equal(facts.calls, 0, `${entry.id}: object closures cannot construct a second orbit`);
    }
    entries.push({ id: entry.id, owner: runtimeFile, runtimeModules: files.length, sharedControllerCalls: calls });
  }
  return { entries, sharedClosure: ownership.sharedClosure };
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const child of value) walk(child, visit);
    else if (value && typeof value === 'object') walk(value, visit);
  }
}
