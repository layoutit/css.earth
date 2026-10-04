/** What VizieR says of a paper's tables, read from an ASU `-meta.all` answer: each table's rows and columns, and which
 * columns hold what a placed star needs (a name, a position of its own, a period, a temperature). VizieR takes a catalogue
 * name (J/ApJ/743/176), a table name or a paper's bibcode as `-source`, so a paper is looked up without guessing its
 * catalogue name. A column is recognised by its UCD when the table has one and by its name otherwise: older tables carry
 * no UCDs. */
import { VIZIER_ASU, type Archive } from '../archives.mts';

export interface VizierColumn { readonly name: string; readonly format: string; readonly description: string; readonly ucd: string }
export interface VizierTable { readonly name: string; readonly rows: number | null; readonly columns: readonly VizierColumn[] }
export interface VizierCatalogue {
  /** The catalogue (J/AJ/128/1167) or, when one table was asked for, that table. */
  readonly name: string;
  /** The catalogue's title as VizieR writes it, "ARAUCARIA project : NGC 300 Cepheid Variables. II (Gieren+, 2004)"; empty for a table. */
  readonly title: string; readonly bibcode: string | null;
  /** The DOI CDS registered for the catalogue (10.26093/cds/vizier.17430176): VizieR states it for a catalogue of several tables, and
   * its number is the answer's own resource id (yCat_17430176_1) otherwise. */
  readonly doi: string | null; readonly tables: readonly VizierTable[];
}

/** The tables of a `-meta.all` answer, or undefined when VizieR holds no such catalogue. Any other error VizieR reports is thrown. */
export function parseVizierMeta(tsv: string, source: string): VizierCatalogue | undefined {
  const error = /^#INFO\tError=(.*)$/mu.exec(tsv)?.[1]?.trim();
  if (error) { if (/not found/iu.test(error)) return undefined; throw new Error(`VizieR ${source}: ${error}`); }
  let name = '', title = '', bibcode: string | null = null, doi: string | null = null, resourceRows: number | null = null, inTable = false, named = false;
  const resource = /^#RESOURCE=yCat_(\d+)(?:_\d+)?\s*$/mu.exec(tsv)?.[1];
  const tables: { name: string; rows: number | null; columns: VizierColumn[] }[] = [];
  for (const line of tsv.split('\n')) {
    if (line.startsWith('#Table')) { inTable = true; named = false; continue; }
    const current = tables.at(-1);
    if (line.startsWith('#Name:')) {
      const value = line.slice(6).trim();
      if (inTable && !named) { tables.push({ name: value, rows: null, columns: [] }); named = true; } else if (!inTable && !name) name = value;
    } else if (line.startsWith('#Title:') && !inTable && !title) title = line.slice(7).trim();
    else if (line.startsWith('#INFO\t')) {
      const [key, value = ''] = (line.split('\t')[1] ?? '').split('=');
      if (key === 'cites' && value.startsWith('bibcode:')) bibcode = value.slice(8);
      if (key === 'citation' && value.startsWith('doi:')) doi = value.slice(4);
      if (key === 'nrows' && /^\d+$/u.test(value)) { if (inTable && current && named) current.rows = Number(value); else resourceRows = Number(value); }
    } else if (line.startsWith('#Column\t') && inTable && current && named) {
      const [, column = '', format = '', description = '', ucd = ''] = line.split('\t');
      current.columns.push({ name: column.trim(), format: format.replace(/^\(|\)$/gu, ''), description: description.trim(), ucd: /^\[ucd=(.*)\]$/u.exec(ucd.trim())?.[1] ?? '' });
    }
  }
  if (!name || !tables.length) throw new Error(`VizieR ${source}: the answer names no table.`);
  // Asked for one table, VizieR gives its row count before the table block.
  for (const table of tables) if (table.rows === null && table.name === name) table.rows = resourceRows;
  return { name, title, bibcode, doi: doi ?? (resource ? `10.26093/cds/vizier.${resource}` : null), tables };
}

/** VizieR's tables for a catalogue, a table or a bibcode; undefined when it holds none. */
export async function vizierTables(archive: Archive, source: string): Promise<VizierCatalogue | undefined> {
  return parseVizierMeta(await archive.text(`${VIZIER_ASU}?${new URLSearchParams({ '-source': source, '-meta.all': '' })}`), source);
}

/** A flag or note VizieR attaches to another column (f_Per, n_ID, u_Vmag), never a name of the row. */
const isQualifier = (column: string) => /^[a-z]_/u.test(column);
const isPosition = (column: VizierColumn) => column.ucd.startsWith('pos.eq.') || /^_?(?:RA|DE)(?:J2000|B1950|deg)?$/u.test(column.name);
const isText = (column: VizierColumn) => /^a/iu.test(column.format);

