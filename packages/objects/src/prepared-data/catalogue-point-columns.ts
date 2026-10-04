import type { PreparedBank } from '../prepared-bank.js';
import type { CataloguePointSpread } from '../catalogue-points.js';
import type { DensityVolumeFrame } from '../density-volume.js';
import { CATALOGUE_POSITION_SCALE, catalogueBankFileColumns } from './catalogue-bank-binary.js';
import { parseCataloguePointHeader, type PreparedCataloguePointBank } from './catalogue-point-bank.js';

/**
 * A catalogue point bank as the page holds it: columns, never an object for each point. A bank's file is columns already
 * (catalogue-bank-binary.ts); read into rows and then into a point object each, the nearby galaxies' 39,916 points were
 * three passes over them on the page's thread, in the frame the bank arrived in. The data worker reads the file into
 * this form, and the page receives its arrays by transfer.
 */
export interface CataloguePointStyle { readonly colorCss: string; readonly radiusPx: number }
export interface PreparedCataloguePointColumns {
  readonly id: string;
  readonly frame: DensityVolumeFrame;
  readonly appearance: PreparedCataloguePointBank['appearance'];
  readonly count: number;
  /** Each point's x, y and z, in the bank's units. */
  readonly positions: Float64Array;
  /** How far the farthest point is from the bank's origin, in its units. */
  readonly reachUnits: number;
  /** The paints the bank's points have (a color at a radius): its palette's entries, or its one color. */
  readonly styles: readonly CataloguePointStyle[];
  /** Each point's style, in a bank with more than one. */
  readonly styleOf: Uint8Array | Uint16Array | null;
  readonly spread: CataloguePointSpread;
  /** The points' prepared cells: `of[i]` is point i's box in `boxes`, six bounds each. */
  readonly cells: { readonly boxes: Float64Array; readonly of: Uint16Array | Uint32Array | Int32Array };
}

/** The buffers a bank's columns live in: what a reader hands over with it. */
export const cataloguePointColumnBuffers = (bank: PreparedCataloguePointColumns): ArrayBufferLike[] =>
  [...new Set([bank.positions.buffer, bank.cells.boxes.buffer, bank.cells.of.buffer, ...(bank.styleOf ? [bank.styleOf.buffer] : [])])];

/** A bank's columns from its file, checked as the JSON form is (catalogue-point-bank.ts): its fields, every point in one
 * cell whose box holds it, every box used, no cell across two levels, and every palette index a color of the palette. */
export function readCataloguePointColumns(file: PreparedBank, at = 'catalogue points'): PreparedCataloguePointColumns {
  const { count, x, y, z, boxes, cell, palette: paletteOf } = catalogueBankFileColumns(file, at);
  const { id, frame, appearance, palette, paletteRadiusPx, colorCss, radiusPx, levelPoints, spread } = parseCataloguePointHeader(file.fields, count, at);
  const fail = (why: string): never => { throw new TypeError(`${id} (${at}): ${why}`); };
  if (Boolean(palette) !== Boolean(paletteOf)) fail(palette ? 'has a palette and no palette column' : 'has a palette column and no palette');
  const cells = boxes.length / 6, used = new Uint8Array(cells), levelOf = new Int32Array(cells).fill(-1), positions = new Float64Array(count * 3);
  for (let box = 0; box < cells; box++) for (let axis = 0; axis < 3; axis++) {
    const low = boxes[box * 6 + axis]!, high = boxes[box * 6 + axis + 3]!;
    if (!Number.isFinite(low) || !Number.isFinite(high) || !(low <= high)) fail(`catalogue point bank field cells box ${box} must be six finite bounds, each minimum at most its maximum`);
  }
  let level = 0, levelEnd = levelPoints[0] ?? count, reachSquared = 0;
  for (let index = 0; index < count; index++) {
    while (index >= levelEnd && level < levelPoints.length - 1) levelEnd += levelPoints[++level]!;
    const own = cell[index]!, px = x[index]! / CATALOGUE_POSITION_SCALE, py = y[index]! / CATALOGUE_POSITION_SCALE, pz = z[index]! / CATALOGUE_POSITION_SCALE;
    if (own >= cells) fail(`catalogue point bank field cells names cell ${own} for point ${index}, outside its ${cells} boxes`);
    const b = own * 6;
    if (!(px >= boxes[b]! && px <= boxes[b + 3]! && py >= boxes[b + 1]! && py <= boxes[b + 4]! && pz >= boxes[b + 2]! && pz <= boxes[b + 5]!)) {
      fail(`catalogue point bank field cells box ${own} does not hold point ${index} (${px}, ${py}, ${pz})`);
    }
    if (levelOf[own] !== -1 && levelOf[own] !== level) fail(`catalogue point bank field cells cell ${own} spans levels ${levelOf[own]} and ${level}`);
    levelOf[own] = level; used[own] = 1;
    if (paletteOf && paletteOf[index]! >= palette!.length) fail(`point ${index} names palette color ${paletteOf[index]}, which the palette of ${palette!.length} lacks.`);
    positions[index * 3] = px; positions[index * 3 + 1] = py; positions[index * 3 + 2] = pz;
    reachSquared = Math.max(reachSquared, px * px + py * py + pz * pz);
  }
  const unused = used.indexOf(0);
  if (unused >= 0) fail(`catalogue point bank field cells box ${unused} holds no point`);
  const styles = palette ? palette.map((color, index) => ({ colorCss: color, radiusPx: paletteRadiusPx ? paletteRadiusPx[index]! : radiusPx })) : [{ colorCss, radiusPx }];
  return { id, frame, appearance, count, positions, reachUnits: Math.sqrt(reachSquared), styles, styleOf: paletteOf, spread, cells: { boxes, of: cell } };
}

/** A bank parsed from its JSON form as columns: what a test or a tool that holds one hands the page's mount. */
export function cataloguePointColumns(bank: PreparedCataloguePointBank): PreparedCataloguePointColumns {
  const count = bank.points.length, positions = new Float64Array(count * 3), keys = new Map<string, number>(), styles: CataloguePointStyle[] = [];
  const styleOf = new Uint16Array(count);
  let reachSquared = 0;
  bank.points.forEach((point, index) => {
    const [px, py, pz] = point.positionUnits, key = `${point.colorCss}|${point.radiusPx}`;
    positions[index * 3] = px; positions[index * 3 + 1] = py; positions[index * 3 + 2] = pz;
    reachSquared = Math.max(reachSquared, px * px + py * py + pz * pz);
    let style = keys.get(key);
    if (style === undefined) { keys.set(key, style = styles.length); styles.push({ colorCss: point.colorCss, radiusPx: point.radiusPx }); }
    styleOf[index] = style;
  });
  return { id: bank.id, frame: bank.frame, appearance: bank.appearance, count, positions, reachUnits: Math.sqrt(reachSquared), styles,
    styleOf: styles.length > 1 ? styleOf : null, spread: bank.spread, cells: bank.cells };
}
