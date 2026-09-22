import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { checkNebulaBoundaries, nebulaPackages } from './package-boundaries.mts';

test('actual illegal imports, missing exports and line overflows fail the package guard', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'nebula-boundaries-'));
  const write = (path: string, value: string) => { const target = resolve(root, path); mkdirSync(resolve(target, '..'), { recursive: true }); writeFileSync(target, value); };
  const source = 'labs/nebula/packages/volume-bake/src/bake.ts';
  try {
    for (const [directory, name] of Object.entries(nebulaPackages)) write(`labs/nebula/packages/${directory}/package.json`, JSON.stringify({
      name, private: true, exports: { '.': './src/index.ts' },
      dependencies: directory === 'volume-core' ? {} : { '@cssearth/volume-core': 'workspace:*' },
    }));
    write(source, "import '@cssearth/volume-core';\n");
    assert.deepEqual(checkNebulaBoundaries(root), []);
    write(source, "import '@cssearth/nebula-reconstruction';\n");
    assert.ok(checkNebulaBoundaries(root).some(error => error.includes('forbidden import reconstruction')));
    write(source, "import '@cssearth/volume-core/private';\n");
    assert.ok(checkNebulaBoundaries(root).some(error => error.includes('non-public import')));
    write(source, "import '../../reconstruction/src/private.ts';\n");
    assert.ok(checkNebulaBoundaries(root).some(error => error.includes('relative import leaves package')));
    write(source, '\n'.repeat(601));
    assert.ok(checkNebulaBoundaries(root).some(error => error.includes('exceeds 600')));
    write(source, "const source = 'src/objects/m42/source/config.json';\n");
    assert.ok(checkNebulaBoundaries(root).some(error => error.includes('object/source path')));
    write(source, 'const load = (name: string) => import(name);\n');
    assert.ok(checkNebulaBoundaries(root).some(error => error.includes('unchecked boundary')));
    write(source, 'export {};\n');
    write('labs/nebula/packages/volume-core/src/index.ts', "import 'node:fs';\n");
    assert.ok(checkNebulaBoundaries(root).some(error => error.includes('core imports platform dependency')));
    write('labs/nebula/packages/volume-core/src/index.ts', "import 'fs';\n");
    assert.ok(checkNebulaBoundaries(root).some(error => error.includes('core imports platform dependency')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('registry-derived celestial dispatch mutations fail without banning schema or physics labels', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'nebula-object-boundaries-'));
  const write = (path: string, value: string) => { const target = resolve(root, path); mkdirSync(resolve(target, '..'), { recursive: true }); writeFileSync(target, value); };
  const source = 'labs/nebula/packages/volume-core/src/dispatch.ts';
  const check = (text: string) => { write(source, text); return checkNebulaBoundaries(root, false); };
  try {
    write('labs/nebula/packages/volume-core/package.json', JSON.stringify({ name: nebulaPackages['volume-core'], private: true, exports: {} }));
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
  const source = 'labs/nebula/packages/volume-bake/src/load.ts';
  const check = (text: string) => { write(source, text); return checkNebulaBoundaries(root, false); };
  const bakeManifest = (dependencies: Record<string, string>) => write('labs/nebula/packages/volume-bake/package.json', JSON.stringify({
    name: nebulaPackages['volume-bake'], private: true, exports: {}, dependencies,
  }));
  try {
    write('labs/nebula/packages/volume-core/package.json', JSON.stringify({ name: nebulaPackages['volume-core'], private: true, exports: { './public': './src/public.ts' } }));
    bakeManifest({ '@cssearth/volume-core': 'workspace:*', sharp: '0.35.3' });
    assert.deepEqual(check("import('node:fs'); import('sharp'); import(`@cssearth/volume-core/public`);"), []);
    for (const mutation of [
      "import('@cssearth/volume-core/' + 'private');",
      "require(`@cssearth/volume-core/private`);",
      "import privateOwner = require('@cssearth/volume-core/private');",
    ]) assert.ok(check(mutation).some(error => error.includes('non-public import')), mutation);
    for (const mutation of ['import(modulePath);', 'require(modulePath);'])
      assert.ok(check(mutation).some(error => error.includes('unchecked boundary')), mutation);
    assert.ok(check("import('/outside/private.ts');").some(error => error.includes('absolute module import')));
    assert.ok(check("import 'undeclared-library/subpath';").some(error => error.includes('undeclared external dependency undeclared-library')));
    bakeManifest({ '@cssearth/volume-core': 'workspace:*' });
    assert.ok(check("import 'sharp';").some(error => error.includes('undeclared external dependency sharp')));
    bakeManifest({ '@cssearth/volume-core': 'workspace:*', sharp: '0.35.3' });
    assert.deepEqual(check("import 'sharp';"), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
