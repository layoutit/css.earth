/** The fourth kind of entry: a paper that measured one star's rotation in one window of a mission and prints the period
 * in its text, not in a table (one-star.json). Such a paper names the light curve it measured, which MAST serves, and the
 * entry ties its sentence to that file, the star's target number and the window. Like a table's entry (published.mts) it
 * is a verdict only on the light the paper judged, it measures nothing, and its period is drawn as printed or not at all
 * (`keptAsPublished`). It is asked last, for a star no method and no table gives a rotation (reduce.mts). The entries
 * are data: no module names a star. */
import { readFile } from 'node:fs/promises';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { MATCH_DEGREES } from '../kepler/light-curves.mts';
import type { PublishedPaper } from './published.mts';
import type { Mission, RotationVerdict } from './verdict.mts';

export const ONE_STAR_SCHEMA = 'cssearth-one-star-verdicts@1';
/** The light curve products a one-star entry may name, as the map's mission table keys them (new-object/brightness). */
export const ONE_STAR_PRODUCTS = ['EVEREST'] as const;
export type OneStarProduct = typeof ONE_STAR_PRODUCTS[number];
/** The file the paper measured: its product, its name and its address at MAST, and how the paper describes it. */
export interface OneStarLight { readonly product: OneStarProduct; readonly filename: string; readonly uri: string; readonly described: string }
/** An entry's paper, in the shape a receipt describes a paper by. `table` is where in the text the period is printed. */
export interface OneStarPaper extends Pick<PublishedPaper, 'id' | 'citation' | 'url' | 'where' | 'catalogue' | 'missions' | 'lightCurve' | 'asks' | 'reliability' | 'swing' | 'table'> {
  readonly printedIn: 'text'; readonly doi: string; readonly mission: Mission; readonly target: number; /** Where the mission lists the target, in degrees. */ readonly raDegrees: number; readonly decDegrees: number; readonly window: number; readonly light: OneStarLight;
  readonly periodDays: number; readonly periodErrorDays: number; readonly quote: string }

const product = (value: unknown): OneStarProduct => { const named = requireString(value, 'light curve product'); if (!(ONE_STAR_PRODUCTS as readonly string[]).includes(named)) throw new TypeError(`A one-star entry names an unknown light curve product, ${named}.`); return named as OneStarProduct; };
const mission = (value: unknown): Mission => { const named = requireString(value, 'mission'); if (named !== 'K2') throw new TypeError(`A one-star entry is of K2 light only, not ${named}.`); return named; };

/** The entries of one-star.json, each checked. */
export function parseOneStar(value: unknown): OneStarPaper[] {
  const record = requireRecord(value, 'one-star verdicts');
  if (record.schema !== ONE_STAR_SCHEMA) throw new TypeError(`one-star.json is not ${ONE_STAR_SCHEMA}.`);
  if (!Array.isArray(record.entries)) throw new TypeError('one-star.json lists no entries.');
  const papers = record.entries.map((entry, index) => {
    const one = requireRecord(entry, `entry ${index}`), light = requireRecord(one.lightCurve, `entry ${index} light curve`), periodDays = requireFiniteNumber(one.periodDays, 'period'), periodErrorDays = requireFiniteNumber(one.periodErrorDays, 'period error');
    if (!(periodDays > 0) || !(periodErrorDays >= 0)) throw new RangeError(`one-star entry ${index}: a period over 0 and an error of 0 or more are needed.`);
    const read = { product: product(light.product), filename: requireString(light.filename, 'file name'), uri: requireString(light.uri, 'file address'), described: requireString(light.described, 'light curve described') };
    if (!read.uri.startsWith('mast:') || !read.uri.endsWith(`/${read.filename}`)) throw new TypeError(`one-star entry ${index}: the file's address is not its name at MAST.`);
    const quote = requireString(one.quote, 'quoted sentence');
    return { id: requireString(one.id, 'id'), citation: requireString(one.citation, 'citation'), url: requireString(one.url, 'url'), doi: requireString(one.doi, 'doi'), where: requireString(one.where, 'where'),
      mission: mission(one.mission), target: requireFiniteNumber(one.target, 'target'), raDegrees: requireFiniteNumber(one.raDegrees, 'right ascension'), decDegrees: requireFiniteNumber(one.decDegrees, 'declination'), window: requireFiniteNumber(one.window, 'window'), light: read, periodDays, periodErrorDays, quote,
      asks: requireString(one.asks, 'what the paper asks'), reliability: requireString(one.reliability, 'reliability'),
      catalogue: 'none', missions: [mission(one.mission)], lightCurve: read.described, swing: 'measured here from the light curve the paper measured', table: `${requireString(one.where, 'where')}: "${quote}"`, printedIn: 'text' as const }; });
  const ids = new Set(papers.map(paper => paper.id)), targets = new Set(papers.map(paper => `${paper.mission} ${paper.target}`));
  if (ids.size !== papers.length || targets.size !== papers.length) throw new TypeError('one-star.json lists an id, or a target, twice.');
  return papers;
}
export const readOneStar = async (path = new URL('./one-star.json', import.meta.url)) => parseOneStar(JSON.parse(await readFile(path, 'utf8')) as unknown);

/** How near a star's place an entry's target must lie: K2's own match of a target to a star (kepler/light-curves.mts). */
export const ONE_STAR_MATCH_DEGREES = MATCH_DEGREES;
/** The entry whose target lies at one of the star's places (K2's years, reduce.mts `targetPlaces`): nothing is asked of an archive. */
export const oneStarFor = (papers: readonly OneStarPaper[], places: readonly { readonly raDegrees: number; readonly decDegrees: number }[]) =>
  papers.find(paper => places.some(place => Math.hypot((place.raDegrees - paper.raDegrees) * Math.cos(place.decDegrees * Math.PI / 180), place.decDegrees - paper.decDegrees) <= ONE_STAR_MATCH_DEGREES));
/** What the paper says of the star, as a verdict: the period it prints. */
export const oneStarVerdict = (paper: OneStarPaper): RotationVerdict => ({ detected: true, periodDays: paper.periodDays });
/** What the paper says, in a sentence's words. */
export const oneStarSays = (paper: OneStarPaper) => `a rotation period of ${paper.periodDays.toFixed(2)} ± ${paper.periodErrorDays} d`;
/** The light's swing, as the methods measure it: its 95th less its 5th percentile, as a share of its mean. */
export function lightSwing(flux: readonly number[]): number {
  // numpy's percentile, which tools.py's methods use: linear between the two nearest ranks.
  const sorted = [...flux].sort((a, b) => a - b), at = (share: number) => { const rank = share * (sorted.length - 1), low = Math.floor(rank), high = Math.min(low + 1, sorted.length - 1); return sorted[low]! + (rank - low) * (sorted[high]! - sorted[low]!); }, mean = flux.reduce((sum, value) => sum + value, 0) / flux.length;
  if (!flux.length || !(mean > 0)) throw new RangeError('A light curve with no light has no swing.');
  return Number(((at(0.95) - at(0.05)) / mean).toFixed(6));
}
