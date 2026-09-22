#!/usr/bin/env node
/**
 * Regenerate Python oracle fixtures through the pinned environment: every fixture
 * oracle (a script under tools/oracles/<group>/ that writes through
 * fixture.py), or only the ones named, such as `spice/dart-draco`. Older
 * standalone audits in the same tree, such as the Borrelly registration, are
 * not fixture oracles and are never run here.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..'), oracles = resolve(root, 'tools/oracles'), python = resolve(root, '.local/oracles/venv/bin/python');
const known = readdirSync(oracles, { withFileTypes: true }).filter(entry => entry.isDirectory())
  .flatMap(group => readdirSync(resolve(oracles, group.name)).filter(file => file.endsWith('.py'))
    .filter(file => /^from fixture import .*\bwrite\b/mu.test(readFileSync(resolve(oracles, group.name, file), 'utf8')))
    .map(file => `${group.name}/${file.slice(0, -3)}`)).sort();
const requested = process.argv.slice(2), unknown = requested.filter(name => name !== 'sbmt/projection' && !known.includes(name));
if (unknown.length) throw new Error(`Unknown oracle ${unknown.join(', ')}; known: ${[...known,'sbmt/projection'].join(', ')}.`);
for (const name of requested.length ? requested : known) {
  console.log(`oracle ${name}`);
  const sbmt = name === 'sbmt/projection';
  if (!sbmt && !existsSync(python)) throw new Error('No Python oracle environment: run node tools/oracles/setup.mts first.');
  const result = spawnSync(sbmt ? process.execPath : python,
    sbmt ? ['--max-old-space-size=192', resolve(oracles, `${name}.mts`)] : [resolve(oracles, `${name}.py`)],
    { cwd: root, stdio: 'inherit', ...(sbmt ? { timeout: 240_000, killSignal: 'SIGKILL' as const,
      env: {...process.env, OMP_NUM_THREADS:'1', VTK_SMP_MAX_THREADS:'1'} } : {}) });
  if (result.status !== 0) throw new Error(`${name} exited with ${result.status ?? result.signal}.`);
}
