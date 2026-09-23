import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { interiorLayer, interiorCorePoleAtlas, interiorSection, shadeInteriorOuter, orientLatitudeBands, polarTile } from '@cssearth/objects';
import { RASTER_DENSITY, type RasterRecipe, type InteriorRecipe, type StructureSource } from './config.js';
import { raster, readRgba, assetPath, outputName } from './io.js';
import { writeLossyWebp } from './lossy-lane.js';
function structureSource(value: unknown): StructureSource {
    if (typeof value !== 'object' || value === null)
        throw new TypeError('Interior source must be an object.');
    const source = value as StructureSource;
    if (![source.metallicCoreRadiusFraction, source.metallicCoreRadiusKm, source.planetRadiusKm, source.outerShellThicknessKm].every(value => typeof value === 'number' && Number.isFinite(value) && value > 0) || source.metallicCoreRadiusFraction >= 1 || source.metallicCoreRadiusKm / source.planetRadiusKm !== source.metallicCoreRadiusFraction || source.outerShellThicknessKm !== source.planetRadiusKm - source.metallicCoreRadiusKm)
        throw new TypeError('Interior source dimensions are inconsistent.');
    if (!source.presentation || !source.presentation.palette || !source.presentation.cutaway || typeof source.structureQualification !== 'string' || typeof source.presentation.qualification !== 'string')
        throw new TypeError('Interior presentation is missing.');
    for (const palette of Object.values(source.presentation.palette))
        if (!Array.isArray(palette) || palette.length !== 3 || !palette.every(value => Number.isInteger(value) && value >= 0 && value <= 255))
            throw new TypeError('Invalid interior palette.');
    return source;
}
export async function prepareInterior(config: RasterRecipe, recipe: InteriorRecipe, sourceDirectory: string, publicDirectory: string) {
    const source = structureSource(JSON.parse(await readFile(resolve(sourceDirectory, recipe.source), 'utf8')) as unknown);
    const material = { palette: source.presentation.palette, worldLightDirection: recipe.worldLightDirection, ambientIntensity: recipe.ambientIntensity, coreNoiseSeed: recipe.coreNoiseSeed };
    const input = await readRgba(resolve(sourceDirectory, recipe.surface), config.sourceWidth, config.sourceHeight);
    const outer = shadeInteriorOuter(input, { width: config.sourceWidth, height: config.sourceHeight }, material);
    const density = RASTER_DENSITY;
    for (const [pixels,surfaceOutput,poleOutput] of [
        [outer,recipe.outerOutput,recipe.outerPolesOutput],
        [input,recipe.outerUnlitOutput,recipe.outerUnlitPolesOutput],
    ] as const) {
        const oriented=orientLatitudeBands(pixels,config.latitudeBands,config.sourceWidth,config.sourceHeight);
        await writeLossyWebp(raster(oriented, config.sourceWidth, config.sourceHeight).resize(config.width * density, config.height * density, { kernel: 'lanczos3' }), assetPath(publicDirectory, surfaceOutput, density), { alphaQuality: 100 });
        const tileSize = recipe.poleTile * density, polar = new Uint8Array(tileSize * tileSize * 2 * 4);
        for (let pole = 0; pole < 2; pole++) {
            const tile = polarTile(pixels, tileSize, pole === 0, { width: config.sourceWidth, height: config.sourceHeight, latitudeBands: config.latitudeBands }, source.presentation.cutaway);
            for (let y = 0; y < tileSize; y++)
                polar.set(tile.subarray(y * tileSize * 4, (y + 1) * tileSize * 4), (y * tileSize * 2 + pole * tileSize) * 4);
        }
        await writeLossyWebp(raster(polar, tileSize * 2, tileSize), assetPath(publicDirectory, poleOutput, density), { alphaQuality: 100 });
    }
    const tileSize=recipe.poleTile*density;
    const width = recipe.width * density, height = recipe.height * density;
    await writeLossyWebp(raster(interiorLayer(width, height, material), width, height), assetPath(publicDirectory, recipe.coreOutput, density), { alphaQuality: 100 });
    await writeLossyWebp(raster(interiorCorePoleAtlas(tileSize, source.presentation.cutaway, material), tileSize * 2, tileSize), assetPath(publicDirectory, recipe.corePolesOutput, density), { alphaQuality: 100 });
    const sectionWidth = recipe.sectionWidth * density, sectionHeight = recipe.sectionHeight * density;
    await writeLossyWebp(raster(interiorSection(sectionWidth, sectionHeight, source, material), sectionWidth, sectionHeight), assetPath(publicDirectory, recipe.sectionOutput, density), { alphaQuality: 100 });
    // The thumbnail shows the section's left half, read from the canonical-density section image.
    await writeLossyWebp(sharp(assetPath(publicDirectory, recipe.sectionOutput, density)).extract({ left: 0, top: 0, width: recipe.sectionWidth * density / 2, height: recipe.sectionHeight * density }).resize(config.thumbnail.size, config.thumbnail.size, { kernel: 'lanczos3' }), assetPath(publicDirectory, recipe.thumbnail, 1), { alphaQuality: 100 });
    const url = (template: string) => config.publicBase + outputName(template, RASTER_DENSITY);
    return { ...recipe.metadata, outerSurfaceUnlitUrl: url(recipe.outerUnlitOutput), outerSurfaceUnlit2xUrl: url(recipe.outerUnlitOutput), outerPolesUnlitUrl: url(recipe.outerUnlitPolesOutput), outerPolesUnlit2xUrl: url(recipe.outerUnlitPolesOutput), coreUrl: url(recipe.coreOutput), core2xUrl: url(recipe.coreOutput), corePolesUrl: url(recipe.corePolesOutput), corePoles2xUrl: url(recipe.corePolesOutput), sectionUrl: url(recipe.sectionOutput), section2xUrl: url(recipe.sectionOutput), outerSurfaceUrl: url(recipe.outerOutput), outerSurface2xUrl: url(recipe.outerOutput), outerPolesUrl: url(recipe.outerPolesOutput), outerPoles2xUrl: url(recipe.outerPolesOutput), poleDimensions: { width: recipe.poleTile * 2, height: recipe.poleTile }, textureDimensions: { width: recipe.width, height: recipe.height }, sectionDimensions: { width: recipe.sectionWidth, height: recipe.sectionHeight }, cutaway: source.presentation.cutaway, metallicCoreRadiusFraction: source.metallicCoreRadiusFraction, outerShellThicknessKm: source.outerShellThicknessKm, publishedApproximateOuterShellThicknessKm: source.publishedApproximateOuterShellThicknessKm, qualification: source.structureQualification, presentationQualification: source.presentation.qualification, presentationPalette: source.presentation.palette, runtimeGeometry: false, runtimeRasterization: false };
}
