import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
// Entry script: node packages/bake/authoring/nearby-universe/cf4-groups.mts [table2.dat.gz] [table3.dat.gz]
/**
 * Adds each Cosmicflows-4 galaxy's group to the tracked galaxy table: the PGC number of the group's dominant galaxy
 * (`1PGC`, Tully et al. 2023, table 2) and the group's distance modulus on the calibrated scale (`DMzp`, table 3, the
 * weighted average of the group's members' distances). The galaxy's own distance modulus stays in its column.
 *
 * Inputs: the tracked `source/galaxies/cf4-hyperleda.csv.gz` and CDS's two tables, by default in `output/cf4/`, downloaded
 * from https://cdsarc.cds.unistra.fr/ftp/J/ApJ/944/94/table2.dat.gz and table3.dat.gz (byte columns from the release's
 * ReadMe, https://cdsarc.cds.unistra.fr/ftp/J/ApJ/944/94/ReadMe).
 * Output: the same table with two more columns, `G1PGC` and `GDMzp`, written in place; `GDMzp` is empty for a group table 3
 * does not list. It prints what it joined.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const repository = checkoutProjectRoot(import.meta.url);
const tablePath = resolve(process.argv[4] ?? resolve(repository, 'src/objects/nearby-universe-galaxies/source/galaxies/cf4-hyperleda.csv.gz'));
const table2Path = resolve(process.argv[2] ?? resolve(repository, 'output/cf4/table2.dat.gz'));
const table3Path = resolve(process.argv[3] ?? resolve(repository, 'output/cf4/table3.dat.gz'));

const lines = async (path: string) => gunzipSync(await readFile(path)).toString('utf8').split('\n').filter(line => line.trim());
// Table 2, bytes 1-7 PGC and 9-15 1PGC; table 3, bytes 1-7 1PGC and 9-14 DMzp (the ReadMe's byte-by-byte descriptions).
const integer = (line: string, from: number, to: number, path: string) => {
  const value = Number(line.slice(from - 1, to));
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${path}: bytes ${from}-${to} of "${line.slice(0, 40)}" are not a PGC number.`);
  return value;
};
const groupOf = new Map((await lines(table2Path)).map(line => [integer(line, 1, 7, table2Path), integer(line, 9, 15, table2Path)]));
const groupModulus = new Map((await lines(table3Path)).map(line => {
  const modulus = Number(line.slice(8, 14));
  if (!Number.isFinite(modulus)) throw new TypeError(`${table3Path}: bytes 9-14 of "${line.slice(0, 40)}" are not a distance modulus.`);
  return [integer(line, 1, 7, table3Path), line.slice(8, 14).trim()] as const;
}));

const [header, ...rows] = gunzipSync(await readFile(tablePath)).toString('utf8').trim().split('\n');
const names = header!.split(',');
const hasGroups = names.slice(-2).join(',') === 'G1PGC,GDMzp';
const baseNames = hasGroups ? names.slice(0, -2) : names;
if (baseNames.includes('G1PGC') || baseNames.includes('GDMzp')) throw new TypeError(`${tablePath}: group columns must be the trailing G1PGC,GDMzp pair.`);
if (names[0] !== 'PGC') throw new TypeError(`${tablePath}: the first column must be PGC, not "${names[0]}".`);
const joined = rows.map(row => {
  const cells = row.split(',');
  if (cells.length !== names.length) throw new TypeError(`${tablePath}: row width differs from the header.`);
  const base = (hasGroups ? cells.slice(0, -2) : cells).join(',');
  const pgc = Number(cells[0]), group = groupOf.get(pgc);
  if (group === undefined) throw new TypeError(`${tablePath}: PGC ${pgc} has no row in ${table2Path}.`);
  // A group table 3 does not list has no group distance: its galaxies keep their own (an empty GDMzp).
  const modulus = groupModulus.get(group) ?? '';
  return `${base},${group},${modulus}`;
});
await writeFile(tablePath, gzipSync([`${baseNames.join(',')},G1PGC,GDMzp`, ...joined].join('\n') + '\n', { level: 9 }));
const sizes = new Map<number, number>();
for (const row of joined) { const group = Number(row.split(',').at(-2)); sizes.set(group, (sizes.get(group) ?? 0) + 1); }
console.log(JSON.stringify({ rows: joined.length, withoutGroupDistance: joined.filter(row => row.endsWith(',')).length, groups: sizes.size, inGroupsOfTwoOrMore: [...sizes.values()].filter(size => size > 1).reduce((sum, size) => sum + size, 0),
  bytes: (await readFile(tablePath)).length, output: tablePath }));
