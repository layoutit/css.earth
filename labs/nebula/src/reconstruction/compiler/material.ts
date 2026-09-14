import type { Vector3 } from '../../../../../src/preparation/volume/config';

type Sample = (x: number, y: number, z: number, out: Vector3) => void;
type MaterialSample = (x: number, y: number, z: number, out: Vector3) => boolean;
/** Color follows the same emitting sub-samples as neutral alpha, not an empty slab midpoint. */
export function compilerSlabMaterial(sampleEmission: Sample, sampleMaterial: MaterialSample) {
  const emission: Vector3 = [0, 0, 0], color: Vector3 = [0, 0, 0];
  return (x: number, y: number, z: number, out: Vector3, slab: { axis: 'x' | 'y' | 'z'; pitch: number; samples: number }): boolean => {
    let weight = 0, covered = 0;
    out[0] = out[1] = out[2] = 0;
    for (let i = 0; i < slab.samples; i++) {
      const offset = slab.pitch * ((i + .5) / slab.samples - .5);
      const sx = x + (slab.axis === 'x' ? offset : 0), sy = y + (slab.axis === 'y' ? offset : 0), sz = z + (slab.axis === 'z' ? offset : 0);
      sampleEmission(sx, sy, sz, emission); const light = emission[0];
      if (!(light > 0)) continue;
      weight += light;
      const observed = sampleMaterial(sx, sy, sz, color);
      if (observed && color.some(channel => !Number.isFinite(channel) || channel < 0 || channel > 255))
        throw new TypeError('Compiler 3D material must return finite RGB chromaticity in 0..255.');
      if (observed) covered += light;
      // Missing/black source material retains the same neutral contribution as other lab lenses.
      // Component colors are already normalized. Renormalizing their local mixture would alter them.
      for (let c = 0; c < 3; c++) out[c] += light * (observed ? color[c]! / 255 : 1);
    }
    if (!(weight > 0) || !(covered > 0)) return false;
    for (let c = 0; c < 3; c++) out[c] = Math.min(255, Math.max(0, 255 * out[c]! / weight));
    return true;
  };
}
