import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ciCacheKeys } from './ci-cache-key.mts';

export type CiBuildMode = 'lint' | 'full';
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
    const declared = [manifest.main, manifest.module, manifest.types, ...Object.values(record(manifest.bin) ? manifest.bin : {})];
    const required = declared.filter((value): value is string => typeof value === 'string').map(value => value.replace(/^\.\//u, '')).map(value => {
      if (!value.startsWith('dist/') || !safePath(value)) throw new TypeError(`Unsupported compiled package output: ${path}/${value}`);
      return value.slice('dist/'.length);
    });
    if (!required.length) throw new TypeError(`No declared compiled package outputs: ${path}`);
    return [{ path: `${path}/dist`, required }];
  });
}

/** Keep pnpm's native workspace dependency ordering (astronomy before engine). Catalogue discovery imports
 * compiled renderer navigation, so it must wait for renderer completion even when warm files exist.
 * The preparation bundle ships JS only: type checks read its sources through the root `#preparation/*` imports.
 * The lint closure intentionally omits navigation/world/font assets, matching the contract checks' imports. */
export function ciBuildPlan(root: string, mode: CiBuildMode): readonly CiBuildTask[] {
  const node = (id: string, file: string, after: readonly string[] = [], args: readonly string[] = []): CiBuildTask =>
    ({ id, after, command: process.execPath, args: [file, ...args] });
  const tasks: CiBuildTask[] = [
    { id: 'packages', after: [], command: 'pnpm', args: ['-r', '--filter', './packages/**', 'build'], outputs: packageOutputs(root) },
    node('titles', 'tools/prepare/prepare-shell-titles.mts'),
    { id: 'renderer', after: ['packages'], command: 'pnpm', args: ['--filter', '@cssearth/engine', 'exec', 'tsup', '--config', '../../src/renderers/css/tsup.config.ts'],
      outputs: [{ path: 'src/renderers/css/dist', required: ['index.js', 'index.d.ts', 'navigation.js', 'navigation.d.ts'] }] },
    node('catalog', 'tools/prepare/prepare-catalog.mts', ['renderer']),
    node('solar', 'tools/prepare/prepare-solar-geometry.mts', ['catalog']),
    { id: 'preparation', after: ['renderer', 'solar', 'titles'], command: 'pnpm', args: ['--filter', '@cssearth/engine', 'exec', 'tsup', '--config', '../../tools/objects/tsup.config.ts'],
      outputs: [{ path: 'tools/objects/dist', required: ['operations.js', 'prepare-spatial-context.js'] }] },
  ];
  if (mode === 'full') tasks.push(
    // Hashes icon sources with @cssearth/core/node, so it waits for the packages build.
    node('icons', 'tools/prepare/prepare-shell-icons.mts', ['packages']),
    node('navigation', 'tools/prepare/prepare-navigation.mts', ['solar'], ['--catalog-only']),
    node('world', 'tools/objects/dist/prepare-spatial-context.js', ['preparation', 'navigation'], ['src/objects/sun/source/navigation/universe.json', 'src/objects/sun/prepared/world-context.json']),
    node('moon-labels', 'tools/prepare/prepare-moon-labels.mts', ['world']),
    node('world-presentation', 'tools/prepare/prepare-world-presentation.mts', ['world']),
  );
  return tasks;
}

