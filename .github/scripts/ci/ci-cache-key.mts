import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const CACHE_FORMAT = 'cssearth-ci-inputs@2';
const BUILD_ENVIRONMENT = ['ASSET_ORIGIN', 'CSSEARTH_PERFORMANCE_SOURCEMAPS', 'NODE_ENV', 'CSSEARTH_SKIP_DECLARATIONS'] as const;

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

const GIT_BUFFER = 256 * 1024 * 1024;

/** Git's object id for the current bytes at each path. Git reads the working tree, so unstaged edits count. */
export function gitBlobIds(root: string, paths: readonly string[]): string[] {
  if (!paths.length) return [];
  for (const path of paths) if (path.includes('\n')) throw new TypeError(`Cache input paths cannot contain a newline: ${JSON.stringify(path)}`);
  const output = execFileSync('git', ['hash-object', '--no-filters', '--stdin-paths'], { cwd: root, input: `${paths.join('\n')}\n`, encoding: 'utf8', maxBuffer: GIT_BUFFER });
  const ids = output.split('\n').filter(Boolean);
  if (ids.length !== paths.length) throw new TypeError(`git hash-object returned ${ids.length} ids for ${paths.length} cache inputs.`);
  return ids;
}

/** A cache key is Git's object id for the listing of its inputs. */
function gitKey(root: string, listing: string): string {
  return execFileSync('git', ['hash-object', '--stdin'], { cwd: root, input: listing, encoding: 'utf8', maxBuffer: GIT_BUFFER }).trim();
}

/** Key every tracked path by Git's object id for its current bytes, including unstaged edits and explicit deletion
 * markers. This deliberately over-invalidates on documentation/data changes instead of guessing a transitive
 * build-input allowlist. The lockfile and source records name ignored downloads; ignored node_modules/dist/prepared
 * outputs never enter the key. Cache consumers must use an exact key and install the frozen lockfile before using its outputs. */
export function ciCacheKeys({ root = resolve(import.meta.dirname, '../../..'), runtime = {
  node: process.versions.node, platform: process.platform, arch: process.arch, environment: process.env,
}, inputs }: { root?: string; runtime?: CacheRuntime; inputs?: (path: string) => boolean } = {}) {
  root = realpathSync(root);
  const entries = trackedCacheEntries(root).filter(entry => !inputs || inputs(entry.path)), paths = new Set(entries.map(entry => entry.path));
  const identity = JSON.stringify([CACHE_FORMAT, toolchain(root, runtime)]);
  let bytes = 0, missing = 0, configFiles = 0;
  const states: (readonly unknown[])[] = [], files: { index: number; path: string; executable: boolean }[] = [];
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
        bytes += info.size;
        files.push({ index: states.length, path: entry.path, executable: Boolean(info.mode & 0o111) });
        state = [];
      } else throw new TypeError(`Tracked cache input is not a file: ${entry.path}`);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      state = ['deleted'];
      missing++;
    }
    states.push(state);
  }
  gitBlobIds(root, files.map(file => file.path)).forEach((id, position) => {
    const file = files[position]!;
    states[file.index] = ['file', file.executable ? 'executable' : 'regular', id];
  });
  let build = `${identity}\n`, typecheck = `${identity}\n`;
  entries.forEach((entry, index) => {
    const encoded = JSON.stringify([entry.path, entry.mode, states[index]]) + '\n';
    build += encoded;
    if (isTypecheckCacheInput(entry.path)) { typecheck += encoded; configFiles++; }
  });
  if (!configFiles) throw new TypeError('Cannot create a compiler cache key without tracked configuration inputs.');
  return { buildDigest: gitKey(root, build), tsconfigDigest: gitKey(root, typecheck), files: entries.length, bytes, missing, configFiles };
}

export interface CompiledPackageInput {
  name: string;
  directory: string;
  dependencies: string[];
  digest: string;
}

