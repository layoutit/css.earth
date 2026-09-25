import sharp, { type Sharp } from 'sharp';
import { resolve } from 'node:path';
import { completeEnhancedCoverage, completeEnhancedPolarTile, polarTile, createPolarSprite, packLatitudeRaster, applySurfaceExposure } from '@cssearth/objects';
import { RASTER_DENSITY, type RasterRecipe } from './config.js';
import { raster, readRgba, assetPath } from './io.js';
import { withAlpha, type ObservationInterpretation, type InterpretedPlate } from './science.js';
import { composeLimbPreview } from './emission-preview.js';
import { encodeLossyWebp, writeLossyWebp } from './lossy-lane.js';
import { missingCoverageColor } from '../../platform/prepare-missing-coverage.mts';
import { RASTER_LEVEL_FACTORS, rasterPagePlan, rasterPageOutput, type RasterPagePlan } from './pages.js';
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
/** Split a packed atlas into its pages of whole bands, each also reduced to every level, encoded as the atlas is. */
async function writeRasterPages(image: Sharp, pages: RasterPagePlan, bands: number, lossless: boolean, path: (page: number, levelWidth?: number) => string) {
    const { data, info } = await image.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.height % bands) throw new RangeError(`A ${info.width} × ${info.height} atlas does not hold ${bands} equal bands.`);
    const rows = info.height / bands * pages.bandsPerPage, stride = info.width * 4;
    for (let page = 0; page < pages.pageCount; page++) {
        const pixels = data.subarray(page * rows * stride, (page + 1) * rows * stride);
        for (const factor of RASTER_LEVEL_FACTORS) {
            const width = info.width / factor, height = rows / factor;
            if (!Number.isInteger(width) || !Number.isInteger(height)) throw new RangeError(`Page ${page} (${info.width} × ${rows}) does not reduce by ${factor}.`);
            let level = raster(pixels, info.width, rows);
            if (factor !== 1) level = sharp(await level.resize(width, height, { kernel: 'lanczos3' }).raw().toBuffer(), { raw: { width, height, channels: 4 } });
            const output = path(page, factor === 1 ? undefined : width);
            if (lossless) await level.webp({ lossless: true, effort: 6 }).toFile(output);
            else await writeLossyWebp(level, output, { effort: 6 });
        }
    }
}
export async function prepareSurfaces(config: RasterRecipe, sourceDirectory: string, publicDirectory: string, interpret?: ObservationInterpretation) {
    const pages = rasterPagePlan(config, RASTER_DENSITY);
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
                // A lossless plate keeps its values; a lossy one is encoded in the lossy lane (lossy-lane.ts).
                const write = (plate: InterpretedPlate, path: string) => plate.lossless
                    ? raster(plate.data, plate.size, plate.size).webp({ lossless: true, effort: 6 }).toFile(path)
                    : writeLossyWebp(raster(plate.data, plate.size, plate.size), path, { alphaQuality: 100, effort: 6 });
                await write(plates.offLimb, assetPath(publicDirectory, config.emission.offLimbOutput, density, surface.id));
                await write(plates.limb, assetPath(publicDirectory, config.emission.limbOutput, density, surface.id));
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
        // Numeric and categorical surfaces keep their selected values: lossless, no chroma subsampling. Other surfaces are
        // encoded in the lossy lane (lossy-lane.ts).
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
                thumbnailSource = await encodeLossyWebp(image.clone(), { effort: 6 });
        }
        else if (nearest)
            await image.clone().webp({ lossless: true, effort: 6 }).toFile(output);
        else
            await writeLossyWebp(image.clone(), output, { effort: 6 });
        if (pages) {
            if (surface.encoding) throw new TypeError(`${surface.id}: a paged surface (${output}) must be WebP, not ${surface.encoding.format}.`);
            await writeRasterPages(image, pages, config.latitudeBands, nearest, (page, levelWidth) =>
                resolve(publicDirectory, rasterPageOutput(surface.output, density, surface.id, page, levelWidth)));
        }
        if (config.polarProjection !== 'angular-nearest') {
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
            if (nearest) await raster(crop, cropSize, cropSize).resize(config.thumbnail.size, config.thumbnail.size, { kernel: nearest ? 'nearest' : 'lanczos3' }).removeAlpha().webp({ lossless: true, effort: 6 }).toFile(assetPath(publicDirectory, surface.thumbnail, 1, surface.id));
            else await writeLossyWebp(raster(crop, cropSize, cropSize).resize(config.thumbnail.size, config.thumbnail.size, { kernel: nearest ? 'nearest' : 'lanczos3' }).removeAlpha(), assetPath(publicDirectory, surface.thumbnail, 1, surface.id), { effort: 6 });
        }
        // The authored crop is in canonical-density map pixels.
        if (config.thumbnail.crop)
            await writeLossyWebp(sharp(thumbnailSource ?? assetPath(publicDirectory, surface.output, RASTER_DENSITY, surface.id)).extract(config.thumbnail.crop).resize(config.thumbnail.size, config.thumbnail.size, { kernel: 'lanczos3' }), assetPath(publicDirectory, surface.thumbnail, 1, surface.id));
        if (thumbnailLimb) {
            const plateSize = thumbnailLimb.size, disc = composeLimbPreview(thumbnailLimb, pixels);
            await writeLossyWebp(raster(disc, plateSize, plateSize).resize(config.thumbnail.size, config.thumbnail.size, { kernel: 'lanczos3' }),
                assetPath(publicDirectory, surface.thumbnail, 1, surface.id), { alphaQuality: 100, effort: 6 });
        }
    }
    // Angular poles are sampled from the whole source map (and an incomplete lens is completed from its fallback), so they
    // are drawn once every source is loaded. Each lens writes its own north-then-south sprite, as the bilinear poles do.
    if (config.polarProjection === 'angular-nearest') {
        const density = RASTER_DENSITY, tileSize = config.polarTile * density, width = tileSize * 2;
        const dimensions = { width: config.sourceWidth, height: config.sourceHeight, latitudeBands: config.latitudeBands };
        for (const surface of preparedSources) {
            const sprite = new Uint8Array(width * tileSize * 4);
            for (let poleIndex = 0; poleIndex < 2; poleIndex++) {
                let tile = polarTile(surface.rgba, tileSize, poleIndex === 0, dimensions);
                if (surface.fallback)
                    tile = completeEnhancedPolarTile(tile, polarTile(surface.fallback, tileSize, poleIndex === 0, dimensions), tileSize);
                for (let y = 0; y < tileSize; y++)
                    sprite.set(tile.subarray(y * tileSize * 4, (y + 1) * tileSize * 4), (y * width + poleIndex * tileSize) * 4);
            }
            await writeLossyWebp(raster(sprite, width, tileSize), assetPath(publicDirectory, config.polesOutput, density, surface.id), { alphaQuality: 100 });
        }
    }
    return { metadata, decoded, interpretations };
}
