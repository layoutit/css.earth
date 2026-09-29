import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { prepareChartAssets } from '../../../site/build/charts/charts.ts';

const test = sourceTest();
const source = new URL('../../../src/objects/hd-189733/source/', import.meta.url).pathname;
const files = ['tess2021204101404-s0041-0000000256364928-0212-s_lc.fits', 'tess2022190063128-s0054-0000000256364928-0227-s_lc.fits', 'tess2024196212429-s0081-0000000256364928-0276-s_lc.fits'].map(name => `photometry/tess/${name}`);

test('HD 189733 b folds from its pinned TESS sectors to a dip as deep as its radius ratio says, flat outside it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'folded-transit-'));
  try {
    // The archive's duration for HD 189733 b is 1.827 h; 7-minute bins give about fifteen across the transit.
    await prepareChartAssets({ sourceDirectory: source, publicDirectory: directory, config: { schema: 'cssearth-chart-assets@1', publicBase: '/scenes/test/', charts: [{
      kind: 'folded-transit', id: 'hd-189733b-transit', title: 'HD 189733 b: its transit', description: 'd', output: 'transit.svg', metadata: {},
      planet: 'hd-189733b', sources: files, durationHours: 1.827, binMinutes: 7, notes: ['TESS 2-min SPOC · sectors 41, 54, 81'] }] } });
    const svg = await readFile(join(directory, 'transit.svg'), 'utf8');
    const bins = [...svg.matchAll(/data-hours="([^"]+)" data-ppm="([^"]+)" data-error="([^"]+)"/gu)].map(m => ({ hours: Number(m[1]), ppm: Number(m[2]), error: Number(m[3]) }));
    const transits = Number(/&quot;transits&quot;:(\d+)/u.exec(svg)?.[1]);
    assert.ok(transits >= 10, `${transits} transits stacked from three sectors of a 2.2-day orbit`);
    // Lally et al. (2025)'s Rp/R* 0.155 makes a dip near (0.155)^2 = 2.4%; limb darkening deepens the centre a little.
    const deepest = Math.min(...bins.map(bin => bin.ppm));
    assert.ok(deepest < -22000 && deepest > -28000, `deepest bin ${deepest} ppm`);
    const outside = bins.filter(bin => Math.abs(bin.hours) > 1.2);
    assert.ok(outside.length >= 4 && outside.every(bin => Math.abs(bin.ppm) < 1500), `baseline bins ${outside.map(bin => Math.round(bin.ppm)).join(', ')}`);
    assert.ok(bins.every(bin => bin.error > 0 && bin.error < 2000), 'each bin carries its standard error');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
