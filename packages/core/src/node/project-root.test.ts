import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { projectRoot } from './index.js';

it('projectRoot walks up to the directory that holds pnpm-workspace.yaml', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
  expect(projectRoot(import.meta.url)).toBe(root);
  expect(projectRoot(pathToFileURL(join(root, 'packages/core/src/index.ts')))).toBe(root);
});
