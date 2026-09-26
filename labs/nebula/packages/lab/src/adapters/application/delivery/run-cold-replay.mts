/** Compile with the repository toolchain, then run the explicit bounded gate. */
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd();
const require = createRequire(resolve(root, 'packages/engine/package.json'));
const { build } = createRequire(require.resolve('tsup'))('esbuild');
const output = resolve(root, 'output/nebula-cold-replay/gate.mjs');
await mkdir(resolve(root, 'output/nebula-cold-replay'), { recursive: true });
await build({ entryPoints: [resolve(root, 'labs/nebula/packages/lab/src/adapters/application/delivery/cold-replay.gate.ts')],
  outfile: output, bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external',
  // @cssearth/renderer is bundled as it was when it was relative modules: Node cannot load its TypeScript sources unbundled.
  plugins: [{ name: 'bundle-renderer-package', setup(builder: { onResolve(options: { filter: RegExp }, callback: (args: { path: string; resolveDir: string }) => { path: string }): void }) {
    builder.onResolve({ filter: /^@cssearth\/renderer(?:\/|$)/ }, args => ({ path: createRequire(resolve(args.resolveDir, 'bundle-renderer.cjs')).resolve(args.path) }));
  } }] });
const child = spawnSync(process.execPath, [output, ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
if (child.error) throw child.error;
process.exitCode = child.status ?? 1;
