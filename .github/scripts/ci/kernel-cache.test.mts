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
    const expressions = [...key.matchAll(/hashFiles\(([^)]*)\)/gu)];
    assert.ok(expressions.length > 0);
    const globs = expressions.flatMap(expression => [...expression[1]!.matchAll(/'([^']+)'/gu)].map(match => match[1]!));
    for (const pin of pins) {
      assert.ok(globs.some(glob => new RegExp(`^${glob.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('[^/]*')}$`, 'u').test(pin.path)), pin.path);
    }
  }
});
