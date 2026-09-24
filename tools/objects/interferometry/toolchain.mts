#!/usr/bin/env node
import { sha256File } from '../../../src/platform/sha256.mts';
/** Install and locate the pinned interferometry toolchains of toolchains.json under output/toolchains/<id> (ignored by git).
 *
 *   node tools/objects/interferometry/toolchain.mts install <squeeze|rotir|pionier|amber|gravity|matisse> [--cache <dir> ...]
 *   node tools/objects/interferometry/toolchain.mts verify <id>
 *
 * Downloads are verified by size and sha256; a file already present in a --cache directory with the same hash is linked
 * instead of downloaded again. Git sources are checked out at their pinned commit, the Julia environment is instantiated from
 * the checked-in Project.toml and Manifest.toml, the PIONIER pipeline is built from ESO's Yorick source package and kit, and on
 * macOS the MATISSE pipeline is rebuilt with LLVM's OpenMP runtime.
 * An installed toolchain records the sha256 of its descriptor; `verify` and `toolchainPath` refuse one built from another.
 * Verified archives are deleted after the build: toolchains are large and the data they reduce are larger. */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, copyFile, link, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';

const repository = resolve(import.meta.dirname, '../../..');
const DESCRIPTOR = resolve(import.meta.dirname, 'toolchains.json');
export const TOOLCHAIN_ROOT = resolve(repository, 'output/toolchains');

const exists = (path: string) => access(path).then(() => true, () => false);


export async function toolchainDescriptor(id: string) {
  const text = await readFile(DESCRIPTOR, 'utf8');
  const all = requireRecord(requireRecord(JSON.parse(text) as unknown, 'toolchains.json').toolchains, 'toolchains');
  const entry = requireRecord(all[id], `toolchain ${id}`);
  return { entry, digest: createHash('sha256').update(JSON.stringify(entry)).digest('hex') };
}

