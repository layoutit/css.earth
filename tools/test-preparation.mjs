import { spawnSync } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engineRequire = createRequire(resolve(root, 'packages/engine/package.json'));
const { build } = createRequire(engineRequire.resolve('tsup'))('esbuild');
const output = resolve(root, '.local/preparation-tests');
const universeOnly = process.argv.length === 3 && process.argv[2] === '--universe';
if (process.argv.length > 2 && !universeOnly) throw new TypeError('Usage: test-preparation.mjs [--universe]');
const universeEntries = [
  'src/preparation/volume/volume.test.ts',
  'src/renderers/css/preparation/volume.test.ts',
  'src/preparation/spatial-context.test.ts',
  'tools/objects/prepare-spatial-context.test.ts',
  'src/preparation/stars/stars.test.ts',
];
async function discover(directory, suffix) {
  const files = [];
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    if (['.local', 'dist', 'node_modules', 'unit', 'browser', 'oracle'].includes(entry.name)) continue;
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await discover(path, suffix));
    else if (entry.name.endsWith(suffix)) files.push(path);
  }
  return files.sort();
}
const entries = universeOnly ? universeEntries : [...new Set([
  'src/renderers/css/preparation/scene/scene.test.ts', ...universeEntries,
  ...await discover('tools/objects', '.test.ts'), ...await discover('tests/objects', '.test.ts'),
])];
await mkdir(output, { recursive: true });
const compiled = [];
for (const entry of entries) {
  const outfile = resolve(output, `${compiled.length}.test.mjs`);
  await build({
    entryPoints: [resolve(root, entry)], outfile, bundle: true,
    platform: 'node', format: 'esm', target: 'node22', packages: 'external',
    plugins: [{ name: 'retain-native-modules', setup(builder) {
      builder.onResolve({ filter: /\.mjs$/ }, args => ({
        path: resolve(args.resolveDir, args.path), external: true,
      }));
    } }],
  });
  compiled.push(outfile);
}
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const native = universeOnly ? [] : [...await discover('tools/objects', '.test.mjs'), ...await discover('tests/objects', '.test.mjs')];
run(['--test', ...compiled, ...native]);
if (!universeOnly) run([resolve(dirname(engineRequire.resolve('vitest/package.json')), 'vitest.mjs'),
  'run', '--root', resolve(root, 'src/renderers/css/preparation/presentation'),
  '--exclude', '**/.local/**', 'presentation.test.ts']);
