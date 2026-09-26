import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleRendererPackage } from '../cli/bundle-renderer.mts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const engineRequire = createRequire(resolve(root, 'packages/engine/package.json'));
const output = resolve(root, '.local/preparation-tests');
const universeOnly = process.argv.length === 3 && process.argv[2] === '--universe';
if (process.argv.length > 2 && !universeOnly) throw new TypeError('Usage: test-preparation.mts [--universe]');
const universeEntries = [
  'src/preparation/galaxy-catalog/galaxy-catalog.test.ts',
  'src/preparation/galaxy-catalog/bibliography.test.ts',
  'src/preparation/cluster-catalog/cluster-catalog.test.ts',
  'src/preparation/image-layers/image-layers.test.ts',
  'src/preparation/volume/volume.test.ts',
  'src/preparation/volume/column-depth.test.ts',
  'packages/bake/src/sky/sky.test.ts',
  'packages/bake/src/volume-leaves/volume.test.ts',
  'packages/bake/src/volume-leaves/volume-impostors.test.ts',
  'src/preparation/spatial-context.test.ts',
  'tools/objects/prepare-spatial-context.test.ts',
  'tools/objects/world-navigation.test.ts',
  'packages/bake/src/stars/stars.test.ts',
  'packages/bake/src/shell/shell.test.ts',
  'packages/bake/src/shell/mesh-subdivision.test.ts',
];
async function discover(directory: string, suffix: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    if (['.local', 'dist', 'node_modules', 'unit', 'oracle'].includes(entry.name)) continue;
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await discover(path, suffix));
    else if (entry.name.endsWith(suffix)) files.push(path);
  }
  return files.sort();
}
const entries = universeOnly ? universeEntries : [...new Set([
  'packages/bake/src/scene/scene.test.ts', ...universeEntries,
  ...await discover('tools/objects', '.test.ts'), ...await discover('tests/objects', '.test.ts'),
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
const native = universeOnly ? [] : [...await discover('tools/objects', '.test.mjs'), ...await discover('tests/objects', '.test.mjs'), ...await discover('tools/objects', '.test.mts'), ...await discover('tests/objects', '.test.mts')];
// Individual suites decode large pinned imagery/terrain. Keep file-level work
// bounded as the registry grows; this does not omit any preparation cases.
run(['--test', '--test-concurrency=1', ...compiled, ...native]);
if (!universeOnly) run([resolve(dirname(engineRequire.resolve('vitest/package.json')), 'vitest.mjs'),
  'run', '--root', resolve(root, 'packages/bake/src/presentation'),
  '--exclude', '**/.local/**', 'presentation.test.ts', 'composite-settings.test.ts']);
