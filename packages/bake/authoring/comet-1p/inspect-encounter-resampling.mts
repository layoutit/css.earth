/** Compare the delivered geographic intermediate with the original image sampler.
 * This measures resampling loss under the existing registration, not registration accuracy. */
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { cross3, dotN, requireRecord, array, number } from '@cssearth/core';
import { loadNativePhotograph } from '@cssearth/bake/objects/layers/terrestrial';
import { prepareEncounters } from './prepare-encounters.mts';

export async function inspectEncounterResampling(source: string, output: string) {
  await mkdir(output, { recursive: true });
  const manifest = requireRecord(JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8')));
  const entry = array(requireRecord)(manifest.inputs).find(input => input.id === 'encounter-projection');
  const projection = requireRecord(entry?.projection);
  assert.equal(projection.type, 'equirectangular');
  assert.equal(projection.longitudeDirection, 'east-positive');
  const referenceRadiusMeters = number(projection.referenceRadiusMeters);
  const widths = [512, 1024, 2048];
  const maps: (Awaited<ReturnType<typeof prepareEncounters>> & {
    width: number; path: string; sampler: Awaited<ReturnType<typeof loadNativePhotograph>>;
  })[] = [];
  for (const width of widths) {
    const result = await prepareEncounters(source, width), path = `encounters-${width}.png`;
    await writeFile(resolve(output, path), result.png);
    const sampler = await loadNativePhotograph(output, { path, width, height: width / 2,
      projection: { type: 'equirectangular', longitudeDirection: 'east-positive', referenceRadiusMeters } },
      { kind: 'image-rgb-no-data', noData: 0, centerLongitude: 180 });
    maps.push({ ...result, width, sampler, path });
  }
  const reference = maps[0];
  const samples: { area: number; source: number; truth: number[]; values: (number[] | null)[] }[] = [];
  const weights = [[.17, .31, .52], [.52, .17, .31], [.31, .52, .17]];
  for (let face = 0; face < reference.mesh.indices.length; face++) {
    const vertices = reference.mesh.indices[face].map(i => reference.mesh.positions[i]);
    const subtract = (a: readonly number[], b: readonly number[]) => a.map((n, i) => n - b[i]);
    const cross = cross3(subtract(vertices[1], vertices[0]), subtract(vertices[2], vertices[0]));
    const area = Math.sqrt(dotN(cross, cross)) / 2 / weights.length;
    for (const w of weights) {
      const point = [0, 1, 2].map(k => vertices.reduce((sum, v, i) => sum + v[k] * w[i], 0));
      const truth = reference.samplePoint(point, face);
      if (!truth) continue;
      const longitude = (Math.atan2(point[1], point[0]) * 180 / Math.PI + 360) % 360;
      const latitude = Math.atan2(point[2], Math.hypot(point[0], point[1])) * 180 / Math.PI;
      const values = maps.map(map => {
        const x = longitude / 360 * map.width - .5, y = (90 - latitude) / 180 * (map.width / 2) - .5;
        const ix = Math.floor(x), iy = Math.floor(y), color = [0, 0, 0];
        // Report blur separately from frame seams and missing coverage. All four
        // contributors must name the same observation as the direct reference.
        for (const dy of [0, 1]) for (const dx of [0, 1]) {
          const px = (ix + dx + map.width) % map.width, py = iy + dy;
          if (py < 0 || py >= map.width / 2 || map.attribution[py * map.width + px] !== truth.source) return null;
        }
        return map.sampler.sample(longitude, latitude, color) ? color : null;
      });
      samples.push({ area, source: truth.source, truth: truth.color, values });
    }
  }
  const common = samples.filter(s => s.values.every(v => v !== null));
  const groups = [0, 1, 2, 3].map(sourceId => {
    const selected = common.filter(s => sourceId === 0 || s.source === sourceId), area = selected.reduce((n, s) => n + s.area, 0);
    assert.ok(selected.length > 0 && area > 0, `No common interior samples for source ${sourceId}`);
    return { source: ['all', 'giotto', 't11190', 't11194'][sourceId], samples: selected.length, areaSquareKm: area / 1e6,
      comparisons: maps.map((map, index) => {
        let absolute = 0, squared = 0;
        const errors = selected.map(s => {
          const color = s.values[index]; if (!color) throw new Error('Missing common sample');
          const error = color.map((value, channel) => Math.abs(value - s.truth[channel]));
          absolute += s.area * error.reduce((a, b) => a + b, 0) / 3;
          squared += s.area * error.reduce((a, b) => a + b * b, 0) / 3;
          return Math.max(...error);
        }).sort((a, b) => a - b);
        return { width: map.width, meanAbsoluteDisplayByteError: absolute / area, rmsDisplayByteError: Math.sqrt(squared / area),
          p95MaximumChannelError: errors[Math.ceil(errors.length * .95) - 1] };
      }) };
  });
  const report = { schema: 'cssearth-halley-resampling-comparison@1',
    method: 'Three asymmetric barycentric points per full-source triangle. Compare bilinear map samples with direct original-image sampling under the same unchanged registration. Area-weight errors over points whose four interpolation corners use the same photograph at every width; seams and gaps excluded from blur statistics.',
    interpretation: 'Resampling fidelity only. This does not validate surface feature coordinates, recover albedo, or add observations.',
    candidateSamples: samples.length, commonInteriorSamples: common.length, groups,
    maps: maps.map((map, index) => ({ width: map.width, height: map.width / 2, path: map.path, bytes: map.png.length,
      interiorSamples: samples.filter(s => s.values[index] !== null).length })),
    inputs: await Promise.all([
      'manifest.json', 'shape/1682q1halley.tab', 'giotto/hmc_best.gif',
      'giotto/rotation-2004.tab', 'giotto/vega2-flyby.txt', 'giotto/vega2-trajectory.txt',
      'reference/giotto-registration.json', 'reference/encounter-registration.json',
      ...['t11190', 't11194'].flatMap(id => [`vega/${id}.hdr`, `vega/${id}.img`]),
    ].map(async path => ({ path, bytes: (await stat(resolve(source, path))).size }))) };
  await writeFile(resolve(output, 'resampling.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const output = resolve(process.argv[2] ?? 'output/halley-resampling');
  console.log(JSON.stringify(await inspectEncounterResampling(resolve('src/objects/comet-1p/source'), output), null, 2));
}
