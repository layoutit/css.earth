#!/usr/bin/env node
/** Install and locate the pinned interferometry toolchains of toolchains.json under output/toolchains/<id> (ignored by git).
 *
 *   node packages/telescope-cli/src/archives/interferometry/toolchain.mts install <squeeze|rotir|pionier|amber|gravity|matisse> [--cache <dir> ...]
 *   node packages/telescope-cli/src/archives/interferometry/toolchain.mts verify <id>
 *
 * Downloads are verified by size; a file already present in a --cache directory at that size is linked instead of downloaded
 * again. Git sources are checked out at their pinned commit, the Julia environment is instantiated from
 * the checked-in Project.toml and Manifest.toml, the PIONIER pipeline is built from ESO's Yorick source package and kit, and on
 * macOS the MATISSE pipeline is rebuilt with LLVM's OpenMP runtime.
 * An installed toolchain keeps the text of its descriptor entry; `verify` and `toolchainPath` refuse one built from another.
 * Verified archives are deleted after the build: toolchains are large and the data they reduce are larger. */
import { runToolchainProcessAsync, hasToolchainProgress, toolchainInstallSignal, verifyToolchainExecutables, installManagedToolchain, assertManagedPythonPlatform, ensureToolchainPython, telescopePythonEnvironment, resolveInstalledToolchain, assertInstalledMarker, type ToolchainPins, USER_ROOT } from '@cssearth/telescope-core/node';
import { packagePath } from '../../paths.mts';
import { access, cp, copyFile, link, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { downloadToolchainArchive } from '../../toolchains/download.mts';

const DESCRIPTOR = packagePath('src/archives/interferometry/toolchains.json');
export const TOOLCHAIN_ROOT = resolve(USER_ROOT, 'output/toolchains');

const exists = (path: string) => access(path).then(() => true, () => false);


/** One toolchains.json entry, as the pins an installed toolchain keeps: the entry's own text, and no lock. */
export async function toolchainDescriptor(id: string): Promise<ToolchainPins> {
  const text = await readFile(DESCRIPTOR, 'utf8');
  const all = requireRecord(requireRecord(JSON.parse(text) as unknown, 'toolchains.json').toolchains, 'toolchains');
  const entry = requireRecord(all[id], `toolchain ${id}`);
  return { id, file: `packages/telescope-cli/src/archives/interferometry/toolchains.json (${id})`, descriptor: JSON.stringify(entry), lock: null, entry };
}

/** The Julia environment a toolchain entry names by its repository path. */
export function toolchainEnvironment(entry: Readonly<Record<string, unknown>>, root = resolve(TOOLCHAIN_ROOT, requireString(entry.id ?? 'rotir', 'environment id'))) {
  return resolve(root, 'environment');
}

async function run(command: string, args: readonly string[], options: { cwd: string; env?: NodeJS.ProcessEnv; answers?: string }) {
  await runToolchainProcessAsync(command, args, { cwd: options.cwd, env: options.env, input: options.answers,
    failureMessage: status => new Error(`${command} ${args.join(' ')} failed in ${options.cwd} (status ${status}).`),
    captureOutput: false, output: (text, stream) => { if (!hasToolchainProgress()) (stream === 'stdout' ? process.stdout : process.stderr).write(text); } });
}

async function fetchDownload(record: Record<string, unknown>, directory: string, caches: readonly string[]) {
  const name = requireString(record.path, 'download path'), bytes = requireFiniteNumber(record.bytes, `${name} bytes`), target = resolve(directory, name);
  const good = async (path: string) => (await stat(path).catch(() => null))?.size === bytes;
  if (await good(target)) return target;
  for (const cache of caches) {
    const candidate = resolve(cache, name);
    if (await good(candidate)) { await rm(target, { force: true }); await link(candidate, target).catch(() => copyFile(candidate, target)); return target; }
  }
  return downloadToolchainArchive(requireString(record.url), target, bytes);
}

export async function installToolchain(id: string, caches: readonly string[] = []) {
  assertManagedPythonPlatform();
  const { entry } = await toolchainDescriptor(id), root = resolve(TOOLCHAIN_ROOT, id), downloads = resolve(root, 'downloads');
  if (entry.build === 'python-venv') {
    const venv = resolve(root, 'venv');
    return ensureToolchainPython(venv, () => toolchainDescriptor(id), async ({ entry }) => {
      const requirements = requireArray(entry.requirements).map(value => requireString(value));
      await run(resolve(venv, 'bin/pip'), ['install', '--quiet', '--disable-pip-version-check', ...requirements], { cwd: root });
    });
  }
  return installManagedToolchain(root, () => toolchainDescriptor(id), null, async ({ entry }) => {
    await mkdir(downloads, { recursive: true });
    const files = await Promise.all(requireArray(entry.downloads ?? []).map(record => fetchDownload(requireRecord(record), downloads, caches)));
    if (id === 'squeeze') {
      const source = requireRecord(entry.source), directory = resolve(root, 'source');
      if (!await exists(directory)) await run('git', ['clone', requireString(source.url), directory], { cwd: root });
      await run('git', ['checkout', '--detach', requireString(source.commit)], { cwd: directory });
      await run('git', ['submodule', 'update', '--init', '--recursive'], { cwd: directory });
      await run('cmake', ['-S', 'source', '-B', 'build', '-DCMAKE_BUILD_TYPE=Release'], { cwd: root });
      await run('cmake', ['--build', 'build', '--parallel'], { cwd: root });
    } else if (id === 'rotir') {
      if (!await exists(resolve(root, 'julia-1.12.7'))) await run('tar', ['-xzf', files[0]!], { cwd: root });
      const registries = requireArray(entry.registries).map(value => requireString(value));
      await cp(packagePath(requireString(entry.environment, 'environment')), toolchainEnvironment(entry), { recursive: true });
      const script = `using Pkg; for r in ${JSON.stringify(registries)}; startswith(r, "http") ? Pkg.Registry.add(url=r) : Pkg.Registry.add(r); end; Pkg.instantiate(); using ROTIR`;
      await run(resolve(root, requireString(entry.executable)), [`--project=${toolchainEnvironment(entry)}`, '-e', script], { cwd: root, env: { JULIA_DEPOT_PATH: resolve(root, 'depot') } });
    } else if (entry.build === 'eso-kit') {
      // An ESO instrument kit (PIONIER, GRAVITY, MATISSE, AMBER): its own install_pipeline builds CPL, esorex and the recipes.
      const build = resolve(root, 'build'), kitArchive = requireString(entry.kit);
      await mkdir(build, { recursive: true });
      const path = entry.yorick === true ? `${await buildYorick(entry, files, build)}:${process.env.PATH}` : process.env.PATH;
      await run('tar', ['-xzf', files.find(file => file.endsWith(kitArchive))!], { cwd: build });
      const kit = resolve(build, kitArchive.replace(/\.tar\.gz$/u, ''));
      await mkdir(resolve(root, 'home'), { recursive: true });
      // ESO's installer asks for confirmation only when a target directory is missing, and it refuses to ask without a terminal:
      // both directories exist before it runs.
      await mkdir(resolve(root, 'pipeline'), { recursive: true }); await mkdir(resolve(root, 'calib'), { recursive: true });
      const repair = entry.repair === undefined ? null : requireRecord(entry.repair, `${id} repair`);
      try { await runToolchainProcessAsync('./install_pipeline', [resolve(root, 'pipeline'), resolve(root, 'calib')], { cwd: kit, input: '', env: { HOME: resolve(root, 'home'), PATH: path },
        failureMessage: status => new Error(`install_pipeline failed for ${id} (status ${status}).`),
        captureOutput: false, output: (text, stream) => { if (!hasToolchainProgress()) (stream === 'stdout' ? process.stdout : process.stderr).write(text); } }); }
      catch (error) { if (!repair || toolchainInstallSignal()?.aborted) throw error; }
      if (repair) {
        // Rebuild the one package the kit's installer could not compile, against the dependencies it did install, then unpack
        // the calibration files the installer never reached.
        const prefix = resolve(root, 'pipeline'), source = resolve(kit, requireString(repair.package));
        if (!await exists(source)) await run('tar', ['-xzf', `${requireString(repair.package)}.tar.gz`], { cwd: kit });
        const env = { FFTWDIR: prefix, ERFADIR: prefix, GSLDIR: prefix, CFITSIODIR: prefix, CPLDIR: prefix, WCSDIR: prefix, CPPFLAGS: requireString(repair.cppflags).replaceAll('{prefix}', prefix) };
        await run('./configure', [`--prefix=${prefix}`], { cwd: source, env });
        await run('make', ['-j8'], { cwd: source, env });
        await run('make', ['install'], { cwd: source, env });
        const calibration = resolve(root, 'calib', requireString(repair.calibrationDirectory));
        await mkdir(calibration, { recursive: true });
        const archive = requireString(repair.calibration), top = archive.replace(/\.tar\.gz$/u, '');
        await run('tar', ['-xzf', resolve(kit, archive), '--strip-components=2', '-C', calibration, `${top}/cal`], { cwd: kit });
      }
      if (entry.openmp !== undefined && process.platform === 'darwin') await threadMatisse(requireRecord(entry.openmp, `${id} openmp`), files, kit, resolve(root, 'pipeline'), build);
      // The kit's build tree is not needed at run time; Yorick's relocatable install is.
      await rm(kit, { recursive: true, force: true });
    } else throw new TypeError(`No installer for toolchain ${id}: it states neither a known id nor build "eso-kit" or "python-venv".`);
    // The archives were verified and unpacked; the disk is kept for data. A reinstall fetches or links them again.
    await rm(downloads, { recursive: true, force: true });
  }, ({ entry }) => verifyToolchainExecutables([resolve(root, requireString(entry.executable, 'executable'))]));
}

/** LLVM's OpenMP runtime built into the pipeline prefix, and one kit package rebuilt against it with the named files' macOS
 * guard removed. The ESO kits leave OpenMP out on macOS; Linux builds with GCC keep it. */
async function threadMatisse(openmp: Record<string, unknown>, files: readonly string[], kit: string, prefix: string, build: string) {
  const runtime = resolve(build, 'openmp'), cmake = resolve(build, 'cmake');
  await rm(runtime, { recursive: true, force: true }); await rm(cmake, { recursive: true, force: true });
  for (const [name, target] of [[requireString(openmp.runtime), runtime], [requireString(openmp.runtimeCmake), cmake]] as const) {
    await mkdir(target, { recursive: true });
    await run('tar', ['-xJf', files.find(file => file.endsWith(name))!, '--strip-components=1', '-C', target], { cwd: build });
  }
  // LLVM's standalone runtime build finds its shared CMake modules in a sibling directory named cmake.
  await run('cmake', ['-S', runtime, '-B', resolve(build, 'openmp-build'), '-DCMAKE_BUILD_TYPE=Release', `-DCMAKE_INSTALL_PREFIX=${prefix}`, '-DOPENMP_STANDALONE_BUILD=ON',
    '-DLIBOMP_OMPD_SUPPORT=OFF', '-DOPENMP_ENABLE_LIBOMPTARGET=OFF', '-DLIBOMP_INSTALL_ALIASES=OFF'], { cwd: build });
  await run('cmake', ['--build', resolve(build, 'openmp-build'), '--parallel', '4'], { cwd: build });
  await run('cmake', ['--install', resolve(build, 'openmp-build')], { cwd: build });
  const packageName = requireString(openmp.package), source = resolve(kit, packageName), guard = requireString(openmp.guard);
  if (!await exists(source)) await run('tar', ['-xzf', `${packageName}.tar.gz`], { cwd: kit });
  for (const file of requireArray(openmp.files).map(value => requireString(value))) {
    const path = resolve(source, file), text = await readFile(path, 'utf8');
    if (!text.includes(guard)) throw new Error(`${file} no longer has the macOS OpenMP guard; review the kit before threading it.`);
    await writeFile(path, text.replaceAll(guard, '#if defined (_OPENMP)'));
  }
  const env = { FFTWDIR: prefix, ERFADIR: prefix, GSLDIR: prefix, CFITSIODIR: prefix, CPLDIR: prefix, WCSDIR: prefix,
    // LLVM installs libomp as @rpath/libomp.dylib; the rpath lets configure's test programs and the recipes find it.
    CPPFLAGS: `-Xpreprocessor -fopenmp -I${resolve(prefix, 'include')}`, LIBS: `-L${resolve(prefix, 'lib')} -lomp`, LDFLAGS: `-Wl,-rpath,${resolve(prefix, 'lib')}` };
  await run('./configure', [`--prefix=${prefix}`], { cwd: source, env });
  await run('make', ['-j4'], { cwd: source, env });
  await run('make', ['install'], { cwd: source, env });
}

/** Yorick from ESO's source package with its two patches, built without X11; the PIONIER pipeline (pndrs) runs on it. Returns
 * the directory holding the yorick executable. */
async function buildYorick(entry: Record<string, unknown>, files: readonly string[], build: string) {
  await run('bsdtar', ['-xf', files.find(file => file.endsWith('.src.rpm'))!], { cwd: build });
  await run('tar', ['-xzf', 'yorick-y_2_2_04.tar.gz'], { cwd: build });
  const yorick = resolve(build, 'yorick-y_2_2_04');
  for (const patch of requireArray(entry.yorickPatches).map(value => requireString(value))) await run('patch', ['-p0', '-N', '-i', resolve(build, patch)], { cwd: yorick });
  await run('make', ['NO_XLIB=yes', 'Y_HOME=relocate', 'config'], { cwd: yorick });
  await run('make', ['NO_XLIB=yes'], { cwd: yorick });
  await run('make', ['NO_XLIB=yes', 'install'], { cwd: yorick });
  return resolve(yorick, 'relocate/bin');
}

/** The installed toolchain's root, refusing a missing install or one built from a different descriptor. */
export async function toolchainPath(id: string) {
  const pins = await toolchainDescriptor(id), root = resolveInstalledToolchain(resolve(TOOLCHAIN_ROOT, id), pins) ?? resolve(TOOLCHAIN_ROOT, id);
  assertInstalledMarker(root, pins, id, `node packages/telescope-cli/src/archives/interferometry/toolchain.mts install ${id}`);
  return root;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, id, ...rest] = process.argv.slice(2);
  const caches = rest.flatMap((value, index) => rest[index - 1] === '--cache' ? [resolve(value)] : []);
  if (mode === 'install' && id) console.log(`${id} installed at ${await installToolchain(id, caches)}`);
  else if (mode === 'verify' && id) console.log(`${id} installed at ${await toolchainPath(id)}`);
  else throw new TypeError('Usage: toolchain install <squeeze|rotir|pionier|amber|gravity|matisse> [--cache <dir> ...] | verify <id>');
}
