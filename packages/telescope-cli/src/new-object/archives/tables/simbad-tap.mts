/** SIMBAD's TAP service answered as tab-separated text, which the star survey and the table route read. The identifier
 * lookups read the comma-separated answer (companions.mts `csv`), which keeps a quoted comma inside its cell. */
import { SIMBAD_TAP } from '../../companions.mts';
import type { Archive } from '../archives.mts';

export const simbadTsvForm = (query: string) => ({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'tsv', QUERY: query });

/** The rows of a SIMBAD TAP tab-separated answer, by column name; strings arrive quoted. A refused query is a VOTable naming why. */
export function parseSimbadTsv(text: string, query: string): Record<string, string>[] {
  if (/^\s*</u.test(text)) throw new Error(`SIMBAD refused the query (${/<INFO[^>]*QUERY_STATUS[^>]*>([^<]*)</u.exec(text)?.[1]?.trim() || 'no reason given'}): ${query}`);
  const [header, ...lines] = text.split(/\r?\n/u).filter(line => line.length), keys = (header ?? '').split('\t');
  const cell = (value: string) => /^".*"$/su.test(value) ? value.slice(1, -1).replaceAll('""', '"') : value;
  return lines.map(line => Object.fromEntries(line.split('\t').map((value, index) => [keys[index] ?? String(index), cell(value).trim()])));
}

export const simbadRows = async (archive: Archive, query: string) => parseSimbadTsv(await archive.text(SIMBAD_TAP, simbadTsvForm(query)), query);

export const simbadQuoted = (value: string) => `'${value.replaceAll("'", "''")}'`;
/** The star SIMBAD lists nearest a position, within `arcsec` of it: its main designation, type and distance from the position. Only
 * the branch of SIMBAD's type tree under `root` is asked ("Ce*", the Cepheids): a galaxy's own entry, a cluster, a nebula or a
 * neighbouring star of another kind at that place is not the star. */
export async function simbadAt(archive: Archive, raDeg: number, decDeg: number, arcsec: number, root: string) {
  const point = `POINT('ICRS', ${raDeg}, ${decDeg})`;
  const [row] = await simbadRows(archive, `SELECT TOP 1 b.main_id, b.otype, DISTANCE(POINT('ICRS', b.ra, b.dec), ${point}) AS separation FROM basic AS b JOIN otypedef AS o ON o.otype = b.otype WHERE o.path LIKE ${simbadQuoted(`%${root}%`)} AND CONTAINS(POINT('ICRS', b.ra, b.dec), CIRCLE('ICRS', ${raDeg}, ${decDeg}, ${(arcsec / 3600).toFixed(7)})) = 1 ORDER BY separation`);
  return row?.main_id ? { name: row.main_id.replace(/\s+/gu, ' '), otype: row.otype ?? '', arcsec: Number(row.separation) * 3600 } : undefined;
}
