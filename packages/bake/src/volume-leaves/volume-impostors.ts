import { cross3 as cross, dot3 as dot } from '@cssearth/core';
/** Bounded offline views of the accepted PolyCSS leaves; no density reconstruction. */
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { validatePreparedCssVolume } from '@cssearth/renderer/volume/validation.ts';
import type { PreparedCssVolume, PreparedVolumeImpostors, PreparedVolumeLeaf, VolumeAxis, VolumeVector } from '@cssearth/renderer/volume/types.ts';
import type { PreparedVolumeLensBrightness } from '@cssearth/renderer/volume/prepared-volume-lenses.ts';

const SIZE = 256;
const AXES = ['x', 'y', 'z'] as const;
const MAX_TEXTURE_PIXELS = 16_777_216;
const MAX_DECODED_BYTES = 1_073_741_824;
type View = PreparedVolumeImpostors['views'][number];
interface Pixels { width: number; height: number; data: Uint8Array }
interface Plane {
  leaf: PreparedVolumeLeaf;
  origin: VolumeVector;
  u: VolumeVector;
  v: VolumeVector;
  width: number;
  height: number;
  backgroundWidth: number;
  backgroundHeight: number;
  backgroundX: number;
  backgroundY: number;
}

/** Saves exactly 26 orthographic PNGs, centered on physical local origin. */
export async function prepareVolumeImpostors(options: {
  volume: PreparedCssVolume;
  brightness: PreparedVolumeLensBrightness;
  readResource: (path: string) => Promise<Uint8Array>;
  writeResource: (path: string, bytes: Uint8Array) => Promise<void>;
  prefix: string;
}): Promise<PreparedCssVolume> {
  const volume = validatePreparedCssVolume(options.volume);
  const { brightness, readResource, writeResource } = options;
  if (!brightness || !['overall', ...AXES].every(key => {
    const value = brightness[key as keyof PreparedVolumeLensBrightness];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
  })) throw new TypeError('Impostor brightness requires overall/x/y/z attenuation between zero and one.');
  const prefix = options.prefix.replace(/\/+$/u, '');
  if (!prefix || prefix.startsWith('/') || /[\\\u0000-\u0020]/u.test(prefix) ||
      prefix.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new TypeError('Impostor prefix must be a safe relative directory.');
  }
  const radiusUnits = Math.hypot(...AXES.map((_, axis) =>
    Math.max(Math.abs(volume.frame.boundsUnits.min[axis]), Math.abs(volume.frame.boundsUnits.max[axis]))));
  if (!(radiusUnits > 0) || !Number.isFinite(radiusUnits)) throw new TypeError('Impostor radius must be finite and positive.');
  const views = directions(prefix);
  const oldPaths = new Set(volume.impostors?.views.map(view => view.texturePath));
  const resources = volume.resources.filter(resource => !oldPaths.has(resource.path));
  const remainingPaths = new Set(resources.map(resource => resource.path));
  if (views.some(view => remainingPaths.has(view.texturePath))) throw new TypeError('Impostor output would overwrite a source resource.');
  const stacks = AXES.map(axis => {
    const stack = volume.stacks.find(candidate => candidate.axis === axis)!;
    return { axis, planes: stack.leaves.map(leaf => plane(leaf, axis)) };
  });
  const metadata = new Map(volume.resources.map(resource => [resource.path, resource]));
  const textures = new Map<string, Pixels>();
  let decodedBytes = 0;
  // A leaf either owns its texture or takes a rectangle out of a shared atlas. Its CSS background is what maps one
  // onto the other, and the rasteriser samples through that mapping, so the decoded image must match the declared
  // resource and the background must cover it exactly, at the leaf's own texel density: its widthPx texels across its
  // box. Checking the leaf's own pixel size instead would refuse every delivered bank, which is why the Magellanic
  // Clouds shipped without impostor views; checking one texel per CSS pixel would refuse every slice drawn at
  // TEXELS_PER_CSS_PIXEL.
  const sameDensity = (texels: number, css: number, leafTexels: number, box: number) => Math.abs(texels * box - leafTexels * css) <= 1e-9 * texels * box;
  for (const { planes } of stacks) for (const { leaf, width, height, backgroundWidth, backgroundHeight } of planes) {
    const resource = metadata.get(leaf.texturePath);
    if (!resource) throw new TypeError(`Impostor leaf ${leaf.id} has no declared texture resource.`);
    if (!sameDensity(resource.width, backgroundWidth, leaf.widthPx, width) || !sameDensity(resource.height, backgroundHeight, leaf.heightPx, height)) {
      throw new TypeError(`Impostor leaf ${leaf.id} background does not cover ${leaf.texturePath} at the leaf's texel density: ` +
        `${resource.width}×${resource.height} texels across background-size ${leaf.style.backgroundSize}, ` +
        `${leaf.widthPx}×${leaf.heightPx} texels across its ${leaf.style.width} ${leaf.style.height} box.`);
    }
    if (textures.has(leaf.texturePath)) continue;
    const count = resource.width * resource.height;
    decodedBytes += count * 4;
    if (count > MAX_TEXTURE_PIXELS || decodedBytes > MAX_DECODED_BYTES) throw new TypeError('Impostor source textures exceed the bounded decode budget.');
    const bytes = await readResource(leaf.texturePath);
    if (bytes.byteLength !== resource.bytes || digest(bytes) !== resource.sha256) throw new TypeError(`Impostor texture identity mismatch: ${leaf.texturePath}.`);
    const { data, info } = await sharp(bytes, { limitInputPixels: MAX_TEXTURE_PIXELS }).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== resource.width || info.height !== resource.height || info.channels !== 4 || data.length !== count * 4) {
      throw new TypeError(`Impostor decoded texture dimensions mismatch: ${leaf.texturePath}.`);
    }
    textures.set(leaf.texturePath, { width: info.width, height: info.height, data });
  }
  const preparedResources: PreparedCssVolume['resources'][number][] = [];
  for (const view of views) {
    const rgba = render(view, stacks, textures, radiusUnits, brightness);
    const bytes = await sharp(rgba, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toBuffer();
    await writeResource(view.texturePath, bytes);
    preparedResources.push({ path: view.texturePath, sha256: digest(bytes), bytes: bytes.byteLength, width: SIZE, height: SIZE });
  }
  return { ...volume, resources: [...resources, ...preparedResources], impostors: {
    schema: 'cssearth-volume-impostors@1', radiusUnits,
    fullBelowDiameterPixels: 128, volumeAboveDiameterPixels: 256, views,
  } };
}

