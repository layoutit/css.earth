/** Internal command adapter. Sources are TypeScript; only disposable outputs are JavaScript. */
import { mkdir, readdir } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildLabModule as build } from './build.ts';
import { labCommands } from './commands.ts';

export async function discoverTests(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return []; throw error;
  });
  const lists = await Promise.all(entries.map(async entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return ['node_modules', 'dist', '.cache'].includes(entry.name) ? [] : discoverTests(path);
    return /\.test\.[cm]?tsx?$/.test(path) ? [path] : [];
  }));
  return lists.flat();
}

export async function labTestFiles(root: string): Promise<string[]> {
  return (await Promise.all([discoverTests(resolve(root, 'labs/nebula/packages')), discoverTests(resolve(root, 'packages/volume-viewer/src'))])).flat().sort();
}

/** `*.sources.test.*` files read restored source assets; CI selects around them with --without-sources. Other args name tests. */
export function selectLabTests(files: readonly string[], args: readonly string[]): string[] {
  const withoutSources = args.includes('--without-sources');
  const names = args.filter(arg => arg !== '--without-sources');
  return files.filter(path => !(withoutSources && /\.sources\.test\.[cm]?tsx?$/.test(path)))
    .filter(path => !names.length || names.includes(basename(path).replace(/\.test\.[cm]?tsx?$/, ''))).sort();
}

export async function runLabCommand(root: string, [command, ...args]: string[]): Promise<number> {
  const output = resolve(root, '.local/nebula-lab/compiled');
  async function compile(path: string) {
    const name = relative(root, path);
    if (name.startsWith('..')) throw new TypeError('Command source leaves the repository.');
    const outfile = resolve(output, name.replace(/\.[cm]?tsx?$/, '.mjs'));
    await mkdir(dirname(outfile), { recursive: true });
    await build({ entryPoints: [path], outfile, bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external' });
    return outfile;
  }
  let execution: string[];
  if (command === 'test') {
    const selected = selectLabTests(await labTestFiles(root), args);
    if (!selected.length) throw new TypeError('No matching lab tests.');
    console.log(`NEBULA_TEST_DISCOVERY ${selected.length} test files`);
    execution = ['--test', ...await Promise.all(selected.map(compile))];
  } else {
    const source = command && labCommands[command];
    if (!source) throw new TypeError(`Unknown lab command: ${command ?? '(missing)'}. Available: test, ${Object.keys(labCommands).join(', ')}`);
    execution = [await compile(resolve(root, source)), ...args];
  }
  const result = spawnSync(process.execPath, execution, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}
