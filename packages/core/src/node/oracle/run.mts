#!/usr/bin/env node
/**
 * Regenerate oracle fixtures through the pinned environment: every oracle, or
 * only the ones named, such as `spice/dart-draco`. Each script lives beside the
 * code it checks and writes through fixture.py; SBMT runs on Node.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { projectRoot } from '../project-root.ts';

const root = projectRoot(import.meta.url), python = resolve(root, '.local/oracles/venv/bin/python');
const oracles: Readonly<Record<string, string>> = {
  "astronomy/hosted-eccentric": "packages/bake/src/astronomy/fixtures/hosted-eccentric.py",
  "fits/core": "packages/bake/src/objects/cameras/fixtures/fits/core.py",
  "fits/pallas": "packages/bake/src/objects/cameras/fixtures/fits/pallas.py",
  "fits/sky-orientation": "packages/bake/src/objects/cameras/fixtures/fits/sky-orientation.py",
  "fits/sky-projection": "packages/bake/src/objects/cameras/fixtures/fits/sky-projection.py",
  "fits/synoptic": "packages/bake/src/objects/cameras/fixtures/fits/synoptic.py",
  "spice/dart-draco": "packages/bake/src/objects/cameras/fixtures/dart-draco.py",

  "fits/binary-table": "packages/telescope-cli/src/archives/interferometry/fixtures/oracles/fits/binary-table.py",
  "physical-units/spectral": "packages/telescope-cli/src/archives/interferometry/fixtures/oracles/physical-units/spectral.py",
  "sbmt/projection": "packages/bake/src/objects/layers/terrestrial/fixtures/sbmt/projection.mts",
  "spice/new-horizons-approach": "packages/bake/src/objects/default-view/fixtures/new-horizons-approach.py",

  "eclipse-map/numerics": "packages/bake/src/objects/raster/eclipse-map/fixtures/numerics.py",
  "eclipse-map/theresa-eigenbasis": "packages/bake/src/objects/raster/eclipse-map/fixtures/theresa-eigenbasis.py",
  "fits/charon-leisa": "packages/bake/src/objects/layers/terrestrial/missions/charon-leisa.py",
  "fits/lupton-asinh": "packages/bake/src/objects/color/fixtures/lupton-asinh.py",
  "fits/rice": "packages/bake/src/objects/layers/observation/fixtures/fits/rice.py",
  "fits/wise-atlas-projection": "packages/bake/src/objects/raster/fixtures/wise-atlas-projection.py",

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
const known = Object.keys(oracles).sort();
const requested = process.argv.slice(2), unknown = requested.filter(name => !known.includes(name));
if (unknown.length) throw new Error(`Unknown oracle ${unknown.join(', ')}; known: ${known.join(', ')}.`);
for (const name of requested.length ? requested : known.filter(name => name !== 'sbmt/projection')) {
  console.log(`oracle ${name}`);
  const sbmt = name === 'sbmt/projection';
  if (!sbmt && !existsSync(python)) throw new Error('No Python oracle environment: run node packages/core/src/node/oracle/setup.mts first.');
  const result = spawnSync(sbmt ? process.execPath : python,
    [...(sbmt ? ['--max-old-space-size=192'] : []), resolve(root, oracles[name]!)],
    { cwd: root, stdio: 'inherit', ...(sbmt ? { timeout: 240_000, killSignal: 'SIGKILL' as const,
      env: {...process.env, OMP_NUM_THREADS:'1', VTK_SMP_MAX_THREADS:'1'} } : {}) });
  if (result.status !== 0) throw new Error(`${name} exited with ${result.status ?? result.signal}.`);
}
