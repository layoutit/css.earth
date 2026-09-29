import assert from 'node:assert/strict';
import { sourceTest } from '../objects/source-test.mts';
const test = sourceTest();
import { access, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readOracleFixture, pinnedOracleVersions, assertPinnedInputs, assertPinnedReferences, ORACLE_ROOT } from '../oracles/fixture.mts';
import { runtimeLock } from '../oracles/sbmt/runtime.mts';

/** Every committed oracle fixture comes from the pinned environment and the pinned inputs; runs in `pnpm test:platform` without Python or restored sources. */
// The scripts sit beside their fixtures; SBMT's JSON bridge manifests and runtime lock are not fixtures.
const NOT_FIXTURES = new Set(['sbmt/package.json', 'sbmt/package-lock.json', 'sbmt/runtime.lock.json']);
const directories = await readdir(resolve(ORACLE_ROOT, 'tests/oracles'), { withFileTypes: true });
const names = (await Promise.all(directories.filter(d => d.isDirectory()).map(async d => (await readdir(resolve(ORACLE_ROOT, 'tests/oracles', d.name))).filter(f => f.endsWith('.json')).map(f => `${d.name}/${f}`)))).flat()
  .filter(name => !NOT_FIXTURES.has(name));
const pins = await pinnedOracleVersions();

test('oracle fixtures name their generator, a pinned tool version and pinned inputs', async () => {
  assert.ok(names.length >= 2, `${names.length} fixtures`);
  for (const name of names) {
    const fixture = await readOracleFixture(name);
    if (fixture.oracle === 'SBMT') {
      const {lock}=await runtimeLock();
      // The committed fixture names the generator's path before the move until SBMT regenerates it.
      assert.ok(['tools/oracles/sbmt/projection.mts','tests/oracles/sbmt/projection.mts'].includes(fixture.generatedBy));
      assert.deepEqual(fixture.tool,{sbmt:lock.sbmt,release:lock.release,java:lock.java,'java-bridge':lock.bridge});
      await assertPinnedInputs(fixture.inputs);
      assertPinnedReferences(fixture.references);
      assert.ok(fixture.inputs.some(p=>p.path==='tests/fixtures/sbmt/cases.json'));
      continue;
    }
    // Fixtures written before the scripts moved from tools/oracles/ keep that path until they are regenerated.
    const script = /^(?:tools|tests)\/oracles\/([a-z0-9-]+\/[a-z0-9-]+\.py)$/u.exec(fixture.generatedBy);
    assert.ok(script, `${name} names its script`);
    await access(resolve(ORACLE_ROOT, 'tests/oracles', script[1]!));
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
