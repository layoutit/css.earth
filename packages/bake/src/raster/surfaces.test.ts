import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { loadNativeSourcePoleSampler } from './surfaces.ts';
import { parseRasterRecipe, prepareRasterAssets } from './assets.ts';
import { loadNativeObservationPoleSampler, parseObservationLens } from '../../../../tools/objects/observation/raster.mts';

describe('native source pole sampling', () => {
    it('packs a lower-resolution surface without changing the shared layout or pole dimensions', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'cssearth-small-surface-'));
        try {
            await sharp({ create: { width: 128, height: 64, channels: 3, background: '#488ecc' } }).png().toFile(join(directory, 'source.png'));
            const config = parseRasterRecipe({ schema: 'cssearth-raster-recipe@1', publicBase: '/scenes/test/', sourceWidth: 128, sourceHeight: 64,
                width: 128, height: 64, latitudeBands: 4, polarTile: 16, resample: 'density-before-pack',
                polarProjection: 'orthographic-bilinear', polesOutput: 'poles-{id}{suffix}.webp', surfaceMetadata: { schema: 'test-assets@1' },
                thumbnail: {size: 8}, surfaces: [{id: 'science', source: 'source.png', falseColor: true, output: '{id}{suffix}.webp', thumbnail: 'thumb-{id}.webp', resolutionScale: .5}] });
            const prepared = await prepareRasterAssets({config,sourceDirectory:directory,publicDirectory:directory,outputDirectory:directory});
            expect(prepared.surfaceDimensions).toEqual({width:128,height:64});
            expect(prepared.surfaces.science.dimensions).toEqual({width:64,height:32});
            const doubled = await sharp(join(directory,'science@2x.webp')).metadata();
            expect([doubled.width,doubled.height]).toEqual([136,96]);
            const pole = await sharp(join(directory,'poles-science@2x.webp')).metadata();
            expect([pole.width,pole.height]).toEqual([64,32]);
            // One canonical density: no 1x map or pole sprite is written, and both addresses name the @2x file.
            await expect(readFile(join(directory,'science.webp'))).rejects.toThrow();
            await expect(readFile(join(directory,'poles-science.webp'))).rejects.toThrow();
            expect([prepared.surfaces.science.url, prepared.surfaces.science.url2x]).toEqual(['/scenes/test/science@2x.webp', '/scenes/test/science@2x.webp']);
            expect(() => parseRasterRecipe({...config,densities:[1,2]})).toThrow(/one canonical density/);
            // A lighting recipe naming a shared bank parses to the bank's fields plus its own, and may not restate the bank's.
            const lighting = { bank: 'sphere', presentationSize: 460, defaultFrame: 230, bankSchema: 'test-bank@1', billboardSchema: 'test-billboard@1', metadata: { schema: 'test-lighting@1' } };
            const banked = parseRasterRecipe({ ...config, lighting }).lighting!;
            expect([banked.bank, banked.frameSize, banked.columns, banked.frameCount, banked.rowOutput, banked.terminator, banked.presentationSize]).toEqual(['sphere', 512, 8, 256, 'lighting-{density}x-row-{row}.webp', [0, 0.1], 460]);
            expect(() => parseRasterRecipe({ ...config, lighting: { ...lighting, frameSize: 512 } })).toThrow(/bank's/);
            expect(() => parseRasterRecipe({ ...config, lighting: { ...lighting, bank: 'cube' } })).toThrow(/Unknown lighting bank/);
            expect(() => parseRasterRecipe({...config,surfaces:[{...config.surfaces[0],resolutionScale:.3}]})).toThrow(/integer/);
        } finally { await rm(directory,{recursive:true,force:true}); }
    });
    it('centres the lens thumbnail on a declared longitude, wrapping across the map edge', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'cssearth-thumbnail-centre-'));
        try {
            // Red at the left edge (longitude 0), blue elsewhere: a crop centred on longitude 0 straddles the seam.
            const pixels = Buffer.alloc(128 * 64 * 3);
            for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) pixels.set(x < 4 || x >= 124 ? [255, 0, 0] : [0, 0, 255], (y * 128 + x) * 3);
            await sharp(pixels, { raw: { width: 128, height: 64, channels: 3 } }).png().toFile(join(directory, 'source.png'));
            const base = { schema: 'cssearth-raster-recipe@1', publicBase: '/scenes/test/', sourceWidth: 128, sourceHeight: 64,
                width: 128, height: 64, latitudeBands: 4, polarTile: 16, resample: 'density-before-pack',
                polarProjection: 'orthographic-bilinear', polesOutput: 'poles-{id}{suffix}.webp', surfaceMetadata: { schema: 'test-assets@1' },
                surfaces: [{ id: 'seam', source: 'source.png', falseColor: false, output: '{id}{suffix}.webp', thumbnail: 'thumb-{id}.webp' }] };
            const centre = async (thumbnail: Record<string, unknown>) => {
                const config = parseRasterRecipe({ ...base, thumbnail });
                await prepareRasterAssets({ config, sourceDirectory: directory, publicDirectory: directory, outputDirectory: directory });
                // Read the bytes: sharp caches decoded files by path, and the thumbnail is rewritten between calls.
                const { data } = await sharp(await readFile(join(directory, 'thumb-seam.webp'))).raw().toBuffer({ resolveWithObject: true });
                return [...data.subarray((4 * 8 + 4) * 3, (4 * 8 + 4) * 3 + 3)];
            };
            // Downscaling blends the narrow seam band with its blue surroundings, so compare channels rather than exact colours.
            const [defaultRed, , defaultBlue] = await centre({ size: 8 });
            expect(defaultBlue).toBeGreaterThan(defaultRed + 200);
            const [seamRed, , seamBlue] = await centre({ size: 8, centerLongitudeDegrees: 0 });
            expect(seamRed).toBeGreaterThan(seamBlue);
            expect(() => parseRasterRecipe({ ...base, thumbnail: { size: 8, centerLongitudeDegrees: 'east' } })).toThrow(/finite/);
        } finally { await rm(directory, { recursive: true, force: true }); }
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
