#!/usr/bin/env node
/**
 * Regenerate oracle fixtures through the pinned environment: every oracle, or
 * only the ones named, such as `spice/dart-draco`. Each script lives beside the
 * code it checks and writes through fixture.py; SBMT runs on Node.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readOracleSetupManifest } from './manifest.mts';
import { projectRoot } from '../project-root.ts';

const root = projectRoot(import.meta.url), python = resolve(root, '.local/oracles/venv/bin/python');
const manifest = readOracleSetupManifest(root);
const oracles = manifest.oracles;
const known = Object.keys(oracles).sort();
const requested = process.argv.slice(2), unknown = requested.filter(name => !known.includes(name));
if (unknown.length) throw new Error(`Unknown oracle ${unknown.join(', ')}; known: ${known.join(', ')}.`);
for (const name of requested.length ? requested : known.filter(name => !oracles[name]!.endsWith('.mts'))) {
  console.log(`oracle ${name}`);
  const sbmt = oracles[name]!.endsWith('.mts');
  if (!sbmt && !existsSync(python)) throw new Error('No Python oracle environment: run node packages/core/src/node/oracle/setup.mts first.');
  const result = spawnSync(sbmt ? process.execPath : python,
    [...(sbmt ? ['--max-old-space-size=192'] : []), resolve(root, oracles[name]!)],
    { cwd: root, stdio: 'inherit', ...(sbmt ? { timeout: 240_000, killSignal: 'SIGKILL' as const,
      env: {...process.env, OMP_NUM_THREADS:'1', VTK_SMP_MAX_THREADS:'1'} } : {}) });
  if (result.status !== 0) throw new Error(`${name} exited with ${result.status ?? result.signal}.`);
}
