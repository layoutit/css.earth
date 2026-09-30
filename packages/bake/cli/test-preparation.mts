import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleRendererPackage } from '@cssearth/bake/preparation';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const engineRequire = createRequire(resolve(root, 'packages/engine/package.json'));
const output = resolve(root, '.local/preparation-tests');
const universeOnly = process.argv.length === 3 && process.argv[2] === '--universe';
if (process.argv.length > 2 && !universeOnly) throw new TypeError('Usage: test-preparation.mts [--universe]');
const universeEntries = [
  'packages/bake/src/galaxy-catalog/galaxy-catalog.test.ts',
  'packages/bake/src/galaxy-catalog/bibliography.test.ts',
  'packages/bake/src/cluster-catalog/cluster-catalog.test.ts',
  'packages/bake/src/image-layers/image-layers.test.ts',
  'packages/bake/src/density/volume.test.ts',
  // `@cssearth/bake` declares no side effects, so a bundled suite cannot pull another in by a bare import: list each one.
  'packages/bake/src/density/retirement.test.ts',
  'packages/bake/src/density/column-depth.test.ts',
  'packages/bake/src/sky/sky.test.ts',
  'packages/bake/src/volume-leaves/volume.test.ts',
  'packages/bake/src/volume-leaves/volume-impostors.test.ts',
  'packages/bake/src/world-context/spatial-context.test.ts',
  'packages/bake/src/objects/scene/world-navigation.test.ts',
  'packages/bake/src/stars/stars.test.ts',
  'packages/bake/src/shell/shell.test.ts',
  'packages/bake/src/shell/mesh-subdivision.test.ts',
];
// Relocated contracts and oracles retain their original Node/audit lanes. Moving them beside an object module
// must not also admit them to preparation discovery, which previously only reached tests/objects/.
const NON_PREPARATION_TESTS: readonly string[] = [
  'packages/bake/src/objects/lineage/body-lineage.test.mts',
  'packages/bake/src/objects/cameras/core.oracle.test.mts',
  'packages/bake/src/objects/cameras/pallas.test.mts',
  'packages/bake/src/objects/cameras/sky-orientation.oracle.test.mts',
  'packages/bake/src/objects/cameras/sky-projection.oracle.test.mts',
  'packages/bake/src/objects/cameras/synoptic.test.mts',
  'packages/bake/src/objects/cameras/dart-draco.oracle.test.mts',

  'packages/bake/src/objects/content/prepare-factsheets-cli.test.mts',
  'packages/bake/src/objects/default-view/fixtures/new-horizons-approach.oracle.test.mts',
  'packages/bake/src/objects/layers/terrestrial/fixtures/sbmt/projection.test.mts',
  'packages/bake/src/objects/layers/terrestrial/surface-observations/inspect-osiris-geo.test.mts',
  'packages/bake/src/objects/provenance/object-provenance.test.mts',
  'packages/bake/src/objects/provenance/recover-provenance.test.mts',
  'packages/bake/src/objects/scene/authored-rotation-contract.test.mts',
  'packages/bake/src/objects/sources/source-manifest-parsers.test.mts',
];
async function discover(directory: string, suffix: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    if (['.local', 'dist', 'node_modules', 'unit', 'oracle'].includes(entry.name)) continue;
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await discover(path, suffix));
    else if (entry.name.endsWith(suffix) && !NON_PREPARATION_TESTS.includes(path)) files.push(path);
  }
  return files.sort();
}
const entries = universeOnly ? universeEntries : [...new Set([
  'packages/bake/src/scene/scene.test.ts', 'site/test/charts.test.ts', ...universeEntries,
  ...await discover('tests/objects', '.test.ts'), ...await discover('packages/bake/src/objects', '.test.ts'),
  'packages/bake/src/delivery/operations-assemble.test.ts', 'packages/bake/src/delivery/public-runtime-assets.test.ts',
  'packages/bake/src/scene/leaf-raster-scale.test.ts',
  ...await discover('packages/bake/authoring', '.test.ts'), ...await discover('packages/telescope-cli/authoring', '.test.ts'),
])];
await mkdir(output, { recursive: true });
const compiled: string[] = [];
for (const entry of entries) {
  const outfile = resolve(output, `${compiled.length}.test.mjs`);
  await build({
    entryPoints: [resolve(root, entry)], outfile, bundle: true,
    platform: 'node', format: 'esm', target: 'node22', packages: 'external',
    plugins: [bundleRendererPackage, { name: 'retain-native-modules', setup(builder) {
      builder.onResolve({ filter: /\.m[jt]s$/ }, args => ({
        path: resolve(args.resolveDir, args.path), external: true,
      }));
    } }],
  });
  compiled.push(outfile);
}
function run(args: string[]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// `.mts` entries load natively; esbuild refuses to mark an entry point itself external.
const native = ['site/test/prepare-spatial-context.test.mts',
  ...(universeOnly ? [] : ['site/test/folded-transit.test.mts', 'src/platform/equirectangular-illustration.test.mts', 'src/platform/interpret-source-verification.test.mts', 'src/objects/earth/paged-ellipsoid-scene.test.mts', 'src/platform/astrometric-sky-registration.test.mts', 'src/platform/default-camera.test.mts', 'src/platform/lens-facing.test.mts', 'src/platform/solar-presentation-frame.test.mts', 'src/platform/solar-view-direction.test.mts', 'site/test/lonlat-slice-table.test.mts', 'src/objects/europa/scientific-focus.test.mts']),
  ...(universeOnly ? [] : ['packages/bake/src/astronomy/hosted-eccentric.oracle.test.mts',
    'packages/bake/src/astronomy/hosted-orbit-source.test.mts', 'packages/bake/src/photometry/picaso-limb.test.mts']),
  ...(universeOnly ? [] : ['packages/bake/src/presentation/emissive-plates.test.mts', 'packages/bake/src/raster/raster-pages.test.mts',
    'packages/bake/src/delivery/publication.test.mts', 'packages/bake/src/delivery/publication-inventory.test.mts']),
  ...(universeOnly ? [] : [...await discover('tests/objects', '.test.mjs'), ...await discover('tests/objects', '.test.mts'), ...await discover('packages/bake/src/objects', '.test.mts'), ...await discover('packages/bake/authoring', '.test.mjs'), ...await discover('packages/bake/authoring', '.test.mts'), ...await discover('packages/telescope-cli/authoring', '.test.mjs'), ...await discover('packages/telescope-cli/authoring', '.test.mts')])];
// Individual suites decode large pinned imagery/terrain. Keep file-level work
// bounded as the registry grows; this does not omit any preparation cases.
run(['--test', '--test-concurrency=1', ...compiled, ...native]);
if (!universeOnly) run([resolve(dirname(engineRequire.resolve('vitest/package.json')), 'vitest.mjs'),
  'run', '--root', resolve(root, 'packages/bake/src/presentation'),
  '--exclude', '**/.local/**', 'presentation.test.ts', 'composite-settings.test.ts']);
