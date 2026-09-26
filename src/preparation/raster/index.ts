import { mkdir, rm, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { resolve } from 'node:path';
import { RASTER_DENSITY, type RasterRecipe } from './config.js';
import { prepareSurfaces } from './surfaces.js';
import { prepareAtmosphere } from './materials.js';
import { prepareLighting } from '../../renderers/css/preparation/materials/lighting.js';
import { prepareInterior } from './interior.js';
import { outputName, hashFile } from './io.js';
import { loadLimbLaw, meanObservedColour, type LimbBlock } from '@cssearth/bake/photometry';
import type { PreparedLimb } from '../../renderers/css/preparation/materials/lighting.js';
import type { ObservationInterpretation } from './science.js';
export type { ObservationInterpretation, InterpretedSurface } from './science.js';
export { parseRasterRecipe } from './validation.js';
export type { RasterRecipe } from './config.js';
export async function prepareRasterAssets({ sourceDirectory, publicDirectory, outputDirectory, config, interpret, shape }: {
    sourceDirectory: string;
    publicDirectory: string;
    outputDirectory: string;
    config: RasterRecipe;
    /** The body's polar-to-equatorial radius ratio, from its geometry record; required with a limb law, whose overlay fades its colour past it. */
    shape?: { polarToEquatorial: number };
    /** Required when any surface declares `science`; supplied by the preparation tools, never by src. */
    interpret?: ObservationInterpretation;
}) {
    await mkdir(publicDirectory, { recursive: true });
    await mkdir(outputDirectory, { recursive: true });
    const { metadata, interpretations } = await prepareSurfaces(config, sourceDirectory, publicDirectory, interpret);
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
            for (const template of [config.emission.offLimbOutput, config.emission.limbOutput]) {
                const name = outputName(template, RASTER_DENSITY, surface.id), path = resolve(publicDirectory, name);
                if (await fullyTransparent(path)) { emptyPlates.add(name); await rm(path); }
            }
    const plate = (key: 'corona' | 'limb', template: string, surfaceId: string) => {
        const name = outputName(template, RASTER_DENSITY, surfaceId);
        return emptyPlates.has(name) ? {} : { [`${key}Url`]: config.publicBase + name, [`${key}Url2x`]: config.publicBase + name };
    };
    const surfaces = Object.fromEntries(config.surfaces.map(surface => [surface.id, { id: surface.id, falseColor: surface.falseColor, ...(surface.resolutionScale ? { dimensions: { width: config.width * surface.resolutionScale, height: config.height * surface.resolutionScale } } : {}), url: config.publicBase + outputName(surface.output, RASTER_DENSITY, surface.id), url2x: config.publicBase + outputName(surface.output, RASTER_DENSITY, surface.id), ...(config.emission ? { ...plate('corona', config.emission.offLimbOutput, surface.id), ...plate('limb', config.emission.limbOutput, surface.id) } : {}), ...(metadata[surface.id] ? { coverageCompletion: metadata[surface.id] } : {}), ...(interpretations[surface.id] ? { interpretation: interpretations[surface.id] } : {}) }]));
    const files = new Set<string>(), density = RASTER_DENSITY;
    for (const surface of config.surfaces) {
        files.add(outputName(surface.thumbnail, 1, surface.id));
        files.add(outputName(surface.output, density, surface.id));
        files.add(outputName(config.polesOutput, density, surface.id));
        if (config.emission)
            for (const template of [config.emission.offLimbOutput, config.emission.limbOutput])
                if (!emptyPlates.has(outputName(template, density, surface.id)))
                    files.add(outputName(template, density, surface.id));
    }
    if (config.lighting)
        for (let row = 0; row < Math.ceil(config.lighting.frameCount / config.lighting.columns); row++)
            files.add(outputName(config.lighting.rowOutput, density).replace('{row}', String(row).padStart(2, '0')));
    if (config.atmosphere)
        for (const template of [config.atmosphere.materialOutput, config.atmosphere.observationOutput, config.atmosphere.lightingOutput])
            files.add(outputName(template, density));
    if (config.interior)
        for (const template of [config.interior.outerOutput, config.interior.outerPolesOutput, config.interior.outerUnlitOutput, config.interior.outerUnlitPolesOutput, config.interior.coreOutput, config.interior.corePolesOutput, config.interior.sectionOutput])
            files.add(outputName(template, density));
    if (config.interior)
        files.add(outputName(config.interior.thumbnail, 1));
    const hashes = Object.fromEntries(await Promise.all([...files].map(async (file) => [file, await hashFile(resolve(publicDirectory, file))])));
    const prepared = { schema: config.surfaceMetadata.schema, ...(config.emission ? { emission: { ...config.emission.metadata, offLimbSize: config.emission.offLimbSize, limbSize: config.emission.limbSize, bodyDiameter: config.emission.bodyDiameter } } : {}), sourceDimensions: { width: config.sourceWidth, height: config.sourceHeight }, surfaceDimensions: { width: config.width, height: config.height }, surfaces, ...(lighting ? { lighting } : {}), ...(atmosphere ? { atmosphere } : {}), ...(interior ? { interior } : {}), hashes };
    await writeFile(resolve(outputDirectory, 'assets.json'), JSON.stringify(prepared) + '\n');
    return prepared;
}

/**
 * Load a body's published models and the overlay's reference colour: the mean observed colour of the named source image,
 * or of the first prepared surface (the default lens) when the block names none.
 */
export async function prepareLimb(block: LimbBlock, sourceDirectory: string, publicDirectory: string, config: RasterRecipe, where: string, polarToEquatorial: number): Promise<PreparedLimb> {
    if (!(polarToEquatorial > 0 && polarToEquatorial <= 1)) throw new TypeError(`${where}: the polar-to-equatorial radius ratio must lie in (0, 1], got ${polarToEquatorial}.`);
    const law = await loadLimbLaw(sourceDirectory, block.models);
    if (block.reference !== undefined) return { law, reference: await meanObservedColour(resolve(sourceDirectory, block.reference)), referenceSource: block.reference, polarToEquatorial };
    const surface = config.surfaces[0];
    if (!surface) throw new TypeError(`${where} names no reference image and the recipe has no surface to take one from.`);
    const prepared = outputName(surface.output, RASTER_DENSITY, surface.id);
    return { law, reference: await meanObservedColour(resolve(publicDirectory, prepared)), referenceSource: `prepared surface ${surface.id} (${prepared})`, polarToEquatorial };
}

/** Whether an image has no pixel with any opacity. */
async function fullyTransparent(path: string) {
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = info.channels - 1; i < data.length; i += info.channels) if (data[i] !== 0) return false;
    return true;
}
