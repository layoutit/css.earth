import { mkdir, rm, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { isRecord } from '@cssearth/core';
import { resolve } from 'node:path';
import { CANONICAL_PREPARED_IMAGE_DENSITY as RASTER_DENSITY, type RasterRecipe, type LimbBlock } from '@cssearth/objects';
import { prepareSurfaces } from './surfaces.ts';
import { prepareAtmosphere } from './materials.ts';
import { prepareLighting } from './lighting.ts';
import { prepareInterior } from './interior.ts';
import { outputName } from './io.ts';
import { loadLimbLaw, meanObservedColor } from '../photometry/index.ts';
import type { PreparedLimb } from './lighting.ts';
import type { ObservationInterpretation } from './science.ts';
import type { RasterPageRecipe } from './pages.ts';
export type { ObservationInterpretation, InterpretedSurface } from './science.ts';
export { readRasterRecipe } from './validation.ts';
export async function prepareRasterAssets({ sourceDirectory, publicDirectory, outputDirectory, config, interpret, shape, pageRecipe }: {
    sourceDirectory: string;
    publicDirectory: string;
    outputDirectory: string;
    config: RasterRecipe;
    /** The body's polar-to-equatorial radius ratio, from its geometry record; required with a limb law, whose overlay fades its color past it. */
    shape?: { polarToEquatorial: number };
    /** Required when any surface declares `science`; supplied by the preparation tools, never by src. */
    interpret?: ObservationInterpretation;
    /** The body's whole recipe when `config` holds only some of its surfaces, so they keep the body's page plan. */
    pageRecipe?: RasterPageRecipe;
}) {
    await mkdir(publicDirectory, { recursive: true });
    await mkdir(outputDirectory, { recursive: true });
    const { metadata, interpretations, constantSurfaces } = await prepareSurfaces(config, sourceDirectory, publicDirectory, interpret, pageRecipe);
    const limbFor = (block: LimbBlock | undefined, where: string) => block ? prepareLimb(block, sourceDirectory, publicDirectory, config, where, shape?.polarToEquatorial ?? NaN) : Promise.resolve(undefined);
    const lighting = config.lighting ? await prepareLighting(config, config.lighting, publicDirectory, await limbFor(config.lighting.limb, 'lighting.limb')) : undefined;
    const atmosphere = config.atmosphere ? await prepareAtmosphere(config.atmosphere, sourceDirectory, publicDirectory, (await limbFor(config.atmosphere.limb, 'atmosphere.limb'))!) : undefined;
    const interior = config.interior ? await prepareInterior(config, config.interior, sourceDirectory, publicDirectory) : undefined;
    // A star's off-limb or limb plate with no visible pixel is not published: the presentation draws no image there. A layer
    // that paints a fully transparent image still gets a backing: AB Pic's empty off-limb plate kept its whole stage a 7.4 MB
    // layer on a DPR 3 iPhone. 364 of the 454 published plates held no visible pixel.
    const emptyPlates = new Set<string>();
    if (config.emission)
        for (const surface of config.surfaces)
            for (const template of [config.emission.offLimbOutput, ...(limbLender(surface) === surface.id ? [config.emission.limbOutput] : [])]) {
                const name = outputName(template, RASTER_DENSITY, surface.id), path = resolve(publicDirectory, name);
                if (await fullyTransparent(path)) { emptyPlates.add(name); await rm(path); }
            }
    const lenders = new Map(config.surfaces.map(surface => [surface.id, limbLender(surface)]));
    // A lender that itself borrows as it is leads on to the surface whose file it is.
    const lenderOf = (surfaceId: string) => { let id = surfaceId; for (let hops = 0; lenders.get(id) !== id && lenders.has(id) && hops < config.surfaces.length; hops++) id = lenders.get(id)!; return id; };
    const plate = (key: 'corona' | 'limb', template: string, surfaceId: string) => {
        const name = outputName(template, RASTER_DENSITY, key === 'limb' ? lenderOf(surfaceId) : surfaceId);
        return emptyPlates.has(name) ? {} : { [`${key}Url`]: config.publicBase + name, [`${key}Url2x`]: config.publicBase + name };
    };
    const surfaces = Object.fromEntries(config.surfaces.map(surface => [surface.id, { id: surface.id, falseColor: surface.falseColor, ...(constantSurfaces[surface.id] ? { constantRaster: constantSurfaces[surface.id] } : {}), ...(surface.resolutionScale ? { dimensions: { width: config.width * surface.resolutionScale, height: config.height * surface.resolutionScale } } : {}), url: config.publicBase + outputName(surface.output, RASTER_DENSITY, surface.id), url2x: config.publicBase + outputName(surface.output, RASTER_DENSITY, surface.id), ...(config.emission ? { ...plate('corona', config.emission.offLimbOutput, surface.id), ...plate('limb', config.emission.limbOutput, surface.id) } : {}), ...(metadata[surface.id] ? { coverageCompletion: metadata[surface.id] } : {}), ...(interpretations[surface.id] ? { interpretation: interpretations[surface.id] } : {}) }]));
    const prepared = { schema: config.surfaceMetadata.schema, ...(config.emission ? { emission: { ...config.emission.metadata, offLimbSize: config.emission.offLimbSize, limbSize: config.emission.limbSize, bodyDiameter: config.emission.bodyDiameter } } : {}), sourceDimensions: { width: config.sourceWidth, height: config.sourceHeight }, surfaceDimensions: { width: config.width, height: config.height }, surfaces, ...(lighting ? { lighting } : {}), ...(atmosphere ? { atmosphere } : {}), ...(interior ? { interior } : {}) };
    await writeFile(resolve(outputDirectory, 'assets.json'), JSON.stringify(prepared) + '\n');
    return prepared;
}

/**
 * Load a body's published models and the overlay's reference color: the mean observed color of the named source image,
 * or of the first prepared surface (the default dataset) when the block names none.
 */
export async function prepareLimb(block: LimbBlock, sourceDirectory: string, publicDirectory: string, config: RasterRecipe, where: string, polarToEquatorial: number): Promise<PreparedLimb> {
    if (!(polarToEquatorial > 0 && polarToEquatorial <= 1)) throw new TypeError(`${where}: the polar-to-equatorial radius ratio must lie in (0, 1], got ${polarToEquatorial}.`);
    const law = await loadLimbLaw(sourceDirectory, block.models);
    if (block.reference !== undefined) return { law, reference: await meanObservedColor(resolve(sourceDirectory, block.reference)), referenceSource: block.reference, polarToEquatorial };
    const surface = config.surfaces[0];
    if (!surface) throw new TypeError(`${where} names no reference image and the recipe has no surface to take one from.`);
    const prepared = outputName(surface.output, RASTER_DENSITY, surface.id);
    return { law, reference: await meanObservedColor(resolve(publicDirectory, prepared)), referenceSource: `prepared surface ${surface.id} (${prepared})`, polarToEquatorial };
}

/** The surface whose limb plate file a surface draws: its own, or the one it borrows as it is (`science.limbOf` with no
 * `limbStrength`, or a strength of 1), of which no second copy is written (surfaces.ts). */
export function limbLender(surface: { readonly id: string; readonly science?: Readonly<Record<string, unknown>> }): string {
    const science = surface.science, strength = science?.limbStrength;
    return typeof science?.limbOf === 'string' && (typeof strength !== 'number' || strength === 1) ? science.limbOf : surface.id;
}

/** Whether an image has no pixel with any opacity. */
async function fullyTransparent(path: string) {
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = info.channels - 1; i < data.length; i += info.channels) if (data[i] !== 0) return false;
    return true;
}

/** Compacted constant surfaces retain their full atlas coordinate domain. A leaf's prepared
 * raster scale must not change when an image with identical pixels is stored as one texel. */
export function surfaceCoordinateWidth(assets: unknown, url: string, imageWidth: number): number {
    if (!isRecord(assets) || !isRecord(assets.surfaces)) return imageWidth;
    for (const surface of Object.values(assets.surfaces)) {
        if (!isRecord(surface) || (surface.url !== url && surface.url2x !== url) || surface.constantRaster === undefined) continue;
        const value = surface.constantRaster;
        if (!isRecord(value) || !Number.isSafeInteger(value.packedWidth) || !(Number(value.packedWidth) > 0) ||
            !Number.isSafeInteger(value.packedHeight) || !(Number(value.packedHeight) > 0) ||
            !Array.isArray(value.rgba) || value.rgba.length !== 4 || value.rgba[3] !== 255 ||
            !value.rgba.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255) || imageWidth !== 1) {
            throw new TypeError('Invalid constant surface raster: ' + url);
        }
        return Number(value.packedWidth);
    }
    return imageWidth;
}
