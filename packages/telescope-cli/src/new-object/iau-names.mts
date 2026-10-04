/** The names the IAU's Working Group on Star Names (WGSN) has adopted, read from the shared bank src/references/iau-star-names,
 * and how a star is matched to one.
 *
 * The bank is the WGSN's IAU Catalog of Star Names as its secretary publishes it, always up to date, on exopla.net: one row per
 * name, with the designation the WGSN gives it (HR, HD, GJ, a survey name), its Hipparcos number, its Bayer designation, the
 * spelling SIMBAD lists, its constellation, the adoption date and the J2000 position. `acquireIauNames` rewrites the bank from that
 * page (`node packages/telescope-cli/src/new-object/iau-names.mts --acquire`); nothing else writes it.
 *
 * A star takes a name when one of its SIMBAD designations is the row's designation, or its Hipparcos number when no other row
 * shares that number: ε Boötis A (Izar, HR 5506) and B (Pulcherrima, HR 5505) are both HIP 72105, so the number names neither. */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readReferenceBankFile, referenceBankRoot } from '@cssearth/bake/objects/sources';

export const IAU_STAR_NAMES = Object.freeze({
  set: 'iau-star-names', path: 'iau-star-names.tsv', page: 'https://exopla.net/star-names/modern-iau-star-names/',
  credit: 'IAU Working Group on Star Names (WGSN), IAU Catalog of Star Names',
});
const COLUMNS = ['name', 'designation', 'hip', 'bayer', 'simbad', 'constellation', 'adopted', 'ra', 'dec'] as const;
export type IauName = Readonly<Record<typeof COLUMNS[number], string>>;
/** A star's IAU name from its SIMBAD designations, or undefined. */
export type IauLookup = (identifiers: readonly string[]) => IauName | undefined;

const collapse = (text: string) => text.replace(/\s+/gu, ' ').trim();

/** The bank's rows; every row has a name, and a designation or a Hipparcos number to be matched by. */
export function parseIauNames(tsv: string): IauName[] {
  const [header, ...lines] = tsv.split('\n').filter(line => line.trim());
  if (header !== COLUMNS.join('\t')) throw new Error(`${IAU_STAR_NAMES.path}: the header is not ${COLUMNS.join(', ')}.`);
  return lines.map((line, index) => {
    const cells = line.split('\t');
    if (cells.length !== COLUMNS.length) throw new Error(`${IAU_STAR_NAMES.path} row ${index + 2}: ${cells.length} cells, not ${COLUMNS.length}.`);
    const row = Object.fromEntries(COLUMNS.map((column, i) => [column, cells[i]!.trim()])) as IauName;
    if (!row.name) throw new Error(`${IAU_STAR_NAMES.path} row ${index + 2}: no name.`);
    if (row.hip && !/^\d+$/u.test(row.hip)) throw new Error(`${IAU_STAR_NAMES.path} row ${index + 2} (${row.name}): Hipparcos number ${row.hip} is not a number.`);
    return row;
  });
}

/** The lookup over `rows`: by designation, then by a Hipparcos number only one row carries. */
export function iauLookup(rows: readonly IauName[]): IauLookup {
  const byDesignation = new Map<string, IauName>(), hipCount = new Map<string, number>(), byHip = new Map<string, IauName>();
  for (const row of rows) {
    const designation = collapse(row.designation);
    if (designation && designation !== '-') {
      if (byDesignation.has(designation)) throw new Error(`${IAU_STAR_NAMES.path}: ${designation} is designated twice (${byDesignation.get(designation)!.name}, ${row.name}).`);
      byDesignation.set(designation, row);
    }
    if (row.hip) { hipCount.set(row.hip, (hipCount.get(row.hip) ?? 0) + 1); byHip.set(row.hip, row); }
  }
  return identifiers => {
    const ids = identifiers.map(collapse);
    for (const id of ids) { const row = byDesignation.get(id); if (row) return row; }
    for (const id of ids) {
      const hip = /^HIP (\d+)$/u.exec(id)?.[1];
      if (hip && hipCount.get(hip) === 1) return byHip.get(hip);
    }
    return undefined;
  };
}

let bank: Promise<{ readonly rows: readonly IauName[]; readonly lookup: IauLookup }> | undefined;
/** The bank, read once per process through its manifest. */
export const readIauNames = () => bank ??= readReferenceBankFile(IAU_STAR_NAMES.set, IAU_STAR_NAMES.path).then(bytes => {
  const rows = parseIauNames(bytes.toString('utf8'));
  return { rows, lookup: iauLookup(rows) };
});

const entities: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#039': "'" };
const text = (html: string) => collapse(html.replace(/<[^>]+>/gu, '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#039);/giu, (whole, entity: string) =>
  entity.startsWith('#x') ? String.fromCodePoint(Number.parseInt(entity.slice(2), 16)) : entity.startsWith('#') && entity !== '#039' ? String.fromCodePoint(Number(entity.slice(1))) : entities[entity] ?? whole));

/** The bank's rows from the WGSN page: its one table whose header starts "proper names". */
export function rowsFromPage(html: string): IauName[] {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/giu, '');
  const rows = [...body.matchAll(/<tr[\s\S]*?<\/tr>/giu)].map(match => [...match[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/giu)].map(cell => text(cell[1]!)));
  const header = rows.find(cells => cells[0] === 'proper names');
  if (!header) throw new Error(`${IAU_STAR_NAMES.page}: no table whose header starts "proper names".`);
  const column = (name: string) => { const index = header.indexOf(name); if (index < 0) throw new Error(`${IAU_STAR_NAMES.page}: no "${name}" column.`); return index; };
  const at = { name: column('proper names'), designation: column('Designation'), hip: column('HIP'), bayer: column('Bayer ID'), simbad: column('Simbad spelling'),
    constellation: column('Constellation'), adopted: column('Date of Adoption'), ra: column('RA'), dec: column('DEC') };
  return rows.filter(cells => cells.length === header.length && cells !== header && cells[0] !== 'proper names').map(cells => ({
    name: cells[at.name]!, designation: cells[at.designation]!, hip: cells[at.hip]!, bayer: cells[at.bayer]!, simbad: cells[at.simbad]!,
    constellation: cells[at.constellation]!, adopted: cells[at.adopted]!.replaceAll('/', '-'), ra: cells[at.ra]!, dec: cells[at.dec]!,
  })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** Rewrite the bank from the WGSN page; returns the number of rows. */
export async function acquireIauNames(): Promise<number> {
  const response = await fetch(IAU_STAR_NAMES.page, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`${IAU_STAR_NAMES.page}: HTTP ${response.status}.`);
  const rows = rowsFromPage(await response.text());
  const tsv = `${[COLUMNS.join('\t'), ...rows.map(row => COLUMNS.map(column => row[column].replaceAll('\t', ' ')).join('\t'))].join('\n')}\n`;
  iauLookup(parseIauNames(tsv));
  await writeFile(resolve(referenceBankRoot(IAU_STAR_NAMES.set), IAU_STAR_NAMES.path), tsv);
  return rows.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv.includes('--acquire')) throw new TypeError('Usage: node packages/telescope-cli/src/new-object/iau-names.mts --acquire');
  const count = await acquireIauNames();
  process.stdout.write(`${count} IAU star names written to src/references/${IAU_STAR_NAMES.set}/${IAU_STAR_NAMES.path}; check the diff.\n`);
}