function directions(prefix: string): View[] {
  const views: View[] = [];
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
    if (x === 0 && y === 0 && z === 0) continue;
    const back = normalize([x, y, z]);
    const up: VolumeVector = Math.abs(back[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0];
    const right = normalize(cross(up, back)), down = cross(right, back);
    const id = `view-${[x, y, z].map(value => value < 0 ? 'n' : value > 0 ? 'p' : '0').join('')}`;
    views.push({ id, back, right, down, texturePath: `${prefix}/${id}.png` });
  }
  return views;
}

function plane(leaf: PreparedVolumeLeaf, axis: VolumeAxis): Plane {
  const match = /^matrix3d\(([^)]+)\)$/u.exec(leaf.style.transform.trim());
  const m = match?.[1].split(',').map(Number);
  if (!m || m.length !== 16 || !m.every(Number.isFinite) || m[3] !== 0 || m[7] !== 0 || m[11] !== 0 || m[15] !== 1) {
    throw new TypeError(`Impostor leaf ${leaf.id} requires an affine CSS matrix.`);
  }
  // Undo the compiler's [y,x,z] reflection and its 50 CSS pixels per unit.
  const u: VolumeVector = [m[1] / 50, m[0] / 50, m[2] / 50];
  const v: VolumeVector = [m[5] / 50, m[4] / 50, m[6] / 50];
  const origin: VolumeVector = [m[13] / 50, m[12] / 50, m[14] / 50];
  const normal = cross(u, v), normalLength = Math.hypot(...normal), component = AXES.indexOf(axis);
  if (!(normalLength > 0) || Math.abs(u[component]) > Math.hypot(...u) * 1e-8 ||
      Math.abs(v[component]) > Math.hypot(...v) * 1e-8) {
    throw new TypeError(`Impostor leaf ${leaf.id} must be a nondegenerate plane parallel to its declared stack.`);
  }
  const [backgroundWidth, backgroundHeight] = cssPixels(leaf.style.backgroundSize);
  const [backgroundX, backgroundY] = cssPixels(leaf.style.backgroundPosition);
  const [width] = cssPixels(leaf.style.width), [height] = cssPixels(leaf.style.height);
  if (!(width > 0 && height > 0 && backgroundWidth > 0 && backgroundHeight > 0)) throw new TypeError('Impostor leaf CSS dimensions must be positive.');
  return { leaf, origin, u, v, width, height, backgroundWidth, backgroundHeight, backgroundX, backgroundY };
}

