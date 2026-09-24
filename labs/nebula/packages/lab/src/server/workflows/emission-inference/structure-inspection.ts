/** Prepared panels, conserved float fields and actual support atlases for any observation. */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { analyzeStructureMap, colorStructureLayer, structureLayers } from '@cssearth/nebula-reconstruction/evidence/structure-map';
import { createSupportAtlases } from '@cssearth/nebula-reconstruction/evidence/support-atlas';
import type { WaveletSettings } from '@cssearth/nebula-reconstruction/evidence/wavelets';
import { composeAffine, type Affine } from '@cssearth/nebula-reconstruction/registration/affine';

export function workingRasterToFrame(nativeToFrame: Affine, nativeWidth: number, nativeHeight: number, width: number, height: number): Affine {
  if (![nativeWidth, nativeHeight, width, height].every(n => Number.isInteger(n) && n > 0)) throw new TypeError('Invalid registered raster dimensions.');
  // Pixel edges remain identical after resizing. There is no inferred crop or half-pixel shift.
  return composeAffine(nativeToFrame, [nativeWidth / width, 0, 0, nativeHeight / height, 0, 0]);
}
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export async function writeStructureInspection(directory: string, rgb: Buffer, width: number, height: number, settings: WaveletSettings) {
  const started = performance.now(), result = analyzeStructureMap(rgb, width, height, settings);
  if (result.metrics.reconstructionMaxError > 1e-6) throw new Error('Structure partition lost source RGB.');
  const raster = async (file: string, bytes: Uint8Array) => {
    const png = await sharp(bytes, { raw: { width, height, channels: 3 } }).png().toBuffer();
    await writeFile(resolve(directory, file), png);
    return { file, sha256: sha(png) };
  };
  const field = async (file: string, values: Float32Array) => {
    const bytes = Buffer.alloc(values.length * 4);
    for (let i = 0; i < values.length; i++) bytes.writeFloatLE(values[i]!, i * 4);
    await writeFile(resolve(directory, file), bytes);
    return { file, values: values.length, sha256: sha(bytes) };
  };
  const source = await raster('source.png', rgb), combined = Buffer.alloc(rgb.length);
  const palette = { diffuse: [.65, .3, .85], arcs: [.1, .9, 1], knots: [1, .8, .15], unassigned: [1, .18, .15] };
  for (let p = 0; p < width * height; p++) {
    const weights = structureLayers.map(layer => result.fractions[layer][p]! * (layer === 'diffuse' ? 1 : 4));
    const sum = weights.reduce((a, b) => a + b, 0), gain = Math.sqrt(result.luminance[p]!);
    for (let c = 0; c < 3; c++) combined[p * 3 + c] = Math.round(255 * gain * structureLayers.reduce((total, layer, i) =>
      total + palette[layer][c]! * weights[i]!, 0) / Math.max(sum, 1e-30));
  }
  const panels = [
    { id: 'source', label: 'Source', ...source, description: 'Full native NOX diffuse image, resized once. No crop or new star removal.' },
    { id: 'combined', label: 'Combined', ...await raster('combined.png', combined), description: 'False-color evidence: violet diffuse, cyan ridges, gold compact, red unassigned. Detail ×4; square-root display brightness.' },
  ];
  const descriptions = {
    diffuse: 'Broad emission, including the outer field; ×1 display. Not a confirmed halo segmentation.',
    arcs: 'Directional ridge evidence across scales; ×4 display. A projected ridge may be a shell edge or filament.',
    knots: 'Fine compact evidence; ×4 display. Residual stars and NOX artifacts may remain.',
    unassigned: 'Unassigned source signal preserved separately; ×4 display.',
  };
  const fields = [];
  for (const layer of structureLayers) {
    const colored = colorStructureLayer(rgb, result.fractions[layer]), gain = layer === 'diffuse' ? 1 : 4;
    panels.push({ id: layer, label: layer[0]!.toUpperCase() + layer.slice(1),
      ...await raster(`${layer}.png`, Uint8Array.from(colored, value => Math.round(Math.min(1, value * gain) * 255))), description: descriptions[layer] });
    fields.push({ layer, rgb: await field(`${layer}-rgb.f32`, colored), fraction: await field(`${layer}-fraction.f32`, result.fractions[layer]) });
  }
  const directionField = await field('tangent-radians.f32', result.directions), support = createSupportAtlases(result.regions, width, height);
  const atlases = [];
  for (let i = 0; i < support.pages.length; i++) {
    const page = support.pages[i]!, file = `regions-${i}.png`;
    const bytes = await sharp(page.pixels, { raw: { width: page.width, height: page.height, channels: 4 } }).png().toBuffer();
    await writeFile(resolve(directory, file), bytes);
    atlases.push({ file, width: page.width, height: page.height, sha256: sha(bytes) });
  }
  return { dimensions: { width, height }, panels, fields, directionField, atlases, regions: support.regions, metrics: result.metrics,
    seconds: (performance.now() - started) / 1000, sourceImageSha256: sha(rgb),
    interpretation: { coordinates: 'Working raster pixel edges; imageToFrame uses native raster edges. Bounds are sprite placement, alpha is actual region support.',
      regionMetrics: 'Contrast is peak positive wavelet coefficient in display luminance [0,1]. Elongation is the weighted spatial major/minor axis ratio, with a 0.5px denominator floor.',
      relationships: 'Scale-plane components and overlap parents are image evidence, not identified physical objects or common depths.',
      accounting: 'Conserved component float fields sum to the source RGB. Boosted panel PNGs are inspection views, not additive scientific flux.' } };
}
