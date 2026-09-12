import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RasterRecipe } from './config.js';
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
    const { metadata } = await prepareSurfaces(config, sourceDirectory, publicDirectory, interpret);
    const lighting = config.lighting ? await prepareLighting(config, config.lighting, publicDirectory) : undefined;
    const atmosphere = config.atmosphere ? await prepareAtmosphere(config.atmosphere, sourceDirectory, publicDirectory) : undefined;
    const interior = config.interior ? await prepareInterior(config, config.interior, sourceDirectory, publicDirectory) : undefined;
    const url = (template: string, id?: string) => config.publicBase + outputName(template, id);
    const surfaces = Object.fromEntries(config.surfaces.map(surface => [surface.id, { id: surface.id, falseColor: surface.falseColor, ...(surface.resolutionScale ? { dimensions: { width: config.width * surface.resolutionScale, height: config.height * surface.resolutionScale } } : {}), url: url(surface.output, surface.id), ...(config.emission ? { coronaUrl: url(config.emission.offLimbOutput, surface.id), limbUrl: url(config.emission.limbOutput, surface.id) } : {}), ...(config.surfaceMetadata.sourcePositionVariable ? { sourcePositionVariable: config.surfaceMetadata.sourcePositionVariable } : {}), ...(metadata[surface.id] ? { coverageCompletion: metadata[surface.id] } : {}) }]));
    const files = new Set<string>();
    for (const surface of config.surfaces) {
        files.add(outputName(surface.thumbnail, surface.id));
        files.add(outputName(surface.output, surface.id));
        if (!config.polesCombined)
            files.add(outputName(config.polesOutput, surface.id));
        if (config.emission)
            for (const template of [config.emission.offLimbOutput, config.emission.limbOutput])
                files.add(outputName(template, surface.id));
    }
    if (config.polesCombined)
        files.add(outputName(config.polesOutput));
    if (config.lighting)
        for (let row = 0; row < Math.ceil(config.lighting.frameCount / config.lighting.columns); row++)
            files.add(outputName(config.lighting.rowOutput).replace('{row}', String(row).padStart(2, '0')));
    if (config.atmosphere)
        for (const template of [config.atmosphere.materialOutput, config.atmosphere.observationOutput, config.atmosphere.lightingOutput])
            files.add(outputName(template));
    if (config.interior) {
        for (const template of [config.interior.outerOutput, config.interior.outerPolesOutput, config.interior.outerUnlitOutput, config.interior.outerUnlitPolesOutput, config.interior.coreOutput, config.interior.corePolesOutput, config.interior.sectionOutput])
            files.add(outputName(template));
        files.add(outputName(config.interior.thumbnail));
    }
    const hashes = Object.fromEntries(await Promise.all([...files].map(async (file) => [file, await hashFile(resolve(publicDirectory, file))])));
    const prepared = { schema: config.surfaceMetadata.schema, ...(config.emission ? { emission: { ...config.emission.metadata, offLimbSize: config.emission.offLimbSize, limbSize: config.emission.limbSize, bodyDiameter: config.emission.bodyDiameter } } : {}), sourceDimensions: { width: config.sourceWidth, height: config.sourceHeight }, surfaceDimensions: { width: config.width, height: config.height }, surfaces, ...(config.polesCombined ? { poles: { url: url(config.polesOutput), tileSize: config.polarTile, tileCount: config.surfaces.length * 2, order: config.surfaces.flatMap(({ id }) => [`${id}-north`, `${id}-south`]) } } : {}), ...(lighting ? { lighting } : {}), ...(atmosphere ? { atmosphere } : {}), ...(interior ? { interior } : {}), hashes };
    await writeFile(resolve(outputDirectory, 'assets.json'), JSON.stringify(prepared) + '\n');
    return prepared;
}
