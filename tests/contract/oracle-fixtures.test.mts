import { kernelBankPaths } from '@cssearth/bake/objects/cameras';
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { access, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readOracleFixture, pinnedOracleVersions, assertPinnedInputs, assertPinnedReferences, ORACLE_ROOT } from '@cssearth/core/oracle';
import { runtimeLock, generatorFingerprint } from '../../packages/bake/src/objects/layers/terrestrial/fixtures/sbmt/runtime.mts';

/** Every committed oracle fixture comes from the pinned environment and the pinned inputs; runs in `pnpm test:platform` without Python or restored sources. */
// The scripts sit beside their fixtures; SBMT's JSON bridge manifests and runtime lock are not fixtures.
const NOT_FIXTURES = new Set(['sbmt/package.json', 'sbmt/package-lock.json', 'sbmt/runtime.lock.json']);
const relocatedFixtures: Readonly<Record<string, string>> = {
  "sbmt/projection.json": "packages/bake/src/objects/layers/terrestrial/fixtures/sbmt/projection.json",

  "spice/dart-draco.json": "packages/bake/src/astronomy/fixtures/dart-draco.json",
  "spice/new-horizons-approach.json": "packages/bake/src/objects/default-view/fixtures/new-horizons-approach.json",

  "eclipse-map/numerics.json": "packages/bake/src/objects/raster/eclipse-map/fixtures/numerics.json",
  "eclipse-map/theresa-eigenbasis.json": "packages/bake/src/objects/raster/eclipse-map/fixtures/theresa-eigenbasis.json",
  "fits/binary-table.json": "packages/bake/src/objects/layers/observation/fixtures/fits/binary-table.json",
  "fits/charon-leisa.json": "packages/bake/src/objects/layers/terrestrial/missions/charon-leisa.json",
  "fits/core.json": "packages/bake/src/objects/layers/observation/fixtures/fits/core.json",
  "fits/encounter.json": "packages/bake/src/objects/layers/terrestrial/missions/encounter.json",
  "fits/llorri.json": "packages/bake/src/objects/layers/terrestrial/missions/llorri.json",
  "fits/lupton-asinh.json": "packages/bake/src/objects/color/fixtures/lupton-asinh.json",
  "fits/pallas.json": "packages/bake/src/objects/layers/observation/fixtures/fits/pallas.json",
  "fits/rice.json": "packages/bake/src/objects/layers/observation/fixtures/fits/rice.json",
  "fits/sky-orientation.json": "packages/bake/src/objects/layers/observation/fixtures/fits/sky-orientation.json",
  "fits/sky-projection.json": "packages/bake/src/objects/layers/observation/fixtures/fits/sky-projection.json",
  "fits/synoptic.json": "packages/bake/src/objects/layers/observation/fixtures/fits/synoptic.json",
  "fits/wise-atlas-projection.json": "packages/bake/src/objects/raster/fixtures/wise-atlas-projection.json",

  "astronomy/hosted-orbit.json": "packages/bake/src/objects/scene/fixtures/hosted-orbit.json",
  "isis/photometric-truth.json": "packages/bake/src/photometry/fixtures/photometric-truth.json",
  "isis2/borrelly-micas.json": "packages/bake/src/objects/layers/terrestrial/missions/borrelly-micas.json",
  "npy/psyche-alma.json": "packages/bake/src/objects/raster/numpy/psyche-alma.json",
  "pds/dart-draco-cube.json": "packages/bake/src/objects/layers/terrestrial/missions/dart-draco-cube.json",
  "pds3/amica-ddr.json": "packages/bake/src/objects/layers/terrestrial/missions/amica-ddr.json",
  "pds3/osiris-geo.json": "packages/bake/src/objects/layers/terrestrial/missions/osiris-geo.json",
  "pds3/osiris-reflectance.json": "packages/bake/src/objects/layers/terrestrial/missions/osiris-reflectance.json"
};
const relocatedScripts: Readonly<Record<string, string>> = {
  "spice/new-horizons-approach.py": "packages/bake/src/objects/default-view/fixtures/new-horizons-approach.py",

  "eclipse-map/numerics.py": "packages/bake/src/objects/raster/eclipse-map/fixtures/numerics.py",
  "eclipse-map/theresa-eigenbasis.py": "packages/bake/src/objects/raster/eclipse-map/fixtures/theresa-eigenbasis.py",
  "fits/charon-leisa.py": "packages/bake/src/objects/layers/terrestrial/missions/charon-leisa.py",
  "fits/lupton-asinh.py": "packages/bake/src/objects/color/fixtures/lupton-asinh.py",
  "fits/rice.py": "packages/bake/src/objects/layers/observation/fixtures/fits/rice.py",
  "fits/wise-atlas-projection.py": "packages/bake/src/objects/raster/fixtures/wise-atlas-projection.py",

  "astronomy/hosted-orbit.py": "packages/bake/src/objects/scene/fixtures/hosted-orbit.py",
  "fits/encounter.py": "packages/bake/src/objects/layers/terrestrial/missions/encounter.py",
  "fits/llorri.py": "packages/bake/src/objects/layers/terrestrial/missions/llorri.py",
  "isis/photometric-truth.py": "packages/bake/src/photometry/fixtures/photometric-truth.py",
  "isis2/borrelly-micas.py": "packages/bake/src/objects/layers/terrestrial/missions/borrelly-micas.py",
  "npy/psyche-alma.py": "packages/bake/src/objects/raster/numpy/psyche-alma.py",
  "pds/dart-draco-cube.py": "packages/bake/src/objects/layers/terrestrial/missions/dart-draco-cube.py",
  "pds3/amica-ddr.py": "packages/bake/src/objects/layers/terrestrial/missions/amica-ddr.py",
  "pds3/osiris-geo.py": "packages/bake/src/objects/layers/terrestrial/missions/osiris-geo.py",
  "pds3/osiris-reflectance.py": "packages/bake/src/objects/layers/terrestrial/missions/osiris-reflectance.py"
};
const directories = await readdir(resolve(ORACLE_ROOT, 'tests/oracles'), { withFileTypes: true });
const names = (await Promise.all(directories.filter(d => d.isDirectory()).map(async d => (await readdir(resolve(ORACLE_ROOT, 'tests/oracles', d.name))).filter(f => f.endsWith('.json')).map(f => `${d.name}/${f}`)))).flat()
  .filter(name => !NOT_FIXTURES.has(name)).concat(Object.keys(relocatedFixtures)).sort();
