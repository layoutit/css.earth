/** A TESS Object of Interest's row in the tables of Canto Martins et al. (2020): the paper's own verdict on the star.
 *
 * Canto Martins et al. (2020), "A Search for Rotation Periods in 1000 TESS Objects of Interest", ApJS 250, 20, Sects. II
 * and III; its tables are VizieR J/ApJS/250/20. An entry of the published-verdict kind (published.mts): nothing is
 * measured or judged here.
 *
 * What the paper did (Sect. II): it took the 2-minute PDC-MAP light curves, from MAST, of the first 1000 TOIs with public
 * light curves in sectors 1 to 22. From each it removed flare-like bumps and the transits of the TOI catalogue, corrected
 * jumps, divided each sector by a third-order polynomial, dropped points over 3.5 standard deviations, and joined a star's
 * sectors in one series. It computed the Lomb-Scargle periodogram, the fast Fourier transform and the wavelet map of that
 * series and inspected each light curve by eye (Sect. II.5): a period is confident with more than three cycles in the
 * light, or with 2.5 to 3 when the signal is clear, large and persistent. The period printed is the peak of the wavelet's
 * global spectrum.
 *
 * What a row asserts (Sect. III and the tables' ReadMe): every target is in one table, and the table is the verdict.
 * Table 1 holds the 131 TOIs "with unambiguous rotation periods". Table 2 holds 32 with "dubious" ones, whose period
 * "could not be disentangled among two or more possibilities" or which show under three cycles; Table 3, 109 with
 * "ambiguous variability"; Table 4, 714 with "noisy" light curves; Table 5, 10 with a pulsation period. Only a row of
 * Table 1 is a rotation with one period.
 *
 * Which light the verdict is on: `tSPAN` is the "effective time span" of the light the paper analysed, the total less
 * its gaps, and `Ncyc` is that span over the period. `Sectors` is not read: its description takes it from the TOI
 * Release Portal, and it is not the list of the sectors analysed (counted 2026-10-07: in 28 of the 131 rows of Table 1
 * the span is over 28 days for each sector named; TIC 271900960 names sector 4 and spans 285 days). So a verdict is taken
 * only when the span says which of the star's sectors it covers: when it is longer than one sector fewer of the star's
 * 2-minute sectors among 1 to 22 could hold, and no longer than they all hold. Then each of them was judged. A sector is
 * counted at 28 days, "the typical 28-day time span of the TESS sectors" (Sect. II). That is this entry's reading of the
 * table, not a sentence of the paper. Sectors after 22 are not the paper's, and its verdict says nothing of their light.
 *
 * The table prints no measure of the light's swing: a star's is measured here, for its page to say (reduce.mts). */
import { VIZIER_TAP } from '../espadons/catalogue.mts';
import type { PublishedJudgement, PublishedVerdict } from './published.mts';

/** The paper's five tables, by what each says of its targets, in the order they are asked. */
export const CANTO_MARTINS_TABLES = [
  { name: 'J/ApJS/250/20/table1', found: 'rotation', columns: ['TIC', 'Prot', 'e_Prot', 'tSPAN', 'Ncyc'] }, { name: 'J/ApJS/250/20/table2', found: 'dubious', columns: ['TIC', 'Prot1', 'Prot2', 'Prot3', 'tSPAN', 'Ncyc'] },
  { name: 'J/ApJS/250/20/table3', found: 'ambiguous', columns: ['TIC', 'tSPAN'] }, { name: 'J/ApJS/250/20/table4', found: 'noisy', columns: ['TIC', 'tSPAN'] }, { name: 'J/ApJS/250/20/table5', found: 'pulsation', columns: ['TIC', 'Ppul', 'tSPAN'] }] as const;
export type CantoMartinsFound = typeof CANTO_MARTINS_TABLES[number]['found'];
/** A target's row, as the columns this module reads. */
export interface CantoMartinsRow { /** The target's number in the TESS Input Catalog. */ readonly tic: number; /** What the paper's table of the target says of it. */ readonly found: CantoMartinsFound;
  /** The effective time span of the light the paper analysed, days. */ readonly spanDays: number; /** The rotation period of Table 1 and its error, days, and the cycles of it the light holds. */ readonly rotationDays?: number; readonly rotationErrorDays?: number; readonly cycles?: number;
  /** The candidate periods of a row of Table 2, days, and the pulsation period of a row of Table 5. */ readonly candidatesDays?: readonly number[]; readonly pulsationDays?: number }

/** The paper's sectors, and the days it gives a sector. */
export const CANTO_MARTINS = { sectors: [1, 22], sectorDays: 28 } as const;
const CATALOGUE = 'J/ApJS/250/20', CITATION = 'Canto Martins et al. (2020, ApJS 250, 20)', PAPER = 'Canto Martins et al. (2020)';
const cell = (cells: Readonly<Record<string, string>>, column: string) => (cells[column] ?? '').trim();
function numberOf(cells: Readonly<Record<string, string>>, column: string, table: string): number | undefined { const printed = cell(cells, column); if (printed === '') return undefined; const value = Number(printed);
  if (!Number.isFinite(value)) throw new TypeError(`${table}: ${column} holds ${printed}, not a number.`); return value; }
