/** A paper's own verdict on a star's rotation: the star's row in the table the paper publishes.
 *
 * A method of methods.mts is run here, by its authors' code, and judged by the criteria its paper prints. A paper whose
 * code cannot be run here still says, in its published table, what it found of each star it lists. An entry of this
 * module reads one such table and says what a row asserts, in the paper's terms and no further: which rows are a
 * rotation with one period, in which of the star's light, and which column decides. Nothing is measured or judged here.
 * A row is looked up only for a star whose light the method wired for it has refused (reduce.mts), and the checks of
 * verdict.mts still apply to what it says.
 *
 * To add a paper, read its sections on the sample, the light curves and the table, and the table's own description,
 * before writing its entry; take only what the paper presents as a detection. A paper qualifies when it measured on the
 * light curve that is mapped (the mission's 2-minute PDC-MAP light curve of a sector), marks its firm detections, and its
 * table says which of a star's light a row is of. The note lists the papers read that do not, each with the reason. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { isRecord } from '@cssearth/core';
import { tapRows } from '@cssearth/telescope/node';
import { VIZIER_TAP } from '../espadons/catalogue.mts';
import { CATALOGUE_AGREEMENT, type Mission, type RotationVerdict } from './verdict.mts';

/** A star's row in a paper's table, as the columns this module reads. */
export interface PublishedRow { /** The target's number in the TESS Input Catalog. */ readonly tic: number; /** The table's period, days; some rows print none. */ readonly rotationDays?: number; /** The paper flags the period as a potential half-period. */ readonly halfPeriod: boolean;
  /** How many of the star's sectors the paper's detections come from. */ readonly sectors: number; /** The 95th less the 5th percentile of the light, as a share of its mean. */ readonly variabilityRange: number; readonly twoTermDays: number; readonly autocorrelationDays: number }
/** What a row says of a star, given the mission's windows the star has: the paper's verdict, and the windows whose light it is a verdict on.
 * `gives` is the one rotation period the row prints for the star, when it prints one: also where the row is no verdict here because its light cannot be told. */
export interface PublishedJudgement { readonly verdict: RotationVerdict; readonly windows: readonly number[]; readonly gives?: number }
/** What an entry says of its paper, whatever its rows hold. */
export interface PublishedPaper { readonly id: string; readonly citation: string; readonly url: string; /** Where in the paper the sample, the light curves and the table are described. */ readonly where: string;
  /** The paper's catalogue at VizieR: a period a star's record holds from it is this paper's own, not a second source. */ readonly catalogue: string;
  /** The published table a verdict is a row of, the TAP service that serves it (asked through the telescope's PyVO reader) and the query that reads it whole. A catalogue of several tables gives a query for each, and a row then carries its query's place in the list as the cell `table`. */
  readonly table: string; readonly service: string; readonly query: string | readonly string[];
  readonly missions: readonly Mission[]; /** The light curve the paper judged. */ readonly lightCurve: string;
  /** What a row of the table asserts, in a sentence's words. */ readonly asks: string; /** What the paper itself measured of its detections' reliability. */ readonly reliability: string;
  /** Where the swing of an accepted star's light comes from, in a sentence's words: the table, or a measure made here. */ readonly swing: string }
export interface PublishedVerdict<Row = PublishedRow, Key extends number | string = number> extends PublishedPaper {
  /** The service's answer as rows, by the target's number, or by its designation where a table has no number for it. */ parse(rows: readonly Readonly<Record<string, string>>[]): Map<Key, Row>;
  /** A row's verdict on a star with these windows of the mission. */ judge(row: Row, windows: readonly number[]): PublishedJudgement;
  /** What the row holds of an accepted star, in a sentence's words, and as the numbers a receipt keeps. */ says(row: Row): string; measures(row: Row): Readonly<Record<string, number | null>> }

