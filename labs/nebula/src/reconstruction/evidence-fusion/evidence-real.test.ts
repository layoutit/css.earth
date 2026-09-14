/** Explicit real-source smoke check; ordinary test runs do not require ignored local inputs. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { prepareEvidenceInputs } from './provider.js';
import { combineEvidence } from './combine.js';
import { geometrySha } from '../geometry/registered-source.js';

test('real pinned Helix inputs produce finite reproducible registered evidence with cached reuse', { skip: process.env.NEBULA_EVIDENCE_REAL !== '1' }, async () => {
  const start = performance.now(), catalogue = '.local/nebula-lab/observations/helix/structures/catalogue.json';
  const inputs = await prepareEvidenceInputs(process.cwd(), catalogue), prepareMs = performance.now() - start;
  assert.equal(inputs.sources.length, 3);
  const output = resolve('.local/nebula-lab/evidence-fusion/verification', inputs.identity); await mkdir(output, { recursive: true });
  const { width, height } = inputs.grid, length = width * height;
  const summaries = [], imageHashes: Record<string, string> = {};
  for (const source of inputs.sources) {
    assert.ok(source.footprint.some(v => v === 1)); assert.ok(source.footprint.some(v => v === 0));
    for (const plane of Object.values(source.channels)) { assert.equal(plane.signal.length, length); assert.ok(plane.signal.every(v => Number.isFinite(v) && v >= 0)); }
    await sharp(source.registeredRgba, { raw: { width, height, channels: 4 } }).png().toFile(resolve(output, `${source.id}-registered.png`));
    summaries.push({ id: source.id, samplingArcseconds: source.samplingArcseconds, covered: source.footprint.reduce((a, b) => a + b, 0),
      channels: Object.fromEntries(Object.entries(source.channels).map(([id, plane]) => [id, { covered: plane.coverage.reduce((a, b) => a + b, 0),
        peakScore: plane.signal.reduce((a, b) => Math.max(a, b), 0), noiseSigma: plane.noiseSigma }])) });
  }
  for (const channel of ['all', 'broad', 'ridges', 'compact'] as const) {
    const result = combineEvidence(inputs, { channel, weights: [1, 1, 1], sensitivity: 1 });
    assert.ok(result.union.some(v => v > .1), `${channel} has no detected evidence`);
    assert.ok(result.agreement.some(v => v > .05), `${channel} has no repeated evidence`);
    for (const field of [result.union, result.agreement, ...result.planes]) assert.ok(field.every(v => Number.isFinite(v) && v >= 0 && v <= 1));
    for (const [name, field] of [['union', result.union], ['agreement', result.agreement]] as const) {
      const data = Uint8Array.from(field, value => Math.round(value * 255));
      const png = await sharp(data, { raw: { width, height, channels: 1 } }).png().toBuffer();
      await writeFile(resolve(output, `${channel}-${name}.png`), png); imageHashes[`${channel}-${name}`] = geometrySha(png);
    }
    if (channel === 'ridges') for (let i = 0; i < inputs.sources.length; i++) {
      const data = Uint8Array.from(result.planes[i], value => Math.round(value * 255));
      await sharp(data, { raw: { width, height, channels: 1 } }).png().toFile(resolve(output, `${inputs.sources[i].id}-ridges.png`));
    }
  }
  const cachedStart = performance.now(), repeated = await prepareEvidenceInputs(process.cwd(), catalogue), cachedMs = performance.now() - cachedStart;
  assert.equal(repeated.identity, inputs.identity);
  for (let i = 0; i < inputs.sources.length; i++) assert.deepEqual(repeated.sources[i].channels.ridges.signal, inputs.sources[i].channels.ridges.signal);
  const report = { identity: inputs.identity, grid: inputs.grid, method: inputs.method, prepareMs, cachedMs, summaries, imageHashes };
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, prepareMs, cachedMs, summaries }));
});
