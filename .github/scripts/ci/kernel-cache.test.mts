/** Kernel bank cache identity follows the pins, with NAIF acquisition as the miss path. */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

const root = new URL('../../../', import.meta.url);
test('every solar preparation CI job caches kernel files under a pin-content key', async () => {
  const workflow = requireRecord(parse(await readFile(new URL('.github/workflows/universe.yml', root), 'utf8')));
  const jobs = Object.values(requireRecord(workflow.jobs)).map(job => requireRecord(job));
  const fetching = jobs.filter(job => requireArray(job.steps).some(step => /build-ci\.mts (?:lint|full)/u.test(String(requireRecord(step).run))));
  assert.ok(fetching.length >= 5);
  const banks = (await readdir(new URL('src/spice/', root), { withFileTypes: true })).filter(entry => entry.isDirectory());
  const pins = await Promise.all(banks.map(async bank => ({ path: `src/spice/${bank.name}/manifest.json`, contents: await readFile(new URL(`src/spice/${bank.name}/manifest.json`, root), 'utf8') })));
  assert.ok(pins.length > 0);
  for (const job of fetching) {
    const steps = requireArray(job.steps).map(step => requireRecord(step));
    const cacheIndex = steps.findIndex(step => step.name === 'Cache pinned NAIF kernel banks');
    assert.ok(cacheIndex >= 0, String(job.name));
    const cache = steps[cacheIndex]!;
    assert.match(requireString(cache.uses), /^actions\/cache@/u);
    const options = requireRecord(cache.with), key = requireString(options.key);
    assert.equal(requireString(options.path).trim(), 'src/spice/*/*/');
    assert.match(key, /hashFiles\('src\/spice\/\*\/manifest\.json'\)/u);
    assert.ok(cacheIndex < steps.findIndex(step => /build-ci\.mts (?:lint|full)/u.test(String(step.run))));
    // The expression admits exactly the tracked bank manifests. Serialize its selected contents to model key input;
    // GitHub owns the digest implementation. Changing every individual pin must change that input.
    const referenced = pins.filter(pin => /^src\/spice\/[^/]+\/manifest\.json$/u.test(pin.path));
    assert.equal(referenced.length, pins.length);
    const identity = (values: typeof pins) => JSON.stringify(values.map(pin => [pin.path, pin.contents]));
    for (const pin of referenced) {
      const parsed = requireRecord(JSON.parse(pin.contents));
      const inputs = requireArray(parsed.inputs).map(input => requireRecord(input));
      assert.ok(inputs.some(input => String(input.origin).includes('naif.jpl.nasa.gov')), pin.path);
      const changed = JSON.stringify({ ...parsed, inputs: inputs.map((input, i) => i === 0 ? { ...input, origin: `${String(input.origin)}?pin-changed` } : input) });
      assert.notEqual(identity(referenced.map(value => value === pin ? { ...pin, contents: changed } : value)), identity(referenced), pin.path);
    }
  }
});
