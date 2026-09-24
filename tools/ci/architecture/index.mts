#!/usr/bin/env node
/** Layer rules and the folder dependency map. A local check for now: CI does not run it yet.
 *
 *   pnpm check:architecture                     fail if a change adds a folder cycle edge or a forbidden import
 *   pnpm check:architecture --update-baseline   record the current state as tools/ci/architecture/baseline.json
 *   pnpm arch:map                               write the JSON views to output/architecture/
 *
 * The check is a ratchet: existing debt is recorded in the baseline, so it is visible without blocking
 * work, and a change may only keep or reduce it. See CONTRIBUTING.md, "Check your change". */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(import.meta.dirname, '../../..'), [command, ...rest] = process.argv.slice(2);
  const usage = 'Usage: node tools/ci/architecture/index.mts check [--update-baseline] | map';
  const update = rest.length === 1 && rest[0] === '--update-baseline';
  if (!(command === 'map' && rest.length === 0) && !(command === 'check' && (rest.length === 0 || update))) {
    console.error(usage); process.exitCode = 2;
  } else if (!existsSync(resolve(root, 'packages/core/dist/index.js'))) {
    // The report imports @cssearth/core, which resolves to its build.
    console.error('The architecture check needs the shared packages built: run `pnpm build:core` (or `pnpm install`) first.');
    process.exitCode = 2;
  } else {
    const [{ check, map }, { IncompleteGraphError }] = await Promise.all([import('./report.mts'), import('./graph.mts')]);
    try {
      if (command === 'map') await map(root);
      else if (!await check(root, update)) process.exitCode = 1;
    } catch (error) {
      if (!(error instanceof IncompleteGraphError)) throw error;
      console.error(error.message); process.exitCode = 2;
    }
  }
}
