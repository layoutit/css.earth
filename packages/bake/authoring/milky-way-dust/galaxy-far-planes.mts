/** Opt-in completed axis pictures from the installed, immutable slab bank. */
import { mkdirSync, readFileSync, unlinkSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { validatePreparedCssVolume, type PreparedCssVolume, type PreparedVolumeLeaf, type VolumeVector } from '@cssearth/objects';
import { prepareCylindricalSide } from './galaxy-cylindrical-side.mts';
import { fitProjectedGalaxyGain } from './galaxy-far-gain.mts';
import { mergedOpticalOpacity } from '../../../renderer/src/volume/optical-opacity.ts';

const AXES = ['x', 'y', 'z'] as const;
interface PixelLayer { readonly pixels: Uint8Array; readonly width: number; readonly height: number; readonly x: number; readonly y: number }

/** Flatten the installed slabs at their actual runtime opacity. Encode ordinary straight RGBA, once. */
export function flattenAxisPixels(layers: readonly PixelLayer[], width: number, height: number, gain: number): Uint8Array {
  const light = new Float64Array(width * height * 3);
  const coverage = new Float64Array(width * height);
  const opacity = mergedOpticalOpacity(gain);
  for (const layer of layers) {
    if (layer.pixels.length !== layer.width * layer.height * 4 || !Number.isInteger(layer.x) || !Number.isInteger(layer.y))
      throw new TypeError('Far picture needs aligned RGBA slabs.');
    for (let y = 0; y < layer.height; y++) for (let x = 0; x < layer.width; x++) {
      const targetX = x + layer.x, targetY = y + layer.y;
      if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) throw new TypeError('Slab exceeds far picture.');
      const source = (y * layer.width + x) * 4, target = (targetY * width + targetX) * 3;
      const alpha = layer.pixels[source + 3]! / 255 * opacity;
      coverage[target / 3] = alpha + coverage[target / 3]! * (1 - alpha);
      for (let channel = 0; channel < 3; channel++) light[target + channel] = layer.pixels[source + channel]! * alpha + light[target + channel]! * (1 - alpha);
    }
  }
  const result = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const alpha = coverage[pixel]!;
    for (let channel = 0; channel < 3; channel++) result[pixel * 4 + channel] = alpha > 0 ? Math.round(light[pixel * 3 + channel]! / alpha) : 0;
    result[pixel * 4 + 3] = Math.round(alpha * 255);
  }
  return result;
}

/** Fit a scalar overlay opacity to integrated premultiplied light on the picture grid. Source-over is linear in t:
 * L(t) = .999 L1 + t (L3 - .999 L1 A3). Samples span the quantized slab opacity range; no angular fit or image runtime. */
export function fitGainBlend(layers: readonly PixelLayer[], width: number, height: number, low: Uint8Array, high: Uint8Array): readonly (readonly [number, number])[] {
  let base = 0, slope = 0;
  for (let i = 0; i < low.length; i += 4) {
    const a = low[i + 3]! / 255 * .999, b = high[i + 3]! / 255;
    const l = (low[i]! + low[i + 1]! + low[i + 2]!) * a;
    base += l; slope += (high[i]! + high[i + 1]! + high[i + 2]!) * b - l * b;
  }
  const samples: [number, number][] = [];
  for (let step = 85; step <= 255; step += 10) {
    const gain = step / 85;
    const target = flattenAxisPixels(layers, width, height, gain);
    let light = 0;
    for (let i = 0; i < target.length; i += 4) light += (target[i]! + target[i + 1]! + target[i + 2]!) * target[i + 3]! / 255;
    samples.push([gain, Math.min(.999, Math.max(.001, slope > 0 ? (light - base) / slope : .001))]);
  }
  return samples;
}

const matrixOf = (leaf: PreparedVolumeLeaf) => leaf.style.transform.slice(9, -1).split(',').map(Number);
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, value, index) => sum + value * b[index]!, 0);
const triple = (values: readonly number[]): VolumeVector => [values[0]!, values[1]!, values[2]!];
const aligned = (value: number): number => {
  if (Math.abs(value - Math.round(value)) > .001) throw new TypeError(`Slab raster phases differ: ${value}.`);
  return Math.round(value);
};

/** Preserve accepted affine columns and raster phase; only the picture rectangle and its depth are new. Looking
 * from the positive axis toward the centre, physical depth (not the BSP-balanced DOM order) sorts back to front. */
