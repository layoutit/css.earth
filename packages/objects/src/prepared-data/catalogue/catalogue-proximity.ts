import { parseDensityVolumeFrame, type DensityVolumeFrame, type VolumeVector } from '../../density-volume.js';

export const PREPARED_CATALOGUE_PROXIMITY_SCHEMA = 'cssearth-catalogue-proximity@1';

/** Lightweight admission metadata; contains no stellar positions or photometry. */
export interface PreparedCatalogueProximity {
  readonly schema: typeof PREPARED_CATALOGUE_PROXIMITY_SCHEMA;
  readonly frame: DensityVolumeFrame;
  readonly disc: { readonly centerUnits: VolumeVector; readonly radiusUnits: number; readonly halfHeightUnits: number; readonly fadeFraction: number };
  readonly levels: readonly { readonly file: string; readonly appearUnits?: readonly [number, number]; readonly nearOpacity: number }[];
}
export function parseCatalogueProximity(value: unknown): PreparedCatalogueProximity {
  const fail = (): never => { throw new TypeError('Invalid prepared catalogue proximity metadata.'); };
  if (!value || typeof value !== 'object') return fail();
  const v = value as Record<string, unknown>, d = v.disc as Record<string, unknown> | undefined;
  if (v.schema !== PREPARED_CATALOGUE_PROXIMITY_SCHEMA || !d || typeof d !== 'object' || !Array.isArray(d.centerUnits) || d.centerUnits.length !== 3 ||
    !d.centerUnits.every(n => typeof n === 'number' && Number.isFinite(n)) || ![d.radiusUnits,d.halfHeightUnits].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0) ||
    typeof d.fadeFraction !== 'number' || !(d.fadeFraction > 0 && d.fadeFraction < 1) || !Array.isArray(v.levels) || v.levels.length < 1) return fail();
  const levels = v.levels.map((level: unknown) => {
    if (!level || typeof level !== 'object') return fail();
    const e = level as Record<string, unknown>, w = e.appearUnits;
    if (typeof e.file !== 'string' || !/^[a-z0-9-]+\.bin$/u.test(e.file) || typeof e.nearOpacity !== 'number' || !(e.nearOpacity > 0 && e.nearOpacity <= 1) ||
      w !== undefined && !(Array.isArray(w) && w.length === 2 && w.every(n => typeof n === 'number' && Number.isFinite(n)) && w[0] > w[1] && w[1] > 0)) return fail();
    return { file: e.file, nearOpacity: e.nearOpacity, ...(w ? { appearUnits: w as [number,number] } : {}) };
  });
  if (new Set(levels.map(l => l.file)).size !== levels.length) return fail();
  return { schema: v.schema, frame: parseDensityVolumeFrame(v.frame), disc: { centerUnits: d.centerUnits as unknown as VolumeVector,
    radiusUnits: d.radiusUnits as number, halfHeightUnits: d.halfHeightUnits as number, fadeFraction: d.fadeFraction }, levels };
}
