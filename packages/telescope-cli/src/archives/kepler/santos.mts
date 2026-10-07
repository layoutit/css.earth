/** A Kepler star's row in the rotation catalogues of Santos et al.: the papers' own verdict on the star.
 *
 * Santos et al. (2019, ApJS 244, 21: stars the Kepler stellar properties catalogue called K and M dwarfs; 2021, ApJS
 * 255, 17: its F and G dwarfs and subgiants) measure rotation in the KEPSEISMIC light curves (kepseismic.mts) of 159,442
 * Kepler stars. Their criteria cannot be run here as printed: 40% of the first paper's periods were decided by its
 * authors' inspection, the second paper's selection is a random forest (ROOSTER) trained on the first, a quarter of
 * whose stars were then inspected too, and no published code holds the trained forest (star-privateer 1.3.1 ships the
 * training features, not a forest). What the papers publish of each star is its row in their tables, and that is what
 * this module reads, in the papers' terms and no further. Whether a star turns, and in what time, is not judged here.
 * What is measured here is a quarter's variance, for the papers' own rule on a quarter, and the light's swing, for a
 * page to say.
 *
 * What a row asserts (2019, Sects. II.2 and III.1; 2021, Sects. II.2 and III; the tables' ReadMe at CDS):
 * - A star of the 2019 paper is in its Table 3 (a rotation period was recovered), Table 4 (none was, with the reason) or
 *   Table 5 (its light holds up to three signals, "likely to be associated with different unresolved sources"); one of
 *   the 2021 paper is in its Table 1 (a period) or Table 2 (none; 36,201 of its 101,538 rows give the reason). The two
 *   samples share no star.
 * - `Prot` of Table 3 or Table 1 is the star's rotation period: the wavelet's period, or the composite spectrum's or the
 *   autocorrelation's when the wavelet gives none (2019, Sect. III.1).
 * - The first flag of those two tables marks a Type 1 classical-pulsator or close-binary candidate, whose signal "may be
 *   distinct from the rotational behavior of single stars" (2019, Sect. II.2); the papers print its period and leave it
 *   out of their own results (2019, Sect. V; 2021, Sect. IV). In Table 1 of 2021 the flag is 0 for six rows the ReadMe
 *   calls "no rotation modulation". No verdict of rotation is taken from a row with either flag: that is this module's
 *   reading of what the papers present as a star's rotation.
 * - Table 5 gives several periods and does not say which is the star's: no verdict is taken from it. No number is read
 *   from it either: the catalogue's file holds a row's periods first and its activities after, where its description
 *   labels them signal by signal (KIC 892376's `Sph1` holds 13.80, its second period, in days).
 * - The other flags (a Gaia binary or subgiant candidate, a planet candidate, the FliPer class, the luminosity excess of
 *   a tidally synchronised pair) are the papers' alerts: they keep such stars in their analysis (2019, Sect. II.2). They
 *   are kept with the row, for a page to say, and decide nothing here.
 *
 * Which light a period is read in: for a period under 23 days the papers take the light filtered at 20 days, from 23 to
 * 60 the light filtered at 55, and for a longer one the light filtered at 80 (2019, Sect. III.1.1; 2021, Sect. III.3.3).
 * The tables do not print the filter of a row; a period selected by eye may come from another. Taking the filter the
 * papers call appropriate for the row's period is this module's reading too.
 *
 * Which quarters the verdict is on: the papers "remove Kepler Quarters with anomalously high variance compared with
 * their neighbours from the rotation analysis" (2019, Sect. III.1) by the rule of García et al. (2014, A&A 572, A34,
 * Sect. 2), which `anomalousQuarters` applies as printed. The rule is printed for a quarter with two neighbours; at a
 * star's first or last quarter the one neighbour is taken, which is a reading of ours. */
import { medianAveraged } from '@cssearth/core';
import { VIZIER_TAP } from '../espadons/catalogue.mts';
import type { PublishedVerdict } from '../tess/published.mts';
import type { RotationVerdict } from '../tess/verdict.mts';
import { POINT, type FilterDays, type KepseismicSeries } from './kepseismic.mts';
import { byQuarter, measuredLight, type QuarterLight } from './quarters.mts';

