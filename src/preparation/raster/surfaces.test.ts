import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { loadNativeSourcePoleSampler } from './surfaces.js';
import { parseRasterRecipe, prepareRasterAssets } from './index.js';
import { loadNativeObservationPoleSampler, parseObservationLens } from '../../../tools/objects/observation/raster.mts';

describe('native source pole sampling', () => {
    it('packs a lower-resolution surface without changing the shared layout or pole dimensions', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'cssearth-small-surface-'));
        try {
            await sharp({ create: { width: 128, height: 64, channels: 3, background: '#488ecc' } }).png().toFile(join(directory, 'source.png'));
            const config = parseRasterRecipe({ schema: 'cssearth-raster-recipe@1', publicBase: '/scenes/test/', sourceWidth: 128, sourceHeight: 64,
                width: 128, height: 64, latitudeBands: 4, polarTile: 16, densities: [1,2], resample: 'density-before-pack',
                polarProjection: 'orthographic-bilinear', polesCombined: false, polesOutput: 'poles-{id}{suffix}.webp', surfaceMetadata: { schema: 'test-assets@1' },
                thumbnail: {size: 8, quality: 80}, surfaces: [{id: 'science', source: 'source.png', falseColor: true, output: '{id}{suffix}.webp', thumbnail: 'thumb-{id}.webp', resolutionScale: .5}] });
            const prepared = await prepareRasterAssets({config,sourceDirectory:directory,publicDirectory:directory,outputDirectory:directory});
            expect(prepared.surfaceDimensions).toEqual({width:128,height:64});
            expect(prepared.surfaces.science.dimensions).toEqual({width:64,height:32});
            const small = await sharp(join(directory,'science.webp')).metadata(), doubled = await sharp(join(directory,'science@2x.webp')).metadata();
            expect([small.width,small.height,doubled.width,doubled.height]).toEqual([68,48,136,96]);
            const pole = await sharp(join(directory,'poles-science.webp')).metadata();
            expect([pole.width,pole.height]).toEqual([32,16]);
            expect(() => parseRasterRecipe({...config,surfaces:[{...config.surfaces[0],resolutionScale:.3}]})).toThrow(/integer/);
        } finally { await rm(directory,{recursive:true,force:true}); }
    });
    it('uses original image texels in the established wrapped normalized map domain', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'cssearth-native-pole-'));
        try {
            const pixels = Buffer.alloc(8 * 4 * 4);
            for (let y = 0; y < 4; y += 1) for (let x = 0; x < 8; x += 1)
                pixels.set([x * 20, y * 40, 10, 80 + x], (y * 8 + x) * 4);
            const path = join(directory, 'source.png');
            await writeFile(path, await sharp(pixels, { raw: { width: 8, height: 4, channels: 4 } }).png().toBuffer());
            const sampler = await loadNativeSourcePoleSampler(path), color = [0, 0, 0, 0];
            expect(sampler.sample(67.5, 0, color)).toBe(true);
            // 67.5° is native column 1; latitude 0 lies halfway between rows 1 and 2.
            expect(color).toEqual([20, 60, 10, 81]);
            expect(sampler.sample(360, 0, color)).toBe(true);
            // The old resize path wrapped the longitude seam before the polar projection.
            expect(color).toEqual([70, 60, 10, 83.5]);
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });

    it('checks connected black-fill coverage in native contributors before a polar output marker', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'cssearth-native-coverage-'));
        try {
            const pixels = Buffer.alloc(8 * 4 * 3);
            for (let y = 0; y < 2; y += 1) for (let x = 0; x < 8; x += 1)
                pixels.set([40 + x, 80 + y, 120], (y * 8 + x) * 3);
            const path = join(directory, 'coverage.png');
            await writeFile(path, await sharp(pixels, { raw: { width: 8, height: 4, channels: 3 } }).png().toBuffer());
            const plan = parseObservationLens({ id: 'photo', input: 'coverage.png', nativeSourcePoles: true,
                coverage: { kind: 'black-fill', southConnected: true } });
            const sampler = await loadNativeObservationPoleSampler(path, plan), color = [0, 0, 0, 0];
            expect(sampler.sample(67.5, 67.5, color)).toBe(true);
            expect(color).toEqual([41, 80, 120, 255]);
            expect(sampler.sample(67.5, -67.5, color)).toBe(false);
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });
});
