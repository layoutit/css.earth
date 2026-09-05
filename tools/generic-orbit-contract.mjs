import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
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
  const entries = [];
  for (const object of objects) {
    const directory = resolve(root, 'src/planets', object.id, 'runtime');
    const files = await modules(directory);
    let calls = 0;
    const owners = [];
    for (const absolute of files) {
      const file = relative(root, absolute);
      const facts = inspectObjectOrbitModule(await readText(absolute), file, root);
      calls += facts.calls;
      if (facts.calls) owners.push(file);
    }
    assert.equal(calls, 1, `${object.id}: exactly one shared orbit construction in its runtime package`);
    entries.push({ id: object.id, owner: owners[0], runtimeModules: files.length, sharedControllerCalls: calls });
  }
  const visited = new Set();
  async function visit(path) {
    if (visited.has(path)) return;
    visited.add(path);
    assert.ok(!relative(root, path).startsWith('src/planets/'), 'Shared orbit imports an object package');
    const source = await readText(path);
    const ast = parseAst(source);
    for (const node of ast.body) {
      if (node.type === 'ImportDeclaration' && node.source.value.startsWith('.') && node.source.value.endsWith('.mjs'))
        await visit(resolve(dirname(path), node.source.value));
    }
  }
  await visit(resolve(root, sharedPath));
  return { entries, sharedClosure: [...visited].map(path => relative(root, path)).sort() };
}

async function modules(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await modules(path));
    else if (entry.name.endsWith('.mjs')) files.push(path);
  }
  return files.sort();
}
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const child of value) walk(child, visit);
    else if (value && typeof value === 'object') walk(value, visit);
  }
}