function render(view: View, stacks: readonly { axis: VolumeAxis; planes: readonly Plane[] }[], textures: ReadonlyMap<string, Pixels>,
  radius: number, brightness: PreparedVolumeLensBrightness): Buffer {
  const image = new Float64Array(SIZE * SIZE * 4);
  const strengths = view.back.map(Math.abs), maximum = Math.max(...strengths);
  let cumulativeWeight = 0, brightnessSum = 0;
  for (const { axis, planes } of stacks) {
    const component = AXES.indexOf(axis), strength = strengths[component];
    const t = Math.max(0, Math.min(1, (strength - maximum + 0.16) / 0.16)), weight = t * t * (3 - 2 * t);
    if (weight === 0) continue;
    cumulativeWeight += weight; brightnessSum += weight * brightness[axis];
    const opacity = weight / cumulativeWeight, gain = Math.max(1, 1 / strength);
    const stackImage = new Float64Array(image.length);
    // Crop centers are not depth keys. Parallel planes order by their real
    // axis coordinate; stable sorting preserves source order on coincident leaves.
    const sign = Math.sign(view.back[component]);
    const sorted = [...planes].sort((a, b) => sign * (a.origin[component] - b.origin[component]));
    for (const source of sorted) rasterize(stackImage, source, textures.get(source.leaf.texturePath)!, view, radius, gain);
    for (let p = 0; p < image.length; p += 4) {
      const alpha = stackImage[p + 3] * opacity, remaining = 1 - alpha;
      for (let c = 0; c < 3; c++) image[p + c] = stackImage[p + c] * opacity + image[p + c] * remaining;
      image[p + 3] = alpha + image[p + 3] * remaining;
    }
  }
  // The lens runtime attenuates the completed cloud, never individual slabs.
  const attenuation = brightness.overall * brightnessSum / cumulativeWeight;
  const rgba = Buffer.alloc(image.length);
  for (let p = 0; p < image.length; p += 4) {
    const alpha = image[p + 3];
    rgba[p + 3] = Math.round(alpha * attenuation * 255);
    if (rgba[p + 3] === 0) continue;
    for (let c = 0; c < 3; c++) rgba[p + c] = Math.round(Math.max(0, Math.min(1, image[p + c] / alpha)) * 255);
  }
  return rgba;
}

