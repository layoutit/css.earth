import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { bakePackage, bakeVolumeEntries, checkNebulaBoundaries, nebulaPackages } from './package-boundaries.mts';

const bakeManifest = (write: (path: string, value: string) => void, dependencies: Record<string, string> = {}) => write('packages/bake/package.json', JSON.stringify({
  name: bakePackage, private: true, exports: { './volume': './dist/volume.js', './volume/node': './dist/volume/node.js' }, dependencies,
}));

test('actual illegal imports, missing exports and line overflows fail the package guard', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'nebula-boundaries-'));
  const write = (path: string, value: string) => { const target = resolve(root, path); mkdirSync(resolve(target, '..'), { recursive: true }); writeFileSync(target, value); };
  const source = 'labs/nebula/packages/reconstruction/src/fit.ts';
  try {
    for (const [directory, name] of Object.entries(nebulaPackages)) write(`labs/nebula/packages/${directory}/package.json`, JSON.stringify({
      name, private: true, exports: { '.': './src/index.ts' }, dependencies: { [bakePackage]: 'workspace:*' },
    }));
    bakeManifest(write);
    write(source, `import '${bakeVolumeEntries.main}';\n`);
    assert.deepEqual(checkNebulaBoundaries(root), []);
    write(source, "import '@cssearth/volume-viewer';\n");
    assert.ok(checkNebulaBoundaries(root).some(error => error.includes('forbidden import volume-viewer')));
    // Like volume-bake before it, the volume bake's Node entry is the lab's alone.
    write(source, `import '${bakeVolumeEntries.node}';\n`);
    assert.ok(checkNebulaBoundaries(root).some(error => error.includes(`forbidden import ${bakeVolumeEntries.node}`)));
    write('labs/nebula/packages/lab/src/bake.ts', `import '${bakeVolumeEntries.node}';\n`);
    write(source, 'export {};\n');
    assert.deepEqual(checkNebulaBoundaries(root), []);
    write(source, "import '@cssearth/bake/volume/private';\n");
    assert.ok(checkNebulaBoundaries(root).some(error => error.includes('non-public import')));
    write('labs/nebula/packages/reconstruction/package.json', JSON.stringify({ name: nebulaPackages.reconstruction, private: true, exports: {} }));
    write(source, `import '${bakeVolumeEntries.main}';\n`);
    assert.ok(checkNebulaBoundaries(root).some(error => error.includes(`undeclared workspace import ${bakePackage}`)));
    write('labs/nebula/packages/reconstruction/package.json', JSON.stringify({ name: nebulaPackages.reconstruction, private: true, exports: {}, dependencies: { [bakePackage]: 'workspace:*' } }));
    write(source, "import '../../volume-viewer/src/private.ts';\n");
    assert.ok(checkNebulaBoundaries(root).some(error => error.includes('relative import leaves package')));
    write(source, '\n'.repeat(601));
    assert.ok(checkNebulaBoundaries(root).some(error => error.includes('exceeds 600')));
    write(source, "const source = 'src/objects/m42/source/config.json';\n");
    assert.ok(checkNebulaBoundaries(root).some(error => error.includes('object/source path')));
    write(source, 'const load = (name: string) => import(name);\n');
    assert.ok(checkNebulaBoundaries(root).some(error => error.includes('unchecked boundary')));
    write(source, 'export {};\n');
    assert.deepEqual(checkNebulaBoundaries(root), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the main volume entry keeps volume-core\'s platform ban and never reaches the node entry, a nebula package or another topic', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'nebula-bake-boundaries-'));
  const write = (path: string, value: string) => { const target = resolve(root, path); mkdirSync(resolve(target, '..'), { recursive: true }); writeFileSync(target, value); };
  const main = 'packages/bake/src/volume/fields/field.ts', node = 'packages/bake/src/volume/node/slices/slices.ts';
  const check = (path: string, text: string) => { write(path, text); const errors = checkNebulaBoundaries(root, false); write(path, 'export {};\n'); return errors; };
  try {
    bakeManifest(write, { sharp: '0.35.3', '@cssearth/core': 'workspace:*' });
    assert.deepEqual(check(node, "import 'node:fs'; import 'sharp'; import '../../fields/field.ts'; import '@cssearth/core/node';\n"), []);
    assert.deepEqual(check(main, "import '../contracts/recipe.ts'; import '@cssearth/core';\n"), []);
    for (const mutation of ["import 'node:fs';", "import 'fs';", "import 'sharp';", "import 'react';", "import 'vite';", "import '@layoutit/polycss';"])
      assert.ok(check(main, mutation).some(error => error.includes('core imports platform dependency')), mutation);
    assert.ok(check(main, "import '../node/slices/slices.ts';").some(error => error.includes('core imports the node entry')));
    assert.ok(check(main, "import '../../sky/stars.ts';").some(error => error.includes('relative import leaves package')));
    assert.ok(check(node, `import '${bakeVolumeEntries.main}';`).some(error => error.includes('bake topic imports a bake entry')));
    assert.ok(check(node, "import '@cssearth/nebula-lab/cli';").some(error => error.includes('forbidden import lab')));
    assert.ok(check(node, "import 'undeclared-library';").some(error => error.includes('undeclared external dependency undeclared-library')));
    assert.ok(check(node, "const source = 'src/objects/m42/source/config.json';").some(error => error.includes('object/source path')));
    assert.ok(check(node, 'const load = (name: string) => import(name);').some(error => error.includes('unchecked boundary')));
    assert.ok(check(main, '\n'.repeat(601)).some(error => error.includes('exceeds 600')));
    write('packages/bake/package.json', JSON.stringify({ name: bakePackage, private: true, exports: { './volume': './dist/volume.js' } }));
    assert.ok(checkNebulaBoundaries(root, false).some(error => error.includes('bake: missing volume entries')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('registry-derived celestial dispatch mutations fail without banning schema or physics labels', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'nebula-object-boundaries-'));
  const write = (path: string, value: string) => { const target = resolve(root, path); mkdirSync(resolve(target, '..'), { recursive: true }); writeFileSync(target, value); };
  const source = 'packages/bake/src/volume/fields/dispatch.ts';
  const check = (text: string) => { write(source, text); return checkNebulaBoundaries(root, false); };
  try {
    bakeManifest(write);
    // A new descriptor proves discovery; the guard has no second list of celestial names.
    write('src/objects/new-observation/object.json', JSON.stringify({ id: 'fresh-celestial-id' }));
    for (const mutation of [
      "if (objectId === 'fresh-celestial-id') solveSpecial();",
      "const value = 'fresh-celestial-id' !== subject.id ? 1 : 2;",
      "switch (bodyId) { case 'fresh-celestial-id': solveSpecial(); }",
      "if (['new-observation', 'other'].includes(input['objectId'])) solveSpecial();",
    ]) assert.ok(check(mutation).some(error => error.includes('hardcoded celestial-id branch')), mutation);
    assert.deepEqual(check("if (schema === 'fresh-celestial-id') validate(); if (line.id === 'H-alpha') emit(); if (projection === 'earth') project();"), []);
    assert.deepEqual(check("if (objectId === requestedObjectId) solve(); const metadata = { id: 'fresh-celestial-id' };"), []);
    // Replacing the descriptor, rather than editing a hand-maintained name set, changes enforcement.
    write('src/objects/new-observation/object.json', JSON.stringify({ id: 'replacement-id' }));
    assert.deepEqual(check("if (objectId === 'fresh-celestial-id') solve();"), []);
    assert.ok(check("if (objectId === 'replacement-id') solve();").some(error => error.includes('hardcoded celestial-id branch')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('computed import bypasses and undeclared external dependencies are rejected', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'nebula-module-boundaries-'));
  const write = (path: string, value: string) => { const target = resolve(root, path); mkdirSync(resolve(target, '..'), { recursive: true }); writeFileSync(target, value); };
  const source = 'labs/nebula/packages/reconstruction/src/load.ts';
  const check = (text: string) => { write(source, text); return checkNebulaBoundaries(root, false); };
  const ownerManifest = (dependencies: Record<string, string>) => write('labs/nebula/packages/reconstruction/package.json', JSON.stringify({
    name: nebulaPackages.reconstruction, private: true, exports: {}, dependencies,
  }));
  try {
    bakeManifest(write);
    ownerManifest({ [bakePackage]: 'workspace:*', sharp: '0.35.3' });
    assert.deepEqual(check("import('node:fs'); import('sharp'); import(`@cssearth/bake/volume`);"), []);
    for (const mutation of [
      "import('@cssearth/bake/volume/' + 'private');",
      "require(`@cssearth/bake/volume/private`);",
      "import privateOwner = require('@cssearth/bake/volume/private');",
    ]) assert.ok(check(mutation).some(error => error.includes('non-public import')), mutation);
    for (const mutation of ['import(modulePath);', 'require(modulePath);'])
      assert.ok(check(mutation).some(error => error.includes('unchecked boundary')), mutation);
    assert.ok(check("import('/outside/private.ts');").some(error => error.includes('absolute module import')));
    assert.ok(check("import 'undeclared-library/subpath';").some(error => error.includes('undeclared external dependency undeclared-library')));
    ownerManifest({ [bakePackage]: 'workspace:*' });
    assert.ok(check("import 'sharp';").some(error => error.includes('undeclared external dependency sharp')));
    ownerManifest({ [bakePackage]: 'workspace:*', sharp: '0.35.3' });
    assert.deepEqual(check("import 'sharp';"), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
