import { mkdir, rm, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { resolve } from 'node:path';
import { RASTER_DENSITY, type RasterRecipe } from './config.js';
import { prepareSurfaces } from './surfaces.js';
import { prepareAtmosphere } from './materials.js';
import { prepareLighting } from '../../renderers/css/preparation/materials/lighting.js';
import { prepareInterior } from './interior.js';
import { outputName, hashFile } from './io.js';
import type { ObservationInterpretation } from './science.js';
export type { ObservationInterpretation, InterpretedSurface } from './science.js';
export { parseRasterRecipe } from './validation.js';
export type { RasterRecipe } from './config.js';
export async function prepareRasterAssets({ sourceDirectory, publicDirectory, outputDirectory, config, interpret }: {
    sourceDirectory: string;
    publicDirectory: string;
    outputDirectory: string;
    config: RasterRecipe;
    /** Required when any surface declares `science`; supplied by the preparation tools, never by src. */
    interpret?: ObservationInterpretation;
}) {
    await mkdir(publicDirectory, { recursive: true });
    await mkdir(outputDirectory, { recursive: true });
    const { metadata, interpretations } = await prepareSurfaces(config, sourceDirectory, publicDirectory, interpret);
    const lighting = config.lighting ? await prepareLighting(config, config.lighting, publicDirectory) : undefined;
    const atmosphere = config.atmosphere ? await prepareAtmosphere(config, config.atmosphere, sourceDirectory, publicDirectory) : undefined;
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
    const surfaces = Object.fromEntries(config.surfaces.map(surface => [surface.id, { id: surface.id, falseColor: surface.falseColor, ...(surface.resolutionScale ? { dimensions: { width: config.width * surface.resolutionScale, height: config.height * surface.resolutionScale } } : {}), url: config.publicBase + outputName(surface.output, RASTER_DENSITY, surface.id), url2x: config.publicBase + outputName(surface.output, RASTER_DENSITY, surface.id), ...(config.emission ? { ...plate('corona', config.emission.offLimbOutput, surface.id), ...plate('limb', config.emission.limbOutput, surface.id) } : {}), ...(config.surfaceMetadata.sourcePositionVariable ? { sourcePositionVariable: config.surfaceMetadata.sourcePositionVariable } : {}), ...(metadata[surface.id] ? { coverageCompletion: metadata[surface.id] } : {}), ...(interpretations[surface.id] ? { interpretation: interpretations[surface.id] } : {}) }]));
    const files = new Set<string>(), density = RASTER_DENSITY;
    for (const surface of config.surfaces) {
        files.add(outputName(surface.thumbnail, 1, surface.id));
        files.add(outputName(surface.output, density, surface.id));
        if (!config.polesCombined)
            files.add(outputName(config.polesOutput, density, surface.id));
        if (config.emission)
            for (const template of [config.emission.offLimbOutput, config.emission.limbOutput])
                if (!emptyPlates.has(outputName(template, density, surface.id)))
                    files.add(outputName(template, density, surface.id));
    }
    if (config.polesCombined)
        files.add(outputName(config.polesOutput, density));
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
    const prepared = { schema: config.surfaceMetadata.schema, ...(config.emission ? { emission: { ...config.emission.metadata, offLimbSize: config.emission.offLimbSize, limbSize: config.emission.limbSize, bodyDiameter: config.emission.bodyDiameter } } : {}), sourceDimensions: { width: config.sourceWidth, height: config.sourceHeight }, surfaceDimensions: { width: config.width, height: config.height }, surfaces, ...(config.polesCombined ? { poles: { url: config.publicBase + outputName(config.polesOutput, RASTER_DENSITY), url2x: config.publicBase + outputName(config.polesOutput, RASTER_DENSITY), tileSize: config.polarTile, tileCount: config.surfaces.length * 2, order: config.surfaces.flatMap(({ id }) => [`${id}-north`, `${id}-south`]) } } : {}), ...(lighting ? { lighting } : {}), ...(atmosphere ? { atmosphere } : {}), ...(interior ? { interior } : {}), hashes };
    await writeFile(resolve(outputDirectory, 'assets.json'), JSON.stringify(prepared) + '\n');
    return prepared;
}

/** Whether an image has no pixel with any opacity. */
async function fullyTransparent(path: string) {
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = info.channels - 1; i < data.length; i += info.channels) if (data[i] !== 0) return false;
    return true;
}
