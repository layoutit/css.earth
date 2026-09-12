/** Run offline lab TypeScript through the repository's existing build toolchain. */
import { createRequire } from 'node:module';
import { mkdir, readdir } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../..');
const packageRequire = createRequire(resolve(root, 'packages/engine/package.json'));
const { build } = createRequire(packageRequire.resolve('tsup'))('esbuild');
const output = resolve(root, '.local/nebula-lab/compiled');
const [command, ...args] = process.argv.slice(2);
const files = await readdir(directory, { recursive: true });
await mkdir(output, { recursive: true });

async function compile(name: string) {
  const outfile = resolve(output, name.replace(/\.ts$/, '.mjs'));
  await build({ entryPoints: [resolve(directory, name)], outfile, bundle: true,
    platform: 'node', format: 'esm', target: 'node22', packages: 'external' });
  return outfile;
}

let execution: string[];
if (command === 'test') {
  const names = files.filter(name => name.endsWith('.test.ts') &&
    (args.length === 0 || args.includes(basename(name).replace(/\.test\.ts$/, '')))).sort();
  if (!names.length) throw new TypeError('No matching lab tests.');
  execution = ['--test', ...await Promise.all(names.map(compile))];
} else if (['browser-shape-cloud-structure', 'browser-shape-cloud-rotation', 'browser-shape-cloud-cache', 'browser-shape-cloud-pose', 'browser-shape-cloud', 'browser-shape-cloud-api', 'prepare-observation-geometry', 'browser-observation-structures', 'prepare-observation-structures', 'prepare-observations', 'browser-observation-alignment', 'browser-nebula-structures', 'prepare-nebula-structures', 'browser-emission', 'prepare-emission', 'verify-nebula', 'bake-nebula', 'promote-volume-lenses', 'browser-removal-strength', 'prepare-overlay-variants', 'browser-overlay-variants', 'prepare-lmc-stars', 'browser-cloud-density', 'browser-cloud-controls', 'prepare-parts', 'browser-filled', 'prepare-filled', 'browser-overlays', 'prepare-overlays', 'prepare-full-density', 'browser-density', 'prepare-particles', 'prepare-master', 'prepare-coherent', 'prepare-prior-window',
  'prepare-structures', 'getsf-run', 'getsf-install', 'extract', 'acquire-images', 'browser-coherent', 'browser-reconstruction-stability', 'browser-reconstruction-reference', 'browser-reconstruction-tabs'].includes(command ?? '')) {
  const entry = files.filter(name => basename(name) === `${command}.ts`);
  if (entry.length !== 1) throw new TypeError(`Expected one lab command entry: ${command}`);
  execution = [await compile(entry[0]!), ...args];
} else {
  throw new TypeError('Usage: run.ts prepare-full-density <recipe.json> | prepare-overlays <recipe.json> | browser-density [base-url] | test [test-name ...] | extract <image> <out> [id] | prepare-particles <recipe.json> <archive.zip> [target-id] | prepare-master <recipe.json> | prepare-coherent <recipe.json> [variant-id] | prepare-prior-window <recipe.json> | prepare-structures <recipe.json> [options] | getsf-install <local-directory> | getsf-run <recipe.json> <installed-getsf> <work-directory> [negative-policy] | acquire-images <recipe.json> | browser-coherent [base-url]');
}
const result = spawnSync(process.execPath, execution, { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
