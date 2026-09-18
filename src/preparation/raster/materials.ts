import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readAtmosphereModel, deriveAtmosphereMaterial, prepareMaterialFrame } from '@cssearth/objects';
import { RASTER_DENSITY, type RasterRecipe, type AtmosphereRecipe } from './config.js';
import { raster, assetPath } from './io.js';
export async function prepareAtmosphere(config: RasterRecipe, recipe: AtmosphereRecipe, sourceDirectory: string, publicDirectory: string) {
    const source = readAtmosphereModel(JSON.parse(await readFile(resolve(sourceDirectory, recipe.source), 'utf8')));
    const model = deriveAtmosphereMaterial(source);
    const density = RASTER_DENSITY, tileSize = recipe.tileSize * density, width = tileSize * recipe.columns, height = tileSize * recipe.rows;
    const material = new Uint8Array(width * height * 4), observation = new Uint8Array(width * height * 4), lighting = new Uint8Array(width * height * 4);
    for (let frame = 0; frame < recipe.frameCount; frame++) {
        const flood = frame === recipe.frameCount - 1;
        const z = flood ? 1 : recipe.minimumLightViewZ + (recipe.maximumLightViewZ - recipe.minimumLightViewZ) * frame / (recipe.directionalFrameCount - 1);
        prepareMaterialFrame({ material, observation, lighting, atlasWidth: width, tileSize, frameX: frame % recipe.columns * tileSize, frameY: Math.floor(frame / recipe.columns) * tileSize, lightDirection: flood ? [0, 0, 1] : [-Math.sqrt(Math.max(0, 1 - z * z)), 0, z], shadowReleaseMaximum: flood ? recipe.floodShadowRelease : recipe.directionalShadowRelease, source, model, config: recipe });
    }
    await raster(material, width, height).webp({ lossless: true, effort: 6 }).toFile(assetPath(publicDirectory, recipe.materialOutput, density));
    await raster(observation, width, height).webp({ lossless: true, effort: 6 }).toFile(assetPath(publicDirectory, recipe.observationOutput, density));
    await raster(lighting, width, height).resize(width / 2, height / 2, { fit: 'fill', kernel: 'lanczos3' }).webp({ lossless: true, effort: 6 }).toFile(assetPath(publicDirectory, recipe.lightingOutput, density));
    return { source, model };
}
