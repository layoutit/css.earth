// Entry script: node packages/bake/authoring/galaxy-clusters/members.mts <hydra|centaurus|perseus|coma>
/**
 * A galaxy cluster's member dots: the members a published catalogue lists that Cosmicflows-4 does not already hold, since
 * the Nearby Universe field draws those. A galaxy within 10 arcsec of a Cosmicflows-4 position is the same galaxy. Each
 * row names the cluster as its group and carries the cluster's Cosmicflows-4 group distance (table 3 DMzp of its group,
 * read from the Nearby Universe's tracked table), so the members sit where the field's own galaxies of the cluster do.
 * The Virgo and Fornax members are built the same way by their own scripts (../virgo-cluster, ../fornax-cluster).
 *
 * The inputs are CDS TAP query results, saved unchanged under `output/clusters/` (each query is in QUERIES below and in
 * the bank's manifest):
 *
 * - **hydra**: Cabanillas de la Casa et al. (2025, A&A 704, A264; CDS J/A+A/704/A264, tables12), 196 galaxies of Hydra I
 *   with a redshift out to 1.75 r200, and La Marca et al. (2022, A&A 659, A92; CDS J/A+A/659/A92, hcdc), the 317 dwarf
 *   members of the Hydra I Cluster Dwarf galaxy Catalogue. A dwarf within 10 arcsec of a row of the first table is the
 *   same galaxy. The dwarfs' B magnitude is from their r and g-r (Jester et al. 2005: B = g + 0.39 (g - r) + 0.21); the
 *   first table gives absolute magnitudes on its own distance, which are not used, so its rows carry none.
 * - **centaurus**: the Centaurus Cluster Catalogue (Jerjen & Dressler 1997, A&AS 124, 1; CDS J/A+AS/124/1, table6), its
 *   198 members of class 1 (membership certain). Positions are VizieR's ICRS conversion of the catalogue's B1950 ones
 *   (columns _RA_icrs, _DE_icrs). Each takes RC3's numerical stage of its morphological class, as the Fornax members
 *   do, and the catalogue's total blue magnitude BT.
 * - **perseus**: Kang et al. (2024, ApJS 272, 22; CDS J/ApJS/272/22, table2), the 418 galaxies its caustic analysis
 *   keeps as members within 60 arcmin of the centre (Mm = 1).
 * - **coma**: Kang et al. (2025, ApJS 278, 51; CDS J/ApJS/278/51, table2), the 1,826 galaxies flagged members within
 *   132 arcmin of the centre (Mm = 1).
 *   For Perseus and Coma the B magnitude is from SDSS DR16 model g and r (CDS V/154, by the tables' SDSS objID) through
 *   the same Jester et al. relation; a member without SDSS photometry carries none. Neither table gives a type.
 *
 * Output: `src/objects/<cluster>-cluster-members/source/dots/members.csv.gz`. It prints what it kept.
 */
import { catalogueSeparationArcsec, createRaDecCatalogueMatcher } from '@cssearth/astronomy';
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

export const QUERIES = {
  'coma-kang-2025': 'SELECT Seq, ObjID, RAJ2000, DEJ2000, rmag, z FROM "J/ApJS/278/51/table2" WHERE Mm=1',
  'perseus-kang-2024': 'SELECT Seq, objID, RAJ2000, DEJ2000, rmag, z FROM "J/ApJS/272/22/table2" WHERE Mm=1',
  'centaurus-ccc': 'SELECT * FROM "J/A+AS/124/1/table6" WHERE Class=1',
  'hydra-cabanillas-2025': 'SELECT ID, Name, RAJ2000, DEJ2000, z, gMAG, rMAG FROM "J/A+A/704/A264/tables12"',
  'hydra-hcdc': 'SELECT * FROM "J/A+A/659/A92/hcdc"',
} as const;
const CLUSTERS = { hydra: '31478', centaurus: '43296', perseus: '12429', coma: '44715' } as const;
type Cluster = keyof typeof CLUSTERS;
interface Member { name: string; ra: number; dec: number; stage: string; b: string }

const cluster = process.argv[2] as Cluster;
if (!(cluster in CLUSTERS)) throw new TypeError(`Usage: members.mts <${Object.keys(CLUSTERS).join('|')}>, got ${String(cluster)}.`);
const repository = checkoutProjectRoot(import.meta.url);
const input = (name: string) => resolve(repository, 'output/clusters', `${name}.csv`);
const fieldPath = resolve(repository, 'src/objects/nearby-universe-galaxies/source/galaxies/cf4-hyperleda.csv.gz');
const outputPath = resolve(repository, `src/objects/${cluster}-cluster-members/source/dots/members.csv.gz`);
const MATCH_ARCSEC = 10;

