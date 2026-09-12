import sharp from 'sharp';
import { detectStars } from '../../alignment/observations/registration';
import type { CompilerImage } from './images';
import type { EmissionFieldModel } from './field-types';
import { createEmissionField } from './field';
import type { CompilerStarInput } from './bake';
const fraction = (id: string) => { let hash = 2166136261; for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619); return ((hash >>> 0) + .5) / 4294967296; };
/** Observed xy/relative light; conditional z follows the fitted emission column, never image-layer index. */
export async function compilerStars(image: CompilerImage, model: EmissionFieldModel, maximum: number): Promise<CompilerStarInput[]> {
  if (!maximum) return [];
  const bytes = await sharp(image.stars.data, { raw: { width: image.stars.width, height: image.stars.height, channels: 3 } }).png().toBuffer();
  const detected = await detectStars(bytes, [image.nativeWidth, image.nativeHeight]), field = createEmissionField(model), output: CompilerStarInput[] = [];
  const count = 128, dz = (field.bounds.max[2] - field.bounds.min[2]) / count, samples = new Float64Array(count), light: [number, number, number] = [0, 0, 0];
  const brightest = detected[0]?.peak ?? 255;
  for (let index = 0; index < detected.length && output.length < maximum; index++) {
    const star = detected[index]!, [x, y] = image.pixelToSky(...star.point); let total = 0;
    if (x < field.bounds.min[0] || x > field.bounds.max[0] || y < field.bounds.min[1] || y > field.bounds.max[1]) continue;
    for (let k = 0; k < count; k++) { field.sampleEmission(x, y, field.bounds.min[2] + (k + .5) * dz, light); samples[k] = light[0]; total += light[0]; }
    if (total * dz < .025) continue;
    const id = `${image.id}-${index}`, chosen = fraction(id) * total; let cumulative = 0, slot = count - 1;
    for (let k = 0; k < count; k++) { cumulative += samples[k]!; if (cumulative >= chosen) { slot = k; break; } }
    const z = field.bounds.min[2] + (slot + .5) * dz;
    if (!image.sampleOriginal(x, y, light)) continue;
    const peak = Math.max(...light, 1), strength = Math.max(.02, Math.min(1, star.peak / brightest));
    const rgb: [number, number, number] = [0, 0, 0]; for (let c = 0; c < 3; c++) rgb[c] = Math.round(255 * (.35 + .65 * light[c]! / peak));
    output.push({ id, positionArcsec: [x, y, z], rgb, widthPx: .75 + 2.25 * Math.sqrt(strength), alpha: .18 + .8 * Math.sqrt(strength) });
  }
  return output;
}
