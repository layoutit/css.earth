import sharp from 'sharp';
import { resolve } from 'node:path';
import { completeEnhancedCoverage, completeEnhancedPolarTile, polarTile, createPolarSprite, packLatitudeRaster, applySurfaceExposure } from '@cssearth/objects';
import { RASTER_DENSITY, type RasterRecipe } from './config.js';
import { raster, readRgba, assetPath } from './io.js';
import { withAlpha, type ObservationInterpretation, type InterpretedPlate } from './science.js';
import { composeLimbPreview } from './emission-preview.js';
import { missingCoverageColor } from '../../platform/prepare-missing-coverage.mts';
type NativePoleSampler = { readonly sample: (longitudeDegrees: number, latitudeDegrees: number, color: number[]) => boolean; };

/** Sample the original image in the exact normalized 2:1 domain used by the established `fit: 'fill'` resize.
 * This changes only pole preparation: the delivered latitude-band image still goes through its existing resize. */
export async function loadNativeSourcePoleSampler(path: string): Promise<NativePoleSampler> {
    const image = sharp(path);
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width < 2 || metadata.height < 2)
        throw new TypeError(`Native pole source has invalid dimensions: ${path}`);
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== metadata.width || info.height !== metadata.height || info.channels !== 4)
        throw new Error(`Native pole source decode drifted: ${path}`);
    const { width, height } = info;
    const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
    return { sample(longitudeDegrees, latitudeDegrees, color) {
        if (!Number.isFinite(longitudeDegrees) || !Number.isFinite(latitudeDegrees) || latitudeDegrees < -90 || latitudeDegrees > 90)
            return false;
        const sourceX = modulo(longitudeDegrees, 360) / 360 * width - .5;
        const sourceY = Math.max(0, Math.min(height - 1, (90 - latitudeDegrees) / 180 * height - .5));
        const x0 = Math.floor(sourceX), x1 = x0 + 1, y0 = Math.floor(sourceY), y1 = Math.min(height - 1, y0 + 1);
        const xAmount = sourceX - x0, yAmount = sourceY - y0;
        for (let channel = 0; channel < 4; channel += 1) {
            const top = data[(y0 * width + modulo(x0, width)) * 4 + channel] * (1 - xAmount) + data[(y0 * width + modulo(x1, width)) * 4 + channel] * xAmount;
            const bottom = data[(y1 * width + modulo(x0, width)) * 4 + channel] * (1 - xAmount) + data[(y1 * width + modulo(x1, width)) * 4 + channel] * xAmount;
            color[channel] = top * (1 - yAmount) + bottom * yAmount;
        }
        return true;
    } };
}

