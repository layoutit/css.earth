import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { prepareStaticSurfaceObject } from './index.mjs';

/** Compile in an isolated destination and compare the complete published bank. */
export async function verifyStaticSurfaceReproduction({ id, projectRoot }) {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid reproduction object ID.');
  const temporary = await mkdtemp(resolve(tmpdir(), 'cssearth-static-reproduction-'));
  const objectDirectory = resolve(projectRoot, 'src/planets', id), publicDirectory = resolve(temporary, 'public');
  const manifest = JSON.parse(await readFile(resolve(objectDirectory, 'runtime-assets.json'), 'utf8'));
  const runtimePath = resolve(objectDirectory, 'prepared/runtime.json'), before = await stat(runtimePath);
  try {
    await prepareStaticSurfaceObject({ objectDirectory, publicDirectory, outputDirectory: resolve(temporary, 'prepared') });
    const after = await stat(runtimePath);
    if (before.mtimeMs !== after.mtimeMs || before.size !== after.size) throw new Error('Isolated preparation modified the mounted object.');
    const digest = createHash('sha256'); let totalBytes = 0;
    for (const asset of manifest.assets) {
      const reproduced = await readFile(resolve(publicDirectory, asset.filename));
      if (reproduced.length !== asset.bytes || createHash('sha256').update(reproduced).digest('hex') !== asset.sha256) throw new Error(`Isolated reproduction drifted: ${asset.filename}`);
      totalBytes += reproduced.length; digest.update(asset.filename); digest.update(reproduced);
    }
    return { schema: `css${id}-isolated-raster-reproduction@1`, assetCount: manifest.assets.length, totalBytes, aggregateSha256: digest.digest('hex'), byteIdentical: true };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
