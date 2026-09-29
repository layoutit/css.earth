import { describe, expect, it } from 'vitest';
import { completeEnhancedCoverage, packLatitudeRaster, applySurfaceExposure, readAtmosphereModel } from './index.js';
describe('prepared raster operators', () => {
    it('packs reversed latitude bands with wrapped horizontal and clamped vertical gutters', () => {
        const source = new Uint8Array(4 * 4 * 4);
        for (let pixel = 0; pixel < 16; pixel++)
            source.fill(pixel, pixel * 4, pixel * 4 + 4);
        const result = packLatitudeRaster(source, 4, 4, 2, 1);
        expect([result.packedWidth, result.packedHeight]).toEqual([6, 8]);
        const red = Array.from({ length: 8 }, (_, row) => Array.from({ length: 6 }, (_, column) => result.data[(row * 6 + column) * 4]));
        expect(red).toEqual([[11, 8, 9, 10, 11, 8], [7, 4, 5, 6, 7, 4], [3, 0, 1, 2, 3, 0], [3, 0, 1, 2, 3, 0], [15, 12, 13, 14, 15, 12], [15, 12, 13, 14, 15, 12], [11, 8, 9, 10, 11, 8], [7, 4, 5, 6, 7, 4]]);
        expect(() => packLatitudeRaster(source, 4, 4, 3, 1)).toThrow();
    });
    it('fills neutral no-data while preserving direct source pixels and provenance', () => {
        const enhanced = new Uint8Array([60, 80, 100, 255, 0, 0, 0, 255, 80, 100, 120, 255, 100, 120, 140, 255]);
        const detail = new Uint8Array(16).fill(100);
        const result = completeEnhancedCoverage(enhanced, detail, detail, { width: 4, height: 1 }, ['measured-albedo', 'measured-topography']);
        expect(Array.from(result.rgba.subarray(0, 4))).toEqual([60, 80, 100, 255]);
        expect(Array.from(result.rgba.subarray(4, 8))).toEqual([73, 93, 113, 255]);
        expect(result.metadata.filledPixelCount).toBe(1);
        expect(result.metadata.referenceSources).toEqual(['measured-albedo', 'measured-topography']);
        expect(Array.from(enhanced.subarray(4, 8))).toEqual([0, 0, 0, 255]);
    });
    it('applies declared exposure independently to channels while retaining alpha', () => {
        const pixels = new Uint8Array([128, 128, 128, 77]);
        applySurfaceExposure(pixels, [1.4, 2.2, 0.9]);
        expect(Array.from(pixels)).toEqual([171, 192, 156, 77]);
        expect(() => applySurfaceExposure(pixels, [0, 1, 1])).toThrow();
    });
    it('rejects malformed source atmosphere records', () => { expect(() => readAtmosphereModel({ schema: 'cssearth-atmosphere-model@1', rayleigh: {} })).toThrow(); });
});
