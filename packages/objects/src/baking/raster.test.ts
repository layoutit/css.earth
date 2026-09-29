import { describe, expect, it } from 'vitest';
import { completeEnhancedCoverage, lightingFrame, packLatitudeRaster, applySurfaceExposure, readAtmosphereModel } from './index.js';
import type { LambertRasterConfig } from './index.js';
const lighting: LambertRasterConfig = { minimumLightViewZ: -1, maximumLightViewZ: 1, frameCount: 256, shadowlessFloodLimbFloor: 0.35, ambientIntensity: 0.05, radiusScale: 0.505, terminator: [0, 0.1], maximumAlpha: 0.95 };
describe('prepared raster operators', () => {
    it('retains independently frozen Lambert phase and flood pixels', () => {
        // The middle row of a 24 px frame: full night, the terminator at half phase, and the shadowless flood frame.
        const middleRows = {
            0: Array(24).fill(242),
            128: [...Array(12).fill(242), 237, 210, 189, 168, 147, 126, 105, 84, 63, 42, 21, 0],
            255: [114, 83, 63, 48, 36, 26, 18, 12, 7, 4, 1, 0, 0, 1, 4, 7, 12, 18, 26, 36, 48, 63, 83, 114],
        };
        for (const [frame, row] of Object.entries(middleRows)) {
            const pixels = lightingFrame(24, Number(frame), lighting);
            expect(Array.from({ length: 24 }, (_, x) => pixels[(12 * 24 + x) * 4 + 3])).toEqual(row);
            expect(pixels.every((value, index) => index % 4 === 3 || value === 0)).toBe(true);
            expect([pixels[3], pixels[(24 * 24 - 1) * 4 + 3]]).toEqual([0, 0]);
            expect(lightingFrame(24, Number(frame), lighting)).toEqual(pixels);
        }
    });
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
