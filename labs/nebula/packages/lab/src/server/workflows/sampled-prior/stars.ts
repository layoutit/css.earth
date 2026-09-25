import { createCompilerStarPhotometer, compilerStarLensPoints, detectCompilerStarCandidates } from '@cssearth/nebula-reconstruction/stars/compiler';
import type { CompilerImage } from '../compiler/images.ts';
import type { CompilerStarInput } from '../compiler/bake.ts';
import type { CompilerStarMaterial, SpatialField } from '@cssearth/bake/volume';
import type { SampledRecipe } from '../../../features/sampled-prior/model.ts';

export async function sampledStars(reference: CompilerImage, images: CompilerImage[], field: SpatialField, maximum: number,
  pulsar: SampledRecipe['pulsar']): Promise<CompilerStarInput[]> {
  const detected = await detectCompilerStarCandidates(reference);
  const points = detected.map(s => s.point), photometers = images.map(image => ({ id: image.id,
    measure: createCompilerStarPhotometer(image, compilerStarLensPoints(reference, image, points)).measure }));
  const meter = photometers.find(m => m.id === reference.id)!;
  const candidates = detected.flatMap((star, index) => {
    const light = meter.measure(index); return light ? [{ star, index, light, energy: Math.max(...light.measurement.residualDisplayEnergyRgb) }] : [];
  }).sort((a, b) => b.energy - a.energy);
  const output: CompilerStarInput[] = [], count = 128, dz = (field.bounds.max[2] - field.bounds.min[2]) / count;
  const sample: [number, number, number] = [0, 0, 0], column = new Float64Array(count);
  for (const { star, index, light } of candidates) {
    if (output.length >= maximum) break;
    const [x, y] = reference.pixelToSky(...star.point);
    // The named central source must never be double-counted as a residual marker.
    if (pulsar && Math.hypot(x - pulsar.positionArcsec[0], y - pulsar.positionArcsec[1]) < Math.max(2, light.diameterUnits)) continue;
    let total = 0;
    for (let i = 0; i < count; i++) { field.sampleEmission(x, y, field.bounds.min[2] + (i + .5) * dz, sample); column[i] = sample[0]; total += sample[0]; }
    if (!(total > 0)) continue;
    const fraction = ((Math.imul(index + 1, 2654435761) >>> 0) + .5) / 4294967296;
    let sum = 0, chosen = count - 1;
    for (let i = 0; i < count; i++) { sum += column[i]!; if (sum >= fraction * total) { chosen = i; break; } }
    const materials: Record<string, CompilerStarMaterial> = {};
    for (const meter of photometers) {
      const measured = meter.measure(index);
      materials[meter.id] = measured ? { rgb: measured.rgb, diameterUnits: measured.diameterUnits, alpha: measured.alpha } :
        { rgb: [0, 0, 0], diameterUnits: light.diameterUnits, alpha: 0 };
    }
    output.push({ id: `${reference.id}-${index}`, positionArcsec: [x, y, field.bounds.min[2] + (chosen + .5) * dz],
      rgb: light.rgb, diameterUnits: light.diameterUnits, alpha: light.alpha, materials });
  }
  if (pulsar) output.push({ id: pulsar.id, positionArcsec: [...pulsar.positionArcsec], rgb: [...pulsar.rgb],
    diameterUnits: pulsar.diameterArcsec, alpha: pulsar.alpha,
    materials: Object.fromEntries(images.map(image => [image.id, { rgb: [...pulsar.rgb], diameterUnits: pulsar.diameterArcsec, alpha: pulsar.alpha }])) });
  return output;
}