export async function prepareGalaxyFarPlanes(input: PreparedCssVolume, prepared: string): Promise<PreparedCssVolume> {
  const volume = validatePreparedCssVolume(input);
  if (volume.mergedOpticalCopies !== 3) throw new TypeError('Galaxy far pictures require the installed three-copy merged slab encoding.');
  const stacks: PreparedCssVolume['stacks'][number][] = [], gainBlend: { axis: 'x' | 'y' | 'z'; samples: readonly (readonly [number, number])[] }[] = [], resources: PreparedCssVolume['resources'][number][] = [];
  for (const [coordinate, axis] of AXES.entries()) {
    if (axis !== 'z') continue;
    const stack = volume.stacks.find(stack => stack.axis === axis)!;
    if (stack.normalUnits || !stack.leaves.length) throw new TypeError('Galaxy far bake needs populated axis-aligned slabs.');
    const leaves = [...stack.leaves].sort((a, b) => a.centerUnits[coordinate]! - b.centerUnits[coordinate]!);
    const first = leaves[0]!, matrix = matrixOf(first);
    const sx = Number.parseFloat(first.style.width) / first.widthPx, sy = Number.parseFloat(first.style.height) / first.heightPx;
    const u = matrix.slice(0, 3).map(value => value * sx), v = matrix.slice(4, 7).map(value => value * sy);
    const offsets = leaves.map(leaf => {
      const other = matrixOf(leaf), delta = other.slice(12, 15).map((value, index) => value - matrix[12 + index]!);
      if (leaf.style.backgroundSize !== `${leaf.style.width} ${leaf.style.height}` || leaf.style.backgroundPosition !== '0px 0px' ||
          other.slice(0, 12).some((value, index) => value !== matrix[index]) ||
          Math.abs(Number.parseFloat(leaf.style.width) / leaf.widthPx - sx) > 1e-8 || Math.abs(Number.parseFloat(leaf.style.height) / leaf.heightPx - sy) > 1e-8)
        throw new TypeError('Slab geometry is not on one uncropped raster calibration.');
      return { leaf, x: aligned(dot(delta, u) / dot(u, u)), y: aligned(dot(delta, v) / dot(v, v)) };
    });
    const left = Math.min(...offsets.map(offset => offset.x)), top = Math.min(...offsets.map(offset => offset.y));
    const width = Math.max(...offsets.map(offset => offset.x + offset.leaf.widthPx)) - left;
    const height = Math.max(...offsets.map(offset => offset.y + offset.leaf.heightPx)) - top;
    const layers: PixelLayer[] = [];
    for (const { leaf, x, y } of offsets) {
      const { data, info } = await sharp(readFileSync(resolve(prepared, leaf.texturePath))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (info.width !== leaf.widthPx || info.height !== leaf.heightPx || info.channels !== 4) throw new TypeError('Slab dimensions differ from prepared metadata.');
      layers.push({ pixels: data, width: info.width, height: info.height, x: x - left, y: y - top });
    }
    const low = flattenAxisPixels(layers, width, height, 1), high = flattenAxisPixels(layers, width, height, 3);
    gainBlend.push({ axis, samples: fitGainBlend(layers, width, height, low, high) });
    mkdirSync(resolve(prepared, 'b30-far-planes'), { recursive: true });
    for (let index = 0; index < 3; index++) matrix[12 + index] = matrix[12 + index]! + u[index]! * left + v[index]! * top;
    // CSS swaps physical x/y; the installed compiler uses 50 CSS units per physical unit.
    const cssCoordinate = coordinate === 0 ? 1 : coordinate === 1 ? 0 : 2;
    const centre = (volume.frame.boundsUnits.min[coordinate]! + volume.frame.boundsUnits.max[coordinate]!) / 2;
    matrix[12 + cssCoordinate] = centre * 50;
    const style = { width: `${width * sx}px`, height: `${height * sy}px`, transform: `matrix3d(${matrix.join(',')})`,
      backgroundSize: `${width * sx}px ${height * sy}px`, backgroundPosition: '0px 0px' };
    const points = [[0, 0], [width * sx, 0], [width * sx, height * sy], [0, height * sy]].map(([x, y]) =>
      [0, 1, 2].map(index => matrix[index]! * x! + matrix[4 + index]! * y! + matrix[12 + index]!));
    const cssCentre = [0, 1, 2].map(index => points.reduce((sum, point) => sum + point[index]!, 0) / 4 / 50);
    const leaf: PreparedVolumeLeaf = { id: `far-${axis}`, centerUnits: [cssCentre[1]!, cssCentre[0]!, cssCentre[2]!], texturePath: `b30-far-planes/${axis}.png`, widthPx: width, heightPx: height, style,
      boundsCssPixels: { min: triple([0, 1, 2].map(index => Math.min(...points.map(point => point[index]!)))),
        max: triple([0, 1, 2].map(index => Math.max(...points.map(point => point[index]!)))) } };
    const pictures: PreparedVolumeLeaf[] = [];
    for (const [index, pixels] of [low, high].entries()) {
      const texturePath = `b30-far-planes/${axis}${index ? '-high' : ''}.png`;
      const bytes = await sharp(pixels, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
      writeFileSync(resolve(prepared, texturePath), bytes);
      pictures.push({ ...leaf, id: `far-${axis}-${index ? 'high' : 'low'}`, texturePath });
      resources.push({ path: texturePath, bytes: bytes.length, width, height });
    }
    stacks.push({ axis, leaves: pictures });
  }
  const { min, max } = volume.frame.boundsUnits;
  const radiusUnits = Math.max(...max.map((value, index) => value - min[index]!)) / 2;
  const cylindrical = await prepareCylindricalSide(volume, prepared);
  for (const axis of ['x', 'y']) for (const suffix of ['', '-high']) {
    const retired = resolve(prepared, `b30-far-planes/${axis}${suffix}.png`);
    if (existsSync(retired)) unlinkSync(retired);
  }
  resources.push(...cylindrical.resources);
  const provisional = validatePreparedCssVolume({ ...volume, farPlanes: { gainBlend, radiusUnits, belowDiameterPixels: 300, stacks, side: cylindrical.side },
    resources: [...volume.resources.filter(resource => !resource.path.startsWith('b30-far-planes/')), ...resources] });
  return validatePreparedCssVolume({ ...provisional, farPlanes: { ...provisional.farPlanes!, gainBlend: await fitProjectedGalaxyGain(provisional, prepared) } });
}