/** One row of one of the five tables, as the service gives it: every cell text, an empty one blank. */
export function parseCantoMartinsRow(table: typeof CANTO_MARTINS_TABLES[number], cells: Readonly<Record<string, string>>): CantoMartinsRow {
  const needed = (column: string) => { const value = numberOf(cells, column, table.name); if (value === undefined || !(value > 0)) throw new TypeError(`${table.name}: a row holds no ${column}.`); return value; };
  const tic = needed('TIC'); if (!Number.isInteger(tic)) throw new TypeError(`${table.name}: TIC ${tic} is not a whole number.`);
  const base = { tic, found: table.found, spanDays: needed('tSPAN') }, error = numberOf(cells, 'e_Prot', table.name);
  if (table.found === 'rotation') return { ...base, rotationDays: needed('Prot'), ...(error === undefined ? {} : { rotationErrorDays: error }), cycles: needed('Ncyc') };
  if (table.found === 'dubious') return { ...base, candidatesDays: ['Prot1', 'Prot2', 'Prot3'].flatMap(column => numberOf(cells, column, table.name) ?? []) };
  return table.found === 'pulsation' ? { ...base, pulsationDays: needed('Ppul') } : base;
}

/** What a table that is not of unambiguous rotation periods says of its targets. */
const NO_ROTATION: Readonly<Record<Exclude<CantoMartinsFound, 'rotation'>, (row: CantoMartinsRow) => string>> = {
  dubious: row => `${PAPER} list the star among the 32 with a dubious rotation period${row.candidatesDays?.length ? ` (${row.candidatesDays.join(' or ')} d)` : ''}: a possible rotation whose period they could not tell among several, or of under three cycles. Their table does not give one period for it.`,
  ambiguous: () => `${PAPER} list the star among the 109 with ambiguous variability: fluctuations they could not read as rotation.`,
  noisy: () => `${PAPER} list the star among the 714 whose light curves are noisy: they find no period in it.`,
  pulsation: row => `${PAPER} list the star among the 10 that pulsate, with a period of ${row.pulsationDays} d: its light does not change by its turning.` };

/** A row's verdict on a star with these 2-minute sectors: a row of Table 1 whose time span says that every one of the
 * star's sectors among 1 to 22 was analysed. */
function judge(row: CantoMartinsRow, windows: readonly number[]): PublishedJudgement {
  const [first, last] = CANTO_MARTINS.sectors, own = windows.filter(sector => sector >= first && sector <= last), no = (reason: string): PublishedJudgement => ({ verdict: { detected: false, reason }, windows: [] });
  if (row.found !== 'rotation') return no(NO_ROTATION[row.found](row));
  const listed = `${PAPER} list the star with an unambiguous rotation period of ${row.rotationDays} d, in ${row.spanDays} days of its light in sectors ${first} to ${last}`, held = CANTO_MARTINS.sectorDays;
  const unknown = (reason: string): PublishedJudgement => ({ ...no(reason), gives: row.rotationDays });
  if (!own.length) return unknown(`${listed}: the star has no 2-minute light curve there.`);
  if (row.spanDays > held * own.length) return unknown(`${listed}: more than the star's ${own.length === 1 ? 'one sector' : `${own.length} sectors`} there (${own.join(', ')}) hold${own.length === 1 ? 's' : ''}, at ${held} days a sector.`);
  if (!(row.spanDays > held * (own.length - 1))) return unknown(`${listed}, and their table does not say which sectors those are: the star has ${own.length} there (${own.join(', ')}), and ${own.length - 1} of them could hold that span.`);
  return { verdict: { detected: true, periodDays: row.rotationDays }, windows: own, gives: row.rotationDays };
}

export const CANTO_MARTINS_2020: PublishedVerdict<CantoMartinsRow> = { id: 'canto-martins-2020', citation: CITATION, url: 'https://arxiv.org/abs/2007.03079', where: 'Sects. II and III; Tables 1 to 5', catalogue: CATALOGUE, table: `VizieR ${CATALOGUE}, table 1`, service: VIZIER_TAP,
  query: CANTO_MARTINS_TABLES.map(table => `SELECT ${table.columns.join(', ')} FROM "${table.name}"`), missions: ['TESS'],
  lightCurve: 'the TESS mission\'s 2-minute PDC-MAP light curves of a TESS Object of Interest in sectors 1 to 22, joined in one series',
  asks: 'the Lomb-Scargle periodogram, the fast Fourier transform and the wavelet map of a star\'s light to show one period, and their own inspection of the light curve to find its signal over more than three cycles, or over 2.5 when it is clear, large and persistent',
  reliability: 'The paper gives its periods\' errors as typically 5%. Of its 18 stars with a rotation period that Oelkers et al. (2018) also measured from the ground, 9 have the two periods within 10% and 9 do not.',
  swing: 'measured here over the sectors mapped; the table prints none',
  parse(answered) { const rows = new Map<number, CantoMartinsRow>();
    for (const cells of answered) { const table = CANTO_MARTINS_TABLES[Number(cell(cells, 'table') || Number.NaN)]; if (!table) throw new TypeError(`${CATALOGUE}: a row does not say which table it is of.`);
      const row = parseCantoMartinsRow(table, cells); if (rows.has(row.tic)) throw new TypeError(`${CATALOGUE}: TIC ${row.tic} is listed twice.`); rows.set(row.tic, row); }
    return rows; },
  judge,
  says: row => `a rotation period of ${row.rotationDays}${row.rotationErrorDays === undefined ? '' : ` ± ${row.rotationErrorDays}`} d, the peak of the wavelet's global spectrum of ${row.spanDays} days of the star's light in sectors 1 to 22 (${row.cycles} cycles), which the paper lists among its unambiguous rotation periods`,
  measures: row => ({ rotationDays: row.rotationDays ?? null, rotationErrorDays: row.rotationErrorDays ?? null, spanDays: row.spanDays, cycles: row.cycles ?? null }) };
