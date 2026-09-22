import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
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
export function ciCacheKeys({ root = resolve(import.meta.dirname, '../..'), runtime = {
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

// These are the only package build steps with filesystem behavior beyond tsup's compiler inputs.
// Their audited implementations read package-local astronomy data, or bundle the telescope CLI. A change
// falls back to the whole-tracked key until its build-time input contract has been reviewed again.
const AUDITED_BUILD_FILES: Readonly<Record<string, string>> = {
  'packages/astronomy/tools/body-records.mts': '527f837d1bb41ff1c29950dfe7cf09deab5323d374a675cc806d420c48a2afb1',
  'packages/astronomy/tools/lib/generator-records.mts': '505d5bd1fb121423af5e04c0466e2a8c6e2410c4c1a6acb5f0a7bf03b377625e',
  'packages/astronomy/tools/lib/source-validation.mts': '680dee1e4f81f9307bdcd377891cc0673da54ca1488f5f300c501781309f500a',
  'packages/telescope/build.mts': '8a9ff660b1851bc90f4afb8ec07d7f51e461097fc2220a5d5930f8dbc0e0de08',
};
const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const BUILD_CONFIG_FIELDS = new Set(['entry', 'outDir', 'tsconfig', 'format', 'external', 'dts', 'sourcemap', 'clean', 'target', 'splitting']);

/** Requires the frozen install, but never scans installed directories. Compiler APIs resolve actual imports;
 * package dist imports stand for the package source digest, so cold and restored checkouts use the same key. */
export async function compiledCiCacheKeys({ root = resolve(import.meta.dirname, '../..'), runtime = {
  node: process.versions.node, platform: process.platform, arch: process.arch, environment: process.env,
} }: { root?: string; runtime?: CacheRuntime } = {}) {
  root = realpathSync(root);
  const full = ciCacheKeys({ root, runtime }), tracked = new Set(trackedCacheEntries(root).map(entry => entry.path));
  const compiler = (await import('typescript')).default, { build } = await import('esbuild');
  const identity = JSON.stringify(['compiled-inputs@1', toolchain(root, runtime)]);
  const shared = [...tracked].filter(path => isTypecheckCacheInput(path) || ['tools/ci/build-ci.mts', 'tools/ci/ci-cache-key.mts'].includes(path));
  const packageInputs = new Set([...shared, ...[...tracked].filter(path => path.startsWith('packages/'))]);
  const packageManifests = [...tracked].filter(path => /^packages\/[^/]+\/package\.json$/u.test(path));
  if (!packageManifests.length) throw new TypeError('No tracked package manifests for the compiled cache.');
  const packages = packageManifests.map(path => {
    const value: unknown = JSON.parse(readFileSync(resolve(root, path), 'utf8'));
    if (!isRecord(value) || typeof value.name !== 'string' || !isRecord(value.scripts) || typeof value.scripts.build !== 'string') throw new TypeError(`Invalid build package: ${path}`);
    return { directory: dirname(path), name: value.name, script: value.scripts.build };
  });
  const packageNames = packages.map(pkg => pkg.name), fallbackReasons: string[] = [];
  const normalizedOptions = (value: unknown): unknown => {
    if (typeof value === 'string' && isAbsolute(value)) {
      const local = relative(root, value).split(sep).join('/');
      return local !== '..' && !local.startsWith('../') ? `./${local}` : value;
    }
    if (Array.isArray(value)) return value.map(normalizedOptions);
    if (isRecord(value)) return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, normalizedOptions(child)]));
    if (typeof value === 'function' || typeof value === 'symbol') throw new TypeError('Build configuration contains executable option values.');
    return value;
  };
  const generatedAstronomy = (path: string) => path.startsWith('packages/astronomy/src/data/generated/');
  const compiledPackage = (path: string) => packages.some(pkg => path.startsWith(`${pkg.directory}/dist/`));
  const input = (absolute: string, selected: Set<string>) => {
    const lexical = relative(root, absolute).split(sep).join('/');
    if (compiledPackage(lexical) || generatedAstronomy(lexical)) return;
    const real = existsSync(absolute) ? realpathSync(absolute) : absolute;
    const local = relative(root, real).split(sep).join('/');
    if (compiledPackage(local) || generatedAstronomy(local)) return;
    if (tracked.has(local)) { selected.add(local); return; }
    // Frozen dependencies include compiler standard libraries. Resolve workspace symlinks before this check.
    if (real.split(sep).includes('node_modules')) return;
    throw new TypeError(`Untracked or missing authored compiler input: ${local}`);
  };
  const closure = async (directory: string, configPath: string | null, selected: Set<string>, options: string[]) => {
    let entries: string[], config: Record<string, unknown>;
    const cwd = resolve(root, directory);
    if (configPath) {
      input(configPath, selected);
      const syntax = compiler.createSourceFile(configPath, readFileSync(configPath, 'utf8'), compiler.ScriptTarget.Latest, true);
      const imports = compiler.preProcessFile(syntax.text, true, true).importedFiles.map(entry => entry.fileName);
      // Current configs are plain tsup options plus node:path/node:url. Custom loaders/plugins or imported
      // configuration modules need their own read contract; do not guess their hidden filesystem inputs.
      if (imports.some(name => !['tsup', 'node:path', 'node:url'].includes(name))) throw new TypeError(`Unsupported build configuration imports: ${configPath}`);
      const loaded: unknown = await import(`${pathToFileURL(configPath).href}?ci-input=${fileHash(configPath)}`);
      if (!isRecord(loaded) || !isRecord(loaded.default)) throw new TypeError(`Expected plain tsup options: ${configPath}`);
      config = loaded.default;
      if (Object.keys(config).some(key => !BUILD_CONFIG_FIELDS.has(key))) throw new TypeError(`Unsupported build configuration options: ${configPath}`);
      const raw = Array.isArray(config.entry) ? config.entry : isRecord(config.entry) ? Object.values(config.entry) : [];
      if (!raw.length || !raw.every((entry): entry is string => typeof entry === 'string')) throw new TypeError(`Invalid compiler entry points: ${configPath}`);
      entries = raw.map(entry => resolve(cwd, entry));
    } else {
      // The audited telescope builder has one entry and no custom loaders or generation.
      config = {};
      entries = [resolve(cwd, 'src/cli.mts')];
    }
    options.push(JSON.stringify([directory, normalizedOptions(config)]));
    const tsconfig = typeof config.tsconfig === 'string' ? resolve(cwd, config.tsconfig) : resolve(cwd, 'tsconfig.json');
    const read = (path: string) => { input(path, selected); return compiler.sys.readFile(path); };
    const parsedSource = compiler.readConfigFile(tsconfig, read);
    if (parsedSource.error) throw new TypeError(compiler.flattenDiagnosticMessageText(parsedSource.error.messageText, '\n'));
    const parsed = compiler.parseJsonConfigFileContent(parsedSource.config, { ...compiler.sys, readFile: read }, dirname(tsconfig));
    if (parsed.errors.length) throw new TypeError(compiler.formatDiagnostics(parsed.errors, { getCanonicalFileName: value => value, getCurrentDirectory: () => root, getNewLine: () => '\n' }));
    const ambient = parsed.fileNames.filter(path => /\.d\.[cm]?ts$/u.test(path));
    const program = compiler.createProgram([...entries, ...ambient], { ...parsed.options, noEmit: true, incremental: false });
    const workspaceImport = (specifier: string) => packageNames.some(name => specifier === name || specifier.startsWith(`${name}/`));
    for (const source of program.getSourceFiles()) {
      input(source.fileName, selected);
      const actual = realpathSync(source.fileName), local = relative(root, actual).split(sep).join('/');
      if (actual.split(sep).includes('node_modules') || compiledPackage(local) || generatedAstronomy(local)) continue;
      for (const reference of compiler.preProcessFile(source.text, true, true).importedFiles) {
        const specifier = reference.fileName;
        if (!specifier.startsWith('.')) continue;
        const destination = relative(root, resolve(dirname(source.fileName), specifier)).split(sep).join('/');
        if (generatedAstronomy(destination) || compiledPackage(destination)) continue;
        if (!compiler.resolveModuleName(specifier, source.fileName, parsed.options, compiler.sys).resolvedModule)
          throw new TypeError(`Unresolved authored compiler input: ${source.fileName} → ${specifier}`);
      }
    }
    const external = config.external ?? [];
    if (!Array.isArray(external) || !external.every((value): value is string => typeof value === 'string')) throw new TypeError('Invalid compiler externals.');
    const result = await build({ absWorkingDir: root, entryPoints: entries, bundle: true, write: false, metafile: true,
      platform: 'node', format: 'esm', target: 'es2022', tsconfig, outdir: resolve(root, 'output/cache-input-analysis'),
      external: [...external, ...packageNames], logLevel: 'silent', plugins: [{ name: 'compiled-input-owners', setup(builder) {
        builder.onResolve({ filter: /./ }, args => {
          if (workspaceImport(args.path)) return { path: args.path, external: true };
          const local = relative(root, resolve(args.resolveDir, args.path)).split(sep).join('/');
          if (generatedAstronomy(local) || compiledPackage(local)) return { path: args.path, external: true };
          return undefined;
        });
      } }] });
    for (const path of Object.keys(result.metafile!.inputs)) input(resolve(root, path), selected);
  };
  const narrowHash = (selected: ReadonlySet<string>, options: readonly string[], upstream = '') => {
    const digest = createHash('sha256').update(identity).update(upstream).update(JSON.stringify(options));
    for (const path of [...selected].sort()) {
      const absolute = resolve(root, path), info = lstatSync(absolute);
      // Package documentation symlinks point to tracked owners already covered by broad package/config inputs.
      const bytes = info.isSymbolicLink() ? Buffer.from(readlinkSync(absolute)) : readFileSync(absolute);
      digest.update(JSON.stringify([path, info.mode & 0o111, bytes.length, createHash('sha256').update(bytes).digest('hex')]) + '\n');
    }
    return digest.digest('hex');
  };
  const packageOptions: string[] = [], rendererOptions: string[] = [];
  let packageDigest = full.buildDigest;
  try {
    for (const pkg of packages) {
      const supported = pkg.script === 'tsup' || pkg.directory === 'packages/astronomy' && pkg.script === 'node tools/body-records.mts && tsup' || pkg.directory === 'packages/telescope' && pkg.script === 'node build.mts';
      if (!supported) throw new TypeError(`Unaudited package build: ${pkg.directory}`);
      for (const [path, sha] of Object.entries(AUDITED_BUILD_FILES).filter(([path]) => path.startsWith(`${pkg.directory}/`)))
        if (fileHash(resolve(root, path)) !== sha) throw new TypeError(`Package filesystem build inputs changed: ${path}`);
      const config = pkg.directory === 'packages/telescope' ? null : resolve(root, pkg.directory, 'tsup.config.ts');
      await closure(pkg.directory, config, packageInputs, packageOptions);
    }
    packageDigest = narrowHash(packageInputs, packageOptions);
  } catch (error) { fallbackReasons.push(`packages: ${error instanceof Error ? error.message : String(error)}`); }
  const rendererInputs = new Set(shared);
  let rendererDigest = full.buildDigest;
  try {
    await closure('src/renderers/css', resolve(root, 'src/renderers/css/tsup.config.ts'), rendererInputs, rendererOptions);
    rendererDigest = narrowHash(rendererInputs, rendererOptions, packageDigest);
  } catch (error) { fallbackReasons.push(`renderer: ${error instanceof Error ? error.message : String(error)}`); }
  return { ...full, packageDigest, rendererDigest, packageInputFiles: packageInputs.size, rendererInputFiles: rendererInputs.size, fallbackReasons };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new TypeError('Usage: node tools/ci/ci-cache-key.mts');
  const started = performance.now(), result = await compiledCiCacheKeys();
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `build_digest=${result.buildDigest}\ntsconfig_digest=${result.tsconfigDigest}\npackage_digest=${result.packageDigest}\nrenderer_digest=${result.rendererDigest}\n`);
  console.log(JSON.stringify({ ...result, elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(3)) }));
}