const canonical = (value: unknown): string => JSON.stringify(value, (_key, child: unknown) =>
  isRecord(child) ? Object.fromEntries(Object.entries(child).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : child);

/** Select the frozen external dependency closure, including root build tools and peer-qualified snapshots.
 * Unrelated workspace importers are excluded; workspace sources are covered by package digests instead. */
function lockInputs(lock: unknown, directory: string): unknown {
  if (!isRecord(lock) || !isRecord(lock.importers) || !isRecord(lock.packages) || !isRecord(lock.snapshots))
    throw new TypeError('Compiled caches require a pnpm v9 lockfile.');
  const snapshots = lock.snapshots, lockedPackages = lock.packages, lockedImporters = lock.importers;
  const selected = new Map<string, unknown>(), metadata = new Map<string, unknown>();
  const visit = (name: string, version: unknown): void => {
    if (typeof version !== 'string') throw new TypeError(`Invalid locked dependency: ${name}`);
    if (version.startsWith('link:')) return;
    const key = `${name}@${version}`;
    if (selected.has(key)) return;
    const snapshot: unknown = snapshots[key];
    if (!isRecord(snapshot)) throw new TypeError(`Missing locked snapshot: ${key}`);
    selected.set(key, snapshot);
    const base = key.split('(')[0]!;
    if (!isRecord(lockedPackages[base])) throw new TypeError(`Missing locked package: ${base}`);
    metadata.set(base, lockedPackages[base]);
    for (const field of ['dependencies', 'optionalDependencies']) {
      const dependencies = snapshot[field];
      if (dependencies !== undefined && !isRecord(dependencies)) throw new TypeError(`Invalid snapshot: ${key}`);
      for (const [child, resolved] of Object.entries(dependencies ?? {})) visit(child, resolved);
    }
  };
  const importers = ['.', directory].map(path => {
    const importer: unknown = lockedImporters[path];
    if (!isRecord(importer)) throw new TypeError(`Missing locked importer: ${path}`);
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      const dependencies = importer[field];
      if (dependencies !== undefined && !isRecord(dependencies)) throw new TypeError(`Invalid importer: ${path}`);
      for (const [name, dependency] of Object.entries(dependencies ?? {})) {
        if (!isRecord(dependency)) throw new TypeError(`Invalid locked dependency: ${name}`);
        visit(name, dependency.version);
      }
    }
    return [path, importer];
  });
  return { policy: Object.fromEntries(Object.entries(lock).filter(([key]) => !['importers', 'packages', 'snapshots'].includes(key))),
    importers, packages: Object.fromEntries(metadata), snapshots: Object.fromEntries(selected) };
}

/** Hash authored bytes, never execute a build config. A package's complete tracked tree is the conservative
 * boundary for plugins, generated entry lists and dynamic imports. Literal authored imports extend that boundary.
 * Workspace dependency digests propagate topologically; no failure falls back to application/docs inputs. */