export interface StarColumns {
  /** The column whose cell names the row's star, as the paper writes it. */
  readonly identifier?: string;
  /** The pulsation period, in days, or its base-10 logarithm when `log`. */
  readonly period?: { readonly column: string; readonly log: boolean };
  readonly temperature?: string;
  /** The column CDS added with the row's name in SIMBAD ("Simbad designation of the Cepheid"), which has the star's position when the table has none. */
  readonly simbadName?: string;
  /** Whether the table carries a sky position; whether it is each star's own is seen only in its rows (starPositions). */
  readonly position: boolean;
}
/** The columns of a table a placed star is read from. */
export function starColumns(table: VizierTable): StarColumns {
  const columns = table.columns.filter(column => column.name !== 'recno');
  const linear = columns.find(column => column.ucd.startsWith('time.period')) ?? columns.find(column => /^(?:<?P(?:er(?:iod)?)?>?|Pr)$/u.test(column.name));
  const log = columns.find(column => /^log\(?P/iu.test(column.name));
  const period = linear && !/^log/iu.test(linear.name) ? { column: linear.name, log: false } : log ? { column: log.name, log: true } : undefined;
  const temperature = columns.find(column => column.ucd.startsWith('phys.temperature.effective') || /^<?Teff>?$/u.test(column.name))?.name;
  const named = columns.filter(column => !isQualifier(column.name) && !isPosition(column) && !column.name.startsWith('_'));
  const identifier = (named.find(column => column.ucd.startsWith('meta.id') && column.ucd.includes('meta.main')) ?? named.find(column => column.ucd.startsWith('meta.id') && !column.ucd.includes('cross'))
    // A table without UCDs: a text column that leads it is the star's name ("Cepheid number"); a later one is a remark.
    ?? (named[0] && !named[0].ucd && isText(named[0]) ? named[0] : undefined))?.name;
  const simbadName = columns.find(column => /^S(?:imbad)?Name$/u.test(column.name) || /simbad (?:designation|name|identifier)/iu.test(column.description))?.name;
  return { ...(identifier && identifier !== simbadName ? { identifier } : {}), ...(period ? { period } : {}), ...(temperature ? { temperature } : {}), ...(simbadName ? { simbadName } : {}), position: table.columns.some(isPosition) };
}

/** The data rows of a VizieR tab-separated answer, by column name. The header is the first line after the comments and the rows
 * follow the dashed rule; the units line between them is blank when no column has a unit. */
export function vizierDataRows(tsv: string, source: string): Record<string, string>[] {
  const error = /^#INFO\tError=(.*)$/mu.exec(tsv)?.[1]?.trim();
  if (error) throw new Error(`VizieR ${source}: ${error}`);
  const lines = tsv.split(/\r?\n/u).filter(line => !line.startsWith('#')), start = lines.findIndex(line => line.trim()), rule = lines.findIndex(line => /^-+(?:\t-+)*\s*$/u.test(line));
  if (start < 0 || rule < 0) return [];
  const header = lines[start]!.split('\t').map(cell => cell.trim());
  return lines.slice(rule + 1).filter(line => line.trim()).map(line => { const cells = line.split('\t').map(cell => cell.trim()); return Object.fromEntries(header.map((column, index) => [column, cells[index] ?? ''])); });
}

/** VizieR's own decimal J2000 position of a row, computed from whatever position the table carries. */
export const DECIMAL_POSITION = { ra: '_RAJ2000', dec: '_DEJ2000' } as const;

/** The paper a VizieR catalogue holds the tables of, from the head of the catalogue's ReadMe: its title, its authors' surnames and
 * its bibcode ("=2011ApJ...743..176G", sometimes followed by a remark). VizieR's table metadata names the paper only for a catalogue of
 * several tables. */
export interface VizierPaper { readonly bibcode: string; readonly title: string; readonly authors: readonly string[] }
export const vizierReadMeUrl = (catalogue: string) => `https://cdsarc.cds.unistra.fr/ftp/${catalogue}/ReadMe`;
export function parseVizierReadMe(text: string, catalogue: string): VizierPaper {
  const lines = text.split(/\r?\n/u), rule = (line: string) => /^={20,}\s*$/u.test(line), first = lines.findIndex(rule), second = lines.findIndex((line, index) => index > first && rule(line));
  const head = first >= 0 && second > first ? lines.slice(first + 1, second) : [], bibcode = head.map(line => /^\s*=(\d{4}\S{15})(?:\s|$)/u.exec(line)?.[1]).find(Boolean);
  const reference = head.findIndex(line => /^\s*</u.test(line)), firstAuthor = head.findIndex(line => /^ {4}\S/u.test(line));
  if (!bibcode || reference < 0 || firstAuthor < 0 || firstAuthor > reference) throw new Error(`${vizierReadMeUrl(catalogue)}: its head names no paper (title, authors, "<journal reference>", "=bibcode").`);
  // An author is a surname and initials ("Contreras Ramos R.", "Gerke J.R."); the surname is what a citation writes.
  const authors = head.slice(firstAuthor, reference).join(' ').split(',').map(author => author.trim().replace(/\s+(?:[A-Z][a-z]?\.-?)+$/u, '')).filter(Boolean);
  return { bibcode, title: head.slice(0, firstAuthor).map(line => line.trim()).join(' '), authors };
}
/** The catalogue a table belongs to: J/ApJ/743/176/table1 is of J/ApJ/743/176. */
export const catalogueOf = (table: string) => table.slice(0, table.lastIndexOf('/'));
