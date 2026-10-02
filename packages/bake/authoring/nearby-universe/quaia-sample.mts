// Entry script: node packages/bake/authoring/nearby-universe/quaia-sample.mts [quaia csv]
/**
 * The Nearby Universe's Quaia sample: the Gaia-unWISE quasars (Storey-Fisher et al. 2024, G < 20.0) that lie outside
 * DESI's footprint, thinned to the tracked DESI sample's density on the sky, so the quasar shell is one even sphere
 * instead of DESI's two cones.
 *
 * Input: the CSV of the manifest's `quaia-quasars-sample` origin query (GaiaDR3, RA_ICRS, DE_ICRS, zQuaia, redshift 0.8 to
 * 3.5, in source id order), by default `output/quaia/quaia-g20.csv`, and the tracked DESI sample.
 * Output: `source/quaia-quasars/quaia-sample.csv.gz`. It prints what it measured.
 *
 * The sky is cut into equal-area cells (bands equal in sin(dec), each split evenly in RA). A cell is DESI's when it holds at
 * least half the median count of the cells the DESI sample reaches. Quaia keeps the rows outside those cells, one in
 * `keepEvery` in source id order (Gaia's source ids follow position, so the share is even across the sky), where
 * `keepEvery` is the ratio of the median per-cell counts of the two samples on their own cells.
 */
import { medianUpperMiddle as median } from '@cssearth/core';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const repository = resolve(import.meta.dirname, '../../../..');
const sourceDirectory = resolve(repository, 'src/objects/nearby-universe-galaxies/source');
const inputPath = resolve(process.argv[2] ?? resolve(repository, 'output/quaia/quaia-g20.csv'));
const outputPath = resolve(sourceDirectory, 'quaia-quasars/quaia-sample.csv.gz');
const desiPath = resolve(sourceDirectory, 'desi-quasars/qso-sample.csv.gz');
const BANDS = 60, CELLS_PER_BAND = 120, CELL_DEG2 = 4 * Math.PI * (180 / Math.PI) ** 2 / (BANDS * CELLS_PER_BAND);

const rows = (text: string, path: string, columns: readonly string[]) => {
  const [header, ...lines] = text.trim().split('\n');
  const names = header!.split(',');
  const at = columns.map(column => {
    const index = names.indexOf(column);
    if (index < 0) throw new TypeError(`${path}: no ${column} column in "${header}".`);
    return index;
  });
  return lines.map((line, number) => {
    const fields = line.split(','), values = at.map(index => fields[index]!);
    const [ra, dec, z] = values.slice(1).map(Number);
    if (![ra, dec, z].every(Number.isFinite)) throw new TypeError(`${path}: row ${number + 2} has a non-numeric RA, Dec or redshift: "${line}".`);
    return { id: values[0]!, ra: ra!, dec: dec!, z: z! };
  });
};
const cell = (ra: number, dec: number) => {
  const band = Math.min(BANDS - 1, Math.floor((Math.sin(dec * Math.PI / 180) + 1) / 2 * BANDS));
  return band * CELLS_PER_BAND + Math.min(CELLS_PER_BAND - 1, Math.floor((ra % 360 + 360) % 360 / 360 * CELLS_PER_BAND));
};
const counts = (points: readonly { ra: number; dec: number }[]) => {
  const count = new Uint32Array(BANDS * CELLS_PER_BAND);
  for (const { ra, dec } of points) count[cell(ra, dec)]!++;
  return count;
};

const desi = rows(gunzipSync(await readFile(desiPath)).toString('utf8'), desiPath, ['TARGETID', 'RA', 'DEC', 'Z']);
const quaia = rows(await readFile(inputPath, 'utf8'), inputPath, ['GaiaDR3', 'RA_ICRS', 'DE_ICRS', 'zQuaia']);
const desiCounts = counts(desi), desiMedian = median([...desiCounts].filter(Boolean));
const footprint = desiCounts.map(count => count >= desiMedian / 2 ? 1 : 0);
const outside = quaia.filter(({ ra, dec }) => !footprint[cell(ra, dec)]);
const quaiaMedian = median([...counts(outside)].filter(Boolean));
const keepEvery = Math.max(1, Math.round(quaiaMedian / desiMedian));
const kept = outside.filter((_, index) => index % keepEvery === 0);
const csv = ['GaiaDR3,RA,DEC,Z', ...kept.map(({ id, ra, dec, z }) => `${id},${ra},${dec},${z}`)].join('\n') + '\n';
await writeFile(outputPath, gzipSync(csv, { level: 9 }));
const footprintCells = footprint.reduce((sum, value) => sum + value, 0);
console.log(JSON.stringify({
  cellDeg2: +CELL_DEG2.toFixed(3), desiRows: desi.length, desiMedianPerCell: desiMedian, desiFootprintDeg2: Math.round(footprintCells * CELL_DEG2),
  quaiaRows: quaia.length, quaiaOutsideFootprint: outside.length, quaiaMedianPerCell: quaiaMedian, keepEvery, kept: kept.length,
  output: outputPath,
}, null, 2));
