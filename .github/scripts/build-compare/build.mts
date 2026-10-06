/** Run only the final offline Astro stage with pinned process and version inputs. */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { finalizeMetadata } from './finalize-metadata.mts';
import { args, files, isMain, record, string } from './records.mts';

const quote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;
export function pinnedInputs(count = '12345'): { COMMIT_REF: string; version: string; TZ: string; LC_ALL: string; CSSEARTH_BUILD_PAGES: string; assetOrigin: string } {
  if (!/^\d+$/u.test(count) || !Number.isSafeInteger(Number(count))) throw new Error('Invalid pinned count');
  return { COMMIT_REF: '0000000000000000000000000000000000000001', version: `${Math.floor(Number(count) / 10000)}.${Number(count) % 10000}`, TZ: 'UTC', LC_ALL: 'C', CSSEARTH_BUILD_PAGES: '', assetOrigin: 'https://earth-assets.lowpoly.cc' };
}
/** The checkout's own Astro config: under site/, or at the root in revisions from before it moved. */
export function productionConfig(checkout: string): string {
  return existsSync(join(checkout, 'site/astro.config.mts')) ? 'site/astro.config.mts' : 'astro.config.mts';
}
export function toolchainMatches(prior: unknown, current: unknown, baseLock: Uint8Array, headLock: Uint8Array): boolean {
  return JSON.stringify(prior) === JSON.stringify(current) && Buffer.from(baseLock).equals(Buffer.from(headLock));
}
export async function build(checkout: string, output: string, options: { toolchain?: string; count?: string; production?: boolean } = {}): Promise<void> {
  checkout = resolve(checkout); output = resolve(output);
  if (checkout === output || checkout.startsWith(`${output}/`) || output === join(checkout, 'dist') || output.startsWith(join(checkout, 'dist') + '/')) throw new Error('Output must be separate from checkout and dist');
  if (process.env.CSSEARTH_ALLOW_MISSING_ASSETS === '1') throw new Error('Comparison requires strict prepared assets');
  const count = options.count ?? '12345';
  const pins = pinnedInputs(count), { version, COMMIT_REF: commitRef } = pins;
  const require = createRequire(join(checkout, 'package.json'));
  // Package export maps sometimes hide package.json; resolve Astro's own dependency for Vite.
  const readVersion = async (name: string, resolver = require): Promise<string> => {
    const path = resolver.resolve(`${name}/package.json`);
    return string(record(JSON.parse(await readFile(path, 'utf8'))).version);
  };
  const lock = await readFile(join(checkout, 'pnpm-lock.yaml'));
  const toolchain = { node: process.version, pnpm: execFileSync('pnpm', ['--version'], { cwd: checkout, encoding: 'utf8' }).trim(), astro: await readVersion('astro'), vite: await readVersion('vite', createRequire(require.resolve('astro/package.json'))), rootVite: await readVersion('vite'), lockfilePresent: true,
    lockfileBytes: lock.length, ...pins, nodeOptions: '--max-old-space-size=6144' };
  if (options.toolchain) {
    const prior = record(JSON.parse(await readFile(options.toolchain, 'utf8')));
    if (!toolchainMatches(prior, toolchain, await readFile(join(resolve(options.toolchain, '..'), 'pnpm-lock.yaml')), lock)) {
      await mkdir(output, { recursive: true });
      await writeFile(join(output, 'toolchain-mismatch.json'), JSON.stringify({ skipped: true, notice: 'Toolchain differs from base record', base: prior, head: toolchain }));
      throw new Error('Toolchain differs from base record');
    }
  }
  await mkdir(output, { recursive: true });
  if ((await files(output)).length) throw new Error('Output directory must be empty');
  const realGit = execFileSync('/bin/sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
  const shim = join(output, 'shim'); await mkdir(shim);
  const log = join(output, 'git-shim.log');
  await writeFile(join(shim, 'git'), `#!/bin/sh\nif [ "$#" = 3 ] && [ "$1" = rev-list ] && [ "$2" = --count ] && [ "$3" = HEAD ]; then\n  echo used >> ${quote(log)}\n  echo ${quote(count)}\n  exit 0\nfi\nexec ${quote(realGit)} "$@"\n`);
  await chmod(join(shim, 'git'), 0o755);
  const environment = { ...process.env, COMMIT_REF: toolchain.COMMIT_REF, CSSEARTH_BUILD_PAGES: toolchain.CSSEARTH_BUILD_PAGES, ASSET_ORIGIN: toolchain.assetOrigin, CSSEARTH_ALLOW_MISSING_ASSETS: '0', PATH: `${shim}:${process.env.PATH ?? ''}`, TZ: 'UTC', LC_ALL: 'C', NODE_OPTIONS: toolchain.nodeOptions + (process.env.CSSEARTH_READ_AUDIT_MODULE ? ` --import=${process.env.CSSEARTH_READ_AUDIT_MODULE}` : ''), CSSEARTH_COMPARISON_VERSION: version, CSSEARTH_COMPARISON_METADATA: join(output, 'metadata') };
  const observed = execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: checkout, env: environment, encoding: 'utf8' }).trim();
  if (observed !== count) throw new Error('Git shim was not selected');
  await writeFile(log, ''); // Only the subsequent config execSync can satisfy this check.
  const started = performance.now();
  const command = ['exec', 'astro', 'build', '--config', options.production ? productionConfig(checkout) : '.github/scripts/build-compare/astro.compare.config.mts'];
  await new Promise<void>((accept, reject) => {
    const child = spawn('pnpm', command, { cwd: checkout, env: environment, stdio: 'inherit' });
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Astro build exceeded 25 minutes')); }, 1_500_000);
    child.once('error', error => { clearTimeout(timer); reject(error); }); child.once('exit', code => { clearTimeout(timer); code === 0 ? accept() : reject(new Error(`Astro build exit ${code}`)); });
  });
  const seconds = (performance.now() - started) / 1000;
  if (!(await readFile(log, 'utf8')).includes('used')) throw new Error('Config execSync did not use pinned git');
  const dist = join(checkout, 'dist');
  let versionFound = false;
  const emitted = await files(dist);
  if (!emitted.some(path => path.endsWith('.html'))) throw new Error('Build emitted no pages');
  for (const path of emitted.filter(path => /\.m?js$/u.test(path))) if ((await readFile(join(dist, path), 'utf8')).includes(`"${version}"`) || (await readFile(join(dist, path), 'utf8')).includes(`'${version}'`)) { versionFound = true; break; }
  const clientVersionFound = versionFound;
  const serverVersionFiles: string[] = [];
  if (!options.production) for (const file of await files(join(output, 'metadata'))) {
    const metadata = record(JSON.parse(await readFile(join(output, 'metadata', file), 'utf8')));
    if (!Array.isArray(metadata.versionFiles) || !metadata.versionFiles.every(value => typeof value === 'string')) throw new Error('Invalid emitted-JS version evidence');
    for (const name of metadata.versionFiles) serverVersionFiles.push(String(name));
  }
  versionFound ||= serverVersionFiles.length > 0;
  // The version belongs to ObjectShell's server-rendered HTML; Astro deletes prerender JS after rendering.
  const htmlVersionFound = (await readFile(join(dist, 'index.html'), 'utf8')).includes(`v${version}`);
  if (!htmlVersionFound || (!options.production && !versionFound)) throw new Error(`Pinned version ${version} absent from emitted server/client JS or rendered HTML`);
  if (!(await readFile(join(dist, 'index.html'), 'utf8')).includes(`/blob/${commitRef}/src/objects/`)) throw new Error('Pinned source revision absent from HTML');
  if (emitted.some(path => path.startsWith('scenes/'))) throw new Error('Production shape retained scenes');
  if (!options.production) await finalizeMetadata(output, dist);
  const inventories = join(output, 'inventories'); await mkdir(inventories);
  for (const path of execFileSync('git', ['ls-files', 'src/objects/*/inventory.json'], { cwd: checkout, encoding: 'utf8' }).trim().split('\n').filter(Boolean)) {
    await writeFile(join(inventories, path.split('/')[2]! + '.json'), await readFile(join(checkout, path)));
  }
  await rename(dist, join(output, 'dist'));
  await writeFile(join(output, 'pnpm-lock.yaml'), lock);
  await writeFile(join(output, 'toolchain.json'), JSON.stringify(toolchain, null, 2));
  await writeFile(join(output, 'build.json'), JSON.stringify({ checkout, command, seconds, files: emitted.length, versionFound, clientVersionFound, serverVersionFiles, htmlVersionFound, configUsedShim: true, coverage: 'astro build only; excludes social images, assemble and server-function bundling' }, null, 2));
  await rm(shim, { recursive: true });
  console.log(`COMPARISON BUILD PASS: ${emitted.length} files, ${seconds.toFixed(1)}s, version ${version}`);
}
if (isMain(import.meta.url)) {
  try {
    const flags = args(['--checkout', '--out', '--toolchain', '--count', '--production']);
    const checkout = flags.get('--checkout'), output = flags.get('--out');
    if (!checkout || !output || (flags.has('--production') && flags.get('--production') !== 'true')) throw new Error('Usage: build.mts --checkout <dir> --out <dir> [--toolchain <base/toolchain.json>] [--production true] [--count <integer>]');
    await build(checkout, output, { toolchain: flags.get('--toolchain'), count: flags.get('--count'), production: flags.has('--production') });
  } catch (error) { console.error(error); process.exitCode = 1; }
}
