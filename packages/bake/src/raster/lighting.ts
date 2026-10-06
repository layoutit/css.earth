import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { existsSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { lightingFrame } from '../baking/index.ts';
import type { AuthoredSphereLaw, RasterRecipe, LightingRecipe } from '@cssearth/objects';
import { limbSphereFrame, type Channels, type LimbLaw } from '../photometry/index.ts';
import { raster, fileBytes } from './io.ts';
import { LIGHTING_BANK_PRESENTATION_SIZE, LIGHTING_BANK_ROOT } from './lighting-banks.ts';
import { LIGHTING_SHEET, lightingSheetAddress, lightingSheetLayout, lightingSheetViewZ, lightingShadowlessAddress, lightingShadowlessSize } from './lighting-sheet.ts';
/** A body's published limb: its models and the overlay's reference color (packages/bake/src/photometry/limb.ts). */
export interface PreparedLimb { readonly law: LimbLaw; readonly reference: Channels<number>; readonly referenceSource: string; readonly polarToEquatorial: number }

/**
 * One lighting frame, `size` pixels across with the overlay's box over its middle `box` pixels: the frame for the light's
 * view z, or the flood-lit frame when it is null. The published limb law when the body has one, otherwise the bank's
 * authored sphere law. A published law is flood-lit with the Sun behind the camera.
 */
function frameFor(size: number, box: number, lightViewZ: number | null, recipe: LightingRecipe, limb: PreparedLimb | undefined, radiusScale: number) {
    const radius = box * radiusScale;
    if (!limb) return lightingFrame({ size, radius }, lightViewZ, recipe as AuthoredSphereLaw);
    const z = lightViewZ ?? 1;
    return limbSphereFrame(size, radius / size, [Math.sqrt(Math.max(0, 1 - z * z)), 0, z], limb.law, limb.reference, limb.polarToEquatorial, box / 2);
}
/**
 * A sphere's lighting: the sheet of every phase (lighting-sheet.ts) and the flood-lit frame as its own file, which is all a
 * body shows with shadows off. A recipe naming a shared bank takes both files as baked under site/public/lighting/<bank>/
 * (lighting-banks.ts): the same bytes an encode here would write, checked by prepare-lighting-bank --check, without the
 * encode. The bake stages into a scratch directory, so the bank is found from the repository root every preparation tool
 * runs from. `radiusScale` is the lit disc's radius as a share of the overlay's box: the sheet's own unless a lane's mesh
 * ends elsewhere, which a bank cannot serve.
 */
export async function prepareLighting(config: Pick<RasterRecipe, 'publicBase'>, recipe: LightingRecipe, publicDirectory: string, limb?: PreparedLimb,
    { radiusScale = LIGHTING_SHEET.radiusScale }: { radiusScale?: number } = {}) {
    if (Boolean(recipe.limb) !== Boolean(limb)) throw new TypeError(`Lighting: lighting.limb ${recipe.limb ? 'names models that were not loaded' : 'is absent but a limb law was supplied'}.`);
    const bankDirectory = recipe.bank === undefined ? undefined : resolve(checkoutProjectRoot(import.meta.url), LIGHTING_BANK_ROOT, recipe.bank);
    const { frameCount, frameSize, margin, columns, sheetFile, shadowlessFile } = LIGHTING_SHEET, { tile, rowCount, width, height } = lightingSheetLayout();
    const shadowlessSize = lightingShadowlessSize(recipe.presentationSize);
    const sheetPath = resolve(publicDirectory, sheetFile), shadowlessPath = resolve(publicDirectory, shadowlessFile);
    if (bankDirectory && radiusScale !== LIGHTING_SHEET.radiusScale) throw new TypeError(`Lighting bank ${recipe.bank} is baked with a lit disc of ${LIGHTING_SHEET.radiusScale} of its box, not ${radiusScale}.`);
    if (bankDirectory && shadowlessSize !== lightingShadowlessSize(LIGHTING_BANK_PRESENTATION_SIZE))
        throw new TypeError(`Lighting bank ${recipe.bank} holds a flood-lit frame for a ${LIGHTING_BANK_PRESENTATION_SIZE} px overlay; a ${recipe.presentationSize} px overlay needs one of ${shadowlessSize} px, so this body states its own lighting.`);
    if (bankDirectory) for (const [file, path] of [[sheetFile, sheetPath], [shadowlessFile, shadowlessPath]] as const) {
        const source = resolve(bankDirectory, file);
        if (!existsSync(source)) throw new Error(`Lighting bank ${recipe.bank} has no ${file} under ${LIGHTING_BANK_ROOT}/${recipe.bank}; bake it: node packages/bake/cli/prepare-lighting-bank.mts.`);
        await copyFile(source, path);
    } else {
        const sheet = new Uint8Array(width * height * 4);
        for (let frame = 0; frame < frameCount; frame++) {
            const pixels = frameFor(tile, frameSize, lightingSheetViewZ(frame), recipe, limb, radiusScale), left = (frame % columns) * tile, top = Math.floor(frame / columns) * tile;
            for (let y = 0; y < tile; y++) sheet.set(pixels.subarray(y * tile * 4, (y + 1) * tile * 4), ((top + y) * width + left) * 4);
        }
        await raster(sheet, width, height).webp({ lossless: true, alphaQuality: 100, effort: 6 }).toFile(sheetPath);
        // The flood-lit frame is the image every page opens on: its pixels and its encoding are those it has always had.
        await raster(frameFor(shadowlessSize, shadowlessSize, null, recipe, limb, radiusScale), shadowlessSize, shadowlessSize).webp({ lossless: true, alphaQuality: 100 }).toFile(shadowlessPath);
    }
    const presentations = Array.from({ length: frameCount }, (_, frameIndex) => ({ frameIndex, lightViewZ: lightingSheetViewZ(frameIndex), ...lightingSheetAddress(frameIndex, recipe.presentationSize) }));
    const limbMetadata = limb ? { limb: { model: 'published-photometric-models-relative-to-the-flood-lit-disc-centre', models: limb.law.paths, referenceColor: limb.reference, referenceSource: limb.referenceSource } } : {};
    return { ...recipe.metadata, ...limbMetadata, ...(recipe.bank === undefined ? {} : { bank: recipe.bank }), frameCount, presentationFrameSize: recipe.presentationSize,
        // The frame a body starts beside: full phase, the nearest to the flood-lit frame it shows until shadows are turned on.
        defaultFrame: frameCount - 1,
        sheet: { url: config.publicBase + sheetFile, encoding: 'lossless-webp', ...await fileBytes(sheetPath), width, height, frameSize, margin, columns, rowCount, decodedRgbaBytes: width * height * 4, presentations },
        shadowless: { url: config.publicBase + shadowlessFile, encoding: 'lossless-webp', ...await fileBytes(shadowlessPath), width: shadowlessSize, height: shadowlessSize, frameIndex: frameCount - 1,
            ...lightingShadowlessAddress(recipe.presentationSize) } };
}
