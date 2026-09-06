import { spawnSync } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engineRequire = createRequire(resolve(root, 'packages/engine/package.json'));
const { build } = createRequire(engineRequire.resolve('tsup'))('esbuild');
const output = resolve(root, '.local/preparation-tests');
const entries = [
  'src/renderers/css/preparation/scene/scene.test.ts',
  'tools/objects/celestial/celestial.test.ts',
  'tests/objects/operations.test.ts',
  'tests/objects/charts.test.ts',
];
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
const native = (await readdir(resolve(root, 'tests/objects')))
  .filter(name => name.endsWith('.test.mjs'))
  .map(name => resolve(root, 'tests/objects', name));
run(['--test', ...compiled, ...native]);
run([resolve(dirname(engineRequire.resolve('vitest/package.json')), 'vitest.mjs'),
  'run', 'src/renderers/css/preparation/presentation/presentation.test.ts']);
