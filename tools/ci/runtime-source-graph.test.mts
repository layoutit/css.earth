import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { resolveRuntimeSource } from './runtime-source-graph.mts';

const root = resolve(import.meta.dirname, '../..');
const options = { root, source: (path: string) => readFile(path, 'utf8') };
const importer = resolve(root, 'site/source-documentation.mts');

test('workspace imports close on the source entry of the package export or of a declared subpath export', async () => {
  assert.equal(await resolveRuntimeSource('@cssearth/core', importer, options), resolve(root, 'packages/core/src/index.ts'));
  assert.equal(await resolveRuntimeSource('@cssearth/core/node', importer, options), resolve(root, 'packages/core/src/node/index.ts'));
  assert.equal(await resolveRuntimeSource('@cssearth/core/schema', importer, options), resolve(root, 'packages/core/src/schema.ts'));
});

test('undeclared or nested workspace subpaths stay unclosed', async () => {
  await assert.rejects(resolveRuntimeSource('@cssearth/core/missing', importer, options), /Workspace export is not concrete/u);
  await assert.rejects(resolveRuntimeSource('@cssearth/core/node/hash', importer, options), /Unclosed workspace import/u);
});
