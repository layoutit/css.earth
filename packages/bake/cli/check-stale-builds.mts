#!/usr/bin/env node
/** Say which build a preparation run would read stale (`@cssearth/bake/preparation`, `stale-builds.ts`).
 *
 *   node packages/bake/cli/check-stale-builds.mts        exits 1 and prints the commands to run when any build is stale
 *   node packages/bake/cli/check-stale-builds.mts --run  rebuilds only the stale ones, in rule order, and exits 0 when they pass
 *
 * The one command that imports the bake's source rather than its entry: it has to run before this package is built, and
 * `--run` is what builds it. The module it loads imports only Node built-ins. */
import { rebuildStale, staleBuilds, staleInstall } from '../src/preparation/stale-builds.ts';

const install = await staleInstall();
if (install) { console.error(install); process.exit(1); }
if (process.argv.includes('--run')) {
  const rebuilt = await rebuildStale().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
  console.log(rebuilt.length ? `Rebuilt ${rebuilt.length} stale build(s).` : 'Builds are current; nothing rebuilt.');
} else {
  const stale = await staleBuilds();
  if (!stale.length) console.log('Builds are current.');
  for (const build of stale) console.log(`stale ${build.name}: ${build.reason}\n  run: ${build.command}`);
  if (stale.length) process.exitCode = 1;
}
