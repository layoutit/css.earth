#!/usr/bin/env node
/** Run the node tests of the shared object libraries in `@cssearth/bake/objects/<topic>`. Those tests stay beside the
 * preparation pipelines in tools/objects/ (and the contracts in tools/ and tests/objects/), because they read body sources,
 * kernel banks and oracle fixtures through the repository's test helpers, so the package's own Vitest run does not reach them.
 * The node tests that need none of those helpers sit beside their module in packages/bake/src/objects/, which Vitest skips.
 * A test belongs here when it imports an object entry; a moved library's tests therefore join without a list to maintain.
 * Tests whose restored sources are absent skip, as they do everywhere else.
 *
 *   node .github/scripts/checks/test-bake-objects.mts           run them (the packages must be built)
 *   node .github/scripts/checks/test-bake-objects.mts --list    print the selected test files */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Tracked node-test files the selection may take, as `git ls-files` pathspecs. */
export const BAKE_OBJECT_TEST_PATHS = ['tools/**/*.test.mts', 'tools/**/*.test.ts', 'tests/**/*.test.mts', 'tests/**/*.test.ts', 'packages/bake/src/objects/**/*.test.ts'] as const;
const OBJECT_ENTRY = /(?:from|import)\s*\(?\s*['"]@cssearth\/bake\/objects\/(?:layers\/)?[a-z-]+['"]/u;

/** The test files among `files` whose source (read by `read`) imports an `@cssearth/bake/objects/<topic>` or
 * `@cssearth/bake/objects/layers/<kind>` entry, sorted. */
export function bakeObjectTests(files: readonly string[], read: (path: string) => string): string[] {
  return files.filter(path => /\.test\.m?ts$/u.test(path) && OBJECT_ENTRY.test(read(path))).sort();
}

function trackedTests(root: string): string[] {
  return execFileSync('git', ['ls-files', '-z', '--', ...BAKE_OBJECT_TEST_PATHS], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(import.meta.dirname, '../../..');
  const tests = bakeObjectTests(trackedTests(root), path => readFileSync(resolve(root, path), 'utf8'));
  if (!tests.length) throw new Error('No test imports an @cssearth/bake/objects entry; the selection is broken.');
  if (process.argv.includes('--list')) console.log(tests.join('\n'));
  else {
    const run = spawnSync(process.execPath, ['--import', './tests/register-vite-suffix.mts', '--test', '--test-concurrency=4', '--test-timeout=180000', ...tests],
      { cwd: root, stdio: 'inherit' });
    process.exitCode = run.status ?? 1;
  }
}