const pins = await pinnedOracleVersions();

test('oracle fixtures name their generator, a pinned tool version and pinned inputs', async () => {
  assert.ok(names.length >= 2, `${names.length} fixtures`);
  for (const name of names) {
    const fixture = await readOracleFixture(relocatedFixtures[name] ? resolve(ORACLE_ROOT, relocatedFixtures[name]) : name);
    if (fixture.oracle === 'SBMT') {
      const {lock,digest}=await runtimeLock();
      // The committed fixture names the generator's path before the move until SBMT regenerates it.
      assert.ok(['tools/oracles/sbmt/projection.mts','tests/oracles/sbmt/projection.mts'].includes(fixture.generatedBy));
      // Known gap: since the committed fixture's tool record holds no runtimeLockSha256 or generatorSha256, so the
      // comparison below fails whenever this test runs past its restored-source skips. Recorded, not repaired here.
      assert.deepEqual(fixture.tool,{sbmt:lock.sbmt,release:lock.release,java:lock.java,'java-bridge':lock.bridge,runtimeLockSha256:digest,generatorSha256:await generatorFingerprint()});
      await assertPinnedInputs(fixture.inputs, kernelBankPaths);
      assertPinnedReferences(fixture.references);
      assert.ok(fixture.inputs.some(p=>p.path==='tests/fixtures/sbmt/cases.json'));
      continue;
    }
    // Fixtures written before the scripts moved from tools/oracles/ keep that path until they are regenerated.
    const script = /^(?:tools|tests)\/oracles\/([a-z0-9-]+\/[a-z0-9-]+\.py)$/u.exec(fixture.generatedBy);
    assert.ok(script, `${name} names its script`);
    await access(relocatedScripts[script[1]!] ? resolve(ORACLE_ROOT, relocatedScripts[script[1]!]) : resolve(ORACLE_ROOT, 'tests/oracles', script[1]!));
    let pinned = 0;
    for (const [tool, version] of Object.entries(fixture.tool)) {
      const pin = pins.get(tool.toLowerCase().replace(/-/g, '_'));
      if (pin === undefined) continue;
      assert.equal(version, pin, `${name}: ${tool} ${version} is the pinned ${pin}`); pinned++;
    }
    assert.ok(pinned >= 1, `${name} records its pinned environment`);
    assert.ok(fixture.inputs.length + fixture.references.length >= 1, `${name} lists its inputs or pinned references`);
    await assertPinnedInputs(fixture.inputs, kernelBankPaths);
    assertPinnedReferences(fixture.references);
  }
});
