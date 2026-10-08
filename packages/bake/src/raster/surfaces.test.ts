import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { loadNativeSourcePoleSampler, prepareSurfaces } from './surfaces.ts';
import { limbLender, readRasterRecipe, prepareRasterAssets, surfaceCoordinateWidth } from './assets.ts';
import { loadNativeObservationPoleSampler, parseObservationDataset } from '../objects/layers/observation/index.ts';
import { strongerLimb } from './science.ts';

describe('a borrowed limb plate drawn stronger', () => {
  it('raises the light the plate lets through to the power of its strength, and keeps the plate black', () => {
    // Four pixels: no darkening, half the light kept, a quarter kept, none kept.
    const plate = { data: new Uint8Array([0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 191, 0, 0, 0, 255]), size: 2, lossless: true };
    assert.deepEqual([...strongerLimb(plate, 1.5).data], [0, 0, 0, 0, 0, 0, 0, 165, 0, 0, 0, 223, 0, 0, 0, 255]);
    assert.equal(strongerLimb(plate, 1), plate); assert.throws(() => strongerLimb(plate, 0), /over 0/);
  });
  it('a plate borrowed as it is stays the lender\'s one file; one drawn stronger is a file of its own', () => {
    assert.equal(limbLender({ id: 'color', science: { kind: 'stellar-photometric-color' } }), 'color');
    assert.equal(limbLender({ id: 'phase-3', science: { limbOf: 'color' } }), 'color');
    assert.equal(limbLender({ id: 'phase-3', science: { limbOf: 'color', limbStrength: 1 } }), 'color');
    assert.equal(limbLender({ id: 'color-brightness', science: { limbOf: 'color', limbStrength: 1.5 } }), 'color-brightness');
    assert.equal(limbLender({ id: 'photograph' }), 'photograph');
  });
});

