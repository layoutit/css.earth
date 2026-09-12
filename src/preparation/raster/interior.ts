import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { interiorLayer, interiorCorePoleAtlas, interiorSection, shadeInteriorOuter, orientLatitudeBands, polarTile } from '@cssearth/objects';
import type { RasterRecipe, InteriorRecipe, StructureSource } from './config.js';
import { raster, readRgba, assetPath, outputName } from './io.js';
// Cutaway textures carry two texels per layout pixel.
const density = 2;
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
    for (const [pixels,surfaceOutput,poleOutput] of [
      [outer,recipe.outerOutput,recipe.outerPolesOutput],
      [input,recipe.outerUnlitOutput,recipe.outerUnlitPolesOutput],
    ] as const) {
        const oriented=orientLatitudeBands(pixels,config.latitudeBands,config.sourceWidth,config.sourceHeight);
        await raster(oriented, config.sourceWidth, config.sourceHeight).resize(config.width * density, config.height * density, { kernel: 'lanczos3' }).webp({ lossless: true, alphaQuality: 100 }).toFile(assetPath(publicDirectory, surfaceOutput));
        const tileSize = recipe.poleTile * density, polar = new Uint8Array(tileSize * tileSize * 2 * 4);
        for (let pole = 0; pole < 2; pole++) {
            const tile = polarTile(pixels, tileSize, pole === 0, { width: config.sourceWidth, height: config.sourceHeight, latitudeBands: config.latitudeBands }, source.presentation.cutaway);
            for (let y = 0; y < tileSize; y++)
                polar.set(tile.subarray(y * tileSize * 4, (y + 1) * tileSize * 4), (y * tileSize * 2 + pole * tileSize) * 4);
        }
        await raster(polar, tileSize * 2, tileSize).webp({ lossless: true, alphaQuality: 100 }).toFile(assetPath(publicDirectory, poleOutput));
    }
    const tileSize = recipe.poleTile * density;
    const width = recipe.width * density, height = recipe.height * density;
    await raster(interiorLayer(width, height, material), width, height).webp({ lossless: true, alphaQuality: 100 }).toFile(assetPath(publicDirectory, recipe.coreOutput));
    await raster(interiorCorePoleAtlas(tileSize, source.presentation.cutaway, material), tileSize * 2, tileSize).webp({ lossless: true, alphaQuality: 100 }).toFile(assetPath(publicDirectory, recipe.corePolesOutput));
    const sectionWidth = recipe.sectionWidth * density, sectionHeight = recipe.sectionHeight * density;
    await raster(interiorSection(sectionWidth, sectionHeight, source, material), sectionWidth, sectionHeight).webp({ lossless: true, alphaQuality: 100 }).toFile(assetPath(publicDirectory, recipe.sectionOutput));
    // The lens thumbnail keeps its accepted source: the section at its layout size, encoded in memory only.
    const layoutSection = await raster(interiorSection(recipe.sectionWidth, recipe.sectionHeight, source, material), recipe.sectionWidth, recipe.sectionHeight).webp({ lossless: true, alphaQuality: 100 }).toBuffer();
    await sharp(layoutSection).extract({ left: 0, top: 0, width: recipe.sectionWidth / 2, height: recipe.sectionHeight }).resize(config.thumbnail.size, config.thumbnail.size, { kernel: 'lanczos3' }).webp({ quality: config.thumbnail.quality, alphaQuality: 100 }).toFile(assetPath(publicDirectory, recipe.thumbnail));
    const url = (template: string) => config.publicBase + outputName(template);
    return { ...recipe.metadata, outerSurfaceUnlitUrl: url(recipe.outerUnlitOutput), outerPolesUnlitUrl: url(recipe.outerUnlitPolesOutput), coreUrl: url(recipe.coreOutput), corePolesUrl: url(recipe.corePolesOutput), sectionUrl: url(recipe.sectionOutput), outerSurfaceUrl: url(recipe.outerOutput), outerPolesUrl: url(recipe.outerPolesOutput), poleDimensions: { width: recipe.poleTile * 2, height: recipe.poleTile }, textureDimensions: { width: recipe.width, height: recipe.height }, sectionDimensions: { width: recipe.sectionWidth, height: recipe.sectionHeight }, cutaway: source.presentation.cutaway, metallicCoreRadiusFraction: source.metallicCoreRadiusFraction, outerShellThicknessKm: source.outerShellThicknessKm, publishedApproximateOuterShellThicknessKm: source.publishedApproximateOuterShellThicknessKm, qualification: source.structureQualification, presentationQualification: source.presentation.qualification, presentationPalette: source.presentation.palette, runtimeGeometry: false, runtimeRasterization: false };
}