export type SantosPaper = 'santos-2019' | 'santos-2021';
/** The two papers, as a receipt and a page cite them. */
export const SANTOS_PAPERS: Readonly<Record<SantosPaper, { readonly id: SantosPaper; readonly citation: string; readonly url: string; readonly where: string; readonly catalogue: string; readonly asks: string; readonly reliability: string }>> = {
  'santos-2019': { id: 'santos-2019', citation: 'Santos et al. (2019, ApJS 244, 21)', url: 'https://arxiv.org/abs/1908.05222', where: 'Sects. II and III; Tables 3 to 5', catalogue: 'J/ApJS/244/21',
    asks: 'the wavelet, the autocorrelation and their product to give one period in the star\'s light filtered at 20, 55 and 80 days, selected by the paper\'s automatic criteria or by its authors\' inspection',
    reliability: 'For the 11,209 stars also in McQuillan et al. (2013, 2014), the paper\'s periods agree with theirs within two sigma for 99.4%.' },
  'santos-2021': { id: 'santos-2021', citation: 'Santos et al. (2021, ApJS 255, 17)', url: 'https://arxiv.org/abs/2107.02217', where: 'Sects. II and III; Tables 1 and 2', catalogue: 'J/ApJS/255/17',
    asks: 'the wavelet, the autocorrelation and their product to give one period in the star\'s light filtered at 20, 55 and 80 days, selected by the paper\'s random forest (ROOSTER), by its automatic criteria or by its authors\' inspection',
    reliability: 'For the 20,080 stars also in McQuillan et al. (2014), the paper\'s periods agree with theirs within 15% for 99.1%.' } };
/** The papers' samples are main-sequence stars and subgiants: "to avoid potential red giants we consider a flat cut at
 * log g = 3.5" (2021, Sect. II.2), and the 2019 paper's stars are dwarfs. A star whose record puts it below that cut is
 * not in their tables, and is not asked for. */
export const SANTOS_GRAVITY = 3.5;
/** The light curve both papers judge. */
export const SANTOS_LIGHT_CURVE = 'the KEPSEISMIC light curve of the star\'s four years with Kepler (KADACS, García et al. 2011), high-pass filtered at 20, 55 and 80 days';

/** What a table holds of its stars: a rotation period, none, or several signals. */
export type Holds = 'rotation' | 'none' | 'several';
export interface SantosTable { readonly paper: SantosPaper; /** The table's name at VizieR. */ readonly name: string; readonly holds: Holds; /** The column of the table's first flag. */ readonly flag: string; /** The columns of the papers' alerts, by what each says. */ readonly alerts: Readonly<Record<string, string>> }
const ALERTS_2019 = { gaiaBinary: 'Fl2', gaiaSubgiant: 'Fl3', planetCandidate: 'Fl4', fliperClass: 'Fl5', luminosityExcessMag: 'DMK' } as const, ALERTS_2021 = { binary: 'flag3', planetCandidate: 'flag4' } as const;
export const SANTOS_TABLES: readonly SantosTable[] = [
  { paper: 'santos-2019', name: 'J/ApJS/244/21/table3', holds: 'rotation', flag: 'Fl1', alerts: ALERTS_2019 }, { paper: 'santos-2019', name: 'J/ApJS/244/21/table4', holds: 'none', flag: 'Fl1', alerts: ALERTS_2019 },
  { paper: 'santos-2019', name: 'J/ApJS/244/21/table5', holds: 'several', flag: 'Fl1', alerts: ALERTS_2019 },
  { paper: 'santos-2021', name: 'J/ApJS/255/17/table1', holds: 'rotation', flag: 'flag1', alerts: ALERTS_2021 }, { paper: 'santos-2021', name: 'J/ApJS/255/17/table2', holds: 'none', flag: 'flag1', alerts: ALERTS_2021 }];

/** A star's row, as the columns this module reads. */
export interface SantosRow { /** The star's number in the Kepler Input Catalog. */ readonly kic: number; readonly paper: SantosPaper; readonly table: string; readonly holds: Holds;
  /** The first and last quarters the star was observed in, as printed ("1-17"). */ readonly quarters: string;
  /** The table's first flag as printed: the candidate flag of a table of periods, the reason or reasons of a table without. */ readonly flag: string;
  /** The rotation period and its uncertainty, days, and the photometric activity S_ph and its uncertainty, parts per million. */ readonly rotationDays?: number; readonly rotationErrorDays?: number; readonly activityPpm?: number; readonly activityErrorPpm?: number;
  /** The papers' alerts, as printed: what each column says is in ALERT_WORDS. */ readonly alerts: Readonly<Record<string, number>> }

