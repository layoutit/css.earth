type Vector3 = [number, number, number];

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

type SlabMaterial = ReturnType<typeof compilerSlabMaterial>;
/**
 * Fade chromaticity toward neutral where the delivered texel alpha is too small to carry it.
 * Browsers composite premultiplied 8-bit colour: at alpha 1–3 each channel rounds to a few levels,
 * and stacked slabs turn that rounding into strong false tints. Alpha is computed exactly as the
 * emission bake does (1 − exp(−exposure · ∫emission)); colour reaches full strength at `fullChromaAlphaByte`.
 */
export function alphaLimitedSlabMaterial(material: SlabMaterial, sampleEmission: Sample, exposureGain: number, fullChromaAlphaByte: number): SlabMaterial {
  if (!(exposureGain > 0) || !Number.isFinite(exposureGain) || !(fullChromaAlphaByte >= 1) || fullChromaAlphaByte > 255)
    throw new TypeError('Alpha-limited material requires positive exposure and a full-chroma alpha byte in 1..255.');
  const emission: Vector3 = [0, 0, 0];
  return (x, y, z, out, slab) => {
    if (!material(x, y, z, out, slab)) return false;
    let integrated = 0;
    for (let i = 0; i < slab.samples; i++) {
      const offset = slab.pitch * ((i + .5) / slab.samples - .5);
      sampleEmission(x + (slab.axis === 'x' ? offset : 0), y + (slab.axis === 'y' ? offset : 0), z + (slab.axis === 'z' ? offset : 0), emission);
      integrated += Math.max(0, emission[0]) * slab.pitch / slab.samples;
    }
    const trust = Math.min(1, 255 * -Math.expm1(-exposureGain * integrated) / fullChromaAlphaByte);
    for (let c = 0; c < 3; c++) out[c] = Math.min(255, Math.max(0, 255 - (255 - out[c]!) * trust));
    return true;
  };
}
