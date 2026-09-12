import sharp from 'sharp';
import { resolve } from 'node:path';
import { completeEnhancedCoverage, completeEnhancedPolarTile, polarTile, createPolarSprite, packLatitudeRaster, applySurfaceExposure } from '@cssearth/objects';
import type { RasterRecipe } from './config.js';
import { raster, readRgba, assetPath } from './io.js';
import { withAlpha, type ObservationInterpretation } from './science.js';
export async function prepareSurfaces(config: RasterRecipe, sourceDirectory: string, publicDirectory: string, interpret?: ObservationInterpretation) {
    const decoded = new Map<string, Uint8Array>();
    const metadata: Record<string, unknown> = {};
    const load = async (path: string) => { let data = decoded.get(path); if (!data) {
        data = await readRgba(resolve(sourceDirectory, path), config.sourceWidth, config.sourceHeight);
        decoded.set(path, data);
    } return data; };
    const preparedSources: {
        id: string;
        rgba: Uint8Array;
        fallback?: Uint8Array;
    }[] = [];
    for (const surface of config.surfaces) {
        let source: Uint8Array | undefined;
        let fallback: Uint8Array | undefined;
        let thumbnailSource: Buffer | undefined;
        if (config.resample === 'source-packed') {
            source = await load(surface.source);
            if (surface.coverage) {
                fallback = await load(surface.coverage.normal);
                const completed = completeEnhancedCoverage(source, fallback, await load(surface.coverage.topography), { width: config.sourceWidth, height: config.sourceHeight }, surface.coverage.references);
                source = completed.rgba;
                metadata[surface.id] = completed.metadata;
            }
            preparedSources.push({ id: surface.id, rgba: source, fallback });
        }
        for (const density of config.densities) {
            const width = config.width * density, height = config.height * density;
            let nearest = false, pixels: Uint8Array;
            if (surface.science) {
                if (!interpret) throw new TypeError(`Surface ${surface.id} declares a scientific interpretation but none was supplied.`);
                const interpreted = await interpret({ id: surface.id, source: surface.source, science: surface.science }, width, height);
                nearest = interpreted.nearest; pixels = withAlpha(interpreted, width, height);
            } else pixels = source ?? await readRgba(resolve(sourceDirectory, surface.source), width, height, true, surface.sharpen?.[density - 1]);
            if (surface.exposure)
                applySurfaceExposure(pixels, surface.exposure);
            const packingWidth = source ? config.sourceWidth : width, packingHeight = source ? config.sourceHeight : height;
            const packed = packLatitudeRaster(pixels, packingWidth, packingHeight, config.latitudeBands, Math.max(2, packingHeight / config.latitudeBands / 4));
            let image = raster(packed.data, packed.packedWidth, packed.packedHeight);
            if (source && (packingWidth !== width || packingHeight !== height))
                image = image.resize(width + height / config.latitudeBands / 2, height + height / 2, { kernel: 'lanczos3' });
            // Numeric and categorical surfaces keep their selected values: lossless, no chroma subsampling.
            const webp = nearest ? { lossless: true, effort: 6 } : config.resample === 'source-packed' ? { quality: density === 1 ? 88 : 90, smartSubsample: true } : { quality: 88, smartSubsample: true, effort: 6 };
            const output = assetPath(publicDirectory, surface.output, density, surface.id);
            if (surface.encoding) {
                // Chrome decodes these maps faster as JPEG than as lossy WebP,
                // and baseline faster than progressive. Encode from the same
                // prepared raster, never the WebP. A grayscale map has one channel.
                const { encoder, progressive, quality, grayscale = false, chromaSubsampling } = surface.encoding;
                const pixels = image.clone().removeAlpha();
                await (grayscale ? pixels.grayscale().toColourspace('b-w') : pixels).jpeg({ quality, mozjpeg: encoder === 'mozjpeg', progressive, ...(chromaSubsampling ? { chromaSubsampling } : {}) }).toFile(output);
                // Lens thumbnails keep their accepted source: the WebP encoding
                // of the density-1 map, now held in memory only.
                if (density === 1 && config.thumbnail.crop)
                    thumbnailSource = await image.clone().webp(webp).toBuffer();
            }
            else
                await image.webp(webp).toFile(output);
            if (!config.polesCombined) {
                const polar = createPolarSprite(pixels, width, height, config.polarTile * density, config.latitudeBands, { sampling: nearest ? 'nearest' : 'bilinear' });
                await raster(polar, config.polarTile * density * 2, config.polarTile * density).webp({ lossless: true, effort: 6 }).toFile(assetPath(publicDirectory, config.polesOutput, density, surface.id));
            }
            if (config.resample === 'density-before-pack' && density === 2) {
                const cropSize = Math.round(height / 2);
                await raster(pixels, width, height).extract({ left: Math.round((width - cropSize) / 2), top: Math.round((height - cropSize) / 2), width: cropSize, height: cropSize }).resize(config.thumbnail.size, config.thumbnail.size, { kernel: nearest ? 'nearest' : 'lanczos3' }).removeAlpha().webp(nearest ? { lossless: true, effort: 6 } : { quality: config.thumbnail.quality, effort: 6 }).toFile(assetPath(publicDirectory, surface.thumbnail, 1, surface.id));
            }
        }
        if (config.thumbnail.crop)
            await sharp(thumbnailSource ?? assetPath(publicDirectory, surface.output, 1, surface.id)).extract(config.thumbnail.crop).resize(config.thumbnail.size, config.thumbnail.size, { kernel: 'lanczos3' }).webp({ quality: config.thumbnail.quality }).toFile(assetPath(publicDirectory, surface.thumbnail, 1, surface.id));
    }
    if (config.polesCombined)
        for (const density of config.densities) {
            const tileSize = config.polarTile * density, width = tileSize * preparedSources.length * 2;
            const atlas = new Uint8Array(width * tileSize * 4);
            for (const [surfaceIndex, surface] of preparedSources.entries())
                for (let poleIndex = 0; poleIndex < 2; poleIndex++) {
                    const dimensions = { width: config.sourceWidth, height: config.sourceHeight, latitudeBands: config.latitudeBands };
                    let tile = polarTile(surface.rgba, tileSize, poleIndex === 0, dimensions);
                    if (surface.fallback)
                        tile = completeEnhancedPolarTile(tile, polarTile(surface.fallback, tileSize, poleIndex === 0, dimensions), tileSize);
                    for (let y = 0; y < tileSize; y++)
                        atlas.set(tile.subarray(y * tileSize * 4, (y + 1) * tileSize * 4), (y * width + (surfaceIndex * 2 + poleIndex) * tileSize) * 4);
                }
            await raster(atlas, width, tileSize).webp({ quality: 90, alphaQuality: 100 }).toFile(assetPath(publicDirectory, config.polesOutput, density));
        }
    return { metadata, decoded };
}
