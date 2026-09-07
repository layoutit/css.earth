/** Run offline lab TypeScript through the repository's existing build toolchain. */
import { createRequire } from 'node:module';
import { mkdir, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
const packageRequire = createRequire(resolve(root, 'packages/engine/package.json'));
const { build } = createRequire(packageRequire.resolve('tsup'))('esbuild');
const output = resolve(root, '.local/nebula-lab/compiled');
const [command, ...args] = process.argv.slice(2);
await mkdir(output, { recursive: true });

async function compile(name: string) {
  const outfile = resolve(output, name.replace(/\.ts$/, '.mjs'));
  await build({ entryPoints: [resolve(directory, name)], outfile, bundle: true,
    platform: 'node', format: 'esm', target: 'node22', packages: 'external' });
  return outfile;
}

let execution: string[];
if (command === 'test') {
  const names = (await readdir(directory)).filter(name => name.endsWith('.test.ts') &&
    (args.length === 0 || args.includes(name.replace(/\.test\.ts$/, '')))).sort();
  if (!names.length) throw new TypeError('No matching lab tests.');
  execution = ['--test', ...await Promise.all(names.map(compile))];
} else if (command === 'prepare-particles' || command === 'prepare-master' || command === 'extract' || command === 'acquire-images') {
  execution = [await compile(`${command}.ts`), ...args];
} else {
  throw new TypeError('Usage: run.ts test [test-name ...] | extract <image> <out> [id] | prepare-particles <recipe.json> <archive.zip> [target-id] | prepare-master <recipe.json> | acquire-images <recipe.json>');
}
const result = spawnSync(process.execPath, execution, { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
