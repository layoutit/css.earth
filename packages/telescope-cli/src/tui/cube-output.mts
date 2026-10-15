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

/** The science reader owns masks and companions. Peak selection uses its band image or sums its native planes. */
export async function cubePeakAperture(input: Parameters<typeof nativeFigureInput>[0], output: OutputChoice): Promise<readonly number[]> {
  const scratch = await telescopeScratch('telescope-peak-');
  try {
    const native = await nativeFigureInput(input, resolve(scratch, 'native'), output.structure), hdu = output.hdu ?? 0;
    const extract = async (selection: { readonly kind: 'band-image'; readonly band: readonly number[] } | { readonly kind: 'image'; readonly plane: number }) => {
      await sciencePackage({ operation: 'extract', path: native.file, hdu, ...selection, uncertainty: 'omit', arrayDirectory: scratch });
      const image = readNpy(await readFile(resolve(scratch, 'values.npy')));
      if (image.shape.length !== 2) throw new Error('Peak selection requires a two-dimensional image.');
      return image;
    };
    let image: ReturnType<typeof readNpy>;
    if (output.spectral?.binEdgesMicrometres) image = await extract({ kind: 'band-image', band: cubeBand(output) });
    else {
      const channels = output.spectral?.centersMicrometres.length;
      if (!channels) throw new Error('The cube has no qualified wavelength channels.');
      image = await extract({ kind: 'image', plane: 0 });
      for (let plane = 1; plane < channels; plane++) {
        const next = await extract({ kind: 'image', plane });
        if (next.values.length !== image.values.length) throw new Error('Cube plane shape changed during peak selection.');
        for (let i = 0; i < image.values.length; i++) image.values[i] += next.values[i]!;
      }
    }
    const [height = 0, width = 0] = image.shape;
    let peak = -1, maximum = -Infinity;
    for (let i = 0; i < image.values.length; i++) {
      const value = image.values[i]!;
      if (Number.isFinite(value) && value > maximum) { peak = i; maximum = value; }
    }
    if (peak < 0) throw new Error('The summed cube has no usable peak.');
    const x = peak % width, y = Math.floor(peak / width);
    if (x < 1 || y < 1 || x + 1 >= width || y + 1 >= height) throw new Error('The brightest pixel is at the edge; a centered 3×3 aperture does not fit. Use telescope export with --aperture.');
    return [x - 1, y - 1, x + 2, y + 2];
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
