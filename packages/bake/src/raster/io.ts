import sharp from 'sharp';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
export const outputName = (template: string, density: number, id = '') => template.replaceAll('{density}', String(density)).replaceAll('{suffix}', density === 1 ? '' : '@2x').replaceAll('{id}', id);
export const raster = (data: Uint8Array, width: number, height: number) => sharp(Buffer.from(data), { raw: { width, height, channels: 4 } });
export async function fileBytes(path: string) { return { bytes: (await stat(path)).size }; }
export async function readRgba(path: string, width: number, height: number, resize = false, sharpen?: number) {
    let image = sharp(path);
    if (resize)
        image = image.resize(width, height, { fit: 'fill', kernel: 'lanczos3' });
    if (sharpen !== undefined)
        image = image.sharpen({ sigma: sharpen });
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== width || info.height !== height || info.channels !== 4)
        throw new RangeError(`Source dimensions drifted at ${path}.`);
    return data;
}
export const assetPath = (directory: string, template: string, density: number, id = '') => resolve(directory, outputName(template, density, id));
