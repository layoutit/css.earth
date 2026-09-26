import { existsSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { lightingFrame, type LambertRasterConfig } from '@cssearth/objects';
import { limbSphereFrame, type Channels, type LimbLaw } from '@cssearth/bake/photometry';
import { RASTER_DENSITY, type RasterRecipe, type LightingRecipe } from '../../../../preparation/raster/config.js';
import { raster, hashFile, outputName } from '../../../../preparation/raster/io.js';
import { LIGHTING_BANK_ROOT } from '../../../../preparation/raster/lighting-banks.js';
/** Rows encoding at once. Each waiting row holds its RGBA, so this stays below the thread pool (tools/objects/thread-pool.ts). */
export const LIGHTING_ENCODE_CONCURRENCY = Math.max(1, Math.min(8, availableParallelism()));
/** A body's published limb: its models and the overlay's reference colour (tools/photometry/limb.mts). */
export interface PreparedLimb { readonly law: LimbLaw; readonly reference: Channels<number>; readonly referenceSource: string; readonly polarToEquatorial: number }

/** One frame of the bank: the published limb law when the body has one, otherwise the shared bank's authored sphere law. */
function frameFor(frameSize: number, frameIndex: number, recipe: LightingRecipe, limb: PreparedLimb | undefined) {
    if (!limb) return lightingFrame(frameSize, frameIndex, recipe as LambertRasterConfig);
    const z = recipe.minimumLightViewZ + (recipe.maximumLightViewZ - recipe.minimumLightViewZ) * frameIndex / (recipe.frameCount - 1);
    return limbSphereFrame(frameSize, recipe.radiusScale, [Math.sqrt(Math.max(0, 1 - z * z)), 0, z], limb.law, limb.reference, limb.polarToEquatorial);
}
export async function prepareLighting(config: RasterRecipe, recipe: LightingRecipe, publicDirectory: string, limb?: PreparedLimb) {
    if (Boolean(recipe.limb) !== Boolean(limb)) throw new TypeError(`Lighting ${recipe.bankSchema}: lighting.limb ${recipe.limb ? 'names models that were not loaded' : 'is absent but a limb law was supplied'}.`);
    // A recipe naming a shared bank takes the bank's rows and billboard as baked under public/lighting/<bank>/ (lighting-banks.ts):
    // the same bytes an encode here would write, checked by prepare-lighting-bank --check, without the encode. The bake stages
    // into a scratch directory, so the bank is found from the repository root every preparation tool runs from.
    const bankDirectory = recipe.bank === undefined ? undefined : resolve(process.cwd(), LIGHTING_BANK_ROOT, recipe.bank);
    const banks: Record<string, unknown> = {};
    const density = RASTER_DENSITY, frameSize = recipe.frameSize * density, rowCount = Math.ceil(recipe.frameCount / recipe.columns);
    const bbSize = recipe.billboardFrameSize * density, bbRows = Math.ceil(recipe.frameCount / recipe.billboardColumns), bbWidth = bbSize * recipe.billboardColumns, bbHeight = bbSize * bbRows;
    const billboard = new Uint8Array(bbWidth * bbHeight * 4);
    const rows: {
        rowIndex: number;
        url: string;
        encoding: string;
        bytes: number;
        sha256: string;
        width: number;
        height: number;
        decodedRgbaBytes: number;
        firstFrame: number;
        frameCount: number;
    }[] = [], presentations = [];
    // Encoding a lossless row (8 frames at 2x, about 0.5 MB) is single-threaded in libvips and took about 1.2 s; 32 rows in
    // sequence made a shape-only planet a 40-second bake with one core busy. Rows now encode on sharp's thread pool while the
    // next row's frames are computed, at most LIGHTING_ENCODE_CONCURRENCY in flight (each row holds 32 MB of RGBA until its
    // encoder has it). Row order, bytes and hashes are unchanged: every row is still written from its own pixels.
    const encodes: Promise<void>[] = [];
    const pending = new Set<Promise<void>>();
    const fromBank = async (file: string) => {
        const source = resolve(bankDirectory!, file);
        if (!existsSync(source)) throw new Error(`Lighting bank ${recipe.bank} has no ${file} under ${LIGHTING_BANK_ROOT}/${recipe.bank}; bake it: node tools/objects/dist/prepare-lighting-bank.js.`);
        await copyFile(source, resolve(publicDirectory, file));
    };
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
        const firstFrame = rowIndex * recipe.columns, frameCount = Math.min(recipe.columns, recipe.frameCount - firstFrame), width = frameSize * frameCount;
        const pixels = bankDirectory ? undefined : new Uint8Array(width * frameSize * 4);
        const file = outputName(recipe.rowOutput, density).replace('{row}', String(rowIndex).padStart(2, '0'));
        const url = config.publicBase + file;
        const thumbnails: Promise<void>[] = [];
        for (let column = 0; column < frameCount; column++) {
            const frameIndex = firstFrame + column;
            presentations.push({ frameIndex, rowIndex, url, backgroundPosition: `${-column * recipe.presentationSize}px 0px`, backgroundSize: `${frameCount * recipe.presentationSize}px ${recipe.presentationSize}px` });
            if (bankDirectory) continue;
            const frame = frameFor(frameSize, frameIndex, recipe, limb);
            for (let y = 0; y < frameSize; y++)
                pixels!.set(frame.subarray(y * frameSize * 4, (y + 1) * frameSize * 4), (y * width + column * frameSize) * 4);
            thumbnails.push(raster(frame, frameSize, frameSize).resize(bbSize, bbSize, { kernel: 'lanczos3' }).raw().toBuffer().then(thumbnail => {
                for (let y = 0; y < bbSize; y++)
                    billboard.set(thumbnail.subarray(y * bbSize * 4, (y + 1) * bbSize * 4), ((Math.floor(frameIndex / recipe.billboardColumns) * bbSize + y) * bbWidth + (frameIndex % recipe.billboardColumns) * bbSize) * 4);
            }));
        }
        const path = resolve(publicDirectory, file);
        const encode = (bankDirectory ? fromBank(file) : Promise.all(thumbnails).then(() => raster(pixels!, width, frameSize).webp({ lossless: true, alphaQuality: 100 }).toFile(path))).then(async () => {
            rows[rowIndex] = { rowIndex, url, encoding: 'lossless-webp', ...await hashFile(path), width, height: frameSize, decodedRgbaBytes: width * frameSize * 4, firstFrame, frameCount };
        });
        encodes.push(encode);
        const tracked: Promise<void> = encode.finally(() => pending.delete(tracked));
        pending.add(tracked);
        if (pending.size >= LIGHTING_ENCODE_CONCURRENCY) await Promise.race(pending);
    }
    await Promise.all(encodes);
    const bbFile = outputName(recipe.billboardOutput, density), bbPath = resolve(publicDirectory, bbFile), bbUrl = config.publicBase + bbFile;
    if (bankDirectory) await fromBank(bbFile);
    else await raster(billboard, bbWidth, bbHeight).webp({ lossless: true, alphaQuality: 100 }).toFile(bbPath);
    const bbPresentations = Array.from({ length: recipe.frameCount }, (_, frameIndex) => ({ frameIndex, url: bbUrl, backgroundPosition: `${-(frameIndex % recipe.billboardColumns) * recipe.presentationSize}px ${-Math.floor(frameIndex / recipe.billboardColumns) * recipe.presentationSize}px`, backgroundSize: `${recipe.billboardColumns * recipe.presentationSize}px ${bbRows * recipe.presentationSize}px` }));
    // The shadowless frame on its own: with shadows off (the default) a body shows only this frame, which a row carries
    // beside seven others (the Moon's row 31 is 514 KB, this frame 57 KB).
    const lastFrame = recipe.frameCount - 1, sfFile = outputName(recipe.billboardOutput, density).replace('billboard', 'shadowless');
    if (!sfFile.includes('shadowless')) throw new TypeError(`Lighting output ${recipe.billboardOutput} does not name its billboard; the shadowless frame has no name.`);
    const sfPath = resolve(publicDirectory, sfFile), sfUrl = config.publicBase + sfFile;
    if (bankDirectory) await fromBank(sfFile);
    else await raster(frameFor(frameSize, lastFrame, recipe, limb), frameSize, frameSize).webp({ lossless: true, alphaQuality: 100 }).toFile(sfPath);
    const shadowless = { url: sfUrl, encoding: 'lossless-webp', ...await hashFile(sfPath), width: frameSize, height: frameSize, frameIndex: lastFrame,
        backgroundPosition: '0px 0px', backgroundSize: `${recipe.presentationSize}px ${recipe.presentationSize}px` };
    // The far view's shadowless frame alone, the same tile the billboard atlas carries among its 256 (the Moon's atlas is
    // 116 KB): with shadows off a distant body shows only this tile.
    const sbFile = outputName(recipe.billboardOutput, density).replace('billboard', 'shadowless-billboard'), sbPath = resolve(publicDirectory, sbFile);
    if (bankDirectory) await fromBank(sbFile);
    else await raster(frameFor(frameSize, lastFrame, recipe, limb), frameSize, frameSize).resize(bbSize, bbSize, { kernel: 'lanczos3' }).webp({ lossless: true, alphaQuality: 100 }).toFile(sbPath);
    const billboardShadowless = { url: config.publicBase + sbFile, encoding: 'lossless-webp', ...await hashFile(sbPath), width: bbSize, height: bbSize, frameIndex: lastFrame,
        backgroundPosition: '0px 0px', backgroundSize: `${recipe.presentationSize}px ${recipe.presentationSize}px` };
    const defaultRow = Math.floor(recipe.defaultFrame / recipe.columns), initialWarmRows = [Math.max(0, defaultRow - 1), defaultRow, Math.min(rowCount - 1, defaultRow + 1)];
    const initialDecodedWorkingSetBytes = initialWarmRows.reduce((sum, row) => sum + rows[row].decodedRgbaBytes, 0);
    banks[density] = { schema: recipe.bankSchema, preparedPixelDensity: density, frameSize, presentationFrameSize: recipe.presentationSize,
        billboard: { schema: recipe.billboardSchema, url: bbUrl, shadowless: billboardShadowless, encoding: 'lossless-webp', ...await hashFile(bbPath), width: bbWidth, height: bbHeight, frameSize: bbSize, columns: recipe.billboardColumns, rowCount: bbRows, frameCount: recipe.frameCount, presentationFrameSize: recipe.presentationSize, decodedRgbaBytes: bbWidth * bbHeight * 4, presentations: bbPresentations },
        transport: { model: 'row-shard-cache', encoding: 'lossless-webp', preloadBeforeMount: true, retainedLeafCount: 1, interpolation: 'nearest-prepared-camera-frame', framesPerRow: recipe.columns, rowCount, defaultFrame: recipe.defaultFrame, defaultRow, initialWarmRows, maximumRetainedRowCount: 3, addressWritesOnlyOnInput: true, retainLastReadyPresentation: true, idleCallbacks: 0, initialDecodedWorkingSetBytes, maximumDecodedWorkingSetBytes: initialDecodedWorkingSetBytes },
        rows, presentations, shadowless, totalBytes: rows.reduce((sum, row) => sum + row.bytes, 0), fullBankDecodedRgbaBytes: rows.reduce((sum, row) => sum + row.decodedRgbaBytes, 0) };
    const limbMetadata = limb ? { limb: { model: 'published-photometric-models-relative-to-the-flood-lit-disc-centre', models: limb.law.paths, referenceColor: limb.reference, referenceSource: limb.referenceSource } } : {};
    return { ...recipe.metadata, ...limbMetadata, frameCount: recipe.frameCount, presentationFrameSize: recipe.presentationSize, defaultFrame: recipe.defaultFrame, preparedPixelDensities: [RASTER_DENSITY], banks };
}
