import { CATALOGUE_POINTS_SCHEMA, MAX_CATALOGUE_POINTS, parseCatalogueCells, parseCataloguePointSpread, type CatalogueCells, type CataloguePointSpread } from '../../catalogue-points.js';
import { parseDensityVolumeFrame, type DensityVolumeFrame, type VolumeVector } from '../../density-volume.js';

/**
 * A stacked bank's levels (packages/bake/cli/stack-catalogue-points.mts), in its order: the outermost is thinned with the
 * camera's distance from `fullDetailUnits`, as any bank is; each inner level's dots appear one at a time as the view's
 * half-width at the origin shrinks through `appearUnits` (from, to), evenly in its logarithm. Zooming in only ever adds
 * dots to the prefix, and zooming out takes the newest away first.
 */
export type CataloguePointLevel = ({ readonly points: number; readonly fullDetailUnits: number } | { readonly points: number; readonly appearUnits: readonly [number, number] })
  /** The level's opacity once the innermost level has filled the view, reached as it fills (1 when absent). */
  & { readonly nearOpacity?: number;
    /** The bank's screen budget once this inner level is whole, reached evenly in the logarithm of the view's half-width
     * as it appears. */
    readonly screenBudget?: number };
export interface PreparedCataloguePointBank {
  readonly id: string;
  readonly frame: DensityVolumeFrame;
  readonly appearance: { readonly colorCss: string; readonly radiusPx: number; readonly opacity: number; readonly palette?: readonly string[];
    /** Each palette entry's own dot radius, where the bank sizes its dots (by absolute magnitude, in tiers). */
    readonly paletteRadiusPx?: readonly number[];
    readonly levels?: readonly CataloguePointLevel[];
    /** A bank without levels is whole within this camera distance of its origin, in its units (10 kpc when absent), and
     * thinned with the distance beyond it. */
    readonly fullDetailUnits?: number;
    /** The most of its dots a bank shows on screen at once: past it, an even, stable share of them is drawn. */
    readonly screenBudget?: number;
    /** The whole bank fades out as the view's half-width at its origin shrinks from the first to the second, evenly in its
     * logarithm, and draws nothing below it: a bank that shapes a galaxy from outside, too busy from within. */
    readonly fadeOutUnits?: readonly [number, number];
    /** Seen from outside its reach, the bank draws at most one dot per this many square pixels of its projected shape
     * (PIXELS_PER_DOT when absent): a bank inside a sparser field matches the field's density, so its edge does not show. */
    readonly outsidePixelsPerDot?: number };
  /** Each point's position, and its palette color (and radius, where the palette sizes its dots) when the bank has a palette. */
  readonly points: readonly { readonly positionUnits: VolumeVector; readonly colorCss: string; readonly radiusPx: number }[];
  /** The bank's prepared shape around its origin, written by the bake that published it. */
  readonly spread: CataloguePointSpread;
  /** Its points' prepared cells: boxes the projection skips whole when they are out of view. */
  readonly cells: CatalogueCells;
}

/** A prepared catalogue-point bank: fixed 3D positions of a published catalogue and how to draw them. */
export function readCataloguePointBank(value: unknown, at = 'catalogue points'): PreparedCataloguePointBank {
  const steps = parseCataloguePointSteps(value, at, Infinity);
  for (;;) { const step = steps.next(); if (step.done) return step.value; }
}

/** The same reading in steps, for a reader that paces it: each step reads up to `chunk` more points, and the last returns
 * the bank. Read in one call, the nearby galaxies' 39,916 points were 30 ms of one frame of a zoom on the iPad (2026-10-03). */