/** Colman et al. (2024), "Methods for the detection of stellar rotation periods in individual TESS sectors and results
 * from the Prime mission", AJ 167, 189, Sects. II.1, II.4 and III; its consolidated catalogue (C24) is VizieR
 * J/AJ/167/189, table fig12. The paper's code (spinneret) carries no licence and is not run here.
 *
 * What the paper did (Sects. II.4 and III.1): it took the mission's 2-minute light curves of sectors 1 to 26, one sector
 * at a time, of targets the TESS Input Catalog gives at most 7000 K (or no temperature), fainter than Gaia absolute
 * magnitude 0 and between TESS magnitudes 5 and 16; clipped each at three sigma and centred it on zero; measured the
 * highest peak of its Lomb-Scargle periodogram; and called a sector a detection of rotation when it passed both of its
 * random-forest classifiers (rotation detected; period accurate) with a periodogram amplitude of at least 0.01. A
 * period over 12 days was kept only when confirmed by eye.
 *
 * What a row of C24 asserts (Sect. III.2 and the table's ReadMe): the target is one of the 10,909 with a detection.
 * `Prot` is the Lomb-Scargle period, the median of the sectors with a detection; `Sector` is how many they are; `Rvar`
 * is the light's 95th less its 5th percentile; `f_Prot` = 1 marks a "potential half-period", set where the 2-term
 * periodogram (`Prot2`) and the autocorrelation (`ProtACF`) both give twice the period in at least one sector.
 *
 * What is taken, and which column decides:
 * - `Prot` is the star's period. A row without one (120 rows) is not a verdict.
 * - `f_Prot` decides whether the row gives one period. For a flagged row the paper prints a second, adjusted period
 *   (twice the first) and does not say which of the two the star turns in: no verdict is taken from it. `Per`, the
 *   adjusted period, is not read: in the published file it does not follow the flag (counted 2026-10-06: 307 of the
 *   1,796 flagged rows hold twice `Prot`, and 1,453 unflagged rows do).
 * - `Sector` decides which light the verdict is on. The table gives how many of a star's sectors its detections come
 *   from, not which, and the paper's per-sector output (Zenodo 10.5281/zenodo.10684613) names no sector either. So a
 *   verdict is taken only when that number is the number of the star's 2-minute light curves in sectors 1 to 26: then
 *   each of them is a sector the paper detected rotation in. That is this entry's reading of the table, not a sentence
 *   of the paper.
 * - `Teff` and `Tmag` are not read: in the rows checked they are another star's (AU Mic's row prints 6100 K and
 *   magnitude 10.29).
 * Sectors after 26 are not the paper's, and its verdict says nothing of their light. */
const COLMAN = { sectors: [1, 26] } as const;
const TABLE = 'J/AJ/167/189/fig12', COLUMNS = ['TIC', 'Rvar', 'Prot', 'f_Prot', 'Sector', 'Prot2', 'ProtACF'] as const;
const colmanSays = (row: PublishedRow) => row.sectors === 1 ? `a rotation period of ${row.rotationDays} d, the highest peak of the Lomb-Scargle periodogram of the star's one sector among sectors 1 to 26, which passed both of the paper's classifiers`
  : `a rotation period of ${row.rotationDays} d, the median of the Lomb-Scargle periods of the star's ${row.sectors} sectors among sectors 1 to 26, each of which passed both of the paper's classifiers`;