/** Apply the declared pointwise exposure shoulder to a direct source sampler. */
export function applyNativeSurfaceExposure(source: NativePoleSampler, shoulders: readonly number[] | undefined): NativePoleSampler {
    if (!shoulders) return source;
    return { sample(longitudeDegrees, latitudeDegrees, color) {
        if (!source.sample(longitudeDegrees, latitudeDegrees, color)) return false;
        for (let channel = 0; channel < 3; channel += 1) {
            const shoulder = shoulders[channel]!;
            color[channel] = 255 * ((1 - Math.exp(-shoulder * color[channel]! / 255)) / (1 - Math.exp(-shoulder)));
        }
        return true;
    } };
}
export async function prepareSurfaces(config: RasterRecipe, sourceDirectory: string, publicDirectory: string, interpret?: ObservationInterpretation) {
    const decoded = new Map<string, Uint8Array>();
    const metadata: Record<string, unknown> = {};
    const interpretations: Record<string, Record<string, Readonly<Record<string, unknown>>>> = {};
    const nativeSourcePoles = new Map<string, Promise<NativePoleSampler>>();
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
        let thumbnailLimb: InterpretedPlate | undefined;
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
        const density = RASTER_DENSITY, scale = surface.resolutionScale ?? 1;
        const width = config.width * density * scale, height = config.height * density * scale;
        let nearest = false, pixels: Uint8Array;
        let nativePhotograph: NativePoleSampler | undefined;
        if (surface.science) {
            if (!interpret) throw new TypeError(`Surface ${surface.id} declares a scientific interpretation but none was supplied.`);
            const interpreted = await interpret({ id: surface.id, source: surface.source, science: surface.science, ...(surface.nativeSourcePoles ? { nativeSourcePoles: true } : {}) }, width, height, density);
            nearest = interpreted.nearest; pixels = withAlpha(interpreted, width, height); nativePhotograph = interpreted.nativePhotograph;
            if (interpreted.report) (interpretations[surface.id] ??= {})[density] = interpreted.report;
            if (config.emission) {
                const plates = interpreted.plates;
                if (!plates) throw new TypeError(`Surface ${surface.id} declares emission but its interpretation returned no plates.`);
                if (surface.thumbnailFromLimbPlate) thumbnailLimb = plates.limb;
                const encode = (plate: InterpretedPlate) => plate.lossless ? { lossless: true, effort: 6 } : { quality: 90, alphaQuality: 100, smartSubsample: true, effort: 6 };
                await raster(plates.offLimb.data, plates.offLimb.size, plates.offLimb.size).webp(encode(plates.offLimb)).toFile(assetPath(publicDirectory, config.emission.offLimbOutput, density, surface.id));
                await raster(plates.limb.data, plates.limb.size, plates.limb.size).webp(encode(plates.limb)).toFile(assetPath(publicDirectory, config.emission.limbOutput, density, surface.id));
            }
        } else {
            pixels = source ?? await readRgba(resolve(sourceDirectory, surface.source), width, height, true, surface.sharpen);
            if (surface.nativeSourcePoles) {
                let pending = nativeSourcePoles.get(surface.source);
                if (!pending) {
                    pending = loadNativeSourcePoleSampler(resolve(sourceDirectory, surface.source));
                    nativeSourcePoles.set(surface.source, pending);
                }
                nativePhotograph = applyNativeSurfaceExposure(await pending, surface.exposure);
            }
        }
        if (surface.exposure)
            applySurfaceExposure(pixels, surface.exposure);
        // The legacy source-packed route resized an already-packed raster, so a filter footprint could cross
        // stored latitude-strip gutters. This opt-in resizes the completed source map first, then creates those
        // same target-size gutters. It deliberately keeps coverage completion at the native source resolution.
        if (source && config.unpackedResizeBeforePack && (config.sourceWidth !== width || config.sourceHeight !== height)) {
            const resized = await raster(pixels, config.sourceWidth, config.sourceHeight)
                .resize(width, height, { kernel: 'lanczos3' }).raw().toBuffer();
            if (resized.length !== width * height * 4) throw new Error(`Unpacked source resize drifted for ${surface.id}.`);
            pixels = resized;
        }
        const resizedUnpacked = Boolean(source && config.unpackedResizeBeforePack);
        const packingWidth = resizedUnpacked ? width : source ? config.sourceWidth : width;
        const packingHeight = resizedUnpacked ? height : source ? config.sourceHeight : height;
        const packed = packLatitudeRaster(pixels, packingWidth, packingHeight, config.latitudeBands, Math.max(2, packingHeight / config.latitudeBands / 4));
        let image = raster(packed.data, packed.packedWidth, packed.packedHeight);
        if (source && !resizedUnpacked && (packingWidth !== width || packingHeight !== height))
            image = image.resize(width + height / config.latitudeBands / 2, height + height / 2, { kernel: 'lanczos3' });
        // Numeric and categorical surfaces keep their selected values: lossless, no chroma subsampling.
        const webp = nearest ? { lossless: true, effort: 6 } : config.resample === 'source-packed' ? { quality: 90, smartSubsample: true } : { quality: 88, smartSubsample: true, effort: 6 };
        const output = assetPath(publicDirectory, surface.output, density, surface.id);
        if (surface.encoding) {
            // Chrome decodes these maps faster as JPEG than as lossy WebP,
            // and baseline faster than progressive. Encode from the same
            // prepared raster, never the WebP. A grayscale map has one channel.
            const { encoder, progressive, quality, grayscale = false, chromaSubsampling } = surface.encoding;
            const pixels = image.clone().removeAlpha();
            await (grayscale ? pixels.grayscale().toColourspace('b-w') : pixels).jpeg({ quality, mozjpeg: encoder === 'mozjpeg', progressive, ...(chromaSubsampling ? { chromaSubsampling } : {}) }).toFile(output);
            // Lens thumbnails come from the WebP encoding of the prepared map, held in memory only.
            if (config.thumbnail.crop)
                thumbnailSource = await image.clone().webp(webp).toBuffer();
        }
        else
            await image.webp(webp).toFile(output);
        if (!config.polesCombined) {
            const polar = createPolarSprite(pixels, width, height, config.polarTile * density, config.latitudeBands, nativePhotograph
                ? { sampling: nearest ? 'nearest' : 'bilinear', nativePhotograph, missingColor: missingCoverageColor }
                : { sampling: nearest ? 'nearest' : 'bilinear' });
            await raster(polar, config.polarTile * density * 2, config.polarTile * density).webp({ lossless: true, effort: 6 }).toFile(assetPath(publicDirectory, config.polesOutput, density, surface.id));
        }
        if (config.resample === 'density-before-pack') {
            const cropSize = Math.round(height / 2), top = Math.round((height - cropSize) / 2);
            // The crop is centred on the declared longitude (column x is longitude x / width * 360) and wraps across the map edge.
            // A lens that observed one hemisphere names its own centre, so its picker tile is not a crop of the data gap.
            const centerLongitude = surface.thumbnailCenterLongitudeDegrees ?? config.thumbnail.centerLongitudeDegrees;
            const centre = centerLongitude === undefined ? width / 2 : ((centerLongitude / 360) * width % width + width) % width;
            const left = Math.round(centre - cropSize / 2), crop = new Uint8Array(cropSize * cropSize * 4);
            for (let y = 0; y < cropSize; y++) for (let x = 0; x < cropSize; x++) {
                const sourceX = ((left + x) % width + width) % width, offset = ((top + y) * width + sourceX) * 4;
                crop.set(pixels.subarray(offset, offset + 4), (y * cropSize + x) * 4);
            }
            await raster(crop, cropSize, cropSize).resize(config.thumbnail.size, config.thumbnail.size, { kernel: nearest ? 'nearest' : 'lanczos3' }).removeAlpha().webp(nearest ? { lossless: true, effort: 6 } : { quality: config.thumbnail.quality, effort: 6 }).toFile(assetPath(publicDirectory, surface.thumbnail, 1, surface.id));
        }
        // The authored crop is in canonical-density map pixels.
        if (config.thumbnail.crop)
            await sharp(thumbnailSource ?? assetPath(publicDirectory, surface.output, RASTER_DENSITY, surface.id)).extract(config.thumbnail.crop).resize(config.thumbnail.size, config.thumbnail.size, { kernel: 'lanczos3' }).webp({ quality: config.thumbnail.quality }).toFile(assetPath(publicDirectory, surface.thumbnail, 1, surface.id));
        if (thumbnailLimb) {
            const plateSize = thumbnailLimb.size, disc = composeLimbPreview(thumbnailLimb, pixels);
            await raster(disc, plateSize, plateSize).resize(config.thumbnail.size, config.thumbnail.size, { kernel: 'lanczos3' })
                .webp({ quality: config.thumbnail.quality, alphaQuality: 100, effort: 6 })
                .toFile(assetPath(publicDirectory, surface.thumbnail, 1, surface.id));
        }
    }
    if (config.polesCombined) {
        const density = RASTER_DENSITY, tileSize = config.polarTile * density, width = tileSize * preparedSources.length * 2;
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
    return { metadata, decoded, interpretations };
}
