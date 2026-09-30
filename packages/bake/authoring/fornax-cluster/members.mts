// Entry script: node packages/bake/authoring/fornax-cluster/members.mts [fcc p2tbl2.dat.gz]
/**
 * The Fornax Cluster's member dots: the Fornax Cluster Catalog's definite members (Ferguson 1989, AJ 98, 367, through
 * CDS VII/180, table p2tbl2, membership code 1) that Cosmicflows-4 does not already hold, since the Nearby Universe
 * field draws those. A galaxy within 10 arcsec of a Cosmicflows-4 position is the same galaxy.
 *
 * The catalogue's B1950 (FK4) positions become J2000 ICRS positions through Astropy's FK4 to ICRS transformation. Each row
 * takes a numerical stage T from its FCC morphology: RC3's stage of each Hubble class (de Vaucouleurs et al. 1991):
 * E and dE -5, S0 and dS0 -2, Sa 1, Sb 3, Sc 5, Sd 7, Sm 9, Im and BCD 10. A type the authors left open between two
 * classes ("dE or dS0", "dE / ImV") or name none of these has none. Each row also names the cluster as its group and
 * carries Fornax's Cosmicflows-4 group distance (table 3 DMzp of group 13418, read from the Nearby Universe's tracked
 * table), so the members sit where the field's own Fornax galaxies do, and its total blue magnitude (BTmag) for the
 * field's tone.
 *
 * Inputs: FCC p2tbl2, by default `output/clusters/fcc-p2tbl2.dat.gz`, from
 * https://cdsarc.cds.unistra.fr/ftp/VII/180/p2tbl2.dat.gz (byte columns from its ReadMe), and the tracked
 * `src/objects/nearby-universe/source/galaxies/cf4-hyperleda.csv.gz`.
 * Output: `src/objects/fornax-cluster/source/dots/fcc-members.csv.gz`. It prints what it kept.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const repository = resolve(import.meta.dirname, '../../../..');
const fccPath = resolve(process.argv[2] ?? resolve(repository, 'output/clusters/fcc-p2tbl2.dat.gz'));
const fieldPath = resolve(repository, 'src/objects/nearby-universe/source/galaxies/cf4-hyperleda.csv.gz');
const outputPath = resolve(repository, 'src/objects/fornax-cluster/source/dots/fcc-members.csv.gz');
const FORNAX_GROUP = '13418', MATCH_ARCSEC = 10;

const stage = (type: string): string => {
  if (/\bor\b|\//u.test(type)) return '';
  const classes: [RegExp, string][] = [[/^d?E/u, '-5'], [/^d?S(B)?0/u, '-2'], [/^S(B)?a/u, '1'], [/^S(B)?b/u, '3'], [/^S(B)?c/u, '5'],
    [/^(d:)?S(B)?c/u, '5'], [/^S(B)?d/u, '7'], [/^S(B)?m/u, '9'], [/^(Im|BCD)/u, '10']];
  return classes.find(([pattern]) => pattern.test(type))?.[1] ?? '';
};
const [fieldHeader, ...fieldRows] = gunzipSync(await readFile(fieldPath)).toString('utf8').trim().split('\n');
const columns = fieldHeader!.split(','), at = (name: string) => {
  const index = columns.indexOf(name);
  if (index < 0) throw new TypeError(`${fieldPath}: no ${name} column in "${fieldHeader}".`);
  return index;
};
const [raAt, decAt, groupAt, groupModulusAt] = ['RAJ2000', 'DEJ2000', 'G1PGC', 'GDMzp'].map(at);
const field = fieldRows.map(row => row.split(','));
const moduli = new Set(field.filter(row => row[groupAt!] === FORNAX_GROUP).map(row => row[groupModulusAt!]!));
if (moduli.size !== 1) throw new TypeError(`${fieldPath}: group ${FORNAX_GROUP} has ${moduli.size} distance moduli, not one.`);
const fornaxModulus = [...moduli][0]!;

// p2tbl2 byte columns (ReadMe): 1-4 FCC, 6-7 RAh, 9-10 RAm, 12-15 RAs, 17 DE-, 18-19 DEd, 21-22 DEm, 24-25 DEs, 27 Mem, 29-53 MType,
// 55-58 BTmag.
const lines = gunzipSync(await readFile(fccPath)).toString('utf8').split('\n').filter(line => line.trim());
if (lines.length !== 340) throw new TypeError(`${fccPath}: FCC p2tbl2 has 340 rows, not ${lines.length}.`);
const definite = lines.filter(line => line[26] === '1').map(line => {
  const number = (from: number, to: number) => {
    const value = Number(line.slice(from - 1, to));
    if (!Number.isFinite(value)) throw new TypeError(`${fccPath}: FCC ${line.slice(0, 4).trim()} bytes ${from}-${to} are not a number.`);
    return value;
  };
  const sign = line[16] === '-' ? -1 : 1;
  return { id: line.slice(0, 4).trim(), type: line.slice(28, 53).trim(), bt: line.slice(54, 58).trim(),
    ra1950: 15 * (number(6, 7) + number(9, 10) / 60 + number(12, 15) / 3600), dec1950: sign * (number(18, 19) + number(21, 22) / 60 + number(24, 25) / 3600) };
});
const { astroqueryToolchainSync } = await import('@cssearth/telescope/node');
const toolchain = astroqueryToolchainSync();
const python = String.raw`import json, sys
import astropy.units as u
from astropy.coordinates import SkyCoord
rows = json.load(sys.stdin)
c = SkyCoord(ra=[r[0] for r in rows] * u.deg, dec=[r[1] for r in rows] * u.deg, frame='fk4', equinox='B1950', obstime='B1950').icrs
json.dump([[round(float(a), 5), round(float(d), 5)] for a, d in zip(c.ra.deg, c.dec.deg)], sys.stdout)`;
const run = spawnSync(toolchain.python, ['-c', python], { env: { ...process.env, ...toolchain.env }, encoding: 'utf8',
  input: JSON.stringify(definite.map(row => [row.ra1950, row.dec1950])) });
if (run.status !== 0) throw new Error(`${fccPath}: the FK4 to ICRS conversion failed: ${run.stderr.slice(-2000)}`);
const icrs = JSON.parse(run.stdout) as [number, number][];

const radius = MATCH_ARCSEC / 3600, cells = new Map<string, [number, number][]>();
const cell = (ra: number, dec: number) => [Math.floor(dec / radius), Math.floor(ra * Math.cos(dec * Math.PI / 180) / radius)];
for (const row of field) {
  const ra = Number(row[raAt!]), dec = Number(row[decAt!]), key = cell(ra, dec).join(',');
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
let drawnByField = 0;
const kept = definite.flatMap((row, index) => {
  const [ra, dec] = icrs[index]!;
  if (inField(ra, dec)) { drawnByField++; return []; }
  return [`${row.id},${ra},${dec},${stage(row.type)},fornax,${fornaxModulus},${row.bt}`];
});
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, gzipSync(['FCC,RAJ2000,DEJ2000,T,Group,GroupDM,Bmag', ...kept].join('\n') + '\n', { level: 9 }));
console.log(JSON.stringify({ definiteMembers: definite.length, drawnByField, kept: kept.length, withoutStage: kept.filter(line => line.split(',')[3] === '').length,
  fornaxModulus, bytes: (await readFile(outputPath)).length, output: outputPath }));