function run(command: string, args: readonly string[], options: { cwd: string; env?: NodeJS.ProcessEnv; answers?: string }) {
  // An installer that asks questions gets its answers on stdin; the rest inherit the terminal.
  const result = spawnSync(command, args, { cwd: options.cwd, env: { ...process.env, ...options.env }, ...(options.answers === undefined ? { stdio: 'inherit' } : { input: options.answers, stdio: ['pipe', 'inherit', 'inherit'] }) });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed in ${options.cwd} (status ${result.status}).`);
}

async function fetchDownload(record: Record<string, unknown>, directory: string, caches: readonly string[]) {
  const name = requireString(record.path), sha256 = requireString(record.sha256), bytes = requireFiniteNumber(record.bytes), target = resolve(directory, name);
  const good = async (path: string) => await exists(path) && (await sha256File(path)).sha256 === sha256;
  if (await good(target)) return target;
  for (const cache of caches) {
    const candidate = resolve(cache, name);
    if (await good(candidate)) { await rm(target, { force: true }); await link(candidate, target).catch(() => copyFile(candidate, target)); return target; }
  }
  const response = await fetch(requireString(record.url));
  if (!response.ok || !response.body) throw new Error(`${record.url} answered ${response.status}.`);
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(target));
  if (!await good(target)) throw new Error(`${name} does not match its pinned sha256 (${bytes} bytes expected).`);
  return target;
}

export async function installToolchain(id: string, caches: readonly string[] = []) {
  const { entry, digest } = await toolchainDescriptor(id), root = resolve(TOOLCHAIN_ROOT, id), downloads = resolve(root, 'downloads');
  if (await toolchainPath(id).then(() => true, () => false)) return root;
  await mkdir(downloads, { recursive: true });
  const files = await Promise.all(requireArray(entry.downloads ?? []).map(record => fetchDownload(requireRecord(record), downloads, caches)));
  if (id === 'squeeze') {
    const source = requireRecord(entry.source), directory = resolve(root, 'source');
    if (!await exists(directory)) run('git', ['clone', requireString(source.url), directory], { cwd: root });
    run('git', ['checkout', '--detach', requireString(source.commit)], { cwd: directory });
    run('git', ['submodule', 'update', '--init', '--recursive'], { cwd: directory });
    run('cmake', ['-S', 'source', '-B', 'build', '-DCMAKE_BUILD_TYPE=Release'], { cwd: root });
    run('cmake', ['--build', 'build', '--parallel'], { cwd: root });
  } else if (id === 'rotir') {
    if (!await exists(resolve(root, 'julia-1.12.7'))) run('tar', ['-xzf', files[0]!], { cwd: root });
    const registries = requireArray(entry.registries).map(value => requireString(value));
    const script = `using Pkg; for r in ${JSON.stringify(registries)}; startswith(r, "http") ? Pkg.Registry.add(url=r) : Pkg.Registry.add(r); end; Pkg.instantiate(); using ROTIR`;
    run(resolve(root, requireString(entry.executable)), [`--project=${resolve(repository, requireString(entry.environment))}`, '-e', script], { cwd: root, env: { JULIA_DEPOT_PATH: resolve(root, 'depot') } });
  } else if (entry.build === 'eso-kit') {
    // An ESO instrument kit (PIONIER, GRAVITY, MATISSE, AMBER): its own install_pipeline builds CPL, esorex and the recipes.
    const build = resolve(root, 'build'), kitArchive = requireString(entry.kit);
    await mkdir(build, { recursive: true });
    const path = entry.yorick === true ? `${await buildYorick(entry, files, build)}:${process.env.PATH}` : process.env.PATH;
    run('tar', ['-xzf', files.find(file => file.endsWith(kitArchive))!], { cwd: build });
    const kit = resolve(build, kitArchive.replace(/\.tar\.gz$/u, ''));
    await mkdir(resolve(root, 'home'), { recursive: true });
    // ESO's installer asks for confirmation only when a target directory is missing, and it refuses to ask without a terminal:
    // both directories exist before it runs.
    await mkdir(resolve(root, 'pipeline'), { recursive: true }); await mkdir(resolve(root, 'calib'), { recursive: true });
    const repair = entry.repair === undefined ? null : requireRecord(entry.repair, `${id} repair`);
    const install = spawnSync('./install_pipeline', [resolve(root, 'pipeline'), resolve(root, 'calib')], { cwd: kit, input: '', stdio: ['pipe', 'inherit', 'inherit'], env: { ...process.env, HOME: resolve(root, 'home'), PATH: path } });
    if (install.status !== 0 && !repair) throw new Error(`install_pipeline failed for ${id} (status ${install.status}).`);
    if (repair) {
      // Rebuild the one package the kit's installer could not compile, against the dependencies it did install, then unpack
      // the calibration files the installer never reached.
      const prefix = resolve(root, 'pipeline'), source = resolve(kit, requireString(repair.package));
      if (!await exists(source)) run('tar', ['-xzf', `${requireString(repair.package)}.tar.gz`], { cwd: kit });
      const env = { FFTWDIR: prefix, ERFADIR: prefix, GSLDIR: prefix, CFITSIODIR: prefix, CPLDIR: prefix, WCSDIR: prefix, CPPFLAGS: requireString(repair.cppflags).replaceAll('{prefix}', prefix) };
      run('./configure', [`--prefix=${prefix}`], { cwd: source, env });
      run('make', ['-j8'], { cwd: source, env });
      run('make', ['install'], { cwd: source, env });
      const calibration = resolve(root, 'calib', requireString(repair.calibrationDirectory));
      await mkdir(calibration, { recursive: true });
      const archive = requireString(repair.calibration), top = archive.replace(/\.tar\.gz$/u, '');
      run('tar', ['-xzf', resolve(kit, archive), '--strip-components=2', '-C', calibration, `${top}/cal`], { cwd: kit });
    }
    if (entry.openmp !== undefined && process.platform === 'darwin') await threadMatisse(requireRecord(entry.openmp, `${id} openmp`), files, kit, resolve(root, 'pipeline'), build);
    // The kit's build tree is not needed at run time; Yorick's relocatable install is.
    await rm(kit, { recursive: true, force: true });
  } else if (entry.build === 'python-venv') {
    // A Python package set in its own interpreter: nothing is built, and the wheels stay out of the repository.
    const python = requireString(entry.python), venv = resolve(root, 'venv');
    if (!await exists(venv)) run(python, ['-m', 'venv', venv], { cwd: root });
    const requirements = requireArray(entry.requirements).map(value => requireString(value));
    run(resolve(venv, 'bin/pip'), ['install', '--quiet', '--disable-pip-version-check', ...requirements], { cwd: root });
  } else throw new TypeError(`No installer for toolchain ${id}: it states neither a known id nor build "eso-kit" or "python-venv".`);
  // The archives were verified and unpacked; the disk is kept for data. A reinstall fetches or links them again.
  await rm(downloads, { recursive: true, force: true });
  await writeFile(resolve(root, 'installed.json'), `${JSON.stringify({ id, descriptorSha256: digest }, null, 2)}\n`);
  return root;
}

/** LLVM's OpenMP runtime built into the pipeline prefix, and one kit package rebuilt against it with the named files' macOS
 * guard removed. The ESO kits leave OpenMP out on macOS; Linux builds with GCC keep it. */
async function threadMatisse(openmp: Record<string, unknown>, files: readonly string[], kit: string, prefix: string, build: string) {
  const runtime = resolve(build, 'openmp'), cmake = resolve(build, 'cmake');
  await rm(runtime, { recursive: true, force: true }); await rm(cmake, { recursive: true, force: true });
  for (const [name, target] of [[requireString(openmp.runtime), runtime], [requireString(openmp.runtimeCmake), cmake]] as const) {
    await mkdir(target, { recursive: true });
    run('tar', ['-xJf', files.find(file => file.endsWith(name))!, '--strip-components=1', '-C', target], { cwd: build });
  }
  // LLVM's standalone runtime build finds its shared CMake modules in a sibling directory named cmake.
  run('cmake', ['-S', runtime, '-B', resolve(build, 'openmp-build'), '-DCMAKE_BUILD_TYPE=Release', `-DCMAKE_INSTALL_PREFIX=${prefix}`, '-DOPENMP_STANDALONE_BUILD=ON',
    '-DLIBOMP_OMPD_SUPPORT=OFF', '-DOPENMP_ENABLE_LIBOMPTARGET=OFF', '-DLIBOMP_INSTALL_ALIASES=OFF'], { cwd: build });
  run('cmake', ['--build', resolve(build, 'openmp-build'), '--parallel', '4'], { cwd: build });
  run('cmake', ['--install', resolve(build, 'openmp-build')], { cwd: build });
  const packageName = requireString(openmp.package), source = resolve(kit, packageName), guard = requireString(openmp.guard);
  if (!await exists(source)) run('tar', ['-xzf', `${packageName}.tar.gz`], { cwd: kit });
  for (const file of requireArray(openmp.files).map(value => requireString(value))) {
    const path = resolve(source, file), text = await readFile(path, 'utf8');
    if (!text.includes(guard)) throw new Error(`${file} no longer has the macOS OpenMP guard; review the kit before threading it.`);
    await writeFile(path, text.replaceAll(guard, '#if defined (_OPENMP)'));
  }
  const env = { FFTWDIR: prefix, ERFADIR: prefix, GSLDIR: prefix, CFITSIODIR: prefix, CPLDIR: prefix, WCSDIR: prefix,
    // LLVM installs libomp as @rpath/libomp.dylib; the rpath lets configure's test programs and the recipes find it.
    CPPFLAGS: `-Xpreprocessor -fopenmp -I${resolve(prefix, 'include')}`, LIBS: `-L${resolve(prefix, 'lib')} -lomp`, LDFLAGS: `-Wl,-rpath,${resolve(prefix, 'lib')}` };
  run('./configure', [`--prefix=${prefix}`], { cwd: source, env });
  run('make', ['-j4'], { cwd: source, env });
  run('make', ['install'], { cwd: source, env });
}

/** Yorick from ESO's source package with its two patches, built without X11; the PIONIER pipeline (pndrs) runs on it. Returns
 * the directory holding the yorick executable. */
async function buildYorick(entry: Record<string, unknown>, files: readonly string[], build: string) {
  run('bsdtar', ['-xf', files.find(file => file.endsWith('.src.rpm'))!], { cwd: build });
  run('tar', ['-xzf', 'yorick-y_2_2_04.tar.gz'], { cwd: build });
  const yorick = resolve(build, 'yorick-y_2_2_04');
  for (const patch of requireArray(entry.yorickPatches).map(value => requireString(value))) run('patch', ['-p0', '-N', '-i', resolve(build, patch)], { cwd: yorick });
  run('make', ['NO_XLIB=yes', 'Y_HOME=relocate', 'config'], { cwd: yorick });
  run('make', ['NO_XLIB=yes'], { cwd: yorick });
  run('make', ['NO_XLIB=yes', 'install'], { cwd: yorick });
  return resolve(yorick, 'relocate/bin');
}

/** The installed toolchain's root, refusing a missing install or one built from a different descriptor. */
export async function toolchainPath(id: string) {
  const { digest } = await toolchainDescriptor(id), root = resolve(TOOLCHAIN_ROOT, id);
  const marker = await readFile(resolve(root, 'installed.json'), 'utf8').then(text => requireRecord(JSON.parse(text) as unknown), () => null);
  if (!marker) throw new Error(`Toolchain ${id} is not installed: node tools/objects/interferometry/toolchain.mts install ${id}`);
  if (marker.descriptorSha256 !== digest) throw new Error(`Toolchain ${id} was built from another toolchains.json entry; reinstall it.`);
  return root;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, id, ...rest] = process.argv.slice(2);
  const caches = rest.flatMap((value, index) => rest[index - 1] === '--cache' ? [resolve(value)] : []);
  if (mode === 'install' && id) console.log(`${id} installed at ${await installToolchain(id, caches)}`);
  else if (mode === 'verify' && id) console.log(`${id} installed at ${await toolchainPath(id)}`);
  else throw new TypeError('Usage: toolchain install <squeeze|rotir|pionier|amber|gravity|matisse> [--cache <dir> ...] | verify <id>');
}