export async function compiledCiCacheKeys({ root = resolve(import.meta.dirname, '../../..'), runtime = {
  node: process.versions.node, platform: process.platform, arch: process.arch, environment: process.env,
} }: { root?: string; runtime?: CacheRuntime } = {}) {
  root = realpathSync(root);
  const full = ciCacheKeys({ root, runtime, inputs: isTypecheckCacheInput }), entries = trackedCacheEntries(root);
  const tracked = new Set(entries.map(entry => entry.path));
  const compiler = (await import('typescript')).default;
  const { parse } = await import('yaml');
  const lock: unknown = parse(readFileSync(resolve(root, 'pnpm-lock.yaml'), 'utf8'));
  const identity = canonical(['compiled-inputs@3', toolchain(root, runtime)]);
  const shared = entries.filter(({ path }) => !path.includes('/') && path !== 'pnpm-lock.yaml' && isTypecheckCacheInput(path) ||
    ['.github/scripts/ci/build-ci.mts', '.github/scripts/ci/ci-cache-key.mts'].includes(path)).map(entry => entry.path);
  const packages = entries.filter(({ path }) => /^packages\/[^/]+\/package\.json$/u.test(path)).map(({ path }) => {
    const manifest: unknown = JSON.parse(readFileSync(resolve(root, path), 'utf8'));
    if (!isRecord(manifest) || typeof manifest.name !== 'string' || !isRecord(manifest.scripts) || typeof manifest.scripts.build !== 'string')
      throw new TypeError(`Invalid build package: ${path}`);
    const dependencies = new Set<string>();
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      const values = manifest[field];
      if (values !== undefined && !isRecord(values)) throw new TypeError(`Invalid dependencies: ${path}`);
      for (const [name, version] of Object.entries(values ?? {})) {
        if (typeof version !== 'string') throw new TypeError(`Invalid dependency: ${path}/${name}`);
        if (version.startsWith('workspace:')) dependencies.add(name);
      }
    }
    return { directory: dirname(path), name: manifest.name, dependencies, selected: new Set(shared) };
  });
  if (!packages.length || new Set(packages.map(pkg => pkg.name)).size !== packages.length) throw new TypeError('Invalid compiled workspace packages.');
  const owners = new Map(packages.map(pkg => [pkg.name, pkg]));
  const fallbackReasons: string[] = [];
  for (const pkg of packages) {
    for (const { path } of entries) if (path.startsWith(`${pkg.directory}/`)) pkg.selected.add(path);
    const queue = [...pkg.selected], visited = new Set<string>();
    while (queue.length) {
      const path = queue.pop()!;
      if (visited.has(path)) continue;
      visited.add(path);
      if (!/\.[cm]?[jt]sx?$/u.test(path) || /\.test\./u.test(path) || !existsSync(resolve(root, path))) continue;
      const text = readFileSync(resolve(root, path), 'utf8');
      for (const { fileName: specifier } of compiler.preProcessFile(text, true, true).importedFiles) {
        const owner = packages.find(candidate => specifier === candidate.name || specifier.startsWith(`${candidate.name}/`));
        if (owner && owner.name !== pkg.name) { pkg.dependencies.add(owner.name); continue; }
        if (!specifier.startsWith('.')) continue;
        const base = resolve(dirname(resolve(root, path)), specifier);
        const stem = base.replace(/\.[cm]?js$/u, '');
        const candidate = [base, ...['.ts', '.mts', '.cts', '.tsx', '/index.ts', '/index.mts'].map(suffix => stem + suffix)]
          .find(file => tracked.has(relativeInside(root, file))) ?? base;
        const local = relativeInside(root, candidate);
        const relativeOwner = packages.find(other => local.startsWith(`${other.directory}/`));
        if (relativeOwner && relativeOwner.name !== pkg.name) { pkg.dependencies.add(relativeOwner.name); continue; }
        if (!tracked.has(local)) {
          // Generated sources/dist and unresolved literals stay within the complete owning-package boundary.
          fallbackReasons.push(`${pkg.name}: package-local boundary for ${path} → ${specifier}`);
          continue;
        }
        if (!pkg.selected.has(local)) { pkg.selected.add(local); queue.push(local); }
      }
    }
  }
  const allInputs = new Set(packages.flatMap(pkg => [...pkg.selected]));
  const files = [...allInputs].filter(path => existsSync(resolve(root, path)) && lstatSync(resolve(root, path)).isFile());
  const ids = new Map(gitBlobIds(root, files).map((id, index) => [files[index]!, id]));
  const inputState = (path: string): unknown => {
    const file = resolve(root, path);
    if (!existsSync(file)) return [path, 'deleted'];
    const info = lstatSync(file);
    if (info.isSymbolicLink()) {
      const target = relativeInside(root, realpathSync(file));
      if (!tracked.has(target)) throw new TypeError(`Untracked package symlink target: ${path}`);
      return [path, 'symlink', readlinkSync(file), gitBlobIds(root, [target])[0]];
    }
    return [path, info.mode & 0o111, ids.get(path)];
  };
  const finished = new Map<string, CompiledPackageInput>(), visiting = new Set<string>();
  const digestPackage = (name: string): CompiledPackageInput => {
    const ready = finished.get(name);
    if (ready) return ready;
    const pkg = owners.get(name);
    if (!pkg) throw new TypeError(`Workspace build dependency outside packages: ${name}`);
    if (visiting.has(name)) throw new TypeError(`Cyclic compiled workspace dependency: ${name}`);
    visiting.add(name);
    const dependencies = [...pkg.dependencies].sort();
    const upstream = dependencies.map(dependency => [dependency, digestPackage(dependency).digest]);
    const digest = gitKey(root, canonical([identity, [...pkg.selected].sort().map(inputState), lockInputs(lock, pkg.directory), upstream]));
    const result = { name, directory: pkg.directory, dependencies, digest };
    finished.set(name, result); visiting.delete(name);
    return result;
  };
  const packageInputs = packages.map(pkg => digestPackage(pkg.name));
  const packageDigest = gitKey(root, canonical(packageInputs.map(pkg => [pkg.name, pkg.digest])));
  return { ...full, packageDigest, packages: packageInputs, packageInputFiles: allInputs.size, fallbackReasons: [...new Set(fallbackReasons)] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new TypeError('Usage: node .github/scripts/ci/ci-cache-key.mts');
  const started = performance.now(), result = await compiledCiCacheKeys();
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `build_digest=${result.buildDigest}\ntsconfig_digest=${result.tsconfigDigest}\npackage_digest=${result.packageDigest}\n`);
  console.log(JSON.stringify({ ...result, elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(3)) }));
}