export function* parseCataloguePointSteps(value: unknown, at: string, chunk: number): Generator<void, PreparedCataloguePointBank, void> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${at} must be an object.`);
  const data = value as Record<string, unknown>;
  if (data.schema !== CATALOGUE_POINTS_SCHEMA || typeof data.id !== 'string' || !data.id) throw new TypeError(`${at}: expected a ${CATALOGUE_POINTS_SCHEMA} bank with an id.`);
  const frame = parseDensityVolumeFrame(data.frame);
  const appearance = data.appearance as Record<string, unknown> | undefined;
  const colorCss = appearance?.colorCss, radiusPx = appearance?.radiusPx, opacity = appearance?.opacity, palette = appearance?.palette, levels = appearance?.levels;
  const screenBudget = appearance?.screenBudget, fullDetailUnits = appearance?.fullDetailUnits, fadeOutUnits = appearance?.fadeOutUnits;
  const outsidePixelsPerDot = appearance?.outsidePixelsPerDot;
  if (outsidePixelsPerDot !== undefined && !(typeof outsidePixelsPerDot === 'number' && outsidePixelsPerDot > 0 && Number.isFinite(outsidePixelsPerDot))) {
    throw new TypeError(`${String(data.id)}: outsidePixelsPerDot is a positive number of square pixels, got ${JSON.stringify(outsidePixelsPerDot)}.`);
  }
  if (fadeOutUnits !== undefined && !(Array.isArray(fadeOutUnits) && fadeOutUnits.length === 2 && fadeOutUnits.every(value => typeof value === 'number' && Number.isFinite(value))
      && fadeOutUnits[0] > fadeOutUnits[1] && fadeOutUnits[1] > 0)) {
    throw new TypeError(`${String(data.id)}: fadeOutUnits is [from, to], from above to above 0, got ${JSON.stringify(fadeOutUnits)}.`);
  }
  if (fullDetailUnits !== undefined && (levels !== undefined || typeof fullDetailUnits !== 'number' || !(fullDetailUnits > 0 && Number.isFinite(fullDetailUnits)))) {
    throw new TypeError(`${String(data.id)}: fullDetailUnits is a positive distance on a bank without levels, got ${JSON.stringify(fullDetailUnits)}.`);
  }
  if (screenBudget !== undefined && !(Number.isSafeInteger(screenBudget) && (screenBudget as number) > 0)) {
    throw new TypeError(`${String(data.id)}: catalogue point screenBudget must be a positive whole number, got ${JSON.stringify(screenBudget)}.`);
  }
  const hex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/iu.test(value);
  if (!hex(colorCss) || typeof radiusPx !== 'number' || !(radiusPx > 0) ||
      typeof opacity !== 'number' || !(opacity > 0 && opacity <= 1)) throw new TypeError(`${data.id}: catalogue point appearance needs a hex color, a positive radius and an opacity in (0, 1].`);
  // A palette entry may carry its own opacity as a fourth byte (#rrggbbaa).
  const entry = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/iu.test(value);
  if (palette !== undefined && (!Array.isArray(palette) || !palette.length || !palette.every(entry))) throw new TypeError(`${data.id}: a catalogue point palette is a list of hex colors, with an optional alpha byte.`);
  const paletteRadiusPx = appearance?.paletteRadiusPx;
  if (paletteRadiusPx !== undefined && (!Array.isArray(palette) || !Array.isArray(paletteRadiusPx) || paletteRadiusPx.length !== palette.length
      || !paletteRadiusPx.every(value => typeof value === 'number' && value > 0 && Number.isFinite(value)))) {
    throw new TypeError(`${data.id}: paletteRadiusPx holds one positive radius per palette color.`);
  }
  if (!Array.isArray(data.points) || !data.points.length || data.points.length > MAX_CATALOGUE_POINTS) {
    throw new TypeError(`${data.id}: a catalogue point bank holds 1 to ${MAX_CATALOGUE_POINTS} points, got ${Array.isArray(data.points) ? data.points.length : 'none'}.`);
  }
  const parsedLevels = levels === undefined ? undefined : parseLevels(levels, data.points.length, data.id);
  if (parsedLevels?.some(level => level.screenBudget !== undefined) && screenBudget === undefined) {
    throw new TypeError(`${data.id}: a level's screenBudget moves the bank's, so the bank needs a screenBudget too.`);
  }
  const spread = parseCataloguePointSpread(data.spread, `${data.id} (${at})`);
  const width = palette ? 4 : 3;
  const rows = data.points as unknown[], points = new Array<PreparedCataloguePointBank['points'][number]>(rows.length);
  for (let index = 0; index < rows.length; index++) {
    if (index && index % chunk === 0) yield;
    const point = rows[index];
    if (!Array.isArray(point) || point.length !== width || !point.every(axis => typeof axis === 'number' && Number.isFinite(axis))) {
      throw new TypeError(`${data.id}: point ${index} must be ${width} finite numbers${palette ? ' (x, y, z and a palette index)' : ''}.`);
    }
    // Every palette entry was checked above, so an index names a color or nothing.
    const color: unknown = palette ? palette[point[3]] : colorCss;
    if (typeof color !== 'string') throw new TypeError(`${data.id}: point ${index} names palette color ${point[3]}, which the palette of ${palette!.length} lacks.`);
    // A point and its position are plain values, read-only by type: freezing each of a bank's tens of thousands was
    // 80,000 freezes in one zoom out of Earth, which Safari pays for one array at a time (2026-10-04).
    points[index] = { positionUnits: [point[0], point[1], point[2]] as unknown as VolumeVector, colorCss: color,
      radiusPx: paletteRadiusPx ? (paletteRadiusPx as number[])[point[3]]! : radiusPx };
  }
  if (rows.length > chunk) yield;
  const cells = parseCatalogueCells(data.cells, data.points as number[][], parsedLevels?.map(level => level.points) ?? [points.length], `${data.id} (${at})`);
  return Object.freeze({ id: data.id, frame, appearance: Object.freeze({ colorCss, radiusPx, opacity,
    ...(palette ? { palette: Object.freeze([...palette]) } : {}), ...(paletteRadiusPx ? { paletteRadiusPx: Object.freeze([...paletteRadiusPx as number[]]) } : {}), ...(parsedLevels ? { levels: parsedLevels } : {}),
    ...(screenBudget === undefined ? {} : { screenBudget: screenBudget as number }),
    ...(fullDetailUnits === undefined ? {} : { fullDetailUnits: fullDetailUnits as number }),
    ...(outsidePixelsPerDot === undefined ? {} : { outsidePixelsPerDot }),
    ...(fadeOutUnits === undefined ? {} : { fadeOutUnits: Object.freeze([...fadeOutUnits as number[]]) as unknown as readonly [number, number] }) }),
    points, spread, cells });
}

function parseLevels(value: unknown, total: number, id: string): readonly CataloguePointLevel[] {
  const positive = (number: unknown): number is number => typeof number === 'number' && Number.isFinite(number) && number > 0;
  if (!Array.isArray(value) || value.length < 1) throw new TypeError(`${id}: a stacked bank has one or more levels.`);
  let before = Infinity, sum = 0;
  const parsed = value.map((raw: unknown, index: number): CataloguePointLevel => {
    const level = raw as { points?: unknown; fullDetailUnits?: unknown; appearUnits?: unknown; nearOpacity?: unknown; screenBudget?: unknown };
    if (!Number.isInteger(level?.points) || !((level.points as number) > 0)) throw new TypeError(`${id}: level ${index} needs its point count.`);
    sum += level.points as number;
    if (level.nearOpacity !== undefined && !(positive(level.nearOpacity) && level.nearOpacity <= 1)) {
      throw new TypeError(`${id}: level ${index} nearOpacity must be in (0, 1], got ${JSON.stringify(level.nearOpacity)}.`);
    }
    if (level.screenBudget !== undefined && (index === 0 || !(Number.isSafeInteger(level.screenBudget) && (level.screenBudget as number) > 0))) {
      throw new TypeError(`${id}: level ${index} screenBudget must be a positive whole number on an inner level, got ${JSON.stringify(level.screenBudget)}.`);
    }
    const near = { ...(level.nearOpacity === undefined ? {} : { nearOpacity: level.nearOpacity as number }),
      ...(level.screenBudget === undefined ? {} : { screenBudget: level.screenBudget as number }) };
    if (index === 0) {
      if (!positive(level.fullDetailUnits)) throw new TypeError(`${id}: the outermost level needs fullDetailUnits.`);
      before = level.fullDetailUnits;
      return Object.freeze({ points: level.points as number, fullDetailUnits: level.fullDetailUnits, ...near });
    }
    const window = level.appearUnits;
    if (!Array.isArray(window) || window.length !== 2 || !positive(window[0]) || !positive(window[1]) || !(window[0] > window[1]) || window[0] > before) {
      throw new TypeError(`${id}: level ${index} appears over a shrinking window starting no farther out than the level before it is whole, got ${JSON.stringify(window)}.`);
    }
    before = window[1];
    return Object.freeze({ points: level.points as number, appearUnits: Object.freeze([window[0], window[1]]) as readonly [number, number], ...near });
  });
  if (sum !== total) throw new TypeError(`${id}: the levels hold ${sum} points, the bank ${total}.`);
  return Object.freeze(parsed);
}
