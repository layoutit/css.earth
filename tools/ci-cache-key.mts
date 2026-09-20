import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const CACHE_FORMAT = 'cssearth-ci-inputs@1';
const BUILD_ENVIRONMENT = ['ASSET_ORIGIN', 'CSSEARTH_PERFORMANCE_SOURCEMAPS', 'NODE_ENV'] as const;

export interface CacheRuntime {
  node: string;
  platform: string;
  arch: string;
  environment: Readonly<Record<string, string | undefined>>;
}

interface TrackedEntry { path: string; mode: string; }

/** Paths come from Git's index, never a recursive glob through installed dependencies or restored outputs. */
export function trackedCacheEntries(root: string): TrackedEntry[] {
  const output = execFileSync('git', ['ls-files', '--stage', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const entries = output.split('\0').filter(Boolean).map(line => {
    const match = /^(100644|100755|120000) [a-f0-9]{40,64} 0\t(.+)$/us.exec(line);
    if (!match) throw new TypeError('Cache inputs require resolved ordinary tracked files; conflicts and gitlinks are unsupported.');
    const path = match[2]!;
    if (isAbsolute(path) || path.split('/').includes('..')) throw new TypeError(`Invalid tracked cache path: ${path}`);
    return { mode: match[1]!, path };
  });
  if (!entries.length) throw new TypeError('Cannot create a build cache key from an empty Git index.');
  // Code-point ordering is stable across locales and independent of index insertion order.
  return entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

/** Incremental compiler state remains verified by tsc. Its reusable configuration family includes every
 * tracked tsconfig spelling (including astro.tsconfig.json), package manifest, lockfile and workspace policy. */
export function isTypecheckCacheInput(path: string): boolean {
  const name = basename(path);
  return /^(?:tsconfig[^/]*|[^/]+\.tsconfig)\.json$/u.test(name) || name === 'package.json' ||
    ['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', '.pnpmfile.cjs', '.pnpmfile.mts'].includes(name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toolchain(root: string, runtime: CacheRuntime) {
  const manifest: unknown = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  if (!isRecord(manifest) || !isRecord(manifest.devDependencies)) throw new TypeError('Cache toolchain metadata must be an object.');
  const packageManager = manifest.packageManager, compiler = manifest.devDependencies.typescript;
  if (typeof packageManager !== 'string' || !/^pnpm@\d+\.\d+\.\d+(?:[-+].+)?$/u.test(packageManager) ||
      typeof compiler !== 'string' || !compiler.trim()) throw new TypeError('Cache inputs require the pinned pnpm and TypeScript toolchain.');
  for (const value of [runtime.node, runtime.platform, runtime.arch]) if (!value) throw new TypeError('Missing cache runtime identity.');
  return { node: runtime.node, platform: runtime.platform, arch: runtime.arch, packageManager, compiler,
    environment: BUILD_ENVIRONMENT.map(name => [name, runtime.environment[name] ?? null]) };
}

function relativeInside(root: string, file: string): string {
  const path = relative(root, file);
  if (path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) throw new TypeError('A tracked cache symlink escapes the repository.');
  return path.split(sep).join('/');
}

/** Hash all tracked current bytes, including unstaged edits and explicit deletion markers. This deliberately
 * over-invalidates on documentation/data changes instead of guessing a transitive build-input allowlist. The
 * lockfile and source recipes pin ignored downloads; ignored node_modules/dist/prepared outputs never enter
 * the digest. Cache consumers must use an exact key and install the frozen lockfile before using its outputs. */
export function ciCacheKeys({ root = resolve(import.meta.dirname, '..'), runtime = {
  node: process.versions.node, platform: process.platform, arch: process.arch, environment: process.env,
} }: { root?: string; runtime?: CacheRuntime } = {}) {
  root = realpathSync(root);
  const entries = trackedCacheEntries(root), paths = new Set(entries.map(entry => entry.path));
  const identity = JSON.stringify([CACHE_FORMAT, toolchain(root, runtime)]);
  const build = createHash('sha256').update(identity), typecheck = createHash('sha256').update(identity);
  let bytes = 0, missing = 0, configFiles = 0;
  for (const entry of entries) {
    const file = resolve(root, entry.path);
    let state: readonly unknown[];
    try {
      const info = lstatSync(file);
      if (info.isSymbolicLink()) {
        const target = readlinkSync(file), targetPath = resolve(dirname(file), target);
        const localTarget = relativeInside(root, targetPath);
        const trackedTarget = (path: string) => paths.has(path) || entries.some(candidate => candidate.path.startsWith(`${path}/`));
        // Missing historical links have no input bytes. If their targets later appear, they must be
        // tracked too; otherwise fail closed instead of silently using an unchanged cache identity.
        let destination: string | undefined;
        try { destination = relativeInside(root, realpathSync(targetPath)); }
        catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
        if (destination !== undefined && (!trackedTarget(localTarget) || !trackedTarget(destination)))
          throw new TypeError(`A tracked cache symlink needs a tracked target: ${entry.path}`);
        state = ['symlink', target, destination === undefined ? 'missing-target' : destination];
        bytes += Buffer.byteLength(target);
      } else if (info.isFile()) {
        const content = readFileSync(file);
        bytes += content.length;
        state = ['file', info.mode & 0o111 ? 'executable' : 'regular', content.length, createHash('sha256').update(content).digest('hex')];
      } else throw new TypeError(`Tracked cache input is not a file: ${entry.path}`);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      state = ['deleted'];
      missing++;
    }
    const encoded = JSON.stringify([entry.path, entry.mode, state]) + '\n';
    build.update(encoded);
    if (isTypecheckCacheInput(entry.path)) { typecheck.update(encoded); configFiles++; }
  }
  if (!configFiles) throw new TypeError('Cannot create a compiler cache key without tracked configuration inputs.');
  return { buildDigest: build.digest('hex'), tsconfigDigest: typecheck.digest('hex'), files: entries.length, bytes, missing, configFiles };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new TypeError('Usage: node tools/ci-cache-key.mts');
  const started = performance.now(), result = ciCacheKeys();
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `build_digest=${result.buildDigest}\ntsconfig_digest=${result.tsconfigDigest}\n`);
  console.log(JSON.stringify({ ...result, elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(3)) }));
}