const cell = (cells: Readonly<Record<string, string>>, column: string) => (cells[column] ?? '').trim();
const numberOf = (cells: Readonly<Record<string, string>>, column: string, table: string): number | undefined => { const printed = cell(cells, column); if (printed === '') return undefined; const value = Number(printed);
  if (!Number.isFinite(value)) throw new TypeError(`${table}: ${column} holds ${printed}, not a number.`); return value; };
/** One row of one of the five tables, as the service gives it: every cell text, an empty one blank. */
export function parseSantosRow(table: SantosTable, cells: Readonly<Record<string, string>>): SantosRow {
  const kic = numberOf(cells, 'KIC', table.name); if (kic === undefined || !Number.isInteger(kic) || kic <= 0) throw new TypeError(`${table.name}: a row holds no KIC.`);
  const optional = (key: string, column: string) => { const value = numberOf(cells, column, table.name); return value === undefined ? {} : { [key]: value }; };
  const alerts = Object.fromEntries(Object.entries(table.alerts).flatMap(([name, column]) => { const value = numberOf(cells, column, table.name); return value === undefined ? [] : [[name, value]]; }));
  const base = { kic, paper: table.paper, table: table.name, holds: table.holds, quarters: cell(cells, 'Q'), flag: cell(cells, table.flag), alerts };
  if (table.holds !== 'rotation') return base;
  const rotationDays = numberOf(cells, 'Prot', table.name); if (rotationDays === undefined || !(rotationDays > 0)) throw new TypeError(`${table.name}: KIC ${kic} is listed without a rotation period.`);
  return { ...base, rotationDays, ...optional('rotationErrorDays', 'E_Prot'), ...optional('activityPpm', 'Sph'), ...optional('activityErrorPpm', 'E_Sph') };
}

/** Why a table without periods lists a star, by its flag: Note (1) of each table's description at CDS. */
const NO_ROTATION: Readonly<Record<SantosPaper, readonly string[]>> = {
  'santos-2019': ['it shows no rotational modulation', 'it shows possible rotational modulation, with no period the paper could give', 'it is a red giant', 'it is an eclipsing binary', 'it is a confirmed RR Lyrae star', 'its light is polluted by another star, in both the KADACS and the PDC-MAP light curves',
    'its light is polluted by another star in the KADACS light curve', 'it is a Type 1 classical-pulsator or close-binary candidate', 'it is a Type 2 classical-pulsator or close-binary candidate', 'it is a Type 3 classical-pulsator candidate'],
  'santos-2021': ['it shows no rotational modulation', 'it shows possible rotational modulation, with no period the paper could give', 'it is a red giant', 'it is an eclipsing binary', 'it is a confirmed RR Lyrae star', 'it is a delta Scuti star, a gamma Doradus star or a hybrid of the two',
    'its light is polluted by another star, in both the PDC-MAP and the KEPSEISMIC light curves', 'its light is polluted by another star in the KEPSEISMIC light curve', 'its light holds several signals', 'it is a Type 2 classical-pulsator or close-binary candidate (its signal resembles a contact binary\'s)',
    'it is a Type 3 classical-pulsator or close-binary candidate (a delta Scuti or gamma Doradus candidate, or polluted by one)', 'it is a Type 4 classical-pulsator or close-binary candidate (its signal resembles a heartbeat star\'s)'] };

