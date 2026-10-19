/** A K2 star's rows in the catalogue of Reinhold & Hekker (2020): the paper's own verdict on the star.
 *
 * Reinhold & Hekker (2020), "Stellar rotation periods from K2 Campaigns 0-18", A&A 635, A43, Sects. 2 and 3; its
 * catalogue is VizieR J/A+A/635/A43, table2. The method itself is wired (methods.mts `REINHOLD_HEKKER_2020`) and run on
 * the K2 light the mission publishes now. This entry is the paper's table, of the published-verdict kind
 * (published.mts): nothing is measured or judged here. It is asked of a star no method gives a rotation, as the TESS
 * papers' tables are: the method run here can refuse a star the paper's own run accepted (a peak just under 0.3, three
 * periods a little further apart), and it is not run at all on a star whose record holds a temperature or a gravity
 * outside the paper's ranges, which the paper took from the EPIC catalogue, not from the star's record.
 *
 * What a row asserts (Sect. 3 and the table's ReadMe): the catalogue "contains the measured rotation periods" of the
 * stars that passed the paper's criteria, one row a star and a campaign ("32,387 periods because several stars have been
 * observed more than once"). `Prot` is the period, `e_Prot` its error, `HPeak` the periodogram's peak, `Rvar` the
 * variability range in percent (the light's 95th less its 5th percentile, Sect. 2), and `_RA`, `_DE` the target's place
 * from the EPIC catalogue. The light is the mission's own PDC-MAP light curve of each campaign listed.
 *
 * What is taken: a star is found by its place (within K2's 4 arcseconds of its place in one of K2's years, as K2's light
 * curves are matched to it), so no archive is asked of a star the table does not list. A star with rows of several
 * campaigns takes the paper's rule (Sect. 3.1, as `REINHOLD_HEKKER_2020.star` applies it): the mean of the campaigns'
 * periods, and no verdict when they deviate by more than 20%. Every campaign the table lists must be among the star's
 * K2 light curves at MAST, or the verdict is not on light the route can read. Campaigns 10 and 11 were split in two by
 * the mission, and the route reads each one's longer, second part (kepler/light-curves.mts `SPLIT_CAMPAIGNS`): a row of
 * campaign 10 is read as that part, whose light the file names window 102 (`windowOfCampaign`). That is this entry's reading of the table: the paper gives about 50 to 70
 * days of light for campaigns 10 and 11 (Sect. 2) and does not say which part. */
import { VIZIER_TAP } from '../espadons/catalogue.mts';
import { MATCH_DEGREES, SPLIT_CAMPAIGNS } from '../kepler/light-curves.mts';
import type { PublishedJudgement, PublishedVerdict } from './published.mts';

const CATALOGUE = 'J/A+A/635/A43', TABLE = `${CATALOGUE}/table2`, COLUMNS = ['EPIC', 'Campaign', 'Prot', 'e_Prot', 'HPeak', 'Rvar', '_RA', '_DE'] as const, PAPER = 'Reinhold & Hekker (2020)';
/** How far apart two campaigns' periods may lie, as a share of their mean (Sect. 3.1). */
const DEVIATION = 0.2;
/** One campaign's row. */
export interface ReinholdHekkerCampaign { readonly campaign: number; readonly periodDays: number; readonly errorDays: number; readonly peakHeight: number; /** As a share of the mean light. */ readonly variabilityRange?: number }
/** A star's rows: its EPIC number and place, and one entry a campaign. */
export interface ReinholdHekkerRow { readonly epic: number; readonly raDegrees: number; readonly decDegrees: number; readonly campaigns: readonly ReinholdHekkerCampaign[] }

/** The star's rows: the nearest target within K2's 4 arcseconds of one of its places (reduce.mts `targetPlaces`). */
export function rowAtPlace(rows: Iterable<ReinholdHekkerRow>, places: readonly { readonly raDegrees: number; readonly decDegrees: number }[]): ReinholdHekkerRow | undefined {
  let best: ReinholdHekkerRow | undefined, least = MATCH_DEGREES;
  for (const row of rows) for (const place of places) { const apart = Math.hypot((row.raDegrees - place.raDegrees) * Math.cos(place.decDegrees * Math.PI / 180), row.decDegrees - place.decDegrees); if (apart <= least) { least = apart; best = row; } }
  return best;
}
/** The window a light curve file of a campaign is read as (reduce.mts), for a campaign the table names. */
export const windowOfCampaign = (campaign: number) => SPLIT_CAMPAIGNS.includes(campaign) ? Number(`${campaign}2`) : campaign;
const two = (days: number) => Number(days.toFixed(2));

