/** A deterministic reducer process for the storage regression; production routing still owns its paths and records. */
import { copyFile, readFile } from 'node:fs/promises';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
const job = requireRecord(JSON.parse(await readFile(requireString(process.argv[2], 'job path'), 'utf8')));
await copyFile(requireString(job.reference), requireString(job.output));
const grid = { shape: [2, 2], crval: [10, 20], pixelScaleArcsec: 0.6 };
process.stdout.write(JSON.stringify({ frames: requireArray(job.frames).length, shape: [2, 2], stackBytes: 16, coveredPixels: 4,
  maxContributingFrames: 1, medianContributingFrames: 1, backgroundOffsets: [0], archiveGrid: grid, gridImpliedByFrames: grid }));