export const COLMAN_2024: PublishedVerdict = { id: 'colman-2024', citation: 'Colman et al. (2024, AJ 167, 189)', url: 'https://arxiv.org/abs/2402.14954', where: 'Sects. II.4 and III; the consolidated catalogue', catalogue: 'J/AJ/167/189', table: `VizieR ${TABLE}`,
  service: VIZIER_TAP, query: `SELECT ${COLUMNS.join(', ')} FROM "${TABLE}"`, missions: ['TESS'],
  lightCurve: 'the TESS mission\'s 2-minute light curve of a sector, among sectors 1 to 26',
  asks: 'a sector\'s light to pass both of the paper\'s random-forest classifiers (rotation detected; period accurate) with a Lomb-Scargle amplitude of at least 0.01',
  reliability: 'On the paper\'s blind test set its first classifier turned away 82% of the stars with no rotation and its second 95% of the inaccurate periods.', swing: 'as the table prints it',
  parse(answered) { const rows = new Map<number, PublishedRow>();
    for (const cells of answered) { const number = (column: typeof COLUMNS[number]) => { const cell = cells[column], value = Number(cell); if (cell === undefined || cell.trim() === '' || !Number.isFinite(value)) throw new TypeError(`${TABLE}: a row holds no ${column}.`); return value; };
      const tic = number('TIC'), flag = number('f_Prot'); if (flag !== 0 && flag !== 1) throw new TypeError(`${TABLE}: TIC ${tic} has a flag that is neither 0 nor 1.`);
      rows.set(tic, { tic, ...((cells.Prot ?? '').trim() === '' ? {} : { rotationDays: number('Prot') }), halfPeriod: flag === 1, sectors: number('Sector'), variabilityRange: number('Rvar'), twoTermDays: number('Prot2'), autocorrelationDays: number('ProtACF') }); }
    return rows; },
  judge(row, windows) { const [first, last] = COLMAN.sectors, own = windows.filter(sector => sector >= first && sector <= last), no = (reason: string): PublishedJudgement => ({ verdict: { detected: false, reason }, windows: [] });
    if (row.rotationDays === undefined) return no('Colman et al. (2024) list the star without a rotation period.');
    if (row.halfPeriod) return no(`Colman et al. (2024) list the star with a period of ${row.rotationDays} d and flag it as a potential half-period (their 2-term periodogram gives ${row.twoTermDays} d and their autocorrelation ${row.autocorrelationDays} d): their table does not give one period for it.`);
    if (row.sectors !== own.length) return { ...no(`Colman et al. (2024) list the star with a rotation period of ${row.rotationDays} d found in ${row.sectors} of its sectors 1 to 26, and their table does not say which: the star has ${own.length === 0 ? 'no 2-minute light curve there' : `${own.length} (${own.join(', ')})`}.`), gives: row.rotationDays };
    return { verdict: { detected: true, periodDays: row.rotationDays, amplitude: row.variabilityRange }, windows: own, gives: row.rotationDays }; },
  says: colmanSays,
  measures: row => ({ rotationDays: row.rotationDays ?? null, variabilityRange: row.variabilityRange, sectors: row.sectors, twoTermDays: row.twoTermDays, autocorrelationDays: row.autocorrelationDays }) };

/** The most rows a table is asked for: more than any table read here holds, so an answer cut short is refused. */
const MOST_ROWS = 1_000_000;
const held = new Map<string, Promise<Map<number | string, unknown>>>();
/** A paper's table, by target. It is one request a table for all stars: kept under `kept` when a path is given, and asked once a run. */
export function publishedRows<Row, Key extends number | string = number>(paper: PublishedVerdict<Row, Key>, kept?: string): Promise<Map<Key, Row>> {
  const known = held.get(paper.id); if (known) return known as Promise<Map<Key, Row>>;
  const read = (async () => { const stored: unknown = kept === undefined ? undefined : await readFile(kept, 'utf8').then(text => JSON.parse(text) as unknown, () => undefined);
    // A kept answer is read as the service's: rows of cells, each a string.
    if (Array.isArray(stored)) return paper.parse(stored.filter(isRecord).map(row => Object.fromEntries(Object.entries(row).map(([name, value]) => [name, typeof value === 'string' ? value : '']))));
    const answered: Record<string, string>[] = [];
    if (typeof paper.query === 'string') answered.push(...await tapRows(paper.service, paper.query, MOST_ROWS));
    else for (const [place, query] of paper.query.entries()) for (const cells of await tapRows(paper.service, query, MOST_ROWS)) answered.push({ ...cells, table: String(place) });
    const rows = paper.parse(answered);
    // Written beside its place and moved there whole: several runs side by side may ask for it at once.
    if (kept !== undefined) { await mkdir(dirname(kept), { recursive: true }); const part = `${kept}.${process.pid}.part`; await writeFile(part, `${JSON.stringify(answered)}\n`); await rename(part, kept); }
    return rows; })();
  held.set(paper.id, read); read.catch(() => held.delete(paper.id)); return read;
}

