// Entry script: node packages/bake/authoring/nearby-universe/wisescos-sample.mts [wiseScosPhotoz160708.csv.gz]
/**
 * The Nearby Universe's WISE x SuperCOSMOS sample: the photometric-redshift galaxies (Bilicki et al. 2016, ApJS 225, 5)
 * outside DESI's footprint, at DESI's density, so the bright-galaxy shell is one ball instead of DESI's two cones.
 *
 * Input: the catalogue's CSV (`wiseScosPhotoz160708.csv.gz` from http://ssa.roe.ac.uk/WISExSCOS.html, 18.5 million
 * galaxies), by default in `output/wisescos/`, read as a stream; and the tracked DESI sample.
 * Output: `source/wisescos-galaxies/wisescos-sample.csv.gz`. It prints what it measured.
 *
 * - DESI's footprint is found as `quaia-sample.mts` finds it: the sky cut into 7,200 equal-area cells (bands equal in
 *   sin(dec), each split evenly in RA); a cell is DESI's when it holds at least half the median count of the cells the
 *   DESI sample reaches.
 * - A galaxy is a candidate outside that footprint with its bias-corrected photometric redshift (`zPhoto_Corr`) from 0.1
 *   to 0.4, DESI's range, and brighter than absolute R -21.5 (its extinction-corrected SuperCOSMOS R, `rCalCorr`, at its
 *   Planck 2018 luminosity distance, no k-correction): DESI's sample's cut, in the nearest band this catalogue has.
 * - The fill covers the cells outside DESI's footprint that hold at least half the median candidate count of such cells:
 *   the catalogue's own mask leaves the Milky Way's disc and the Magellanic Clouds empty, and those stay empty.
 * - In each redshift bin 0.02 wide, the fill keeps as many candidates per cell as the DESI sample holds per footprint
 *   cell, a fixed share of each bin chosen by each galaxy's WISE id, so the ball's depth follows DESI's.
 * - This catalogue has no g, r and z fluxes to colour a galaxy as DESI's are coloured, so each row carries its redshift
 *   bin (column C), and the script prints the median colour DESI's own galaxies show in each bin (each channel's median
 *   over the prepared DESI bank's untoned palette colours, `output/catalogue-points/nearby-universe/desi-bright-galaxies.json`,
 *   which `prepare-catalogue-points.mts src/objects/nearby-universe desi-bright-galaxies` writes): the recipe's colour
 *   stops.
 */
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { createGunzip, gunzipSync, gzipSync } from 'node:zlib';

const repository = resolve(import.meta.dirname, '../../../..');
const sourceDirectory = resolve(repository, 'src/objects/nearby-universe/source');
const inputPath = resolve(process.argv[2] ?? resolve(repository, 'output/wisescos/wiseScosPhotoz160708.csv.gz'));
const outputPath = resolve(sourceDirectory, 'wisescos-galaxies/wisescos-sample.csv.gz');
const desiPath = resolve(sourceDirectory, 'desi-bright-galaxies/bgs-bright-21.5-sample.csv.gz');
const BANDS = 60, CELLS_PER_BAND = 120, CELL_DEG2 = 4 * Math.PI * (180 / Math.PI) ** 2 / (BANDS * CELLS_PER_BAND);
const Z_FROM = 0.1, Z_TO = 0.4, Z_BIN = 0.02, BINS = Math.round((Z_TO - Z_FROM) / Z_BIN), ABSOLUTE_R = -21.5;

const cell = (ra: number, dec: number) => {
  const band = Math.min(BANDS - 1, Math.floor((Math.sin(dec * Math.PI / 180) + 1) / 2 * BANDS));
  return band * CELLS_PER_BAND + Math.min(CELLS_PER_BAND - 1, Math.floor((ra % 360 + 360) % 360 / 360 * CELLS_PER_BAND));
};
const bin = (z: number) => z >= Z_FROM && z < Z_TO ? Math.min(BINS - 1, Math.floor((z - Z_FROM) / Z_BIN)) : -1;
const median = (values: readonly number[]) => {
  if (!values.length) throw new TypeError('No occupied cells to take a median of.');
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1]!;
};
// Planck 2018 (Planck Collaboration 2020, A&A 641, A6; Astropy's Planck18): H0 67.66 km/s/Mpc, Omega_m 0.30966, flat. The
// luminosity distance only sets the magnitude cut, so the radiation term Astropy adds is left out (under 0.01 mag here).
const H0 = 67.66, OMEGA_M = 0.30966, C_KM_S = 299792.458;
const luminosityDistancePc = (() => {
  const steps = 4000, table = new Float64Array(steps + 1), dz = 0.5 / steps;
  for (let i = 1; i <= steps; i++) {
    const e = (z: number) => 1 / Math.sqrt(OMEGA_M * (1 + z) ** 3 + 1 - OMEGA_M);
    table[i] = table[i - 1]! + (e((i - 1) * dz) + e(i * dz)) / 2 * dz;
  }
  return (z: number) => (1 + z) * C_KM_S / H0 * table[Math.round(z / dz)]! * 1e6;
})();
// A share chosen by WISE id: the same galaxies on every run, spread evenly across the sky.
const share = (id: number) => {
  let hash = 2166136261;
  for (const digit of String(id)) hash = Math.imul(hash ^ digit.charCodeAt(0), 16777619) >>> 0;
  return hash / 2 ** 32;
};

