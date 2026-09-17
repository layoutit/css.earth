/** Baselines on which an exposure lost its fringes, found against the same telescope pair in the blocks before and after.
 *
 * When the fringes of a baseline fall outside PIONIER's scan (a telescope's delay off, or its light lost), pndrs still writes a
 * squared visibility for it: about zero, with an error about as small, so it outweighs every good exposure it is averaged with
 * and every model it is fitted to. pndrs's own scan selection (SNR above 1.75) does not catch it, and scan SNR does not tell it
 * apart from a star's real near-null points either: on π¹ Gruis in September 2014 the lost baselines have SNR 2.5 to 20 and the
 * real 60 to 80 m points past the first null 7 to 28.
 *
 * What does tell them apart is time. A telescope pair's projected baseline changes by a few percent between neighbouring blocks,
 * so a real squared visibility changes smoothly; lost fringes drop it by a factor of 100 to 1000 for one block. An exposure's
 * baseline is lost when its squared visibility is below a tenth of the larger median of the same pair in the previous and next
 * block of the same object, and that median is at least 0.002: below that the pair is near a null, where a tenfold change is
 * possible without anything lost. The author of the π¹ Gruis file removed the same baselines (every baseline of telescope 3 in
 * the first science block, and four of the six in the two-exposure block at 03:04 UT on 26 September).
 *
 * A lost baseline is flagged with its error set to 1e10, and so is every closure phase using it: pndrs gives no weight to a sample
 * whose error is 1e5 or more when it averages exposures and builds transfer functions. */
import { binaryTable, numbers, readFitsHdus, tableColumn, writeCell } from './fits-table.mts';

export const LOST_FRINGE_RATIO = 0.1;
export const LOST_FRINGE_MINIMUM_NEIGHBOUR = 0.002;
const REMOVED_ERROR = 1e10;

const pairKey = (a: number, b: number) => a < b ? `${a}-${b}` : `${b}-${a}`;

/** The channel-mean squared visibility of each telescope pair in one exposure's raw product. */
export function pairVisibilities(bytes: Buffer) {
  const pairs = new Map<string, number>();
  for (const hdu of readFitsHdus(bytes).filter(hdu => hdu.extname === 'OI_VIS2')) {
    const table = binaryTable(hdu);
    for (let row = 0; row < table.rows; row++) {
      const [a, b] = numbers(bytes, table, row, tableColumn(table, 'STA_INDEX')), flags = numbers(bytes, table, row, tableColumn(table, 'FLAG'));
      const values = numbers(bytes, table, row, tableColumn(table, 'VIS2DATA')).filter((_, k) => !flags[k]);
      if (values.length) pairs.set(pairKey(a!, b!), values.reduce((sum, value) => sum + value, 0) / values.length);
    }
  }
  return pairs;
}

export interface ExposureVisibilities { readonly id: string; readonly object: string; readonly block: number; readonly pairs: ReadonlyMap<string, number> }

const median = (values: readonly number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[sorted.length >> 1]! : undefined; };

/** Each exposure's lost telescope pairs; exposures with none are left out. */
export function findLostFringes(exposures: readonly ExposureVisibilities[]) {
  const lost = new Map<string, string[]>();
  const blocksOf = new Map<string, number[]>();
  for (const exposure of exposures) blocksOf.set(exposure.object, [...new Set([...(blocksOf.get(exposure.object) ?? []), exposure.block])].sort((a, b) => a - b));
  const blockMedian = (block: number | undefined, pair: string) => block === undefined ? undefined
    : median(exposures.filter(exposure => exposure.block === block).flatMap(exposure => exposure.pairs.has(pair) ? [exposure.pairs.get(pair)!] : []));
  for (const exposure of exposures) {
    const blocks = blocksOf.get(exposure.object)!, index = blocks.indexOf(exposure.block);
    for (const [pair, value] of exposure.pairs) {
      const neighbours = [blockMedian(blocks[index - 1], pair), blockMedian(blocks[index + 1], pair)].filter((entry): entry is number => entry !== undefined);
      if (!neighbours.length) continue;
      const reference = Math.max(...neighbours);
      if (reference >= LOST_FRINGE_MINIMUM_NEIGHBOUR && value < LOST_FRINGE_RATIO * reference) lost.set(exposure.id, [...(lost.get(exposure.id) ?? []), pair]);
    }
  }
  return lost;
}

/** A copy of a raw product with the given telescope pairs removed, and every closure phase that uses one of them. */
export function removeLostFringes(input: Buffer, pairs: readonly string[]) {
  const bytes = Buffer.from(input), removed = new Set(pairs);
  let vis2 = 0, closures = 0;
  for (const hdu of readFitsHdus(bytes)) {
    if (hdu.extname !== 'OI_VIS2' && hdu.extname !== 'OI_T3') continue;
    const table = binaryTable(hdu), flag = tableColumn(table, 'FLAG');
    const errors = (hdu.extname === 'OI_VIS2' ? ['VIS2ERR'] : ['T3PHIERR', 'T3AMPERR']).map(name => tableColumn(table, name));
    for (let row = 0; row < table.rows; row++) {
      const stations = numbers(bytes, table, row, tableColumn(table, 'STA_INDEX'));
      const uses = hdu.extname === 'OI_VIS2' ? removed.has(pairKey(stations[0]!, stations[1]!))
        : [[0, 1], [1, 2], [0, 2]].some(([a, b]) => removed.has(pairKey(stations[a!]!, stations[b!]!)));
      if (!uses) continue;
      const channels = numbers(bytes, table, row, flag).length;
      for (let k = 0; k < channels; k++) { writeCell(bytes, table, row, flag, k, true); for (const error of errors) writeCell(bytes, table, row, error, k, REMOVED_ERROR); }
      if (hdu.extname === 'OI_VIS2') vis2++; else closures++;
    }
  }
  return { bytes, vis2, closures };
}
