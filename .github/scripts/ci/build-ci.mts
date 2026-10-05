import { spawn } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compiledCiCacheKeys, type CompiledPackageInput } from './ci-cache-key.mts';

export type CiBuildMode = 'lint' | 'full' | 'packages' | 'generators';
interface CompiledDirectory { path: string; required: readonly string[]; }
export interface CiBuildTask {
  id: string;
  after: readonly string[];
  command: string;
  args: readonly string[];
  outputs?: readonly CompiledDirectory[];
}
const RECEIPT = '.ci-build-files.json';
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const safePath = (value: unknown): value is string => typeof value === 'string' && Boolean(value) && !isAbsolute(value) && !value.split(/[\\/]/u).includes('..');

function packageOutputs(root: string): CompiledDirectory[] {
  return readdirSync(resolve(root, 'packages'), { withFileTypes: true }).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name, 'en')).flatMap(entry => {
    const path = `packages/${entry.name}`, manifest: unknown = JSON.parse(readFileSync(resolve(root, path, 'package.json'), 'utf8'));
    if (!record(manifest) || !record(manifest.scripts)) throw new TypeError(`Invalid package manifest: ${path}`);
    if (typeof manifest.scripts.build !== 'string') return [];
    const entries = [manifest.main, manifest.module, manifest.types, ...Object.values(record(manifest.bin) ? manifest.bin : {})].filter(value => value !== undefined);
    // A package with only subpath entries (`@cssearth/bake/volume`) declares its compiled outputs in `exports`.
    const exported = (value: unknown): unknown[] => typeof value === 'string' ? [value] : record(value) ? Object.values(value).flatMap(exported) : [];
    const declared = entries.length ? entries : exported(manifest.exports).filter(value => typeof value === 'string' && value.startsWith('./dist/'));
    const required = declared.filter((value): value is string => typeof value === 'string').map(value => value.replace(/^\.\//u, '')).map(value => {
      if (!value.startsWith('dist/') || !safePath(value)) throw new TypeError(`Unsupported compiled package output: ${path}/${value}`);
      return value.slice('dist/'.length);
    });
    if (!required.length) throw new TypeError(`No declared compiled package outputs: ${path}`);
    return [{ path: `${path}/dist`, required: [...new Set(required)] }];
  });
}

/** Keep pnpm's native workspace dependency ordering (catalog and engine before renderer). Catalogue
 * discovery imports compiled renderer navigation (@cssearth/renderer/navigation), so it waits for the packages build
 * even when warm files exist.
 * The lint closure intentionally omits navigation/world/font assets, matching the contract checks' imports. */
export function ciBuildPlan(root: string, mode: CiBuildMode): readonly CiBuildTask[] {
  const node = (id: string, file: string, after: readonly string[] = [], args: readonly string[] = []): CiBuildTask =>
    ({ id, after, command: process.execPath, args: [file, ...args] });
  const tasks: CiBuildTask[] = [
    { id: 'packages', after: [], command: 'pnpm', args: ['-r', '--filter', './packages/**', 'build'], outputs: packageOutputs(root) },
    node('titles', 'site/build/prepare/prepare-shell-titles.mts'),
    node('catalog', 'site/build/prepare/prepare-catalog.mts', ['packages']),
    node('solar', 'packages/bake/cli/prepare-solar-geometry.mts', ['catalog']),
  ];
  if (mode === 'full' || mode === 'generators') tasks.push(
    // Hashes icon sources with @cssearth/core/node, so it waits for the packages build.
    node('icons', 'site/build/prepare/prepare-shell-icons.mts', ['packages']),
    node('navigation', 'packages/bake/cli/prepare-navigation.mts', ['solar'], ['--catalog-only']),
    node('world', 'site/build/prepare/prepare-spatial-context.ts', ['navigation'], ['src/objects/sun/source/navigation/universe.json', 'src/objects/sun/prepared/world-context.json']),
    node('moon-labels', 'site/build/prepare/prepare-moon-labels.mts', ['world']),
    node('world-presentation', 'site/build/prepare/prepare-world-presentation.mts', ['world']),
  );
  // Split callers compile before restoring selected inputs. Keep the full generator closure and its
  // internal ordering; only the already-completed package prerequisite leaves this phase.
  if (mode === 'packages') return tasks.filter(task => task.id === 'packages');
  if (mode === 'generators') return tasks.filter(task => task.id !== 'packages')
    .map(task => ({ ...task, after: task.after.filter(id => id !== 'packages') }));
  return tasks;
}

/** Receipts list only the small compiled directories, never the installed tree or restored data banks. The cache
 * receipt names each package's exact inputs; the listing proves the restore is complete: every file present, none empty, none extra. */
