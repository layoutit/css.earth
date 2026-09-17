/** Prepared catalogue contract. Historical schema identifiers are preserved byte-for-byte. */
import type { DensityVolumeFrame } from './volume-frame.ts';

export interface PreparedLmcStar {
  id: string; raDeg: number; decDeg: number; magnitude: number; colorIndexBv: number | null; spectralType: string;
  positionUnits: [number, number, number]; sizePx: number; colorCss: string; opacity: number;
  cloudSignal: number; cloudPartIds: string[];
}
export interface PreparedLmcStars {
  /** The historical LMC schema fixes its id and 'Bonanos2009:' star prefix; the generic schema declares both. */
  schema: 'cssearth-lmc-stars@1' | 'cssearth-catalogue-stars@1'; id: string; frame: DensityVolumeFrame;
  magnitudeBand: 'V'; stars: PreparedLmcStar[]; sourceUrl: string; credit: string; depthAssumption: string; provenance: unknown;
  starIdPrefix?: string;
}
const finiteArray = (v: unknown, length: number): v is number[] =>
  Array.isArray(v) && v.length === length && v.every(Number.isFinite);

export function parsePreparedLmcStars(value: unknown, expectedFrame: DensityVolumeFrame): PreparedLmcStars {
  const payload = value as PreparedLmcStars;
  const historical = payload?.schema === 'cssearth-lmc-stars@1';
  const prefix = historical ? 'Bonanos2009:' : payload?.starIdPrefix;
  if (!payload || (historical ? payload.id !== 'lmc-stars' || payload.starIdPrefix !== undefined :
        payload.schema !== 'cssearth-catalogue-stars@1' || typeof payload.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(payload.id)) ||
      typeof prefix !== 'string' || !/^[A-Za-z0-9]{1,32}:$/.test(prefix) ||
      payload.magnitudeBand !== 'V' || !payload.frame || !Array.isArray(payload.stars) || payload.stars.length < 1 || payload.stars.length > 2000 ||
      typeof payload.sourceUrl !== 'string' || !payload.sourceUrl.startsWith('https://') ||
      typeof payload.credit !== 'string' || typeof payload.depthAssumption !== 'string') throw new TypeError('Invalid prepared catalogue stars.');
  const f = payload.frame;
  if (!finiteArray(f.originM, 3) || !finiteArray(f.localToReferenceXyzw, 4) || !Number.isFinite(f.metersPerUnit) || f.metersPerUnit <= 0 ||
      Math.abs(Math.hypot(...f.localToReferenceXyzw) - 1) > 1e-10) throw new TypeError('Invalid prepared star frame.');
  for (const key of ['referenceFrame', 'epochJdTt', 'originM', 'localToReferenceXyzw', 'metersPerUnit'] as const)
    if (JSON.stringify(f[key]) !== JSON.stringify(expectedFrame[key])) throw new TypeError('Prepared stars and cloud use different physical frames.');
  const ids = new Set<string>();
  for (const star of payload.stars) {
    if (!star || typeof star.id !== 'string' || !star.id.startsWith(prefix) || star.id.length === prefix.length || star.id.length > 100 || ids.has(star.id) ||
        typeof star.spectralType !== 'string' || !finiteArray(star.positionUnits, 3) || !Number.isFinite(star.raDeg) || star.raDeg < 0 || star.raDeg >= 360 ||
        !Number.isFinite(star.decDeg) || Math.abs(star.decDeg) > 90 || !Number.isFinite(star.magnitude) ||
        !Number.isFinite(star.cloudSignal) || star.cloudSignal < 0 || star.cloudSignal > 1 ||
        !Array.isArray(star.cloudPartIds) || !star.cloudPartIds.length || star.cloudPartIds.some(id => typeof id !== 'string' || !id) ||
        new Set(star.cloudPartIds).size !== star.cloudPartIds.length ||
        !(star.colorIndexBv === null || Number.isFinite(star.colorIndexBv)) || !Number.isFinite(star.sizePx) || star.sizePx < .5 || star.sizePx > 4 ||
        !Number.isFinite(star.opacity) || star.opacity < 0 || star.opacity > 1 || !/^#[0-9a-f]{6}$/i.test(star.colorCss))
      throw new TypeError('Invalid prepared catalogue star point.');
    ids.add(star.id);
  }
  return payload;
}
