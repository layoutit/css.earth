import type { ObservationPhoto, ObservationMapping } from '@cssearth/bake/volume';
export type { ObservationPhoto } from '@cssearth/bake/volume';
/** Offline photographic targets and independent projection checks for the filled-volume experiment. */
import sharp from 'sharp';
import type { FilledComponentsResult } from './filled-components.ts';

type Vec3 = [number, number, number];
type Bounds = { min: Vec3; max: Vec3 };
/** Read native pixels first, then sample their registered sky rays into a north-up tangent plane. */
export async function rectifyObservation(bytes: Buffer, mapping: ObservationMapping, width: number): Promise<ObservationPhoto> {
  if (!Number.isInteger(width) || width < 16 || width > 2048) throw new TypeError('Observation width must be 16–2048 pixels.');
  // Prefilter from the native source before the projective resampling, avoiding point-sampled stellar aliasing.
  // Pinned observatory TIFFs can contain strips larger than libtiff's default
  // allocation limit. Match the verified-original decoder used by star removal.
  const source = await sharp(bytes, { unlimited: true }).toColourspace('srgb').removeAlpha()
    .resize({ width: width * 2, height: width * 2, fit: 'inside', withoutEnlargement: true })
    .raw().toBuffer({ resolveWithObject: true });
  // A source that declares its own coverage keeps it: alpha 0 means unobserved, never zero brightness. The
  // prefilter would blend masked pixels into their neighbours, so coverage is resampled from the native alpha.
  const declared = (await sharp(bytes, { unlimited: true }).metadata()).hasAlpha === true;
  const alpha = declared ? await sharp(bytes, { unlimited: true }).ensureAlpha().extractChannel(3)
    .resize({ width: width * 2, height: width * 2, fit: 'inside', withoutEnlargement: true, kernel: 'nearest' })
    .raw().toBuffer({ resolveWithObject: true }) : null;
  if (alpha && (alpha.info.width !== source.info.width || alpha.info.height !== source.info.height))
    throw new Error('Observation coverage channel differs from its own pixel grid.');
  const { min, max } = mapping.boundsUnits;
  const height = Math.max(1, Math.round(width * (max[1] - min[1]) / (max[0] - min[0])));
  if (width * height > 4_194_304) throw new TypeError('Rectified image exceeds four million pixels.');
  const rgb = new Uint8Array(width * height * 3), intensity = new Float32Array(width * height);
  const sourceCoverage = alpha ? new Uint8Array(width * height) : undefined;
  let coveredPixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const uv = mapping.uvAtTangent(min[0] + (x + .5) / width * (max[0] - min[0]),
      max[1] - (y + .5) / height * (max[1] - min[1]));
    if (!uv) continue;
    coveredPixels++;
    const sx = Math.max(0, Math.min(source.info.width - 1, uv[0] * source.info.width - .5));
    const sy = Math.max(0, Math.min(source.info.height - 1, uv[1] * source.info.height - .5));
    const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(x0 + 1, source.info.width - 1), y1 = Math.min(y0 + 1, source.info.height - 1);
    const tx = sx - x0, ty = sy - y0, p = y * width + x;
    if (alpha && sourceCoverage) {
      // Any masked contributor makes the resampled pixel unobserved; a mask must not shrink by interpolation.
      const taps = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]] as const;
      sourceCoverage[p] = taps.every(([xx, yy]) => alpha.data[yy * alpha.info.width + xx]! >= 250) ? 1 : 0;
    }
    for (let c = 0; c < 3; c++) {
      const at = (xx: number, yy: number) => source.data[(yy * source.info.width + xx) * source.info.channels + c]!;
      rgb[3 * p + c] = Math.round((at(x0, y0) * (1 - tx) + at(x1, y0) * tx) * (1 - ty) +
        (at(x0, y1) * (1 - tx) + at(x1, y1) * tx) * ty);
    }
    intensity[p] = (rgb[3 * p]! * .2126 + rgb[3 * p + 1]! * .7152 + rgb[3 * p + 2]! * .0722) / 255;
  }
  return { width, height, rgb, intensity, coveredPixels, ...(sourceCoverage ? { sourceCoverage } : {}) };
}

