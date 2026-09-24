import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readFitsHdu, fitsImageAccessor } from '../../fits/fits.mts';
import { parseTransform } from './source-records.mts';
import { shape, text, number, array, optional, dictionary } from '@cssearth/core';

const plane = shape({ extension: number, name: text, units: text });
const profile = shape({
  path: text, sampling: text, extension: number, name: text, units: text,
  primary: dictionary(text),
  grid: shape({ width: number, height: number, longitudeOrigin: number, rowOrder: text }),
  missingTuple: optional(array(shape({ extension: number, name: text, units: text, value: number }))),
  valueTransform: optional(parseTransform),
});

/** Read a released scalar map with IMAGE extensions and an explicitly sourced
 * full-world equirectangular grid. FITS row order is not assumed to be north-up.
 * This reader deliberately supports only unscaled IEEE float32 IMAGE HDUs. */
export function decodeFitsImageMap(bytes: Buffer, value: unknown) {
  const recipe = profile(value);
  if (recipe.sampling !== 'nearest' || !['north-to-south', 'south-to-north'].includes(recipe.grid.rowOrder) ||
      ![recipe.grid.width, recipe.grid.height, recipe.extension].every(n => Number.isSafeInteger(n) && n > 0) ||
      recipe.grid.longitudeOrigin < -180 || recipe.grid.longitudeOrigin >= 360 || !Object.keys(recipe.primary).length ||
      recipe.missingTuple?.length === 0 || recipe.missingTuple?.some(p => !Number.isSafeInteger(p.extension) || p.extension < 1)) {
    throw new TypeError('FITS scalar maps require an identified extension, source grid and nearest sampling.');
  }
  const primary = readFitsHdu(bytes);
  if (primary.header.SIMPLE !== true || primary.header.BITPIX !== 8 || primary.header.NAXIS !== 0 || primary.header.EXTEND !== true ||
      Object.entries(recipe.primary).some(([key, expected]) => primary.header[key] !== expected)) {
    throw new Error('FITS scalar-map primary identity changed.');
  }
  const hdus = new Map<number, { header: ReturnType<typeof readFitsHdu>['header']; dataOffset: number; at: (index: number) => number }>();
  const samples = recipe.grid.width * recipe.grid.height;
  if (!Number.isSafeInteger(samples) || samples > 100_000_000) throw new Error('Unbounded FITS scalar grid.');
  let offset = primary.dataOffset, extension = 0;
  while (offset < bytes.length) {
    const hdu = readFitsHdu(bytes, offset), h = hdu.header;
    if (h.XTENSION !== 'IMAGE' || h.BITPIX !== -32 || h.NAXIS !== 2 || h.NAXIS1 !== recipe.grid.width || h.NAXIS2 !== recipe.grid.height ||
        h.PCOUNT !== 0 || h.GCOUNT !== 1 || (h.BSCALE ?? 1) !== 1 || (h.BZERO ?? 0) !== 0 || hdu.dataOffset + samples * 4 > bytes.length) {
      throw new Error('FITS scalar-map extension layout changed or is truncated.');
    }
    hdus.set(++extension, { ...hdu, at: fitsImageAccessor(bytes, hdu) });
    offset = hdu.nextOffset;
  }
  if (offset !== bytes.length) throw new Error('FITS scalar-map padding is truncated.');
  const select = (p: ReturnType<typeof plane>) => {
    const hdu = hdus.get(p.extension);
    if (!hdu || hdu.header.EXTNAME !== p.name || hdu.header.UNITS !== p.units) throw new Error('FITS scalar-map quantity or units changed.');
    return hdu;
  };
  const selected = select(recipe), missing = recipe.missingTuple?.map(p => ({ ...select(p), value: p.value })) ?? [];
  const at = (index: number) => {
    if (missing.length && missing.every(p => p.at(index) === p.value)) return null;
    const value = selected.at(index);
    return Number.isFinite(value) ? value * (recipe.valueTransform?.scale ?? 1) + (recipe.valueTransform?.offset ?? 0) : null;
  };
  return {
    width: recipe.grid.width, height: recipe.grid.height,
    sampleCell(x: number, y: number) {
      return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < recipe.grid.width && y >= 0 && y < recipe.grid.height
        ? at(y * recipe.grid.width + x) : null;
    },
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      const longitudeFraction = ((longitude - recipe.grid.longitudeOrigin) % 360 + 360) % 360 / 360;
      const latitudeFraction = (90 + (recipe.grid.rowOrder === 'north-to-south' ? -latitude : latitude)) / 180;
      const x = Math.floor(longitudeFraction * recipe.grid.width), y = Math.min(recipe.grid.height - 1, Math.floor(latitudeFraction * recipe.grid.height));
      return at(y * recipe.grid.width + x);
    },
    report: { format: 'fits-image-map', extension: recipe.extension, name: recipe.name, units: recipe.units,
      grid: recipe.grid, missingTuple: recipe.missingTuple ?? null, sampling: recipe.sampling },
  };
}

export async function loadFitsImageMap(root: string, value: unknown) {
  const recipe = profile(value);
  if (!recipe.path || recipe.path.startsWith('/') || recipe.path.includes('\\') || recipe.path.split('/').includes('..')) {
    throw new TypeError('FITS scalar map must be inside the source directory.');
  }
  return decodeFitsImageMap(await readFile(resolve(root, recipe.path)), recipe);
}
