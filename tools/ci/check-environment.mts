/**
 * Check the local environment preparation depends on before a long run finds out.
 * Each problem names its fix. Exit code 1 when anything is wrong. It needs Node 24 to load at all.
 */
import { access, constants, lstat, readdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hasErrorCode } from '../sources/source-values.mts';

const optionalStat = (path: string) => lstat(path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });

async function newestSource(directory: string, skip: ReadonlySet<string>): Promise<number> {
  let newest = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) newest = Math.max(newest, await newestSource(path, skip));
    // Only .ts modules are bundled; .mts tools run directly.
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) newest = Math.max(newest, (await stat(path)).mtimeMs);
  }
  return newest;
}

/** Problems found in a checkout; empty when preparation can run. */
export async function checkEnvironment(root: string): Promise<string[]> {
  const problems: string[] = [];
  const require = createRequire(join(root, 'package.json'));
  try {
    const { default: cwebp } = await import(pathToFileURL(require.resolve('cwebp-bin')).href) as { default: unknown };
    if (typeof cwebp !== 'string') throw new TypeError('cwebp-bin exports no path');
    await access(cwebp, constants.X_OK);
  } catch { problems.push('The cwebp binary is missing; `pnpm install --ignore-scripts` skips it. Copy node_modules/.pnpm/cwebp-bin@*/node_modules/cwebp-bin/vendor/cwebp from another checkout or reinstall with scripts.'); }
  try { require('sharp'); } catch { problems.push('sharp does not load; run pnpm install.'); }
  if ((await optionalStat(join(root, 'public/scenes')))?.isSymbolicLink()) problems.push('public/scenes is a symlink; setup refuses linked runtime assets. Replace it with a real directory.');
  for (const name of await readdir(join(root, 'packages'))) {
    if (!await optionalStat(join(root, 'packages', name, 'dist'))) problems.push(`packages/${name}/dist is missing; run pnpm build:packages.`);
  }
  const bundle = await optionalStat(join(root, 'tools/objects/dist/prepare-authored.js'));
  const sources = Math.max(await newestSource(join(root, 'tools/objects'), new Set(['dist'])), await newestSource(join(root, 'src/preparation'), new Set()));
  if (!bundle) problems.push('tools/objects/dist is missing; run pnpm build:tools.');
  else if (bundle.mtimeMs < sources) problems.push('tools/objects/dist is older than its sources; run pnpm build:tools (tsup builds it, not tsc).');
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const problems = await checkEnvironment(process.cwd());
  for (const problem of problems) console.log(`✖ ${problem}`);
  if (problems.length) process.exitCode = 1;
  else console.log('Preparation environment is ready.');
}