/** The papers' verdict on a star, from its row; a star in no table has none. */
export function santosVerdict(row: SantosRow | undefined): RotationVerdict {
  if (!row) return { detected: false, reason: 'Santos et al. (2019, 2021) do not list the star in their rotation catalogues of Kepler stars.' };
  const paper = SANTOS_PAPERS[row.paper].citation, no = (reason: string): RotationVerdict => ({ detected: false, reason });
  if (row.holds === 'none') { const reasons = row.flag === '' ? [] : row.flag.split(',').map(code => NO_ROTATION[row.paper][Number(code.trim())]);
    if (reasons.some(reason => reason === undefined)) throw new TypeError(`${row.table}: KIC ${row.kic} carries the flag "${row.flag}", which the table's description does not list.`);
    return no(`${paper} list the star without a rotation period${reasons.length ? `: ${reasons.join(' and ')}` : ''}.`); }
  if (row.holds === 'several') return no(`${paper} list the star among those whose light holds several signals, likely of different unresolved sources: their table does not give one period for the star.`);
  if (row.flag === '1') return no(`${paper} list the star with a period of ${row.rotationDays} d and flag it as a Type 1 classical-pulsator or close-binary candidate, whose signal may not be the rotation of a single star.`);
  if (row.flag === '0' && row.paper === 'santos-2021') return no(`${paper} list the star with a period of ${row.rotationDays} d and flag it as showing no rotational modulation.`);
  if (row.flag !== '') throw new TypeError(`${row.table}: KIC ${row.kic} carries the flag "${row.flag}", which the table's description does not list.`);
  return { detected: true, periodDays: row.rotationDays! };
}

/** What an accepted row holds, in a sentence's words, and as the numbers a receipt keeps. */
export const santosSays = (row: SantosRow) => `a rotation period of ${row.rotationDays}${row.rotationErrorDays === undefined ? '' : ` ± ${row.rotationErrorDays}`} d${row.activityPpm === undefined ? '' : ` and a photometric activity (S_ph, the scatter of the light over five rotations) of ${Math.round(row.activityPpm)} parts per million`}`;
export const santosMeasures = (row: SantosRow): Readonly<Record<string, number | null>> => ({ rotationDays: row.rotationDays ?? null, rotationErrorDays: row.rotationErrorDays ?? null, activityPpm: row.activityPpm ?? null, activityErrorPpm: row.activityErrorPpm ?? null });

/** The papers' filter for a period, days: 20 under 23 days, 55 from 23 to 60, 80 from 60 on. */
export const SANTOS_FILTERS = [[23, 20], [60, 55], [Infinity, 80]] as const;
export const filterFor = (rotationDays: number): FilterDays => SANTOS_FILTERS.find(([under]) => rotationDays < under)![1];

/** García et al. (2014, A&A 572, A34), Sect. 2: the variance of every quarter of a light curve is divided by the median
 * of those variances; the difference of that ratio between a quarter and each of its two neighbours is taken; and the
 * quarter is removed when the mean of the two differences is greater than a threshold the paper sets at 0.9. */
export const ANOMALOUS_VARIANCE = 0.9;
/** Which of a star's quarters that rule removes, from the variance of each in order. */
export function anomalousQuarters(variances: readonly number[]): boolean[] {
  if (!variances.every(value => Number.isFinite(value) && value >= 0)) throw new RangeError('A quarter\'s variance is a number that is not negative.');
  const median = medianAveraged([...variances]), ratios = variances.map(value => value / median);
  return ratios.map((ratio, index) => { const differences = [ratios[index - 1], ratios[index + 1]].flatMap(neighbour => neighbour === undefined ? [] : [ratio - neighbour]);
    return differences.length > 0 && differences.reduce((sum, difference) => sum + difference, 0) / differences.length > ANOMALOUS_VARIANCE; });
}
/** The variance of a quarter's light, as the rule reads it. */
export const variance = (values: readonly number[]) => { const mean = values.reduce((sum, value) => sum + value, 0) / values.length; return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length; };

/** The light's swing: its 95th less its 5th percentile, as a share of its mean. The same measure Reinhold & Hekker (2020)
 * and Holcomb et al. (2022) give of their light curves; Santos et al. print another (S_ph), so this one is measured here
 * for a page to say, and decides nothing. */
export function variabilityRange(flux: readonly number[]): number { const sorted = [...flux].sort((a, b) => a - b), at = (share: number) => { const place = share * (sorted.length - 1), low = Math.floor(place);
  return sorted[low]! + ((sorted[Math.min(low + 1, sorted.length - 1)] ?? sorted[low]!) - sorted[low]!) * (place - low); };
  if (!sorted.length) throw new RangeError('A light curve with no points has no range.'); return at(0.95) - at(0.05); }