function outputInventory(directory: string): string[] {
  const files: string[] = [];
  const visit = (relative: string) => {
    for (const entry of readdirSync(resolve(directory, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (path === RECEIPT) continue;
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) {
        if (!statSync(resolve(directory, path)).size) throw new TypeError(`Empty compiled output: ${directory}/${path}`);
        files.push(path);
      } else throw new TypeError(`Compiled cache outputs must be ordinary files: ${path}`);
    }
  };
  visit('');
  if (!files.length) throw new TypeError(`Empty compiled output directory: ${directory}`);
  return files;
}

export function compiledOutputsValid(root: string, output: CompiledDirectory, digest: string): boolean {
  try {
    const directory = resolve(root, output.path), receipt: unknown = JSON.parse(readFileSync(resolve(directory, RECEIPT), 'utf8'));
    if (!record(receipt) || receipt.schema !== 3 || receipt.digest !== digest || !Array.isArray(receipt.files)) return false;
    const files = receipt.files;
    if (!files.length || !files.every(safePath)) return false;
    if (!output.required.every(path => files.includes(path))) return false;
    // A partial restore, empty file, extra stale chunk or removed declaration invalidates the hit.
    return JSON.stringify(outputInventory(directory)) === JSON.stringify(files);
  } catch { return false; }
}

function recordOutputs(root: string, output: CompiledDirectory, digest: string): void {
  const directory = resolve(root, output.path), files = outputInventory(directory);
  for (const path of output.required) if (!files.includes(path) || !lstatSync(resolve(directory, path)).isFile()) throw new TypeError(`Build did not produce ${output.path}/${path}`);
  writeFileSync(resolve(directory, RECEIPT), JSON.stringify({ schema: 3, digest, files }) + '\n');
}

async function execute(task: CiBuildTask, root: string): Promise<void> {
  await new Promise<void>((accept, reject) => {
    const child = spawn(task.command, [...task.args], { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? accept() : reject(new Error(`${task.id} failed (${signal ?? code}).`)));
  });
}

/** Invalid receipts rebuild their reverse dependency closure, including when a dependency's digest matches
 * but its restored files are incomplete. Explicit filters select exactly that set; pnpm orders the builds. */
export function packageRebuildClosure(packages: readonly CompiledPackageInput[], invalid: readonly string[]): string[] {
  const selected = new Set(invalid);
  let changed = true;
  while (changed) {
    changed = false;
    for (const pkg of packages) if (!selected.has(pkg.name) && pkg.dependencies.some(name => selected.has(name))) {
      selected.add(pkg.name); changed = true;
    }
  }
  return packages.filter(pkg => selected.has(pkg.name)).map(pkg => pkg.name);
}

export async function buildCi({ root = resolve(import.meta.dirname, '../../..'), mode, packages, run = execute,
}: { root?: string; mode: CiBuildMode; packages?: readonly CompiledPackageInput[];
  run?: (task: CiBuildTask, root: string) => Promise<void> }) {
  packages ??= (await compiledCiCacheKeys({ root })).packages;
  const inputs = new Map(packages.map(pkg => [`${pkg.directory}/dist`, pkg]));
  const plan = ciBuildPlan(root, mode), pending = new Map<string, Promise<void>>(), results: { id: string; cached: boolean; seconds: number; rebuilt?: string[] }[] = [];
  for (const task of plan) {
    const parents = task.after.map(id => {
      const parent = pending.get(id);
      if (!parent) throw new TypeError(`Build prerequisite ${id} must precede ${task.id}.`);
      return parent;
    });
    pending.set(task.id, Promise.all(parents).then(async () => {
      const started = performance.now();
      let rebuilt: string[] | undefined;
      if (task.id === 'packages') {
        const outputs = task.outputs ?? [];
        const invalid = outputs.filter(output => {
          const pkg = inputs.get(output.path);
          if (!pkg) throw new TypeError(`Missing compiled input identity: ${output.path}`);
          return !compiledOutputsValid(root, output, pkg.digest);
        }).map(output => inputs.get(output.path)!.name);
        rebuilt = packageRebuildClosure(packages, invalid);
        if (rebuilt.length) {
          await run({ ...task, args: ['-r', ...rebuilt.flatMap(name => ['--filter', name]), 'build'] }, root);
          for (const output of outputs) {
            const pkg = inputs.get(output.path)!;
            if (rebuilt.includes(pkg.name)) recordOutputs(root, output, pkg.digest);
          }
        }
        if (!rebuilt.includes('@cssearth/astronomy') && packages.some(pkg => pkg.name === '@cssearth/astronomy')) {
          // Warm dist does not restore generated TS needed by compiler/test consumers.
          await run({ id: 'astronomy-data', after: [], command: process.execPath, args: ['packages/astronomy/cli/body-records.mts'] }, root);
        }
      } else await run(task, root);
      const cached = task.id === 'packages' && rebuilt?.length === 0;
      const result = { id: task.id, cached, seconds: Number(((performance.now() - started) / 1000).toFixed(3)), ...(rebuilt ? { rebuilt } : {}) };
      results.push(result);
      console.log(`[build-ci] ${task.id}: ${cached ? 'verified package receipts' : 'ran'} ${result.seconds}s`);
    }));
  }
  const completed = await Promise.allSettled(pending.values()), failure = completed.find(result => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv[2];
  if (process.argv.length !== 3 || (mode !== 'lint' && mode !== 'full' && mode !== 'packages' && mode !== 'generators'))
    throw new TypeError('Usage: node .github/scripts/ci/build-ci.mts lint|full|packages|generators');
  const started = performance.now(), results = await buildCi({ mode });
  console.log(JSON.stringify({ mode, seconds: Number(((performance.now() - started) / 1000).toFixed(3)), compiledCacheHits: results.filter(result => result.cached).length, results }));
}