function rasterize(target: Float64Array, plane: Plane, pixels: Pixels, view: View, radius: number, gain: number): void {
  const { origin, u, v, width, height } = plane, scale = SIZE / (radius * 2);
  const ox = dot(view.right, origin) * scale + SIZE / 2, oy = dot(view.down, origin) * scale + SIZE / 2;
  const ux = dot(view.right, u) * scale, uy = dot(view.down, u) * scale;
  const vx = dot(view.right, v) * scale, vy = dot(view.down, v) * scale;
  const determinant = ux * vy - uy * vx;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-20) throw new TypeError('Impostor active plane has a degenerate projection.');
  const inverse = 1 / determinant;
  const left = Math.max(0, Math.floor(Math.min(ox, ox + ux * width, ox + vx * height, ox + ux * width + vx * height)));
  const top = Math.max(0, Math.floor(Math.min(oy, oy + uy * width, oy + vy * height, oy + uy * width + vy * height)));
  const right = Math.min(SIZE, Math.ceil(Math.max(ox, ox + ux * width, ox + vx * height, ox + ux * width + vx * height)));
  const bottom = Math.min(SIZE, Math.ceil(Math.max(oy, oy + uy * width, oy + vy * height, oy + uy * width + vy * height)));
  const copy1 = Math.max(0, Math.min(1, gain - 1)), copy2 = Math.max(0, Math.min(1, gain - 2));
  const sample = [0, 0, 0, 0];
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    const dx = x + 0.5 - ox, dy = y + 0.5 - oy;
    const localX = (dx * vy - dy * vx) * inverse, localY = (dy * ux - dx * uy) * inverse;
    if (localX < 0 || localX >= width || localY < 0 || localY >= height) continue;
    const imageX = (localX - plane.backgroundX) / plane.backgroundWidth;
    const imageY = (localY - plane.backgroundY) / plane.backgroundHeight;
    if (imageX < 0 || imageX >= 1 || imageY < 0 || imageY >= 1) continue;
    samplePremultiplied(pixels, imageX * pixels.width - 0.5, imageY * pixels.height - 0.5, sample);
    const baseAlpha = sample[3];
    if (baseAlpha === 0) continue;
    const alpha = 1 - (1 - baseAlpha) * (1 - copy1 * baseAlpha) * (1 - copy2 * baseAlpha);
    const amplification = alpha / baseAlpha, p = (y * SIZE + x) * 4, remaining = 1 - alpha;
    for (let c = 0; c < 3; c++) target[p + c] = sample[c] * amplification + target[p + c] * remaining;
    target[p + 3] = alpha + target[p + 3] * remaining;
  }
}

/** Interpolate premultiplied samples so invisible RGB cannot bleed into emission. */
function samplePremultiplied(pixels: Pixels, x: number, y: number, result: number[]): void {
  const sx = Math.max(0, Math.min(pixels.width - 1, x)), sy = Math.max(0, Math.min(pixels.height - 1, y));
  const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(x0 + 1, pixels.width - 1), y1 = Math.min(y0 + 1, pixels.height - 1);
  const fx = sx - x0, fy = sy - y0;
  const p00 = (y0 * pixels.width + x0) * 4, p10 = (y0 * pixels.width + x1) * 4;
  const p01 = (y1 * pixels.width + x0) * 4, p11 = (y1 * pixels.width + x1) * 4;
  const a00 = pixels.data[p00 + 3] / 255 * (1 - fx) * (1 - fy), a10 = pixels.data[p10 + 3] / 255 * fx * (1 - fy);
  const a01 = pixels.data[p01 + 3] / 255 * (1 - fx) * fy, a11 = pixels.data[p11 + 3] / 255 * fx * fy;
  for (let c = 0; c < 3; c++) result[c] = (pixels.data[p00 + c] * a00 + pixels.data[p10 + c] * a10 +
    pixels.data[p01 + c] * a01 + pixels.data[p11 + c] * a11) / 255;
  result[3] = a00 + a10 + a01 + a11;
}

function cssPixels(value: string): number[] { return value.trim().split(/\s+/u).map(part => Number.parseFloat(part)); }
function digest(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex'); }
function normalize(vector: VolumeVector): VolumeVector {
  const length = Math.hypot(...vector);
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}