/** One quarter of a star's light under the papers' verdict on the star: what the quarter holds, whether the papers'
 * rule keeps it in their analysis, and the measured light a map of it is fitted to. */
export interface QuarterReading { readonly quarter: number; /** Its points, and how many of them are measured and filled in. */ readonly points: number; readonly measured: number; readonly filled: number;
  /** From its first measured point to its last, days, and in turns of the star. */ readonly spanDays: number; readonly turns: number; /** The variance of its light over the median of the star's quarters. */ readonly varianceOverMedian: number;
  /** Why the quarter has no map, when it has none: the papers' rule on its variance, or less than a turn of the star in it. */ readonly left?: 'variance' | 'turn';
  readonly verdict: RotationVerdict; readonly time: readonly number[]; readonly flux: readonly number[] }
/** A star's quarters under a period the papers give it. A quarter the rule of García et al. (2014) removes is not part
 * of the light the papers' verdict is on, and has none. A quarter whose measured light spans less than one turn of the
 * star has none either: not every longitude faced the telescope in it, and a map of it would draw longitudes nobody
 * saw. That second limit is no paper's: it is what a map of a whole surface needs. */
export function quarterReadings(parts: readonly QuarterLight[], periodDays: number, citation: string): QuarterReading[] {
  if (!(periodDays > 0)) throw new RangeError('A star\'s quarters are read under a rotation period.');
  const variances = parts.map(part => variance(part.flux)), median = variances.length ? medianAveraged([...variances]) : 1, removed = anomalousQuarters(variances);
  return parts.map((part, index) => { const light = measuredLight(part), spanDays = light.time.length ? light.time.at(-1)! - light.time[0]! : 0, turns = spanDays / periodDays, over = Number((variances[index]! / median).toFixed(2));
    const verdict: RotationVerdict = removed[index] ? { detected: false, reason: `In quarter ${part.quarter} the variance of the star's light is ${over} times the median of its quarters, more than ${ANOMALOUS_VARIANCE} of that median over the quarters beside it: ${citation} remove such a quarter from their rotation analysis (the rule of García et al. 2014).` }
      : turns < 1 ? { detected: false, reason: `Quarter ${part.quarter} holds ${spanDays.toFixed(1)} days of the star's light, less than one turn of ${periodDays} d: not every longitude faced Kepler in it.` }
      : { detected: true, periodDays, amplitude: Number(variabilityRange(light.flux).toFixed(6)) };
    return { quarter: part.quarter, points: part.time.length, measured: light.time.length, filled: part.state.filter(state => state === POINT.filled).length, spanDays: Number(spanDays.toFixed(1)), turns: Number(turns.toFixed(2)), varianceOverMedian: over,
      ...(removed[index] ? { left: 'variance' as const } : turns < 1 ? { left: 'turn' as const } : {}), verdict, time: light.time, flux: light.flux }; });
}

/** A star under the papers' verdict: the verdict, each of its quarters in the light the papers read its period in, and
 * what a star's page says of that light: its filter, and the quarters left without a map with the reason for each. */
export interface SantosStar { readonly verdict: RotationVerdict; readonly quarters: readonly QuarterReading[]; readonly note?: string }
const listed = (items: readonly (string | number)[]) => items.join(', ').replace(/, ([^,]*)$/u, ' and $1');
/** "quarter 13", "quarters 3, 6 and 12". */
const quartersOf = (quarters: readonly QuarterReading[]) => `quarter${quarters.length === 1 ? '' : 's'} ${listed(quarters.map(quarter => quarter.quarter))}`;
/** A star's row set beside its light curve of the filter the papers take the row's period from. The star's swing is that
 * of the light of all the quarters kept, together. A row that is no verdict of rotation reads no light. `turnDays` is
 * the time the star turns in when that is not the row's period: twice it, where the catalogues print twice it
 * (tess/verdict.mts). */
