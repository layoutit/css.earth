import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFormatReaderFindings, checkSiteBuildFormatReaders } from './site-build-format-readers.mts';

const paths = new Set(['object.json', 'source/content/charts.json']);
const read = "JSON.parse(await readFile(resolve(root, 'object.json'), 'utf8'))";
test('direct file read mutation is red, objects parser is green', () => {
  assert.equal(buildFormatReaderFindings('site/build/read.mts', `const value = ${read};`, paths).length, 1);
  assert.deepEqual(buildFormatReaderFindings('site/build/read.mts', `import { parseObjectDescriptor as parse } from '@cssearth/objects'; const value = parse(${read});`, paths), []);
});
test('unknown binding crosses admission before projection, imports alone do not admit it', () => {
  const prefix = "import { parseObjectDescriptor } from '@cssearth/objects';";
  assert.equal(buildFormatReaderFindings('site/build/read.mts', `${prefix} const value = ${read}; console.log(value.type);`, paths).length, 1);
  assert.deepEqual(buildFormatReaderFindings('site/build/read.mts', `${prefix} const value = ${read}; const parsed = parseObjectDescriptor(value); console.log(parsed.type);`, paths), []);
  assert.equal(buildFormatReaderFindings('site/build/read.mts', `${prefix} const value = ${read}; console.log(value.type); parseObjectDescriptor(value);`, paths).length, 1);
});
test('file path aliases are followed; comments and plain JSON are not schema records', () => {
  assert.equal(buildFormatReaderFindings('site/build/read.mts', "import { resolve } from 'node:path'; const path = resolve(root, 'object.json'); const value = JSON.parse(await readFile(path, 'utf8'));", paths).length, 1);
  assert.deepEqual(buildFormatReaderFindings('site/build/read.mts', "// JSON.parse(await readFile('object.json'))\nconst value = JSON.parse(await readFile('package.json', 'utf8'));", paths), []);
  assert.equal(buildFormatReaderFindings('site/build/read.mts', `const value = JSON.parse('{"schema":"cssearth-object@1"}');`, paths).length, 1);
});
test('registry schemas and tracked data discover paths relative to any checkout', () => {
  const root = mkdtempSync(join(tmpdir(), 'build-readers-'));
  const files = ['packages/objects/src/prepared-data/example.ts', 'src/objects/body/source/recipe.json', 'site/build/read.mts', 'packages/objects/src/prepared-data/format-reader-ledger.ts'];
  try {
    for (const file of files) mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, files[0]!), "export const SCHEMA = 'cssearth-example@1';");
    writeFileSync(join(root, files[3]!), "import { SCHEMA } from './example.js'; export const POLICIES = [{schema: SCHEMA, readers: ['readRecipe'], paths: []}];");
    writeFileSync(join(root, files[1]!), '{"schema":"cssearth-example@1"}');
    writeFileSync(join(root, files[2]!), "const value = JSON.parse(await readFile('source/recipe.json', 'utf8'));" );
    assert.equal(checkSiteBuildFormatReaders(root, files).length, 1);
    writeFileSync(join(root, files[2]!), "import { readRecipe } from '@cssearth/objects'; const value = readRecipe(JSON.parse(await readFile('source/recipe.json', 'utf8')));" );
    assert.deepEqual(checkSiteBuildFormatReaders(root, files), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('format-specific admission rejects the wrong parser and a shadowed import', () => {
  const allowed = new Map([['object.json', new Set(['parseObjectDescriptor'])]]);
  assert.equal(buildFormatReaderFindings('site/build/read.mts', `import { readChartAssetRecipe } from '@cssearth/objects'; readChartAssetRecipe(${read});`, paths, allowed).length, 1);
  assert.equal(buildFormatReaderFindings('site/build/read.mts', `import { parseObjectDescriptor } from '@cssearth/objects'; function f(parseObjectDescriptor: (v: unknown) => unknown) { return parseObjectDescriptor(${read}); }`, paths, allowed).length, 1);
});
test('projecting a field before calling an objects parser is not admission', () => {
  const prefix = "import { parseObjectDescriptor } from '@cssearth/objects';";
  assert.equal(buildFormatReaderFindings('site/build/read.mts', `${prefix} parseObjectDescriptor(${read}.properties);`, paths).length, 1);
  assert.equal(buildFormatReaderFindings('site/build/read.mts', `${prefix} const value = ${read}; parseObjectDescriptor(value.properties);`, paths).length, 1);
  assert.equal(buildFormatReaderFindings('site/build/read.mts', `${prefix} parseObjectDescriptor({ properties: ${read} });`, paths).length, 1);
});
test('generated filenames in literal loops still require their format reader', () => {
  const source = "import { resolve } from 'node:path'; for (const name of ['sky', 'sun'] as const) { const path = resolve(root, `${name}.json`); const value = await readFile(path, 'utf8').then(JSON.parse); }";
  assert.equal(buildFormatReaderFindings('site/build/read.mts', source, new Set(['sky.json', 'sun.json'])).length, 1);
});
test('local transports and parse callbacks require admission at the consumer', () => {
  const prefix = "import { readFile } from 'node:fs/promises'; import { parseObjectDescriptor } from '@cssearth/objects'; const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));";
  assert.equal(buildFormatReaderFindings('site/build/read.mts', `${prefix} const value = await json('object.json'); console.log(value.id);`, paths).length, 1);
  assert.deepEqual(buildFormatReaderFindings('site/build/read.mts', `${prefix} const value = parseObjectDescriptor(await json('object.json'));`, paths), []);
  assert.equal(buildFormatReaderFindings('site/build/read.mts', `${prefix} parseObjectDescriptor(await json('object.json')); const unchecked = await json('object.json');`, paths).length, 1);
  assert.equal(buildFormatReaderFindings('site/build/read.mts', "const value = await readFile('object.json', 'utf8').then(JSON.parse); console.log(value.id);", paths).length, 1);
});