const [desiHeader, ...desiRows] = gunzipSync(await readFile(desiPath)).toString('utf8').trim().split('\n');
const desiNames = desiHeader!.split(','), [raAt, decAt, zAt] = ['RA', 'DEC', 'Z'].map(name => desiNames.indexOf(name));
if ([raAt, decAt, zAt].some(index => index! < 0)) throw new TypeError(`${desiPath}: needs RA, DEC and Z columns, not "${desiHeader}".`);
const desiCells = new Uint32Array(BANDS * CELLS_PER_BAND), desiBins = new Uint32Array(BINS);
const desi = desiRows.map(row => { const fields = row.split(','); return [Number(fields[raAt!]), Number(fields[decAt!]), Number(fields[zAt!])] as const; });
for (const [ra, dec] of desi) desiCells[cell(ra, dec)]!++;
const desiMedian = median([...desiCells].filter(Boolean));
const footprint = desiCells.map(count => count >= desiMedian / 2 ? 1 : 0), footprintCells = footprint.reduce((sum, value) => sum + value, 0);
for (const [ra, dec, z] of desi) if (footprint[cell(ra, dec)] && bin(z) >= 0) desiBins[bin(z)]!++;

// One pass over the catalogue keeps every candidate in flat columns (a few million rows): its WISE id (an integer below
// 2^53), position, redshift, R and sky cell.
const names: string[] = [], ids: number[] = [], ras: number[] = [], decs: number[] = [], zs: number[] = [], rs: number[] = [], homes: number[] = [];
let rows = 0, inRange = 0, faint = 0, inside = 0;
const lines = createInterface({ input: createReadStream(inputPath).pipe(createGunzip()), crlfDelay: Infinity });
let columns: number[] = [];
for await (const line of lines) {
  if (!names.length) {
    names.push(...line.split(','));
    columns = ['wiseID', 'ra', 'dec', 'rCalCorr', 'zPhoto_Corr'].map(name => {
      const index = names.indexOf(name);
      if (index < 0) throw new TypeError(`${inputPath}: no ${name} column in "${line}".`);
      return index;
    });
    continue;
  }
  rows++;
  const fields = line.split(','), [idColumn, raColumn, decColumn, rColumn, zColumn] = columns;
  const z = Number(fields[zColumn!]), ra = Number(fields[raColumn!]), dec = Number(fields[decColumn!]), r = Number(fields[rColumn!]);
  if (bin(z) < 0) continue;
  inRange++;
  if (!(r - 5 * Math.log10(luminosityDistancePc(z) / 10) < ABSOLUTE_R)) { faint++; continue; }
  const home = cell(ra, dec);
  if (footprint[home]) { inside++; continue; }
  ids.push(Number(fields[idColumn!])); ras.push(ra); decs.push(dec); zs.push(z); rs.push(r); homes.push(home);
}
const perCell = new Uint32Array(BANDS * CELLS_PER_BAND);
for (const home of homes) perCell[home]!++;
const candidateMedian = median([...perCell].filter(Boolean));
const covered = perCell.map(count => count >= candidateMedian / 2 ? 1 : 0), coveredCells = covered.reduce((sum, value) => sum + value, 0);
const available = new Uint32Array(BINS);
homes.forEach((home, index) => { if (covered[home]) available[bin(zs[index]!)]!++; });
// Each bin keeps DESI's count per footprint cell over the covered cells: a share of what the catalogue offers there.
const target = [...desiBins].map(count => count / footprintCells * coveredCells);
const kept = homes.flatMap((home, index) => covered[home] && share(ids[index]!) < target[bin(zs[index]!)]! / available[bin(zs[index]!)]!
  ? [`${ids[index]},${ras[index]},${decs[index]},${zs[index]},${rs[index]},${bin(zs[index]!)}`] : []);
const csv = ['wiseID,RA,DEC,Z,R,C', ...kept].join('\n') + '\n';
// DESI's median colour per bin, from its prepared bank (points in the sample's row order).
const bankPath = resolve(repository, 'output/catalogue-points/nearby-universe/desi-bright-galaxies.json');
const bank = JSON.parse(await readFile(bankPath, 'utf8')) as { points?: number[][]; appearance?: { palette?: string[] } };
if (!bank.points || bank.points.length !== desi.length || !bank.appearance?.palette) throw new TypeError(`${bankPath}: expected ${desi.length} points with a palette, in the sample's order.`);
const channels = Array.from({ length: BINS }, () => [[], [], []] as number[][]);
bank.points.forEach((point, index) => {
  const at = bin(desi[index]![2]), colour = bank.appearance!.palette![point[3]!]!;
  if (at >= 0) for (let channel = 0; channel < 3; channel++) channels[at]![channel]!.push(parseInt(colour.slice(1 + channel * 2, 3 + channel * 2), 16));
});
const colourStops = channels.map((bands, index) => [index, '#' + bands.map(values => median(values).toString(16).padStart(2, '0')).join('')]);
await writeFile(outputPath, gzipSync(csv, { level: 9 }));
console.log(JSON.stringify({
  cellDeg2: +CELL_DEG2.toFixed(3), desiRows: desi.length, desiFootprintDeg2: Math.round(footprintCells * CELL_DEG2),
  catalogueRows: rows, inRedshiftRange: inRange, fainterThanCut: faint, onDesiFootprint: inside, candidates: ids.length,
  coveredDeg2: Math.round(coveredCells * CELL_DEG2), kept: kept.length,
  bins: [...desiBins].map((count, index) => ({ z: +(Z_FROM + index * Z_BIN).toFixed(2), desiPerCell: +(count / footprintCells).toFixed(3),
    availablePerCell: +(available[index]! / coveredCells).toFixed(3), shortfall: available[index]! < target[index]! })),
  colourStops, output: outputPath,
}, null, 2));
