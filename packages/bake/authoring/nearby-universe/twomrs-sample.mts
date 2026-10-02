// Entry script: node packages/bake/authoring/nearby-universe/twomrs-sample.mts [table3.dat.gz]
/**
 * The Nearby Universe's 2MASS Redshift Survey sample: the 2MRS galaxies (Huchra et al. 2012, ApJS 199, 26, table 3) that
 * Cosmicflows-4 does not hold, so the field reaches the sky Cosmicflows-4's surveys leave empty, down to 5 degrees from
 * the Milky Way's plane (8 toward its bulge), where 2MRS's own mask ends.
 *
 * Input: CDS's table 3, by default `output/2mrs/table3.dat.gz`, from https://cdsarc.cds.unistra.fr/ftp/J/ApJS/199/26/table3.dat.gz
 * (byte columns from its ReadMe), and the tracked Cosmicflows-4 table.
 * Output: `source/galaxies-2mrs/twomrs-sample.csv.gz`. It prints what it kept.
 *
 * - A galaxy within 10 arcsec of a Cosmicflows-4 position is the same galaxy, drawn at its measured distance there.
 * - Each redshift (cz, in the solar system barycentre's frame) moves to the cosmic microwave background's frame with the
 *   dipole Planck measured (Planck Collaboration 2020, A&A 641, A1: 369.82 km/s toward l 264.021, b 48.253 degrees):
 *   1 + z_CMB = (1 + cz / c)(1 + v cos(angle) / c). The field is placed in the CMB frame as Cosmicflows-4 is.
 * - Kept from Cosmicflows-4's nearest galaxy (3.03 Mpc, z_CMB 0.0007) to z_CMB 0.05, past the field's 200 Mpc.
 * - Its numerical type T is the ZCAT code's first two characters (the ReadMe's note G1: -7 to 11 and 16 are Hubble
 *   stages); a quasar or AGN (-9), an HI cloud (12), a peculiar (15), an unclassified galaxy (19), an unclassified spiral
 *   (20) or an unexamined one (98) has none.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const repository = resolve(import.meta.dirname, '../../../..');
const inputPath = resolve(process.argv[2] ?? resolve(repository, 'output/2mrs/table3.dat.gz'));
const fieldPath = resolve(repository, 'src/objects/nearby-universe-galaxies/source/galaxies/cf4-hyperleda.csv.gz');
const outputPath = resolve(repository, 'src/objects/nearby-universe-galaxies/source/galaxies-2mrs/twomrs-sample.csv.gz');
const C_KM_S = 299792.458, DIPOLE_KM_S = 369.82, DIPOLE_L = 264.021, DIPOLE_B = 48.253, Z_FROM = 0.0007, Z_TO = 0.05, MATCH_ARCSEC = 10;

const unit = (lDeg: number, bDeg: number) => {
  const l = lDeg * Math.PI / 180, b = bDeg * Math.PI / 180;
  return [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)];
};
const dipole = unit(DIPOLE_L, DIPOLE_B);
const [fieldHeader, ...fieldRows] = gunzipSync(await readFile(fieldPath)).toString('utf8').trim().split('\n');
const names = fieldHeader!.split(','), raAt = names.indexOf('RAJ2000'), decAt = names.indexOf('DEJ2000');
if (raAt < 0 || decAt < 0) throw new TypeError(`${fieldPath}: needs RAJ2000 and DEJ2000 columns, not "${fieldHeader}".`);
const radius = MATCH_ARCSEC / 3600, cells = new Map<string, [number, number][]>();
const cell = (ra: number, dec: number) => [Math.floor(dec / radius), Math.floor(ra * Math.cos(dec * Math.PI / 180) / radius)];
for (const row of fieldRows) {
  const fields = row.split(','), ra = Number(fields[raAt]), dec = Number(fields[decAt]), key = cell(ra, dec).join(',');
  cells.set(key, [...cells.get(key) ?? [], [ra, dec]]);
}
const inField = (ra: number, dec: number) => {
  const [y, x] = cell(ra, dec);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    for (const [fra, fdec] of cells.get(`${y! + dy},${x! + dx}`) ?? []) {
      if (Math.hypot((ra - fra) * Math.cos(dec * Math.PI / 180), dec - fdec) <= radius) return true;
    }
  }
  return false;
};

// Table 3 byte columns (ReadMe): 1-16 ID, 18-26 RAdeg, 28-36 DEdeg, 38-46 GLON, 48-56 GLAT, 58-63 Kcmag, 165-169 type, 174-178 cz.
const lines = gunzipSync(await readFile(inputPath)).toString('utf8').split('\n').filter(line => line.trim());
if (lines.length !== 44599) throw new TypeError(`${inputPath}: 2MRS table 3 has 44,599 rows, not ${lines.length}.`);
let withoutRedshift = 0, drawnByField = 0, outOfRange = 0, withoutType = 0;
const kept = lines.flatMap(line => {
  const field = (from: number, to: number) => line.slice(from - 1, to).trim(), number = (from: number, to: number) => Number(field(from, to));
  const id = field(1, 16), ra = number(18, 26), dec = number(28, 36), l = number(38, 46), b = number(48, 56), k = number(58, 63);
  if (![ra, dec, l, b, k].every(Number.isFinite)) throw new TypeError(`${inputPath}: ${id} has a malformed position or magnitude.`);
  if (!field(174, 178)) { withoutRedshift++; return []; }
  const cz = number(174, 178), direction = unit(l, b);
  const cosine = direction.reduce((sum, value, axis) => sum + value * dipole[axis]!, 0);
  const z = (1 + cz / C_KM_S) * (1 + DIPOLE_KM_S * cosine / C_KM_S) - 1;
  if (!(z >= Z_FROM && z <= Z_TO)) { outOfRange++; return []; }
  if (inField(ra, dec)) { drawnByField++; return []; }
  const code = Number(field(165, 169).slice(0, 2)), typed = Number.isInteger(code) && ((code >= -7 && code <= 11) || code === 16);
  if (!typed) withoutType++;
  return [`${id},${ra},${dec},${z.toFixed(6)},${typed ? code : ''},${k}`];
});
await writeFile(outputPath, gzipSync(['ID,RAJ2000,DEJ2000,Z,T,K', ...kept].join('\n') + '\n', { level: 9 }));
console.log(JSON.stringify({ rows: lines.length, withoutRedshift, outOfRange, drawnByField, kept: kept.length, withoutType,
  bytes: (await readFile(outputPath)).length, output: outputPath }));
