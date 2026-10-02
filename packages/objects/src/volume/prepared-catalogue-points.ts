import { parseDensityVolumeFrame, type DensityVolumeFrame, type VolumeVector } from '../density-volume.js';

export interface PreparedCataloguePoint {
  readonly id: string;
  readonly positionUnits: VolumeVector;
  /** Final prepared presentation, including saved size, exposure and support. */
  readonly sizePx: number;
  /** Optional physical footprint; historical catalogue points retain fixed screen sizes. */
  readonly diameterUnits?: number;
  readonly colorCss: string;
  readonly opacity: number;
}
export interface PreparedCataloguePoints {
  readonly frame: DensityVolumeFrame;
  readonly points: readonly PreparedCataloguePoint[];
}

export function validatePreparedCataloguePoints(input: unknown): PreparedCataloguePoints {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Prepared catalogue points must be an object.');
  const value = input as PreparedCataloguePoints;
  const frame = parseDensityVolumeFrame(value.frame);
  if (!Array.isArray(value.points)) throw new TypeError('Prepared catalogue points need a fixed point array.');
  const ids = new Set<string>();
  const points = value.points.map(point => {
    if (!point || typeof point.id !== 'string' || !point.id || ids.has(point.id) ||
        !Array.isArray(point.positionUnits) || point.positionUnits.length !== 3 || !point.positionUnits.every(Number.isFinite) ||
        !Number.isFinite(point.sizePx) || point.sizePx <= 0 ||
        (point.diameterUnits !== undefined && (!Number.isFinite(point.diameterUnits) || point.diameterUnits <= 0)) || !Number.isFinite(point.opacity) || point.opacity < 0 || point.opacity > 1 ||
        typeof point.colorCss !== 'string' || !/^#[0-9a-f]{6}$/iu.test(point.colorCss)) {
      throw new TypeError('Prepared catalogue point identity, position or presentation is invalid.');
    }
    ids.add(point.id);
    return Object.freeze({ id: point.id, positionUnits: Object.freeze([...point.positionUnits]) as VolumeVector,
      sizePx: point.sizePx, ...(point.diameterUnits === undefined ? {} : { diameterUnits: point.diameterUnits }), colorCss: point.colorCss, opacity: point.opacity });
  });
  return Object.freeze({ frame, points: Object.freeze(points) });
}

