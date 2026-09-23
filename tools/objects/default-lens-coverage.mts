/** Where a body's default map has data, read from its prepared minimap: the gray gap fill the lanes paint is found by its
 * graticule (`detectMissingCoverage`) and placed on the body through the surface map's left edge and the minimap's framing.
 * The default camera turns toward this data (`prepareDefaultCameraAngles`); nothing here decides what counts as data. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import type { Vector3 } from '../../src/renderers/css/solar-system/types.ts';
import { detectMissingCoverage } from '../../src/platform/prepare-missing-coverage.mts';
import { isRecord } from '../sources/source-values.mts';

const DEGREE = Math.PI / 180;
export interface LensCoverage { readonly lens: string; readonly missing: Uint8Array; readonly width: number; readonly height: number;
  /** Body east longitude of the minimap's left edge, in degrees. */
  readonly leftEdgeLongitudeDeg: number }

const optionalJson = async (path: string): Promise<unknown> => {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (isRecord(error) && error.code === 'ENOENT') return undefined; throw error; }
};

/** The default lens's coverage, or none for a body without prepared lenses or a minimap of its default lens. */
export async function readDefaultLensCoverage(objectDirectory: string, mapLeftEdgeLongitudeDeg: number): Promise<LensCoverage | undefined> {
  const [controls, minimaps, framing] = await Promise.all([optionalJson(resolve(objectDirectory, 'prepared/controls.json')),
    optionalJson(resolve(objectDirectory, 'prepared/minimaps.json')), optionalJson(resolve(objectDirectory, 'source/presentation/minimap.json'))]);
  const lens = isRecord(controls) && isRecord(controls.lenses) && typeof controls.lenses.defaultLens === 'string' ? controls.lenses.defaultLens : undefined;
  const image = lens && isRecord(minimaps) && Array.isArray(minimaps.images) ? minimaps.images.find(entry => isRecord(entry) && entry.id === lens) : undefined;
  if (!lens || !isRecord(image)) return undefined;
  if (typeof image.path !== 'string') throw new TypeError(`${objectDirectory}: minimap ${lens} has no path.`);
  const center = isRecord(framing) ? framing.centerLongitudeDegrees : undefined;
  if (center !== undefined && typeof center !== 'number') throw new TypeError(`${objectDirectory}: minimap framing centerLongitudeDegrees is ${String(center)}, not a number.`);
  // prepare-surface-minimaps rolls a framed map so its left edge is map longitude (center - 180).
  const offset = center === undefined ? 0 : ((center - 180) % 360 + 360) % 360;
  const { data, info } = await sharp(resolve(objectDirectory, 'prepared', image.path)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const missing = detectMissingCoverage(data, info, { longitudeOffsetDegrees: offset });
  return Object.freeze({ lens, missing, width: info.width, height: info.height, leftEdgeLongitudeDeg: mapLeftEdgeLongitudeDeg + offset });
}

function eachPixel(coverage: LensCoverage, visit: (direction: Vector3, area: number, covered: boolean) => void) {
  const { width, height, missing, leftEdgeLongitudeDeg } = coverage;
  for (let y = 0; y < height; y++) {
    const latitude = (90 - (y + 0.5) * 180 / height) * DEGREE, area = Math.cos(latitude);
    for (let x = 0; x < width; x++) {
      const longitude = (leftEdgeLongitudeDeg + (x + 0.5) * 360 / width) * DEGREE;
      visit([Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude)] as unknown as Vector3,
        area, !missing[y * width + x]);
    }
  }
}

/** The area-weighted mean body-fixed direction of the covered pixels; its length says how lopsided the data is. */
export function coverageDirection(coverage: LensCoverage): Vector3 {
  const sum = [0, 0, 0]; let area = 0;
  eachPixel(coverage, (direction, weight, covered) => {
    if (!covered) return;
    area += weight;
    for (let axis = 0; axis < 3; axis++) sum[axis]! += weight * direction[axis]!;
  });
  return (area > 0 ? sum.map(value => value / area) : sum) as unknown as Vector3;
}

/** The share of the visible disc, by projected area, that shows data when the view is centred on `toward`. */
export function visibleCoverageShare(coverage: LensCoverage, toward: Vector3): number {
  const length = Math.hypot(...toward); let shown = 0, total = 0;
  eachPixel(coverage, (direction, area, covered) => {
    const facing = (direction[0] * toward[0] + direction[1] * toward[1] + direction[2] * toward[2]) / length;
    if (facing <= 0) return;
    total += facing * area;
    if (covered) shown += facing * area;
  });
  return total > 0 ? shown / total : 0;
}
