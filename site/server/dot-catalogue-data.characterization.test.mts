import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

const subject = new URL('./dot-catalogue-data.mts', import.meta.url);
const nodeSource = new URL('../prepared/prepared-world-context-node-source.mts', import.meta.url);
const idsSource = new URL('../prepared/prepared-dot-catalogues.json', import.meta.url);
const part = (sources: unknown[], objects: unknown[]) => ({ schema: 'nebula', sources, objects });

function evaluate(ids: unknown = { galaxies: 'galaxy', clusters: 'cluster' }, parts = [
  part([{ id: 'shared', label: 'first' }, { id: 'unique', label: 'unique' }], [{ id: 'a' }]),
  part([{ id: 'shared', label: 'last' }], [{ id: 'b' }]),
]) {
  const directory = mkdtempSync(join(tmpdir(), 'catalogue-import-'));
  try {
    for (const id of ['galaxy', 'cluster']) {
      const folder = join(directory, id);
      mkdirSync(folder);
      writeFileSync(join(folder, 'catalogue.json'), JSON.stringify({ schema: id, frame: `${id}-frame`, objects: [{ id }] }));
    }
    const script = join(directory, 'import.mts');
    writeFileSync(script, `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { mock } from 'node:test';
import { pathToFileURL } from 'node:url';
const subject = ${JSON.stringify(subject.href)};
globalThis.catalogueParts = ${JSON.stringify(parts)};
registerHooks({ load(url, context, nextLoad) {
  if (url !== subject) return nextLoad(url, context);
  const source = readFileSync(new URL(url), 'utf8');
  const start = source.indexOf('import.meta.glob(');
  const end = source.indexOf(')).map(parsePreparedNebulaCatalog)', start);
  assert.ok(start >= 0 && end > start, 'one glob call');
  const replacement = '[...globalThis.catalogueParts]';
  const transformed = source.slice(0, start) + replacement + source.slice(end + 1);
  return { format: 'module', source: stripTypeScriptTypes(transformed, { mode: 'strip' }), shortCircuit: true };
}});
mock.module(${JSON.stringify(import.meta.resolve('@cssearth/objects'))}, { namedExports: {
  PREPARED_NEBULA_CATALOG_SCHEMA: 'nebula',
  parsePreparedGalaxyCatalog: value => { assert.equal(value.schema, 'galaxy');
   return value; },
  parsePreparedClusterCatalog: value => { assert.equal(value.schema, 'cluster');
   return value; },
  parsePreparedNebulaCatalog: value => { assert.equal(value.schema, 'nebula');
   return value; },
}});
mock.module(${JSON.stringify(nodeSource.href)}, { namedExports: {
  nodeProjectFileUrl: (_from, path) => {
    const match = /^src\\/objects\\/(galaxy|cluster)\\/prepared\\/catalogue\\.json$/.exec(path);
  assert.ok(match, 'public project-relative catalogue path');
    return pathToFileURL(${JSON.stringify(directory)} + '/' + match[1] + '/catalogue.json').href;
  },
}});
mock.module(${JSON.stringify(idsSource.href)}, { defaultExport: ${JSON.stringify(ids)} });
const { DOT_CATALOGUES } = await import(subject);
console.log(JSON.stringify(DOT_CATALOGUES));
console.log('IMPORT_OK');
`);
    // The glob load hook pins behavior but changes loaded text. This file is
    // intentionally not measured by the coverage tools; never attest altered text.
    const env = { ...process.env };
    // Node copies the parent's coverage directory when this key is absent.
    // An explicit empty value prevents that propagation and disables collection.
    env.NODE_V8_COVERAGE = '';
    delete env.COVERAGE_SOURCE_DIR;
    delete env.COVERAGE_SOURCE_ROOT;
    const result = spawnSync(process.execPath, ['--experimental-test-module-mocks', script], {
      env, encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024,
    });
    if (result.error) throw result.error;
    return result;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('dot catalogue import joins independent layers and keeps the last duplicate source', () => {
  const result = evaluate();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('IMPORT_OK'));
  const firstLine = result.stdout.split('\n')[0]!;
  assert.deepEqual(JSON.parse(firstLine), {
    galaxies: { schema: 'galaxy', frame: 'galaxy-frame', objects: [{ id: 'galaxy' }] },
    clusters: { schema: 'cluster', frame: 'cluster-frame', objects: [{ id: 'cluster' }] },
    nebulae: { schema: 'nebula', frame: 'galaxy-frame', sources: [{ id: 'shared', label: 'last' }, { id: 'unique', label: 'unique' }], objects: [{ id: 'a' }, { id: 'b' }] },
  });
});

test('dot catalogue import rejects missing and non-string ids for either layer', () => {
  for (const [ids, layer] of [
    [{ clusters: 'cluster' }, 'galaxies'],
    [{ galaxies: 4, clusters: 'cluster' }, 'galaxies'],
    [{ galaxies: 'galaxy' }, 'clusters'],
    [{ galaxies: 'galaxy', clusters: null }, 'clusters'],
  ] as const) {
    const result = evaluate(ids);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes(`names no catalogue for the ${layer} dot layer`), result.stderr);
  }
});

test('dot catalogue import accepts no nebula source parts', () => {
  const result = evaluate(undefined, []);
  assert.equal(result.status, 0, result.stderr);
  const value: unknown = JSON.parse(result.stdout.split('\n')[0]!);
  assert.ok(typeof value === 'object' && value !== null && 'nebulae' in value);
  assert.deepEqual(value.nebulae, { schema: 'nebula', frame: 'galaxy-frame', sources: [], objects: [] });
});