/** What a paper's table says of one target: its row, the row's verdict on the star's windows, and the row in a sentence's words and as the numbers a receipt keeps. */
export interface PublishedFinding { readonly paper: PublishedPaper; readonly row: unknown; readonly judgement: PublishedJudgement; readonly says: string; readonly measures: Readonly<Record<string, number | null>> }
/** A paper's table, asked about one target with these windows of the mission. */
export interface PublishedLookup { readonly paper: PublishedPaper; find(target: number, windows: readonly number[], kept?: string): Promise<PublishedFinding | undefined> }
/** An entry as a table that can be asked, whatever its rows hold. The papers read of a star's TESS light are listed in
 * papers.mts; those read of its Kepler light are kepler/santos.mts `SANTOS`, entries of this same kind. */
export const publishedLookup = <Row,>(paper: PublishedVerdict<Row>): PublishedLookup => ({ paper, async find(target, windows, kept) { const row = (await publishedRows(paper, kept)).get(target);
  return row === undefined ? undefined : { paper, row, judgement: paper.judge(row, windows), says: paper.says(row), measures: paper.measures(row) }; } });

/** Whether two periods of one star differ: neither is within 20% of the other, the measure of verdict.mts. */
const apart = (a: number, b: number) => Math.abs(a - b) > CATALOGUE_AGREEMENT * Math.max(a, b);
/** Why no paper's verdict is taken of a star that two papers print different rotation periods for, when they do. A
 * paper's period counts whether or not its row is a verdict here. Which of two papers is right is not decided here. */
export function publishedApart(findings: readonly PublishedFinding[]): string | undefined {
  const given = findings.flatMap(one => one.judgement.gives === undefined ? [] : [{ citation: one.paper.citation, days: one.judgement.gives }]);
  for (const [index, a] of given.entries()) for (const b of given.slice(index + 1)) if (apart(a.days, b.days))
    return `${a.citation} list the star with a rotation period of ${a.days} d and ${b.citation} with one of ${b.days} d: the two papers differ, and neither period is taken.`;
  return undefined;
}
/** A period a star's record holds from a catalogue's table, with the sentence that says which (new-object/metadata). */
export interface Catalogued { readonly days: number; readonly source: string }
/** A paper's verdict after the checks of verdict.mts, as a verdict that is still the paper's: kept at the paper's period,
 * or withheld. Two things differ from a period measured here. Set beside the catalogued period, a measured period may be
 * doubled, because a light's strongest period can be half the rotation; a paper's period is its statement of the
 * rotation itself, so one that is half the catalogued period is two published values that differ, and nothing is drawn
 * at a period the paper does not give. And where the star's record adopts no period because its catalogues disagree,
 * a measured period settles which it is; a paper's period is itself one of the catalogued ones and settles nothing, so
 * a period the record holds from another table, more than 20% from the paper's, withholds it. `catalogued` are the
 * periods the record holds, each with its table; `adoptedDays` the one it adopts, when it does. */
export function keptAsPublished(paper: Pick<PublishedPaper, 'citation' | 'catalogue'>, said: RotationVerdict, checked: RotationVerdict, adoptedDays: number | undefined, catalogued: readonly Catalogued[] = []): RotationVerdict {
  const lists = `${paper.citation} list the star with a rotation period of ${said.periodDays} d`;
  if (!checked.detected) return { detected: false, reason: `${lists}. ${checked.reason}` };
  if (checked.lightPeriodDays !== undefined) return { detected: false, reason: `${lists}, half the ${adoptedDays} d its record holds from the catalogues: the two published periods differ, and the paper's verdict is not drawn at a period it does not give.` };
  const other = adoptedDays === undefined && said.periodDays !== undefined ? catalogued.find(one => !one.source.startsWith(`VizieR ${paper.catalogue}/`) && apart(one.days, said.periodDays!)) : undefined;
  return other ? { detected: false, reason: `${lists}, and its record holds ${other.days} d from another table (${other.source.split(' (')[0]}): the two published periods differ, the record adopts neither, and neither is drawn.` } : checked;
}

/** The TESS Input Catalog number a 2-minute light curve's file name holds. */
export const ticOf = (filename: string): number | undefined => { const found = /^tess\d+-s\d{4}-(\d{16})-\d{4}-s_lc\.fits$/u.exec(filename)?.[1]; return found === undefined ? undefined : Number(found); };
