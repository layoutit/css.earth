import { resolve } from 'node:path';
import { lightingFrame } from '@cssearth/objects';
import type { RasterRecipe, LightingRecipe } from '../../../../preparation/raster/config.js';
import { raster, hashFile, outputName } from '../../../../preparation/raster/io.js';
export async function prepareLighting(config: RasterRecipe, recipe: LightingRecipe, publicDirectory: string) {
    const banks: Record<string, unknown> = {};
    for (const density of config.densities) {
        const frameSize = recipe.frameSize * density, rowCount = Math.ceil(recipe.frameCount / recipe.columns);
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
        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
            const firstFrame = rowIndex * recipe.columns, frameCount = Math.min(recipe.columns, recipe.frameCount - firstFrame), width = frameSize * frameCount;
            const pixels = new Uint8Array(width * frameSize * 4);
            const file = outputName(recipe.rowOutput, density).replace('{row}', String(rowIndex).padStart(2, '0'));
            const url = config.publicBase + file;
            for (let column = 0; column < frameCount; column++) {
                const frameIndex = firstFrame + column, frame = lightingFrame(frameSize, frameIndex, recipe);
                for (let y = 0; y < frameSize; y++)
                    pixels.set(frame.subarray(y * frameSize * 4, (y + 1) * frameSize * 4), (y * width + column * frameSize) * 4);
                const thumbnail = await raster(frame, frameSize, frameSize).resize(bbSize, bbSize, { kernel: 'lanczos3' }).raw().toBuffer();
                for (let y = 0; y < bbSize; y++)
                    billboard.set(thumbnail.subarray(y * bbSize * 4, (y + 1) * bbSize * 4), ((Math.floor(frameIndex / recipe.billboardColumns) * bbSize + y) * bbWidth + (frameIndex % recipe.billboardColumns) * bbSize) * 4);
                presentations.push({ frameIndex, rowIndex, url, backgroundPosition: `${-column * recipe.presentationSize}px 0px`, backgroundSize: `${frameCount * recipe.presentationSize}px ${recipe.presentationSize}px` });
            }
            const path = resolve(publicDirectory, file);
            await raster(pixels, width, frameSize).webp({ lossless: true, alphaQuality: 100 }).toFile(path);
            rows.push({ rowIndex, url, encoding: 'lossless-webp', ...await hashFile(path), width, height: frameSize, decodedRgbaBytes: width * frameSize * 4, firstFrame, frameCount });
        }
        const bbFile = outputName(recipe.billboardOutput, density), bbPath = resolve(publicDirectory, bbFile), bbUrl = config.publicBase + bbFile;
        await raster(billboard, bbWidth, bbHeight).webp({ lossless: true, alphaQuality: 100 }).toFile(bbPath);
        const bbPresentations = Array.from({ length: recipe.frameCount }, (_, frameIndex) => ({ frameIndex, url: bbUrl, backgroundPosition: `${-(frameIndex % recipe.billboardColumns) * recipe.presentationSize}px ${-Math.floor(frameIndex / recipe.billboardColumns) * recipe.presentationSize}px`, backgroundSize: `${recipe.billboardColumns * recipe.presentationSize}px ${bbRows * recipe.presentationSize}px` }));
        const defaultRow = Math.floor(recipe.defaultFrame / recipe.columns), initialWarmRows = [Math.max(0, defaultRow - 1), defaultRow, Math.min(rowCount - 1, defaultRow + 1)];
        const initialDecodedWorkingSetBytes = initialWarmRows.reduce((sum, row) => sum + rows[row].decodedRgbaBytes, 0);
        banks[density] = { schema: recipe.bankSchema, preparedPixelDensity: density, frameSize, presentationFrameSize: recipe.presentationSize,
            billboard: { schema: recipe.billboardSchema, url: bbUrl, encoding: 'lossless-webp', ...await hashFile(bbPath), width: bbWidth, height: bbHeight, frameSize: bbSize, columns: recipe.billboardColumns, rowCount: bbRows, frameCount: recipe.frameCount, presentationFrameSize: recipe.presentationSize, decodedRgbaBytes: bbWidth * bbHeight * 4, presentations: bbPresentations },
            transport: { model: 'row-shard-cache', encoding: 'lossless-webp', preloadBeforeMount: true, retainedLeafCount: 1, interpolation: 'nearest-prepared-camera-frame', framesPerRow: recipe.columns, rowCount, defaultFrame: recipe.defaultFrame, defaultRow, initialWarmRows, maximumRetainedRowCount: 3, addressWritesOnlyOnInput: true, retainLastReadyPresentation: true, idleCallbacks: 0, initialDecodedWorkingSetBytes, maximumDecodedWorkingSetBytes: initialDecodedWorkingSetBytes },
            rows, presentations, totalBytes: rows.reduce((sum, row) => sum + row.bytes, 0), fullBankDecodedRgbaBytes: rows.reduce((sum, row) => sum + row.decodedRgbaBytes, 0) };
    }
    return { ...recipe.metadata, frameCount: recipe.frameCount, presentationFrameSize: recipe.presentationSize, defaultFrame: recipe.defaultFrame, preparedPixelDensities: config.densities, banks };
}
