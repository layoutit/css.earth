#!/usr/bin/env node
/**
 * Regenerate Python oracle fixtures through the pinned environment: every fixture
 * oracle (a script under tests/oracles/<group>/ that writes through
 * fixture.py), or only the ones named, such as `spice/dart-draco`. Older
 * standalone audits in the same tree, such as the Borrelly registration, are
 * not fixture oracles and are never run here.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { projectRoot } from '../project-root.ts';

const root = projectRoot(import.meta.url), oracles = resolve(root, 'tests/oracles'), python = resolve(root, '.local/oracles/venv/bin/python');
const relocated: Readonly<Record<string, string>> = {
  "astronomy/hosted-orbit": "packages/bake/src/objects/scene/fixtures/hosted-orbit.py",
  "fits/encounter": "packages/bake/src/objects/layers/terrestrial/missions/encounter.py",
  "fits/llorri": "packages/bake/src/objects/layers/terrestrial/missions/llorri.py",
  "isis/photometric-truth": "packages/bake/src/photometry/fixtures/photometric-truth.py",
  "isis2/borrelly-micas": "packages/bake/src/objects/layers/terrestrial/missions/borrelly-micas.py",
  "npy/psyche-alma": "packages/bake/src/objects/raster/numpy/psyche-alma.py",
  "pds/dart-draco-cube": "packages/bake/src/objects/layers/terrestrial/missions/dart-draco-cube.py",
  "pds3/amica-ddr": "packages/bake/src/objects/layers/terrestrial/missions/amica-ddr.py",
  "pds3/osiris-geo": "packages/bake/src/objects/layers/terrestrial/missions/osiris-geo.py",
  "pds3/osiris-reflectance": "packages/bake/src/objects/layers/terrestrial/missions/osiris-reflectance.py"
};
const known = readdirSync(oracles, { withFileTypes: true }).filter(entry => entry.isDirectory())
  .flatMap(group => readdirSync(resolve(oracles, group.name)).filter(file => file.endsWith('.py'))
    .filter(file => /^from fixture import .*\bwrite\b/mu.test(readFileSync(resolve(oracles, group.name, file), 'utf8')))
    .map(file => `${group.name}/${file.slice(0, -3)}`)).concat(Object.keys(relocated)).sort();
const requested = process.argv.slice(2), unknown = requested.filter(name => name !== 'sbmt/projection' && !known.includes(name));
if (unknown.length) throw new Error(`Unknown oracle ${unknown.join(', ')}; known: ${[...known,'sbmt/projection'].join(', ')}.`);
for (const name of requested.length ? requested : known) {
  console.log(`oracle ${name}`);
  const sbmt = name === 'sbmt/projection';
  if (!sbmt && !existsSync(python)) throw new Error('No Python oracle environment: run node packages/core/src/node/oracle/setup.mts first.');
  const result = spawnSync(sbmt ? process.execPath : python,
    sbmt ? ['--max-old-space-size=192', resolve(oracles, `${name}.mts`)] : [relocated[name] ? resolve(root, relocated[name]) : resolve(oracles, `${name}.py`)],
    { cwd: root, stdio: 'inherit', ...(sbmt ? { timeout: 240_000, killSignal: 'SIGKILL' as const,
      env: {...process.env, OMP_NUM_THREADS:'1', VTK_SMP_MAX_THREADS:'1'} } : {}) });
  if (result.status !== 0) throw new Error(`${name} exited with ${result.status ?? result.signal}.`);
}