export async function writeObservationPanel(path: string, photo: ObservationPhoto, channel?: Float32Array, eastLeft = true) {
  const rgb = Buffer.from(photo.rgb);
  if (channel) for (let p = 0; p < channel.length; p++) {
    const ratio = photo.intensity[p]! > 0 ? channel[p]! / photo.intensity[p]! : 0;
    for (let c = 0; c < 3; c++) rgb[3 * p + c] = Math.round(Math.max(0, Math.min(255, rgb[3 * p + c]! * ratio)));
  }
  let image = sharp(rgb, { raw: { width: photo.width, height: photo.height, channels: 3 } });
  if (eastLeft) image = image.flop();
  await image.png().toFile(path);
}

export function extendedMap(decomposition: FilledComponentsResult, length: number) {
  const result = new Float32Array(length);
  for (const component of decomposition.components) for (let i = 0; i < component.pixels.length; i++)
    result[component.pixels[i]!] += component.contributions[i]!;
  return result;
}

export interface ProjectionSampler {
  sample(x: number, y: number, z: number, out: Vec3): void;
  displayTargetAtPixel(pixel: number, out: Vec3): void;
}

/** Integrate actual Earth rays through the physical wrapper, not just the sampler's own coordinates. */
export function validateObservationProjection(options: {
  sampler: ProjectionSampler; physicalSample: ProjectionSampler['sample']; mapping: ObservationMapping;
  photo: ObservationPhoto; bounds: Bounds; samples: number; exposure: number;
}) {
  const { photo, bounds, sampler, mapping } = options;
  const indices = new Set<number>();
  for (let row = 0; row < 19; row++) for (let col = 0; col < 19; col++)
    indices.add(Math.round(row / 18 * (photo.height - 1)) * photo.width + Math.round(col / 18 * (photo.width - 1)));
  let brightest = 0;
  for (let p = 0; p < photo.intensity.length; p++) if (photo.intensity[p]! > photo.intensity[brightest]!) brightest = p;
  indices.add(brightest);
  const errors = [0, 0], convergence = [0, 0, 0], rgb: Vec3 = [0, 0, 0], expected: Vec3 = [0, 0, 0];
  const display = (v: Vec3) => {
    const peak = Math.max(...v), signal = -Math.expm1(-options.exposure * peak);
    return v.map(c => peak > 0 ? c / peak * signal : 0) as Vec3;
  };
  for (const pixel of indices) {
    const x = bounds.min[0] + ((pixel % photo.width) + .5) / photo.width * (bounds.max[0] - bounds.min[0]);
    const y = bounds.max[1] - (Math.floor(pixel / photo.width) + .5) / photo.height * (bounds.max[1] - bounds.min[1]);
    sampler.displayTargetAtPixel(pixel, expected);
    const outputs: Vec3[] = [];
    for (const [run, steps] of [options.samples, options.samples * 2].entries()) {
      const total: Vec3 = [0, 0, 0], dz = (bounds.max[2] - bounds.min[2]) / steps;
      for (let i = 0; i < steps; i++) {
        const point = mapping.pointAtDepth(x, y, bounds.min[2] + (i + .5) * dz);
        options.physicalSample(...point, rgb);
        for (let c = 0; c < 3; c++) total[c] += rgb[c]! * dz * mapping.rayPathPerDepth(x, y);
      }
      const actual = display(total); outputs.push(actual);
      for (let c = 0; c < 3; c++) errors[run] = Math.max(errors[run]!, Math.abs(actual[c]! - expected[c]!));
    }
    for (let c = 0; c < 3; c++) convergence[c] = Math.max(convergence[c]!, Math.abs(outputs[0]![c]! - outputs[1]![c]!));
  }
  if (Math.max(...errors) > .003 || Math.max(...convergence) > .0015)
    throw new Error(`Observed color projection is not converged: ${JSON.stringify({ errors, convergence })}`);
  return { testedRays: indices.size, depthSamples: [options.samples, options.samples * 2],
    maximumDisplayChannelError: errors, maximumConvergenceDifference: convergence,
    meaning: 'Physical Earth-ray integration before texture quantization. A projection fit does not validate unobserved geometry.' };
}
