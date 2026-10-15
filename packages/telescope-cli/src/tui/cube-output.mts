import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sciencePackage, telescopeScratch } from '@cssearth/telescope-core/node';
import { readNpy } from '@cssearth/bake/objects/raster';
import { nativeFigureInput } from '../delivery/native-figure.mts';
import type { OutputChoice } from '../delivery/outputs.mts';

export function cubeBand(output: OutputChoice): readonly [number, number] {
  const edges = output.spectral?.binEdgesMicrometres;
  if (!edges?.length) throw new Error('The cube has no qualified wavelength bin edges.');
  const first = edges[0]!, last = edges.at(-1)!;
  if (!Number.isFinite(first + last) || Math.min(first, last) <= 0 || first === last) throw new Error('Invalid qualified cube wavelength range.');
  return [Math.min(first, last), Math.max(first, last)];
}

/** The science reader owns masks and companions. Peak selection uses one full-band image. */
export async function cubePeakAperture(input: Parameters<typeof nativeFigureInput>[0], output: OutputChoice, extract = sciencePackage): Promise<readonly number[]> {
  const band = cubeBand(output);
  const scratch = await telescopeScratch('telescope-peak-');
  try {
    const native = await nativeFigureInput(input, resolve(scratch, 'native'), output.structure), hdu = output.hdu ?? 0;
    await extract({ operation: 'extract', path: native.file, hdu, kind: 'band-image', band, uncertainty: 'omit', arrayDirectory: scratch });
    const image = readNpy(await readFile(resolve(scratch, 'values.npy')));
    if (image.shape.length !== 2) throw new Error('Peak selection requires a two-dimensional image.');
    const [, width = 0] = image.shape;
    let peak = -1, maximum = -Infinity;
    for (let i = 0; i < image.values.length; i++) {
      const value = image.values[i]!;
      if (Number.isFinite(value) && value > maximum) { peak = i; maximum = value; }
    }
    if (peak < 0) throw new Error('The summed cube has no usable peak.');
    const x = peak % width, y = Math.floor(peak / width);
    return [x, y, x + 1, y + 1];
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
