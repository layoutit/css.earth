// Entry script: node packages/bake/authoring/virgo-cluster/members.mts [evcc table2.dat]
/**
 * The Virgo Cluster's member dots: the Extended Virgo Cluster Catalog's certain members (Kim et al. 2014, ApJS 215, 22,
 * table 2, `MmI` = M, by redshift against the Virgo infall model) that Cosmicflows-4 does not already hold, since the
 * Nearby Universe field draws those. A galaxy within 10 arcsec of a Cosmicflows-4 position is the same galaxy.
 *
 * Each row keeps its EVCC number, J2000 position and a numerical stage T read from its EVCC morphology: RC3's stage of
 * each Hubble class (de Vaucouleurs et al. 1991): E -5, S0 -2, Sa 1, Sb 3, Sc 5, Sd 7, Sm 9, Irr 10; dwarf ellipticals
 * as E, dwarf lenticulars as S0; an unsubdivided spiral (S) or an edge-on disk has none. Each row also names the cluster
 * as its group and carries Virgo's Cosmicflows-4 group distance (table 3 DMzp of group 41220, read from the Nearby
 * Universe's tracked table), so the members sit where the field's own Virgo galaxies do, and a B magnitude from its SDSS g
 * and r magnitudes through Jester et al. (2005)'s transformation, B = g + 0.39 (g - r) + 0.21, for the field's tone.
 *
 * Inputs: EVCC table 2, by default `output/clusters/evcc-table2.dat`, from
 * https://cdsarc.cds.unistra.fr/ftp/J/ApJS/215/22/table2.dat (byte columns from its ReadMe), and the tracked
 * `src/objects/nearby-universe/source/galaxies/cf4-hyperleda.csv.gz`.
 * Output: `src/objects/virgo-cluster-members/source/dots/evcc-members.csv.gz`. It prints what it kept.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const repository = resolve(import.meta.dirname, '../../../..');
const evccPath = resolve(process.argv[2] ?? resolve(repository, 'output/clusters/evcc-table2.dat'));
const fieldPath = resolve(repository, 'src/objects/nearby-universe/source/galaxies/cf4-hyperleda.csv.gz');
const outputPath = resolve(repository, 'src/objects/virgo-cluster-members/source/dots/evcc-members.csv.gz');
const VIRGO_GROUP = '41220', MATCH_ARCSEC = 10;

// EVCC table 2 byte columns (ReadMe): 1-4 EVCC, 17-24 RAdeg, 26-32 DEdeg, 74 MmI, 90-92 TT1, 126-130 gmag, 138-142 rmag.
const stage = (code: string): string => {
  if (code === '100') return '-5';
  if (/^4[01][01]$/u.test(code)) return code[1] === '0' ? '-5' : '-2';
  if (/^3[01]0$/u.test(code)) return '10';
  const disk = /^2[01]([0-7])$/u.exec(code);
  if (disk) return ['-2', '1', '3', '5', '7', '9', '', ''][Number(disk[1])]!;
  throw new TypeError(`${evccPath}: EVCC morphology code ${JSON.stringify(code)} is not in its ReadMe's table 1.`);
};
const [fieldHeader, ...fieldRows] = gunzipSync(await readFile(fieldPath)).toString('utf8').trim().split('\n');
const columns = fieldHeader!.split(','), at = (name: string) => {
  const index = columns.indexOf(name);
  if (index < 0) throw new TypeError(`${fieldPath}: no ${name} column in "${fieldHeader}".`);
  return index;
};
const [raAt, decAt, groupAt, groupModulusAt] = ['RAJ2000', 'DEJ2000', 'G1PGC', 'GDMzp'].map(at);
const field = fieldRows.map(row => row.split(','));
const moduli = new Set(field.filter(row => row[groupAt!] === VIRGO_GROUP).map(row => row[groupModulusAt!]!));
if (moduli.size !== 1) throw new TypeError(`${fieldPath}: group ${VIRGO_GROUP} has ${moduli.size} distance moduli, not one.`);
const virgoModulus = [...moduli][0]!;
// Cosmicflows-4 positions in cells a match radius wide.
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
const lines = (await readFile(evccPath, 'utf8')).split('\n').filter(line => line.trim());
if (lines.length !== 1589) throw new TypeError(`${evccPath}: EVCC table 2 has 1,589 rows, not ${lines.length}.`);
let members = 0, drawnByField = 0;
const kept = lines.flatMap(line => {
  if (line[73] !== 'M') return [];
  members++;
  const id = line.slice(0, 4).trim(), ra = Number(line.slice(16, 24)), dec = Number(line.slice(25, 32));
  if (!Number.isFinite(ra) || !Number.isFinite(dec)) throw new TypeError(`${evccPath}: EVCC ${id} has no position.`);
  if (inField(ra, dec)) { drawnByField++; return []; }
  const g = Number(line.slice(125, 130)), r = Number(line.slice(137, 142));
  const b = line.slice(125, 130).trim() && line.slice(137, 142).trim() && Number.isFinite(g) && Number.isFinite(r) ? (g + 0.39 * (g - r) + 0.21).toFixed(2) : '';
  return [`${id},${ra},${dec},${stage(line.slice(89, 92).trim())},virgo,${virgoModulus},${b}`];
});
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, gzipSync(['EVCC,RAJ2000,DEJ2000,T,Group,GroupDM,Bmag', ...kept].join('\n') + '\n', { level: 9 }));
console.log(JSON.stringify({ certainMembers: members, drawnByField, kept: kept.length, virgoModulus, bytes: (await readFile(outputPath)).length, output: outputPath }));
