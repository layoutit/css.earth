import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { projectRoot } from './index.js';

it('projectRoot walks up to the directory that holds pnpm-workspace.yaml', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
  assert.equal(projectRoot(import.meta.url), root);
  assert.equal(projectRoot(pathToFileURL(join(root, 'packages/core/src/index.ts'))), root);
});