export function santosStar(row: SantosRow | undefined, series: Pick<KepseismicSeries, 'kic' | 'filterDays' | 'time' | 'flux' | 'state' | 'stepDays'> | undefined, turnDays?: number): SantosStar {
  const said = santosVerdict(row); if (!row || !said.detected || said.periodDays === undefined) return { verdict: said, quarters: [] };
  if (!series || series.kic !== row.kic || series.filterDays !== filterFor(said.periodDays)) throw new TypeError(`KIC ${row.kic}: a period of ${said.periodDays} d is read in the star's light filtered at ${filterFor(said.periodDays)} days.`);
  const quarters = quarterReadings(byQuarter(series), turnDays ?? said.periodDays, SANTOS_PAPERS[row.paper].citation), kept = quarters.filter(quarter => quarter.verdict.detected);
  const removed = quarters.filter(quarter => quarter.left === 'variance'), short = quarters.filter(quarter => quarter.left === 'turn');
  const note = [`The papers read a period of ${said.periodDays} d in the star's light filtered at ${series.filterDays} days, and that is the light curve mapped.`,
    ...(removed.length + short.length ? [`${removed.length + short.length} of the star's ${quarters.length} quarters ${removed.length + short.length === 1 ? 'has' : 'have'} no map.`] : []),
    ...(removed.length ? [`The papers' rule on a quarter's variance (García et al. 2014) removes ${quartersOf(removed)}, whose variance is ${listed(removed.map(quarter => quarter.varianceOverMedian))} times the median of the star's quarters.`] : []),
    ...(short.length ? [`${quartersOf(short).replace(/^q/u, 'Q')} ${short.length === 1 ? 'holds' : 'hold'} less than one turn of the star.`] : [])].join(' ');
  if (!kept.length) return { verdict: { detected: false, reason: `${SANTOS_PAPERS[row.paper].citation} list the star with a rotation period of ${said.periodDays} d, and none of its quarters is one a map can be made of: ${quarters.map(quarter => quarter.verdict.reason).join(' ')}` }, quarters, note };
  return { verdict: { ...said, amplitude: Number(variabilityRange(kept.flatMap(quarter => quarter.flux)).toFixed(6)) }, quarters, note };
}

/** The columns asked of a table: the star, its quarters, the table's flags and, of a table of periods, the period and the activity. */
const columnsOf = (table: SantosTable) => ['KIC', 'Q', table.flag, ...Object.values(table.alerts), ...(table.holds === 'rotation' ? ['Prot', 'E_Prot', 'Sph', 'E_Sph'] : [])];
/** One paper as an entry of the published-verdict kind (tess/published.mts): its tables are asked whole, one query each,
 * and a star's row is in one of them. What a row says is `santosVerdict`; which of the star's quarters the verdict is on
 * is known only from its light (`santosStar`), so `judge` gives the windows it is handed back for an accepted row. */
function published(id: SantosPaper): PublishedVerdict<SantosRow> { const paper = SANTOS_PAPERS[id], tables = SANTOS_TABLES.filter(table => table.paper === id);
  return { id: paper.id, citation: paper.citation, url: paper.url, where: paper.where, table: `VizieR ${paper.catalogue}, ${tables.find(table => table.holds === 'rotation')!.name.split('/').at(-1)!.replace('table', 'table ')}`, service: VIZIER_TAP,
    query: tables.map(table => `SELECT ${columnsOf(table).join(', ')} FROM "${table.name}"`), missions: ['Kepler'], lightCurve: SANTOS_LIGHT_CURVE, asks: paper.asks, reliability: paper.reliability,
    swing: 'measured here over the quarters mapped; the table prints another measure of it, S_ph',
    parse(answered) { const rows = new Map<number, SantosRow>();
      for (const cells of answered) { const table = tables[Number(cell(cells, 'table') || Number.NaN)]; if (!table) throw new TypeError(`${paper.catalogue}: a row does not say which table it is of.`);
        const row = parseSantosRow(table, cells); if (rows.has(row.kic)) throw new TypeError(`${paper.catalogue}: KIC ${row.kic} is listed twice.`); rows.set(row.kic, row); }
      return rows; },
    judge(row, windows) { const verdict = santosVerdict(row); return { verdict, windows: verdict.detected ? windows : [] }; }, says: santosSays, measures: santosMeasures }; }
export const SANTOS_2019 = published('santos-2019'), SANTOS_2021 = published('santos-2021');
/** The papers read of a star's Kepler light, in the order they are asked. */
export const SANTOS: readonly PublishedVerdict<SantosRow>[] = [SANTOS_2019, SANTOS_2021];