/** A CSV with a header, as the TAP service writes it: quoted strings, no embedded newlines. */
async function table(name: string): Promise<Record<string, string>[]> {
  const path = input(name), [header, ...rows] = (await readFile(path, 'utf8')).trim().split('\n');
  const cells = (line: string) => [...line.matchAll(/("([^"]*)"|[^,]*)(,|$)/gu)].slice(0, -1).map(match => (match[2] ?? match[1] ?? '').trim());
  const columns = cells(header!);
  if (!rows.length || columns.length < 3) throw new TypeError(`${path}: expected a TAP result with a header and rows, got "${header?.slice(0, 80)}".`);
  return rows.map(line => Object.fromEntries(cells(line).map((value, index) => [columns[index]!, value])));
}
const number = (row: Record<string, string>, column: string, path: string) => {
  const value = Number(row[column]);
  if (row[column] === undefined || row[column] === '' || !Number.isFinite(value)) throw new TypeError(`${path}: ${column} is "${row[column]}" in ${JSON.stringify(row).slice(0, 120)}.`);
  return value;
};
/** Jester et al. (2005): B = g + 0.39 (g - r) + 0.21. */
const jesterB = (g: number, r: number) => (g + 0.39 * (g - r) + 0.21).toFixed(2);
/** RC3's numerical stage of a morphological class; a type left open between two classes has none. */
const stage = (type: string): string => {
  if (/\bor\b|\/|\?/u.test(type)) return '';
  const classes: [RegExp, string][] = [[/^d?E/u, '-5'], [/^d?S(B)?0/u, '-2'], [/^S(B)?a/u, '1'], [/^S(B)?b/u, '3'], [/^S(B)?c/u, '5'],
    [/^S(B)?d/u, '7'], [/^S(B)?m/u, '9'], [/^(Im|BCD)/u, '10']];
  return classes.find(([pattern]) => pattern.test(type))?.[1] ?? '';
};

async function sloanMembers(file: keyof typeof QUERIES, idColumn: string, prefix: string): Promise<Member[]> {
  const photometry = new Map((await table(`${cluster}-sdss16`)).map(row => [row.objID!, row]));
  return (await table(file)).map(row => {
    const sdss = photometry.get(row[idColumn]!), g = Number(sdss?.gmag), r = Number(sdss?.rmag);
    return { name: `${prefix} ${row.Seq}`, ra: number(row, 'RAJ2000', input(file)), dec: number(row, 'DEJ2000', input(file)), stage: '',
      b: sdss && sdss.gmag !== '' && sdss.rmag !== '' && Number.isFinite(g) && Number.isFinite(r) ? jesterB(g, r) : '' };
  });
}
const readers: Record<Cluster, () => Promise<Member[]>> = {
  coma: () => sloanMembers('coma-kang-2025', 'ObjID', 'Kang2025'),
  perseus: () => sloanMembers('perseus-kang-2024', 'objID', 'Kang2024'),
  centaurus: async () => (await table('centaurus-ccc')).map(row => ({ name: `CCC ${row.CCC}`, ra: number(row, '_RA_icrs', input('centaurus-ccc')), dec: number(row, '_DE_icrs', input('centaurus-ccc')),
    stage: stage(row.MType ?? ''), b: row.BT ?? '' })),
  hydra: async () => {
    const giants = (await table('hydra-cabanillas-2025')).map(row => ({ name: (row.Name ?? '').replaceAll('_', ' ') || `Cabanillas2025 ${row.ID}`,
      ra: number(row, 'RAJ2000', input('hydra-cabanillas-2025')), dec: number(row, 'DEJ2000', input('hydra-cabanillas-2025')), stage: '', b: '' }));
    const dwarfs = (await table('hydra-hcdc')).map(row => {
      const r = number(row, 'rmag', input('hydra-hcdc')), color = number(row, 'g-r', input('hydra-hcdc'));
      return { name: (row.Name ?? '').replaceAll('_', ' '), ra: number(row, 'RAJ2000', input('hydra-hcdc')), dec: number(row, 'DEJ2000', input('hydra-hcdc')), stage: '', b: jesterB(r + color, r) };
    });
    // A dwarf the redshift table also lists is drawn once, with the dwarf catalogue's magnitude.
    const repeated = giants.filter(giant => dwarfs.some(dwarf => catalogueSeparationArcsec(giant.ra, giant.dec, dwarf.ra, dwarf.dec, false) <= MATCH_ARCSEC));
    return [...giants.filter(giant => !repeated.includes(giant)), ...dwarfs];
  },
};

const [fieldHeader, ...fieldRows] = gunzipSync(await readFile(fieldPath)).toString('utf8').trim().split('\n');
const columns = fieldHeader!.split(','), at = (name: string) => {
  const index = columns.indexOf(name);
  if (index < 0) throw new TypeError(`${fieldPath}: no ${name} column in "${fieldHeader}".`);
  return index;
};
const [raAt, decAt, groupAt, groupModulusAt] = ['RAJ2000', 'DEJ2000', 'G1PGC', 'GDMzp'].map(at);
const field = fieldRows.map(row => row.split(','));
const moduli = new Set(field.filter(row => row[groupAt!] === CLUSTERS[cluster]).map(row => row[groupModulusAt!]!));
if (moduli.size !== 1) throw new TypeError(`${fieldPath}: group ${CLUSTERS[cluster]} has ${moduli.size} distance moduli, not one.`);
const modulus = [...moduli][0]!;

const inField = createRaDecCatalogueMatcher(field.map(row => {
  return [Number(row[raAt!]), Number(row[decAt!])];
}), MATCH_ARCSEC, 'arcseconds');
const members = await readers[cluster]();
let drawnByField = 0;
const kept = members.flatMap(member => {
  if (inField(member.ra, member.dec)) { drawnByField++; return []; }
  if (member.name.includes(',')) throw new TypeError(`${cluster}: the name "${member.name}" holds a comma.`);
  return [`${member.name},${member.ra.toFixed(5)},${member.dec.toFixed(5)},${member.stage},${cluster},${modulus},${member.b}`];
});
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, gzipSync(['Name,RAJ2000,DEJ2000,T,Group,GroupDM,Bmag', ...kept].join('\n') + '\n', { level: 9 }));
console.log(JSON.stringify({ cluster, members: members.length, drawnByField, kept: kept.length, withoutStage: kept.filter(line => line.split(',')[3] === '').length,
  withoutMagnitude: kept.filter(line => line.split(',')[6] === '').length, modulus, bytes: (await readFile(outputPath)).length, output: outputPath }));
