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
 * before writing its entry; take only what the paper presents as a detection. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { isRecord } from '@cssearth/core';
import { tapRows } from '@cssearth/telescope/node';
import type { Mission, RotationVerdict } from './verdict.mts';

/** VizieR's table access service (CDS). The telescope's PyVO reader asks it, as it asks every VO table. */
export const VIZIER_TAP = 'https://tapvizier.cds.unistra.fr/TAPVizieR/tap';

/** A star's row in a paper's table, as the columns this module reads. */
export interface PublishedRow { /** The target's number in the TESS Input Catalog. */ readonly tic: number; /** The table's period, days; some rows print none. */ readonly rotationDays?: number; /** The paper flags the period as a potential half-period. */ readonly halfPeriod: boolean;
  /** How many of the star's sectors the paper's detections come from. */ readonly sectors: number; /** The 95th less the 5th percentile of the light, as a share of its mean. */ readonly variabilityRange: number; readonly twoTermDays: number; readonly autocorrelationDays: number }
/** What a row says of a star, given the mission's windows the star has: the paper's verdict, and the windows whose light it is a verdict on. */
export interface PublishedJudgement { readonly verdict: RotationVerdict; readonly windows: readonly number[] }
export interface PublishedVerdict { readonly id: string; readonly citation: string; readonly url: string; /** Where in the paper the sample, the light curves and the table are described. */ readonly where: string;
  /** The published table a verdict is a row of, the service that serves it and the query that reads it whole. */ readonly table: string; readonly service: string; readonly query: string;
  readonly missions: readonly Mission[]; /** The light curve the paper judged. */ readonly lightCurve: string;
  /** What a row of the table asserts, in a sentence's words. */ readonly asks: string; /** What the paper itself measured of its detections' reliability. */ readonly reliability: string;
  /** The service's answer as rows, by the target's number. */ parse(rows: readonly Readonly<Record<string, string>>[]): Map<number, PublishedRow>;
  /** A row's verdict on a star with these windows of the mission. */ judge(row: PublishedRow, windows: readonly number[]): PublishedJudgement;
  /** What the row holds of an accepted star, in a sentence's words, and as the numbers a receipt keeps. */ says(row: PublishedRow): string; measures(row: PublishedRow): Readonly<Record<string, number | null>> }

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
export const COLMAN_2024: PublishedVerdict = { id: 'colman-2024', citation: 'Colman et al. (2024, AJ 167, 189)', url: 'https://arxiv.org/abs/2402.14954', where: 'Sects. II.4 and III; the consolidated catalogue', table: `VizieR ${TABLE}`,
  service: VIZIER_TAP, query: `SELECT ${COLUMNS.join(', ')} FROM "${TABLE}"`, missions: ['TESS'],
  lightCurve: 'the TESS mission\'s 2-minute light curve of a sector, among sectors 1 to 26',
  asks: 'a sector\'s light to pass both of the paper\'s random-forest classifiers (rotation detected; period accurate) with a Lomb-Scargle amplitude of at least 0.01',
  reliability: 'On the paper\'s blind test set its first classifier turned away 82% of the stars with no rotation and its second 95% of the inaccurate periods.',
  parse(answered) { const rows = new Map<number, PublishedRow>();
    for (const cells of answered) { const number = (column: typeof COLUMNS[number]) => { const cell = cells[column], value = Number(cell); if (cell === undefined || cell.trim() === '' || !Number.isFinite(value)) throw new TypeError(`${TABLE}: a row holds no ${column}.`); return value; };
      const tic = number('TIC'), flag = number('f_Prot'); if (flag !== 0 && flag !== 1) throw new TypeError(`${TABLE}: TIC ${tic} has a flag that is neither 0 nor 1.`);
      rows.set(tic, { tic, ...((cells.Prot ?? '').trim() === '' ? {} : { rotationDays: number('Prot') }), halfPeriod: flag === 1, sectors: number('Sector'), variabilityRange: number('Rvar'), twoTermDays: number('Prot2'), autocorrelationDays: number('ProtACF') }); }
    return rows; },
  judge(row, windows) { const [first, last] = COLMAN.sectors, own = windows.filter(sector => sector >= first && sector <= last), no = (reason: string): PublishedJudgement => ({ verdict: { detected: false, reason }, windows: [] });
    if (row.rotationDays === undefined) return no('Colman et al. (2024) list the star without a rotation period.');
    if (row.halfPeriod) return no(`Colman et al. (2024) list the star with a period of ${row.rotationDays} d and flag it as a potential half-period (their 2-term periodogram gives ${row.twoTermDays} d and their autocorrelation ${row.autocorrelationDays} d): their table does not give one period for it.`);
    if (row.sectors !== own.length) return no(`Colman et al. (2024) list the star with a rotation period of ${row.rotationDays} d found in ${row.sectors} of its sectors 1 to 26, and their table does not say which: the star has ${own.length === 0 ? 'no 2-minute light curve there' : `${own.length} (${own.join(', ')})`}.`);
    return { verdict: { detected: true, periodDays: row.rotationDays, amplitude: row.variabilityRange }, windows: own }; },
  says: colmanSays,
  measures: row => ({ rotationDays: row.rotationDays ?? null, variabilityRange: row.variabilityRange, sectors: row.sectors, twoTermDays: row.twoTermDays, autocorrelationDays: row.autocorrelationDays }) };

/** Every paper whose table is read, in the order they are asked. */
export const PUBLISHED: readonly PublishedVerdict[] = [COLMAN_2024];

/** The most rows a table is asked for: more than any table read here holds, so an answer cut short is refused. */
const MOST_ROWS = 1_000_000;
const held = new Map<string, Promise<Map<number, PublishedRow>>>();
/** A paper's table, by target. It is one request for all stars: kept under `kept` when a path is given, and asked once a run. */
export function publishedRows(paper: PublishedVerdict, kept?: string): Promise<Map<number, PublishedRow>> {
  const known = held.get(paper.id); if (known) return known;
  const read = (async () => { const stored: unknown = kept === undefined ? undefined : await readFile(kept, 'utf8').then(text => JSON.parse(text) as unknown, () => undefined);
    // A kept answer is read as the service's: rows of cells, each a string.
    if (Array.isArray(stored)) return paper.parse(stored.filter(isRecord).map(row => Object.fromEntries(Object.entries(row).map(([name, value]) => [name, typeof value === 'string' ? value : '']))));
    const answered = await tapRows(paper.service, paper.query, MOST_ROWS), rows = paper.parse(answered);
    // Written beside its place and moved there whole: several runs side by side may ask for it at once.
    if (kept !== undefined) { await mkdir(dirname(kept), { recursive: true }); const part = `${kept}.${process.pid}.part`; await writeFile(part, `${JSON.stringify(answered)}\n`); await rename(part, kept); }
    return rows; })();
  held.set(paper.id, read); read.catch(() => held.delete(paper.id)); return read;
}

/** The TESS Input Catalog number a 2-minute light curve's file name holds. */
export const ticOf = (filename: string): number | undefined => { const found = /^tess\d+-s\d{4}-(\d{16})-\d{4}-s_lc\.fits$/u.exec(filename)?.[1]; return found === undefined ? undefined : Number(found); };
