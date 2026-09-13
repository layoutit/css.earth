import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readOracleFixture, pinnedOracleVersions, assertPinnedInputs, ORACLE_ROOT } from './oracles/fixture.mts';

/** Every committed oracle fixture comes from the pinned environment and the pinned inputs; runs in `pnpm test:platform` without Python or restored sources. */
const directories = await readdir(resolve(ORACLE_ROOT, 'tests/oracles'), { withFileTypes: true });
const names = (await Promise.all(directories.filter(d => d.isDirectory()).map(async d => (await readdir(resolve(ORACLE_ROOT, 'tests/oracles', d.name))).filter(f => f.endsWith('.json')).map(f => `${d.name}/${f}`)))).flat();
const pins = await pinnedOracleVersions();

test('oracle fixtures name their generator, a pinned tool version and pinned inputs', async () => {
  assert.ok(names.length >= 2, `${names.length} fixtures`);
  for (const name of names) {
    const fixture = await readOracleFixture(name);
    assert.match(fixture.generatedBy, /^tools\/oracles\/[a-z0-9-]+\/[a-z0-9-]+\.py$/u, `${name} names its script`);
    let pinned = 0;
    for (const [tool, version] of Object.entries(fixture.tool)) {
      const pin = pins.get(tool.toLowerCase().replace(/-/g, '_'));
      if (pin === undefined) continue;
      assert.equal(version, pin, `${name}: ${tool} ${version} is the pinned ${pin}`); pinned++;
    }
    assert.ok(pinned >= 2, `${name} records at least the oracle and numpy versions from the pinned environment`);
    assert.ok(fixture.inputs.length >= 1, `${name} lists its inputs`);
    await assertPinnedInputs(fixture.inputs);
  }
});
