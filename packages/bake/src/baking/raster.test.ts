import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { completeEnhancedCoverage, packLatitudeRaster, applySurfaceExposure, readAtmosphereModel } from './index.js';
describe('prepared raster operators', () => {
    it('packs reversed latitude bands with wrapped horizontal and clamped vertical gutters', () => {
        const source = new Uint8Array(4 * 4 * 4);
        for (let pixel = 0; pixel < 16; pixel++)
            source.fill(pixel, pixel * 4, pixel * 4 + 4);
        const result = packLatitudeRaster(source, 4, 4, 2, 1);
        assert.deepEqual(([result.packedWidth, result.packedHeight]), [6, 8]);
        const red = Array.from({ length: 8 }, (_, row) => Array.from({ length: 6 }, (_, column) => result.data[(row * 6 + column) * 4]));
        assert.deepEqual(red, [[11, 8, 9, 10, 11, 8], [7, 4, 5, 6, 7, 4], [3, 0, 1, 2, 3, 0], [3, 0, 1, 2, 3, 0], [15, 12, 13, 14, 15, 12], [15, 12, 13, 14, 15, 12], [11, 8, 9, 10, 11, 8], [7, 4, 5, 6, 7, 4]]);
        assert.throws(() => packLatitudeRaster(source, 4, 4, 3, 1));
    });
    it('fills neutral no-data while preserving direct source pixels and provenance', () => {
        const enhanced = new Uint8Array([60, 80, 100, 255, 0, 0, 0, 255, 80, 100, 120, 255, 100, 120, 140, 255]);
        const detail = new Uint8Array(16).fill(100);
        const result = completeEnhancedCoverage(enhanced, detail, detail, { width: 4, height: 1 }, ['measured-albedo', 'measured-topography']);
        assert.deepEqual(Array.from(result.rgba.subarray(0, 4)), [60, 80, 100, 255]);
        assert.deepEqual(Array.from(result.rgba.subarray(4, 8)), [73, 93, 113, 255]);
        assert.equal(result.metadata.filledPixelCount, 1);
        assert.deepEqual(result.metadata.referenceSources, ['measured-albedo', 'measured-topography']);
        assert.deepEqual(Array.from(enhanced.subarray(4, 8)), [0, 0, 0, 255]);
    });
    it('applies declared exposure independently to channels while retaining alpha', () => {
        const pixels = new Uint8Array([128, 128, 128, 77]);
        applySurfaceExposure(pixels, [1.4, 2.2, 0.9]);
        assert.deepEqual(Array.from(pixels), [171, 192, 156, 77]);
        assert.throws(() => applySurfaceExposure(pixels, [0, 1, 1]));
    });
    it('rejects malformed source atmosphere records', () => { assert.throws(() => readAtmosphereModel({ schema: 'cssearth-atmosphere-model@1', rayleigh: {} })); });
});
