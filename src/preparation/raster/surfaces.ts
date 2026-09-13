import sharp from 'sharp';
import { resolve } from 'node:path';
import { completeEnhancedCoverage, completeEnhancedPolarTile, polarTile, createPolarSprite, packLatitudeRaster, applySurfaceExposure } from '@cssearth/objects';
import type { RasterRecipe } from './config.js';
import { raster, readRgba, assetPath } from './io.js';
import { withAlpha, type ObservationInterpretation, type InterpretedPlate } from './science.js';
import { missingCoverageColor } from '../../platform/prepare-missing-coverage.mts';
type NativePoleSampler = { readonly sample: (longitudeDegrees: number, latitudeDegrees: number, color: number[]) => boolean; };
// Prepared maps carry two texels per layout pixel.
const density = 2;

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
        const scale = surface.resolutionScale ?? 1;
        const width = config.width * density * scale, height = config.height * density * scale;
        let nearest = false, pixels: Uint8Array;
        let nativePhotograph: NativePoleSampler | undefined;
        if (surface.science) {
            if (!interpret) throw new TypeError(`Surface ${surface.id} declares a scientific interpretation but none was supplied.`);
            const interpreted = await interpret({ id: surface.id, source: surface.source, science: surface.science, ...(surface.nativeSourcePoles ? { nativeSourcePoles: true } : {}) }, width, height, density);
            nearest = interpreted.nearest; pixels = withAlpha(interpreted, width, height); nativePhotograph = interpreted.nativePhotograph;
            if (config.emission) {
                const plates = interpreted.plates;
                if (!plates) throw new TypeError(`Surface ${surface.id} declares emission but its interpretation returned no plates.`);
                const encode = (plate: InterpretedPlate) => plate.lossless ? { lossless: true, effort: 6 } : { quality: 90, alphaQuality: 100, smartSubsample: true, effort: 6 };
                await raster(plates.offLimb.data, plates.offLimb.size, plates.offLimb.size).webp(encode(plates.offLimb)).toFile(assetPath(publicDirectory, config.emission.offLimbOutput, surface.id));
                await raster(plates.limb.data, plates.limb.size, plates.limb.size).webp(encode(plates.limb)).toFile(assetPath(publicDirectory, config.emission.limbOutput, surface.id));
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
        const completedSource = pixels;
        // The legacy source-packed route resized an already-packed raster, so a filter footprint could cross
        // stored latitude-strip gutters. This opt-in resizes the completed source map first, then creates those
        // same target-size gutters. It deliberately keeps coverage completion at the native source resolution.
        const resizedUnpacked = Boolean(source && config.unpackedResizeBeforePack);
        const resizeUnpacked = async (targetWidth: number, targetHeight: number) => {
            if (config.sourceWidth === targetWidth && config.sourceHeight === targetHeight) return completedSource;
            const resized = await raster(completedSource, config.sourceWidth, config.sourceHeight)
                .resize(targetWidth, targetHeight, { kernel: 'lanczos3' }).raw().toBuffer();
            if (resized.length !== targetWidth * targetHeight * 4) throw new Error(`Unpacked source resize drifted for ${surface.id}.`);
            return resized;
        };
        if (resizedUnpacked)
            pixels = await resizeUnpacked(width, height);
        const packingWidth = resizedUnpacked ? width : source ? config.sourceWidth : width;
        const packingHeight = resizedUnpacked ? height : source ? config.sourceHeight : height;
        const packed = packLatitudeRaster(pixels, packingWidth, packingHeight, config.latitudeBands, Math.max(2, packingHeight / config.latitudeBands / 4));
        let image = raster(packed.data, packed.packedWidth, packed.packedHeight);
        if (source && !resizedUnpacked && (packingWidth !== width || packingHeight !== height))
            image = image.resize(width + height / config.latitudeBands / 2, height + height / 2, { kernel: 'lanczos3' });
        // Numeric and categorical surfaces keep their selected values: lossless, no chroma subsampling.
        const webp = nearest ? { lossless: true, effort: 6 } : config.resample === 'source-packed' ? { quality: 90, smartSubsample: true } : { quality: 88, smartSubsample: true, effort: 6 };
        const output = assetPath(publicDirectory, surface.output, surface.id);
        if (surface.encoding) {
            // Chrome decodes these maps faster as JPEG than as lossy WebP,
            // and baseline faster than progressive. Encode from the same
            // prepared raster, never the WebP. A grayscale map has one channel.
            const { encoder, progressive, quality, grayscale = false, chromaSubsampling } = surface.encoding;
            const opaque = image.clone().removeAlpha();
            await (grayscale ? opaque.grayscale().toColourspace('b-w') : opaque).jpeg({ quality, mozjpeg: encoder === 'mozjpeg', progressive, ...(chromaSubsampling ? { chromaSubsampling } : {}) }).toFile(output);
        }
        else
            await image.webp(webp).toFile(output);
        if (!config.polesCombined) {
            const polar = createPolarSprite(pixels, width, height, config.polarTile * density, config.latitudeBands, nativePhotograph
                ? { sampling: nearest ? 'nearest' : 'bilinear', nativePhotograph, missingColor: missingCoverageColor }
                : { sampling: nearest ? 'nearest' : 'bilinear' });
            await raster(polar, config.polarTile * density * 2, config.polarTile * density).webp({ lossless: true, effort: 6 }).toFile(assetPath(publicDirectory, config.polesOutput, surface.id));
        }
        if (config.resample === 'density-before-pack') {
            const cropSize = Math.round(height / 2);
            await raster(pixels, width, height).extract({ left: Math.round((width - cropSize) / 2), top: Math.round((height - cropSize) / 2), width: cropSize, height: cropSize }).resize(config.thumbnail.size, config.thumbnail.size, { kernel: nearest ? 'nearest' : 'lanczos3' }).removeAlpha().webp(nearest ? { lossless: true, effort: 6 } : { quality: config.thumbnail.quality, effort: 6 }).toFile(assetPath(publicDirectory, surface.thumbnail, surface.id));
        }
        if (config.thumbnail.crop) {
            // A cropped lens thumbnail keeps its accepted source: the packed map at the
            // layout size, WebP-encoded in memory only. Crops need source-packed maps.
            const layoutWidth = config.width * scale, layoutHeight = config.height * scale;
            let layout;
            if (resizedUnpacked) {
                const layoutPacked = packLatitudeRaster(await resizeUnpacked(layoutWidth, layoutHeight), layoutWidth, layoutHeight, config.latitudeBands, Math.max(2, layoutHeight / config.latitudeBands / 4));
                layout = raster(layoutPacked.data, layoutPacked.packedWidth, layoutPacked.packedHeight);
            } else {
                layout = raster(packed.data, packed.packedWidth, packed.packedHeight);
                if (packingWidth !== layoutWidth || packingHeight !== layoutHeight)
                    layout = layout.resize(layoutWidth + layoutHeight / config.latitudeBands / 2, layoutHeight + layoutHeight / 2, { kernel: 'lanczos3' });
            }
            const thumbnailSource = await layout.webp(nearest ? { lossless: true, effort: 6 } : { quality: 88, smartSubsample: true }).toBuffer();
            await sharp(thumbnailSource).extract(config.thumbnail.crop).resize(config.thumbnail.size, config.thumbnail.size, { kernel: 'lanczos3' }).webp({ quality: config.thumbnail.quality }).toFile(assetPath(publicDirectory, surface.thumbnail, surface.id));
        }
    }
    if (config.polesCombined) {
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
        await raster(atlas, width, tileSize).webp({ quality: 90, alphaQuality: 100 }).toFile(assetPath(publicDirectory, config.polesOutput));
    }
    return { metadata, decoded };
}
