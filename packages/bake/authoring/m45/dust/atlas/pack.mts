import sharp from 'sharp';

export interface CloudAtlas { rgba: Uint8Array; width: number; height: number; cells: Uint16Array }

/** Fill undefined transparent RGB from this tile alone; alpha and active RGB never change. */
export function dilateTransparentRgb(original: Uint8Array, size: number): Uint8Array {
  const rgba = original.slice(), count = size * size, seeds = new Int32Array(count).fill(-1), queue = new Int32Array(count);
  let next = 0, length = 0;
  for (let p = 0; p < count; p++) if (original[p * 4 + 3]) { seeds[p] = p; queue[length++] = p; }
  // Deterministic multi-source8-neighbor flood: nearest seed in Chebyshev distance,
  // row-major tie breaking. These colors have zero optical support, not new light.
  while (next < length) {
    const p = queue[next++]!, x = p % size, y = Math.floor(p / size), seed = seeds[p]!;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const sx = x + dx, sy = y + dy;
      if (sx < 0 || sy < 0 || sx >= size || sy >= size) continue;
      const q = sy * size + sx;
      if (seeds[q] !== -1) continue;
      seeds[q] = seed; queue[length++] = q;
      for (let c = 0; c < 3; c++) rgba[q * 4 + c] = original[seed * 4 + c]!;
    }
  }
  return rgba;
}

/** Each existing cell retains its native viewport; external gutters isolate its sampling. */
export function packCloudAtlas(tiles: readonly Uint8Array[], size: number, gutter: number): CloudAtlas {
  if (!tiles.length || !Number.isSafeInteger(size) || size < 1 || !Number.isSafeInteger(gutter) || gutter < 1)
    throw new Error('Positive tile count, native size and external gutter required');
  if (tiles.some(tile => tile.length !== size * size * 4)) throw new Error('NativeRGBA tile size mismatch');
  const across = Math.ceil(Math.sqrt(tiles.length)), pitch = size + 2 * gutter;
  const width = across * pitch, height = Math.ceil(tiles.length / across) * pitch;
  if (width > 65535 || height > 65535) throw new Error('Atlas exceeds unsigned16 cell coordinates');
  const rgba = new Uint8Array(width * height * 4), cells = new Uint16Array(tiles.length * 2);
  for (const [i, original] of tiles.entries()) {
    const tile = dilateTransparentRgb(original, size), left = i % across * pitch + gutter, top = Math.floor(i / across) * pitch + gutter;
    cells.set([left, top], i * 2);
    for (let y = -gutter; y < size + gutter; y++) for (let x = -gutter; x < size + gutter; x++) {
      const sx = Math.max(0, Math.min(size - 1, x)), sy = Math.max(0, Math.min(size - 1, y));
      const source = (sy * size + sx) * 4, target = ((top + y) * width + left + x) * 4;
      rgba.set(tile.subarray(source, source + 4), target);
    }
  }
  return { rgba, width, height, cells };
}

/** Ordinary straightRGBA. exact preserves edge colors under alpha0 through libwebp. */
export function encodeCloudAtlas(atlas: CloudAtlas): Promise<Buffer> {
  return sharp(atlas.rgba, { raw: { width: atlas.width, height: atlas.height, channels: 4 } })
    .webp({ lossless: true, exact: true }).toBuffer();
}