/** The table's rows, by the star's EPIC number. */
export function parseReinholdHekker(answered: readonly Readonly<Record<string, string>>[]): Map<number, ReinholdHekkerRow> {
  const rows = new Map<number, { epic: number; raDegrees: number; decDegrees: number; campaigns: ReinholdHekkerCampaign[] }>();
  for (const cells of answered) {
    const number = (column: typeof COLUMNS[number], optional = false) => { const printed = (cells[column] ?? '').trim(), value = Number(printed);
      if (printed === '' && optional) return undefined; if (printed === '' || !Number.isFinite(value)) throw new TypeError(`${TABLE}: a row holds no ${column}.`); return value; };
    const epic = number('EPIC')!, campaign = number('Campaign')!, range = number('Rvar', true);
    if (!Number.isInteger(epic) || !Number.isInteger(campaign)) throw new TypeError(`${TABLE}: EPIC ${epic} or campaign ${campaign} is not a whole number.`);
    const row = rows.get(epic) ?? { epic, raDegrees: number('_RA')!, decDegrees: number('_DE')!, campaigns: [] };
    if (row.campaigns.some(one => one.campaign === campaign)) throw new TypeError(`${TABLE}: EPIC ${epic} is listed twice for campaign ${campaign}.`);
    row.campaigns.push({ campaign, periodDays: number('Prot')!, errorDays: number('e_Prot')!, peakHeight: number('HPeak')!, ...(range === undefined ? {} : { variabilityRange: range / 100 }) });
    rows.set(epic, row); }
  return rows;
}

/** A star's verdict on its K2 campaigns at MAST (as MAST's listing numbers them: a split campaign by its own number): the paper's period when every campaign it lists is among them and, for
 * several, their periods agree within 20%. */
function judge(row: ReinholdHekkerRow, windows: readonly number[]): PublishedJudgement {
  const periods = row.campaigns.map(one => one.periodDays), mean = two(periods.reduce((sum, days) => sum + days, 0) / periods.length), no = (reason: string): PublishedJudgement => ({ verdict: { detected: false, reason }, windows: [], gives: mean });
  const listed = `${PAPER} list the star with ${row.campaigns.length === 1 ? `a rotation period of ${periods[0]} d in campaign ${row.campaigns[0]!.campaign}` : `rotation periods of ${periods.join(' and ')} d in campaigns ${row.campaigns.map(one => one.campaign).join(' and ')}`}`;
  if (Math.max(...periods) - Math.min(...periods) > DEVIATION * mean) return { ...no(`${listed}, which deviate by more than the 20% beyond which the paper excludes a star.`), gives: undefined };
  const own = row.campaigns.map(one => one.campaign), missing = own.filter(campaign => !windows.includes(campaign));
  if (missing.length) return no(`${listed}, and K2 publishes no light curve of the star for ${missing.length === 1 ? 'that campaign' : 'those campaigns'} at MAST now (campaign ${missing.join(', ')}).`);
  const ranges = row.campaigns.flatMap(one => one.variabilityRange === undefined ? [] : [one.variabilityRange]);
  return { verdict: { detected: true, periodDays: mean, ...(ranges.length ? { amplitude: Number((ranges.reduce((sum, value) => sum + value, 0) / ranges.length).toFixed(6)) } : {}) }, windows: own, gives: mean };
}

export const REINHOLD_HEKKER_2020_TABLE: PublishedVerdict<ReinholdHekkerRow> = { id: 'reinhold-hekker-2020-catalogue', citation: 'Reinhold & Hekker (2020, A&A 635, A43)', url: 'https://arxiv.org/abs/2001.08214', where: 'Sects. 2 and 3; the catalogue of rotation periods', catalogue: CATALOGUE, table: `VizieR ${TABLE}`,
  service: VIZIER_TAP, query: `SELECT ${COLUMNS.map(column => `"${column}"`).join(', ')} FROM "${TABLE}"`, missions: ['K2'],
  lightCurve: 'the K2 mission\'s long-cadence PDC-MAP light curve of each campaign the catalogue lists for the star',
  asks: 'the periodogram, the wavelet and the autocorrelation of a campaign\'s light to give periods within a day of each other under 10 days, two days to 20 and five beyond, with a periodogram peak over 0.3, a period between a day and half the light\'s span, and a variability range under 10%',
  reliability: 'Of the paper\'s stars observed in two campaigns, 75.7% gave periods within 20% of each other.', swing: 'as the table prints it (the mean of the campaigns\' variability ranges)',
  parse: parseReinholdHekker, judge,
  says: row => row.campaigns.length === 1 ? `a rotation period of ${row.campaigns[0]!.periodDays} ± ${row.campaigns[0]!.errorDays} d in campaign ${row.campaigns[0]!.campaign}, with a periodogram peak of ${row.campaigns[0]!.peakHeight}`
    : `rotation periods of ${row.campaigns.map(one => `${one.periodDays} ± ${one.errorDays} d (campaign ${one.campaign})`).join(' and ')}, whose mean is the star's`,
  measures: row => ({ epic: row.epic, campaigns: row.campaigns.length, periodDays: two(row.campaigns.reduce((sum, one) => sum + one.periodDays, 0) / row.campaigns.length), peakHeight: Math.min(...row.campaigns.map(one => one.peakHeight)) }) };
