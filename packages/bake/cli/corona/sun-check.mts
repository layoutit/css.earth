#!/usr/bin/env node
/** The corona derivation's premise checked on the Sun, where the corona is measured: does the neutral line of the potential
 * field, extrapolated from the Sun's surface field of one rotation, mark where STEREO measured the corona dense in that
 * rotation? docs/stellar-corona-from-magnetic-maps.md quotes what this prints.
 *
 *   node packages/bake/cli/corona/sun-check.mts <WSO coefficients> <cor1b-n3d_CR2053P1_m10.fits>
 *
 * The field: the Wilcox Solar Observatory's harmonic coefficients of the radial photospheric field for Carrington rotation
 * 2053, Schmidt-normalised, in microtesla (http://wso.stanford.edu/Harmonic.rad/CR2053, 990 bytes, saved unchanged). The
 * density: the STEREO-B COR1 tomography of the same rotation the Sun's package holds
 * (src/objects/sun/source/stereo/cor1/), on Carrington longitude, latitude and radius from 1.5 to 4 solar radii. */
import { neutralLine, type FieldHarmonics } from '@cssearth/bake/objects/stellar';
import { fitsImageAccessor, readFitsHdu } from '@cssearth/fits';
import { readFile } from 'node:fs/promises';

const [coefficientPath, fitsPath] = process.argv.slice(2);
if (!coefficientPath || !fitsPath) throw new TypeError('Usage: corona/sun-check.mts <WSO coefficients> <COR1 density FITS>');

/** WSO's Schmidt-normalised g and h as the orthonormal real harmonics the derivation uses, which carry the Condon-Shortley
 * phase: g and h times (-1)^m sqrt(4π / (2l + 1)), and microtesla to gauss. */
async function wsoHarmonics(path: string): Promise<FieldHarmonics> {
  const rows = (await readFile(path, 'utf8')).split('\n').map(line => line.replace(/\t.*$/u, '').trim().split(/\s+/u).map(Number)).filter(row => row.length > 1 && row.every(Number.isFinite));
  const lmax = rows.length / 2 - 1, count = (lmax + 1) * (lmax + 2) / 2, cosine = new Float64Array(count), sine = new Float64Array(count);
  for (let l = 0; l <= lmax; l++) for (let m = 0; m <= l; m++) {
    const scale = (m % 2 ? -1 : 1) * Math.sqrt(4 * Math.PI / (2 * l + 1)) / 100;
    cosine[l * (l + 1) / 2 + m] = rows[l]![m + 1]! * scale; sine[l * (l + 1) / 2 + m] = rows[lmax + 1 + l]![m + 1]! * scale;
  }
  return { lmax, cosine, sine };
}

const harmonics = await wsoHarmonics(coefficientPath), bytes = await readFile(fitsPath), hdu = readFitsHdu(bytes), sample = fitsImageAccessor(bytes, hdu);
const [longitudes, latitudes, shells] = hdu.dimensions as [number, number, number];
if (longitudes !== 361 || latitudes !== 181 || shells !== 51) throw new Error(`Unexpected STEREO grid ${hdu.dimensions.join(' x ')}.`);

const weightedMedian = (values: number[], weights: number[]) => { const order = values.map((_, i) => i).sort((i, j) => values[i]! - values[j]!), total = weights.reduce((s, v) => s + v, 0);
  let run = 0; for (const i of order) { run += weights[i]!; if (run >= total / 2) return values[i]!; } return values[order.at(-1)!]!; };
const BINS = [[0, 5], [5, 10], [10, 20], [20, 40], [40, 180]] as const;

console.log(`Measured density over the density typical of its radius (the area-weighted median of the shell), by angle from the neutral line: ${BINS.map(([low, high]) => `${low}-${high}°`).join(', ')}`);
for (const source of [2, 2.5, 3.25]) {
  const line = neutralLine(harmonics, source);
  console.log(`source surface at ${source} radii:`);
  for (const shell of [1.5, 2, 2.5, 3, 3.5, 4]) {
    const r = Math.round((shell - 1.5) / 0.05), density: number[] = [], away: number[] = [], weight: number[] = [];
    for (let lat = 2; lat < latitudes - 2; lat += 3) for (let lon = 0; lon < longitudes - 1; lon += 3) {
      density.push(sample((r * latitudes + lat) * longitudes + lon)); away.push(line.distanceDegrees((90 - (lat - 90)) * Math.PI / 180, lon * Math.PI / 180)); weight.push(Math.cos((lat - 90) * Math.PI / 180));
    }
    const typical = weightedMedian(density, weight), floor = typical / 1000;
    const bins = BINS.map(([low, high]) => { const inside = density.map((value, i) => [Math.max(value, floor) / typical, weight[i]!] as const).filter((_, i) => away[i]! >= low && away[i]! < high);
      return inside.length ? weightedMedian(inside.map(one => one[0]), inside.map(one => one[1])).toFixed(2) : '-'; });
    console.log(`  ${shell.toFixed(1)} R: typical ${typical.toExponential(1)} electrons per cm3; ${bins.join(', ')}`);
  }
}
