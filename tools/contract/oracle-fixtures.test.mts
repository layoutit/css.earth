import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readOracleFixture, pinnedOracleVersions, assertPinnedInputs, assertPinnedReferences, ORACLE_ROOT } from '../oracles/fixture.mts';
import { runtimeLock, generatorFingerprint } from '../oracles/sbmt/runtime.mts';

/** Every committed oracle fixture comes from the pinned environment and the pinned inputs; runs in `pnpm test:platform` without Python or restored sources. */
const directories = await readdir(resolve(ORACLE_ROOT, 'tests/oracles'), { withFileTypes: true });
const names = (await Promise.all(directories.filter(d => d.isDirectory()).map(async d => (await readdir(resolve(ORACLE_ROOT, 'tests/oracles', d.name))).filter(f => f.endsWith('.json')).map(f => `${d.name}/${f}`)))).flat();
const pins = await pinnedOracleVersions();

test('oracle fixtures name their generator, a pinned tool version and pinned inputs', async () => {
  assert.ok(names.length >= 2, `${names.length} fixtures`);
  for (const name of names) {
    const fixture = await readOracleFixture(name);
    if (fixture.oracle === 'SBMT') {
      const {lock,digest}=await runtimeLock();
      assert.equal(fixture.generatedBy,'tools/oracles/sbmt/projection.mts');
      assert.deepEqual(fixture.tool,{sbmt:lock.sbmt,release:lock.release,java:lock.java,'java-bridge':lock.bridge,runtimeLockSha256:digest,generatorSha256:await generatorFingerprint()});
      await assertPinnedInputs(fixture.inputs);
      assertPinnedReferences(fixture.references);
      assert.ok(fixture.inputs.some(p=>p.path==='tests/fixtures/sbmt/cases.json'));
      continue;
    }
    assert.match(fixture.generatedBy, /^tools\/oracles\/[a-z0-9-]+\/[a-z0-9-]+\.py$/u, `${name} names its script`);
    let pinned = 0;
    for (const [tool, version] of Object.entries(fixture.tool)) {
      const pin = pins.get(tool.toLowerCase().replace(/-/g, '_'));
      if (pin === undefined) continue;
      assert.equal(version, pin, `${name}: ${tool} ${version} is the pinned ${pin}`); pinned++;
    }
    assert.ok(pinned >= 1, `${name} records its pinned environment`);
    assert.ok(fixture.inputs.length + fixture.references.length >= 1, `${name} lists its inputs or pinned references`);
    await assertPinnedInputs(fixture.inputs);
    assertPinnedReferences(fixture.references);
  }
});