/** Receipts cover only the small compiled directories, never the installed tree or restored data banks. */
function outputInventory(directory: string): Record<string, string> {
  const files: Record<string, string> = {};
  const visit = (relative: string) => {
    for (const entry of readdirSync(resolve(directory, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (path === RECEIPT) continue;
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) {
        const bytes = readFileSync(resolve(directory, path));
        if (!bytes.length) throw new TypeError(`Empty compiled output: ${path}`);
        files[path] = createHash('sha256').update(bytes).digest('hex');
      } else throw new TypeError(`Compiled cache outputs must be ordinary files: ${path}`);
    }
  };
  visit('');
  if (!Object.keys(files).length) throw new TypeError(`Empty compiled output directory: ${directory}`);
  return files;
}

export function compiledOutputsValid(root: string, output: CompiledDirectory, digest: string): boolean {
  try {
    const directory = resolve(root, output.path), receipt: unknown = JSON.parse(readFileSync(resolve(directory, RECEIPT), 'utf8'));
    if (!record(receipt) || receipt.schema !== 1 || receipt.digest !== digest || !record(receipt.files)) return false;
    const files = receipt.files, entries = Object.entries(files);
    if (!entries.length || !entries.every(([path, hash]) => safePath(path) && typeof hash === 'string' && /^[a-f0-9]{64}$/u.test(hash))) return false;
    if (!output.required.every(path => Object.hasOwn(files, path))) return false;
    // A partial restore, empty/corrupt file, extra stale chunk or removed declaration invalidates the hit.
    return JSON.stringify(outputInventory(directory)) === JSON.stringify(files);
  } catch { return false; }
}

function recordOutputs(root: string, output: CompiledDirectory, digest: string): void {
  const directory = resolve(root, output.path), files = outputInventory(directory);
  for (const path of output.required) if (!Object.hasOwn(files, path) || !lstatSync(resolve(directory, path)).isFile()) throw new TypeError(`Build did not produce ${output.path}/${path}`);
  writeFileSync(resolve(directory, RECEIPT), JSON.stringify({ schema: 1, digest, files }) + '\n');
}

async function execute(task: CiBuildTask, root: string): Promise<void> {
  await new Promise<void>((accept, reject) => {
    const child = spawn(task.command, [...task.args], { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? accept() : reject(new Error(`${task.id} failed (${signal ?? code}).`)));
  });
}

export async function buildCi({ root = resolve(import.meta.dirname, '../..'), mode, cacheHit = false, digest,
  packageCacheHit = cacheHit, rendererCacheHit = cacheHit, packageDigest = digest, rendererDigest = digest, run = execute,
}: { root?: string; mode: CiBuildMode; cacheHit?: boolean; digest: string; packageCacheHit?: boolean; rendererCacheHit?: boolean;
  packageDigest?: string; rendererDigest?: string; run?: (task: CiBuildTask, root: string) => Promise<void> }) {
  for (const identity of [digest, packageDigest, rendererDigest]) if (!/^[a-f0-9]{64}$/u.test(identity)) throw new TypeError('CI build digests must be an exact SHA-256 cache identity.');
  const plan = ciBuildPlan(root, mode), pending = new Map<string, Promise<void>>(), results: { id: string; cached: boolean; seconds: number }[] = [];
  for (const task of plan) {
    const parents = task.after.map(id => {
      const parent = pending.get(id);
      if (!parent) throw new TypeError(`Build prerequisite ${id} must precede ${task.id}.`);
      return parent;
    });
    pending.set(task.id, Promise.all(parents).then(async () => {
      const started = performance.now();
      const identity = task.id === 'packages' ? packageDigest : task.id === 'renderer' ? rendererDigest : digest;
      const hit = task.id === 'packages' ? packageCacheHit : task.id === 'renderer' ? rendererCacheHit : cacheHit;
      const cached = Boolean(hit && task.outputs?.length && task.outputs.every(output => compiledOutputsValid(root, output, identity)));
      if (cached && task.id === 'packages') {
        // The package dist cache intentionally excludes generated TS sources needed by typecheck/tests.
        await run({ id: 'astronomy-data', after: [], command: process.execPath, args: ['packages/astronomy/tools/body-records.mts'] }, root);
      } else if (!cached) {
        await run(task, root);
        for (const output of task.outputs ?? []) recordOutputs(root, output, identity);
      }
      const result = { id: task.id, cached, seconds: Number(((performance.now() - started) / 1000).toFixed(3)) };
      results.push(result);
      console.log(`[build-ci] ${task.id}: ${cached ? 'verified exact cache' : 'ran'} ${result.seconds}s`);
    }));
  }
  // Do not return with concurrent generators/compilers still writing after another task fails.
  const completed = await Promise.allSettled(pending.values()), failure = completed.find(result => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv[2];
  if (process.argv.length !== 3 || (mode !== 'lint' && mode !== 'full')) throw new TypeError('Usage: node tools/ci/build-ci.mts lint|full');
  const flag = (name: string, fallback = false) => {
    const value = process.env[name];
    if (value === undefined || value === '') return fallback;
    if (value !== 'true' && value !== 'false') throw new TypeError(`${name} must be true or false.`);
    return value === 'true';
  };
  const hit = flag('CI_BUILD_CACHE_HIT');
  const digest = process.env.CI_BUILD_DIGEST || ciCacheKeys().buildDigest;
  const started = performance.now(), results = await buildCi({ mode, digest, cacheHit: hit,
    packageCacheHit: flag('CI_PACKAGE_CACHE_HIT', hit), rendererCacheHit: flag('CI_RENDERER_CACHE_HIT', hit),
    packageDigest: process.env.CI_PACKAGE_DIGEST || digest, rendererDigest: process.env.CI_RENDERER_DIGEST || digest });
  console.log(JSON.stringify({ mode, seconds: Number(((performance.now() - started) / 1000).toFixed(3)), compiledCacheHits: results.filter(result => result.cached).length }));
}
