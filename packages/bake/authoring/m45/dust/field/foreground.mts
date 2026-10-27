import type { Vec } from '../physics/types.mts';

/** Local z is normal depth minus136pc; the solar origin approximates Earth's position. */
export const EARTH_EYE_PC: Vec = [0, 0, -136];

interface ForegroundField {
  inputs: { stars: readonly { name: string; at: readonly [number, number, number] }[] };
  near(x: number, y: number, z: number): number;
  density(x: number, y: number, z: number): number;
}

export function foregroundSelection(field: ForegroundField) {
  if (!field.inputs.stars.length) throw new Error('Illuminating stars are required');
  const starPlaneZPc = Math.min(...field.inputs.stars.map(star => star.at[2]));
  if (!Number.isFinite(starPlaneZPc) || starPlaneZPc <= EARTH_EYE_PC[2]) throw new Error('Invalid foreground interval');
  const selected = (x: number, y: number, z: number) => z > EARTH_EYE_PC[2] && z < starPlaneZPc ? field.near(x, y, z) : 0;
  const remaining = (x: number, y: number, z: number) => Math.max(0, field.density(x, y, z) - selected(x, y, z));
  return {
    earthEye: [...EARTH_EYE_PC] as Vec, starPlaneZPc, selected, remaining,
    metadata: {
      method: 'Select existing near-cloud material strictly between the fixed Earth origin and every adopted illuminating-star normal depth',
      coordinate: 'pc east/north/away from Earth; z=normal depth minus136pc',
      earthEyePc: [...EARTH_EYE_PC], starPlaneZPc,
      stellarNormalDepthsPc: field.inputs.stars.map(star => ({ name: star.name, normalDepthPc: 136 + star.at[2] })),
      densityModified: false, selectedColumnRenormalized: false, backgroundMaterialMovedForward: false,
      assumptions: [
        'The adopted bright-star136.7pc normal-depth plane is a conditional realization, not measured individual distances.',
        'The foreground restriction selects a reflection component; it is not evidence of a sharp physical cloud boundary.',
        'The solar origin is used for the Earth reference; the AU-scale orbital offset is unresolved by these dust data.',
        'Reference Earth illumination and outgoing attenuation are frozen for all preview cameras by the fixed reference model; this is not angle-correct radiative transfer.',
        'All other dust contributes only fixed Galactic illumination; the full density remains in attenuation caches.'
      ]
    }
  };
}
