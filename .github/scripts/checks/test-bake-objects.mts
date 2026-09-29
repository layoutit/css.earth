#!/usr/bin/env node
/** Run the node tests of the shared object libraries in `@cssearth/bake/objects/<topic>`. Those tests stay beside the
 * authoring scripts under each package's authoring/ folder and the contracts in tests/, because they read body sources,
 * kernel banks and oracle fixtures through the repository's test helpers, so the package's own Vitest run does not reach them.
 * The node tests that need none of those helpers sit beside their module in packages/bake/src/objects/, which Vitest skips.
 * Tests importing an object entry belong here, together with the explicitly listed relocated Node suites that do not.
 * Preparation suites keep their separate `pnpm test:preparation` lane; neither location nor `node:test` selects them here.
 * Tests whose restored sources are absent skip, as they do everywhere else.
 *
 *   node .github/scripts/checks/test-bake-objects.mts           run them (the packages must be built)
 *   node .github/scripts/checks/test-bake-objects.mts --list    print the selected test files */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Relocated suites without an object-entry import. Keep this list explicit so preparation suites cannot join by accident. */
const RELOCATED_NODE_TESTS: readonly string[] = [
  'packages/bake/src/delivery/operations-assemble.test.ts',
  'packages/bake/src/delivery/public-runtime-assets.test.ts',
  'packages/bake/src/delivery/publication-inventory.test.mts',
  'packages/bake/src/delivery/publication.test.mts',
  'packages/bake/src/objects/acquisition/acquisition-request.test.ts',
  'packages/bake/src/objects/layers/terrestrial/fixtures/comets/comet-lightcurve-models.test.mts',
  'packages/bake/src/objects/layers/terrestrial/fixtures/comets/comet-radar-models.test.mts',
  'packages/bake/src/objects/layers/terrestrial/fixtures/comets/comet-radius-models.test.mts',
  'packages/bake/src/objects/sources/fixtures/distant-world-sources.test.mts',
  'packages/bake/src/objects/sources/fixtures/source-fixture.test.mts',
  'packages/bake/src/objects/sphere-survey/commands-root.test.mts',
  'packages/bake/src/objects/sphere-survey/survey-install-spawns.test.mts',
  'packages/bake/src/presentation/emissive-plates.test.mts',
  'packages/bake/src/raster/raster-pages.test.mts',
  'packages/bake/src/scene/leaf-raster-scale.test.ts',
];
/** Tracked test files the Node selection may take, as `git ls-files` pathspecs. */
export const BAKE_OBJECT_TEST_PATHS = ['tests/**/*.test.mts', 'tests/**/*.test.ts', 'packages/bake/src/objects/**/*.test.ts', 'packages/bake/src/objects/**/*.test.mts', 'packages/bake/authoring/**/*.test.mts', 'packages/telescope-cli/authoring/**/*.test.mts', ...RELOCATED_NODE_TESTS] as const;
const OBJECT_ENTRY = /(?:from|import)\s*\(?\s*['"]@cssearth\/bake\/objects\/(?:layers\/)?[a-z-]+['"]/u;
/** Tests of an object entry that read the restored prepared packages of real bodies, so they run where those are restored:
 * the source-catalogue step of audit.yml's prepared-universe job. */
export const RESTORED_PACKAGE_TESTS: readonly string[] = ['packages/bake/src/objects/provenance/object-provenance.test.mts'];

/** Object-entry tests and relocated bake Node suites, sorted, except tests requiring restored packages. */
export function bakeObjectTests(files: readonly string[], read: (path: string) => string): string[] {
  return files.filter(path => /\.test\.m?ts$/u.test(path) && !RESTORED_PACKAGE_TESTS.includes(path) && (OBJECT_ENTRY.test(read(path)) || RELOCATED_NODE_TESTS.includes(path))).sort();
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