describe('native source pole sampling', () => {
    it('stores constant opaque lossless surfaces as one exact texel while preserving their coordinate domain and polar alpha', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'cssearth-constant-surface-'));
        try {
            const config = readRasterRecipe({ schema: 'cssearth-raster-recipe@2', publicBase: '/scenes/test/', sourceWidth: 64, sourceHeight: 32,
                width: 64, height: 32, latitudeBands: 4, polarTile: 16, resample: 'density-before-pack',
                polarProjection: 'orthographic-bilinear', polesOutput: 'poles-{id}{suffix}.webp', surfaceMetadata: { schema: 'test-assets@1' },
                thumbnail: { size: 8 }, surfaces: [{ id: 'color', source: 'color.json', falseColor: false, output: '{id}{suffix}.webp',
                    thumbnail: 'thumb-{id}.webp', science: { kind: 'test' } }] });
            for (const variant of ['constant', 'detail', 'alpha'] as const) {
                const prepared = await prepareRasterAssets({ config, sourceDirectory: directory, publicDirectory: directory, outputDirectory: directory,
                    interpret: async (_surface, width, height) => {
                        const data = new Uint8Array(width * height * 4);
                        for (let i = 0; i < data.length; i += 4) data.set([255, 224, 193, 255], i);
                        const centre = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
                        if (variant === 'detail') data[centre] = 254;
                        if (variant === 'alpha') data[centre + 3] = 254;
                        return { data, channels: 4, nearest: true };
                    } });
                const bytes = await readFile(join(directory, 'color@2x.webp'));
                const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
                if (variant === 'constant') {
                    assert.deepEqual(([info.width, info.height, ...data]), [1, 1, 255, 224, 193, 255]);
                    assert.deepEqual(prepared.surfaces.color.constantRaster, { packedWidth: 136, packedHeight: 96, rgba: [255, 224, 193, 255] });
                    assert.equal(surfaceCoordinateWidth(prepared, '/scenes/test/color@2x.webp', 1), 136);
                    assert.throws(() => surfaceCoordinateWidth(prepared, '/scenes/test/color@2x.webp', 136), /Invalid constant/);
                } else {
                    assert.deepEqual(([info.width, info.height]), [136, 96]);
                    assert.equal(prepared.surfaces.color.constantRaster, undefined);
                    assert.equal(surfaceCoordinateWidth(prepared, '/scenes/test/color@2x.webp', 136), 136);
                }
                const pole = await sharp(await readFile(join(directory, 'poles-color@2x.webp'))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
                assert.deepEqual(([pole.info.width, pole.info.height]), [64, 32]);
                assert.equal(pole.data.some((v, i) => i % 4 === 3 && v === 0), true);
                assert.equal((await sharp(await readFile(join(directory, 'thumb-color.webp'))).metadata()).width, 8);
            }
        } finally { await rm(directory, { recursive: true, force: true }); }
    });
    it('adds lossless numeric maps to source-packed angular poles without changing photographic assets', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'cssearth-numeric-angular-'));
        try {
            await sharp({create:{width:128,height:64,channels:3,background:'#488ecc'}}).png().toFile(join(directory,'photo.png'));
            const base = {schema:'cssearth-raster-recipe@2',publicBase:'/scenes/test/',sourceWidth:128,sourceHeight:64,
                width:64,height:32,latitudeBands:4,polarTile:16,resample:'source-packed',unpackedResizeBeforePack:true,
                polarProjection:'angular-nearest',polesOutput:'poles-{id}{suffix}.webp',surfaceMetadata:{schema:'test@1'},
                thumbnail:{size:8,crop:{left:12,top:12,width:16,height:16}},surfaces:[{id:'photo',source:'photo.png',falseColor:false,output:'{id}{suffix}.webp',thumbnail:'thumb-{id}.webp'}]};
            await prepareSurfaces(readRasterRecipe(base),directory,directory);
            const names=['photo@2x.webp','poles-photo@2x.webp','thumb-photo.webp'];
            const before=await Promise.all(names.map(name=>readFile(join(directory,name))));
            const science={id:'height',source:'native.tif',falseColor:true,output:'{id}{suffix}.webp',thumbnail:'thumb-{id}.webp',
                science:{scientific:{displaySampling:'nearest'}}};
            const recipe={...base,surfaces:[...base.surfaces,science]},config=readRasterRecipe(recipe);
            await prepareSurfaces(config,directory,directory,async (_surface,width,height)=>{
                const data=new Uint8Array(width*height*3);
                for(let y=0;y<height;y++)for(let x=0;x<width;x++)data.set(y<height/2?[1,73,137]:[199,17,91],(y*width+x)*3);
                return {data,channels:3,nearest:true};
            });
            for(let i=0;i<names.length;i++)assert.deepEqual((await readFile(join(directory,names[i]))), before[i]);
            for(const name of ['height@2x.webp','poles-height@2x.webp','thumb-height.webp']){
                const bytes=await readFile(join(directory,name));assert.equal(bytes.includes(Buffer.from('VP8L')), true);
                const rgba=await sharp(bytes).ensureAlpha().raw().toBuffer();
                for(let i=0;i<rgba.length;i+=4)if(rgba[i+3])assert.ok(([[1,73,137],[199,17,91]]).some(item => isDeepStrictEqual(item, [...rgba.subarray(i,i+3)])));
            }
            assert.throws(()=>readRasterRecipe({...recipe,sourceWidth:256}), /canonical source dimensions/);
            assert.throws(()=>readRasterRecipe({...recipe,surfaces:[{...science,science:{scientific:{displaySampling:'bilinear'}}}]}), /nearest numeric/);
        } finally {await rm(directory,{recursive:true,force:true});}
    });
    it('packs a lower-resolution surface without changing the shared layout or pole dimensions', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'cssearth-small-surface-'));
        try {
            await sharp({ create: { width: 128, height: 64, channels: 3, background: '#488ecc' } }).png().toFile(join(directory, 'source.png'));
            const config = readRasterRecipe({ schema: 'cssearth-raster-recipe@2', publicBase: '/scenes/test/', sourceWidth: 128, sourceHeight: 64,
                width: 128, height: 64, latitudeBands: 4, polarTile: 16, resample: 'density-before-pack',
                polarProjection: 'orthographic-bilinear', polesOutput: 'poles-{id}{suffix}.webp', surfaceMetadata: { schema: 'test-assets@1' },
                thumbnail: {size: 8}, surfaces: [{id: 'science', source: 'source.png', falseColor: true, output: '{id}{suffix}.webp', thumbnail: 'thumb-{id}.webp', resolutionScale: .5}] });
            const prepared = await prepareRasterAssets({config,sourceDirectory:directory,publicDirectory:directory,outputDirectory:directory});
            assert.deepEqual(prepared.surfaceDimensions, {width:128,height:64});
            assert.deepEqual(prepared.surfaces.science.dimensions, {width:64,height:32});
            const doubled = await sharp(join(directory,'science@2x.webp')).metadata();
            assert.deepEqual(([doubled.width,doubled.height]), [136,96]);
            const pole = await sharp(join(directory,'poles-science@2x.webp')).metadata();
            assert.deepEqual(([pole.width,pole.height]), [64,32]);
            // One canonical density: no 1x map or pole sprite is written, and both addresses name the @2x file.
            await assert.rejects(readFile(join(directory,'science.webp')));
            await assert.rejects(readFile(join(directory,'poles-science.webp')));
            assert.deepEqual(([prepared.surfaces.science.url, prepared.surfaces.science.url2x]), ['/scenes/test/science@2x.webp', '/scenes/test/science@2x.webp']);
            assert.throws(() => readRasterRecipe({...config,densities:[1,2]}), /one canonical density/);
            // A lighting recipe names a shared bank and takes its authored law; it lays out no frames and states no law of its own.
            const lighting = { bank: 'sphere', presentationSize: 460, metadata: { note: 'test' } };
            const banked = readRasterRecipe({ ...config, lighting }).lighting!;
            assert.deepEqual(([banked.bank, banked.shadowlessFloodLimbFloor, banked.ambientIntensity, banked.terminator, banked.maximumAlpha, banked.presentationSize]), ['sphere', 0.35, 0.05, [0, 0.1], 0.95, 460]);
            assert.throws(() => readRasterRecipe({ ...config, lighting: { ...lighting, frameSize: 512 } }), /the sheet's layout is the lane's/);
            assert.throws(() => readRasterRecipe({ ...config, lighting: { ...lighting, ambientIntensity: 0.1 } }), /belongs to a shared bank/);
            assert.throws(() => readRasterRecipe({ ...config, lighting: { presentationSize: 460 } }), /one of the two/);
            assert.throws(() => readRasterRecipe({ ...config, lighting: { ...lighting, bank: 'cube' } }), /Unknown lighting bank/);
            assert.throws(() => readRasterRecipe({...config,surfaces:[{...config.surfaces[0],resolutionScale:.3}]}), /integer/);
        } finally { await rm(directory,{recursive:true,force:true}); }
    });
    it('draws a catalogue dataset over an earlier surface: empty cells take its pixels scaled, feature cells keep their color', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'cssearth-underlay-'));
        try {
            await sharp({ create: { width: 64, height: 32, channels: 3, background: { r: 200, g: 100, b: 50 } } }).png().toFile(join(directory, 'photo.png'));
            const photo = { id: 'photo', source: 'photo.png', falseColor: false, output: '{id}{suffix}.webp', thumbnail: 'thumb-{id}.webp' };
            const catalogue = { id: 'dunes', source: 'dunes.tif', falseColor: true, output: '{id}{suffix}.webp', thumbnail: 'thumb-{id}.webp',
                science: { scientific: { displaySampling: 'nearest' } }, underlay: { surface: 'photo', brightness: 0.5 } };
            const recipe = { schema: 'cssearth-raster-recipe@2', publicBase: '/scenes/test/', sourceWidth: 64, sourceHeight: 32,
                width: 64, height: 32, latitudeBands: 4, polarTile: 16, resample: 'density-before-pack',
                polarProjection: 'orthographic-bilinear', polesOutput: 'poles-{id}{suffix}.webp', surfaceMetadata: { schema: 'test-assets@1' },
                thumbnail: { size: 8 }, surfaces: [photo, catalogue] };
            const captured: Uint8Array[] = [];
            await prepareSurfaces(readRasterRecipe(recipe), directory, directory, async (_surface, width, height) => {
                // The left half holds a catalogued feature; the right half is empty and painted with a stand-in grid color.
                const data = new Uint8Array(width * height * 3), missing = new Uint8Array(width * height);
                for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
                    const i = y * width + x;
                    if (x < width / 2) data.set([223, 115, 255], i * 3); else { data.set([90, 90, 90], i * 3); missing[i] = 1; }
                }
                captured.push(missing);
                return { data, channels: 3, nearest: true, missing };
            });
            const rgba = await sharp(join(directory, 'dunes@2x.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            const colors = new Set<string>();
            for (let i = 0; i < rgba.data.length; i += 4) if (rgba.data[i + 3]) colors.add([...rgba.data.subarray(i, i + 3)].join(','));
            // Lossless: only the feature color and the half-bright photograph remain; the stand-in grid color is gone.
            assert.deepEqual([...colors].sort(), ['100,50,25', '223,115,255']);
            assert.equal(captured.length, 1);
            // A grey, 6-bit underlay: Rec. 709 luma of (200, 100, 50) is 117.3, times 0.5 is 59 (58.6 rounded), keeping 6 bits is 56.
            await prepareSurfaces(readRasterRecipe({ ...recipe, surfaces: [photo, { ...catalogue, underlay: { surface: 'photo', brightness: 0.5, grayscale: true, bits: 6 } }] }), directory, directory,
                async (_surface, width, height) => ({ data: new Uint8Array(width * height * 3).fill(90), channels: 3, nearest: true, missing: new Uint8Array(width * height).fill(1) }));
            const grey = await sharp(await readFile(join(directory, 'dunes@2x.webp'))).ensureAlpha().raw().toBuffer(); // sharp caches decoded files by path
            const greys = new Set<string>(); for (let i = 0; i < grey.length; i += 4) if (grey[i + 3]) greys.add([...grey.subarray(i, i + 3)].join(','));
            assert.deepEqual(([...greys]), ['56,56,56']);
            assert.throws(() => readRasterRecipe({ ...recipe, surfaces: [photo, { ...catalogue, underlay: { surface: 'photo', brightness: 0.5, bits: 9 } }] }), /bits must be an integer from 1 to 8, not 9/);
            assert.throws(() => readRasterRecipe({ ...recipe, surfaces: [catalogue, photo] }), /earlier surface photo/);
            assert.throws(() => readRasterRecipe({ ...recipe, surfaces: [photo, { ...catalogue, underlay: { surface: 'photo', brightness: 0 } }] }), /brightness must be in \(0, 1\], not 0/);
            assert.throws(() => readRasterRecipe({ ...recipe, surfaces: [photo, { ...catalogue, science: undefined }] }), /science dataset/);
        } finally { await rm(directory, { recursive: true, force: true }); }
    });
    it('centres the dataset thumbnail on a declared longitude, wrapping across the map edge', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'cssearth-thumbnail-centre-'));
        try {
            // Red at the left edge (longitude 0), blue elsewhere: a crop centred on longitude 0 straddles the seam.
            const pixels = Buffer.alloc(128 * 64 * 3);
            for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) pixels.set(x < 4 || x >= 124 ? [255, 0, 0] : [0, 0, 255], (y * 128 + x) * 3);
            await sharp(pixels, { raw: { width: 128, height: 64, channels: 3 } }).png().toFile(join(directory, 'source.png'));
            const base = { schema: 'cssearth-raster-recipe@2', publicBase: '/scenes/test/', sourceWidth: 128, sourceHeight: 64,
                width: 128, height: 64, latitudeBands: 4, polarTile: 16, resample: 'density-before-pack',
                polarProjection: 'orthographic-bilinear', polesOutput: 'poles-{id}{suffix}.webp', surfaceMetadata: { schema: 'test-assets@1' },
                surfaces: [{ id: 'seam', source: 'source.png', falseColor: false, output: '{id}{suffix}.webp', thumbnail: 'thumb-{id}.webp' }] };
            const centre = async (thumbnail: Record<string, unknown>) => {
                const config = readRasterRecipe({ ...base, thumbnail });
                await prepareRasterAssets({ config, sourceDirectory: directory, publicDirectory: directory, outputDirectory: directory });
                // Read the bytes: sharp caches decoded files by path, and the thumbnail is rewritten between calls.
                const { data } = await sharp(await readFile(join(directory, 'thumb-seam.webp'))).raw().toBuffer({ resolveWithObject: true });
                return [...data.subarray((4 * 8 + 4) * 3, (4 * 8 + 4) * 3 + 3)];
            };
            // Downscaling blends the narrow seam band with its blue surroundings, so compare channels rather than exact colors.
            const [defaultRed, , defaultBlue] = await centre({ size: 8 });
            assert.ok(defaultBlue > defaultRed + 200);
            const [seamRed, , seamBlue] = await centre({ size: 8, centerLongitudeDegrees: 0 });
            assert.ok(seamRed > seamBlue);
            assert.throws(() => readRasterRecipe({ ...base, thumbnail: { size: 8, centerLongitudeDegrees: 'east' } }), /finite/);
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
            assert.equal(sampler.sample(67.5, 0, color), true);
            // 67.5° is native column 1; latitude 0 lies halfway between rows 1 and 2.
            assert.deepEqual(color, [20, 60, 10, 81]);
            assert.equal(sampler.sample(360, 0, color), true);
            // The old resize path wrapped the longitude seam before the polar projection.
            assert.deepEqual(color, [70, 60, 10, 83.5]);
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
            const plan = parseObservationDataset({ id: 'photo', input: 'coverage.png', nativeSourcePoles: true,
                coverage: { kind: 'black-fill', southConnected: true } });
            const sampler = await loadNativeObservationPoleSampler(path, plan), color = [0, 0, 0, 0];
            assert.equal(sampler.sample(67.5, 67.5, color), true);
            assert.deepEqual(color, [41, 80, 120, 255]);
            assert.equal(sampler.sample(67.5, -67.5, color), false);
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });
});
