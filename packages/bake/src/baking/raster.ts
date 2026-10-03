import { modulo, clamp } from './math.js';
export function packLatitudeRaster(source: Uint8Array, width: number, height: number, bandCount: number, gutter: number) {
    if (![width, height, bandCount, gutter].every(value => Number.isInteger(value) && value > 0) || height % bandCount !== 0 || source.length !== width * height * 4)
        throw new RangeError('Invalid latitude raster dimensions.');
    const bandHeight = height / bandCount;
    const packedWidth = width + gutter * 2;
    const packedHeight = height + gutter * 2 * bandCount;
    const data = new Uint8Array(packedWidth * packedHeight * 4);
    for (let band = 0; band < bandCount; band++) {
        for (let localY = -gutter; localY < bandHeight + gutter; localY++) {
            const sourceY = clamp(band * bandHeight + bandHeight - 1 - localY, 0, height - 1);
            const outputY = band * (bandHeight + gutter * 2) + gutter + localY;
            for (let outputX = 0; outputX < packedWidth; outputX++) {
                const sourceOffset = (sourceY * width + modulo(outputX - gutter, width)) * 4;
                data.set(source.subarray(sourceOffset, sourceOffset + 4), (outputY * packedWidth + outputX) * 4);
            }
        }
    }
    return { data, packedWidth, packedHeight };
}
export function applySurfaceExposure(pixels: Uint8Array, shoulders: readonly number[]): void {
    if (shoulders.length !== 3 || shoulders.some(value => !Number.isFinite(value) || value <= 0))
        throw new RangeError('Exposure needs three positive shoulders.');
    for (let offset = 0; offset < pixels.length; offset += 4)
        for (let channel = 0; channel < 3; channel++) {
            const shoulder = shoulders[channel];
            pixels[offset + channel] = Math.round(255 * ((1 - Math.exp(-shoulder * pixels[offset + channel] / 255)) / (1 - Math.exp(-shoulder))));
        }
}
