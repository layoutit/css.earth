#!/usr/bin/env node
/** Say which build a preparation run would read stale, before the run fails with an unrelated-looking error (a digest
 * mismatch from an old objects package, a missing module after main moved). A build is stale when a source it compiles is
 * newer than its output, or its output is missing. Modification times are enough for a local preflight; CI builds fresh.
 *
 *   node tools/ci/check-stale-builds.mts        exits 1 and prints the commands to run when any build is stale
 *   node tools/ci/check-stale-builds.mts --run  rebuilds only the stale ones, in rule order, and exits 0 when they pass */
import { execFile } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface BuildRule { readonly name: string; readonly command: string; readonly sources: readonly string[]; readonly output: string }

/** The builds preparation tools import. Sources are directories scanned for TypeScript, JSON body records or generator scripts. */
export const BUILD_RULES: readonly BuildRule[] = Object.freeze([
  { name: '@cssearth/objects', command: 'pnpm build:objects', sources: ['packages/objects/src'], output: 'packages/objects/dist/index.js' },
  { name: '@cssearth/astronomy', command: 'pnpm build:astronomy', sources: ['packages/astronomy/src', 'packages/astronomy/data/bodies', 'packages/astronomy/tools'], output: 'packages/astronomy/dist/index.js' },
  { name: '@cssearth/engine', command: 'pnpm build:engine', sources: ['packages/engine/src'], output: 'packages/engine/dist/index.js' },
  { name: '@cssearth/catalog', command: 'pnpm build:catalog', sources: ['packages/catalog/src'], output: 'packages/catalog/dist/index.js' },
  { name: 'CSS renderer bundle', command: 'pnpm build:renderer', sources: ['src/renderers/css'], output: 'src/renderers/css/dist/index.js' },
  { name: 'preparation tools bundle', command: 'pnpm --filter @cssearth/engine exec tsup --config ../../tools/objects/tsup.config.ts', sources: ['tools/objects', 'src/preparation'], output: 'tools/objects/dist/prepare-authored.js' },
  { name: 'solar geometry', command: 'node tools/prepare/prepare-solar-geometry.mts', sources: ['packages/astronomy/data/bodies'], output: 'src/platform/solar-geometry.mts' },
]);

const SOURCE = /\.(?:ts|mts|json)$/u, SKIP = new Set(['dist', 'node_modules']);

async function newest(path: string): Promise<number> {
  const info = await stat(path).catch(() => null);
  if (!info) return 0;
  if (!info.isDirectory()) return SOURCE.test(path) && !/\.test\.m?ts$/u.test(path) ? info.mtimeMs : 0;
  let latest = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    latest = Math.max(latest, await newest(resolve(path, entry.name)));
  }
  return latest;
}

export async function staleBuilds(root = process.cwd(), rules: readonly BuildRule[] = BUILD_RULES) {
  const stale: { name: string; command: string; reason: string }[] = [];
  for (const rule of rules) {
    const output = await stat(resolve(root, rule.output)).catch(() => null);
    if (!output) { stale.push({ name: rule.name, command: rule.command, reason: `${rule.output} is missing` }); continue; }
    let source = 0, newestPath = '';
    for (const path of rule.sources) { const time = await newest(resolve(root, path)); if (time > source) { source = time; newestPath = path; } }
    if (source > output.mtimeMs) stale.push({ name: rule.name, command: rule.command, reason: `${newestPath} changed after ${relative(root, resolve(root, rule.output))} was built` });
  }
  return stale;
}

/** Rebuild only what is stale, in rule order, so a dependent build never runs before its dependency. */
export async function rebuildStale(root = process.cwd(), rules: readonly BuildRule[] = BUILD_RULES,
  run: (command: string) => Promise<void> = async command => { await promisify(execFile)(command, { cwd: root, shell: true }); }) {
  const stale = await staleBuilds(root, rules);
  for (const build of stale) {
    console.log(`rebuilding ${build.name}: ${build.reason}`);
    await run(build.command);
  }
  return stale;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes('--run')) {
    const rebuilt = await rebuildStale();
    console.log(rebuilt.length ? `Rebuilt ${rebuilt.length} stale build(s).` : 'Builds are current; nothing rebuilt.');
  } else {
    const stale = await staleBuilds();
    if (!stale.length) console.log('Builds are current.');
    for (const build of stale) console.log(`stale ${build.name}: ${build.reason}\n  run: ${build.command}`);
    if (stale.length) process.exitCode = 1;
  }
}
