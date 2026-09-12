import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { sampleCalibrationTile } from './calibration-tile-address.mts';
import { json, records } from './interaction-analysis-records.mts';
import { object, text, integer } from './oracle-values.mts';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export async function verifyProvenance(nativePath: string, browserPath: string | null, calibrationRoot: string) {
  const n = await json(nativePath), b = browserPath ? await json(browserPath) : null;
  const nativeDirectory = dirname(n.sourceReport == null ? nativePath : text(n.sourceReport));
  const source = object((await json(resolve(calibrationRoot, 'manifest.json'))).source);
  const sourceBytes = await readFile(resolve(calibrationRoot, text(source.path)));
  assert.equal(hash(sourceBytes), text(source.encodedSha256));
  const raster = await sharp(sourceBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(hash(raster.data), text(source.decodedRgbaSha256));
  assert.equal(n.calibrationSha256, source.decodedRgbaSha256);
  const mapping = await json(resolve(nativeDirectory, 'mapping/texture-map.json'));
  const mappings = records(mapping.mappings).map(row => {
    const address = object(row.googleCacheAddress);
    return { googleCacheAddress: { level: integer(address.level), col: integer(address.col), row: integer(address.row) },
      calibrationTile: object(row.calibrationTile) };
  });
  const bindings = records(n.bindings);
  assert.ok(bindings.length > 0, 'Native capture has no audited texture bindings');
  const tiles = new Map<string, string>();
  for (const binding of bindings) {
    assert.equal(binding.mapped, true);
    const entry = mappings.find(m => m.googleCacheAddress.level === binding.level &&
      m.googleCacheAddress.col === binding.x && m.googleCacheAddress.row === binding.y);
    assert.ok(entry, 'Native binding lacks its capture-specific tile mapping');
    const tile = entry.calibrationTile;
    assert.equal(tile.sourceDecodedRgbaSha256, source.decodedRgbaSha256);
    assert.equal(tile.uploadRgbaSha256, binding.decodedRgbaSha256);
    const uploadPath = text(tile.uploadPath), expectedHash = text(binding.decodedRgbaSha256);
    if (!tiles.has(uploadPath)) {
      const bytes = await readFile(uploadPath);
      assert.equal(hash(bytes), expectedHash);
      const { topDown } = sampleCalibrationTile(raster, entry.googleCacheAddress);
      const regenerated = await sharp(topDown, { raw: { width: 256, height: 256, channels: 4 } }).flip().raw().toBuffer();
      assert.equal(hash(regenerated), expectedHash);
      tiles.set(uploadPath, expectedHash);
    }
  }
  const process = await json(resolve(nativeDirectory, 'process.json'));
  assert.equal(hash(await readFile(text(process.executable))), text(process.executableSha256));
  const nativeFrames: { path: string; sha256: string }[] = [];
  for (const frame of records(n.frames)) {
    const path = text(frame.path); nativeFrames.push({ path, sha256: hash(await readFile(path)) });
  }
  const browserFrames: { path: string; sha256: string }[] = [];
  if (b) {
    assert.equal(b.calibrationSha256, source.decodedRgbaSha256);
    for (const resource of records(b.resources)) {
      assert.equal(resource.sourceDecodedRgbaSha256, source.decodedRgbaSha256);
      const bytes = await readFile(resolve(calibrationRoot, text(resource.path)));
      assert.equal(hash(bytes), text(resource.encodedSha256));
      assert.equal(hash(await sharp(bytes).ensureAlpha().raw().toBuffer()), text(resource.decodedRgbaSha256));
    }
    const frames = records(b.frames).map(frame => ({ path: text(frame.path), sha256: text(frame.sha256) }));
    assert.equal(new Set(frames.map(f => f.path)).size, frames.length);
    for (const frame of frames) {
      assert.equal(hash(await readFile(frame.path)), frame.sha256);
      browserFrames.push(frame);
    }
  }
  return { verified: true, sourceSha256: text(source.decodedRgbaSha256), executable: process,
    nativeBindings: bindings.length, regeneratedTiles: tiles.size, nativeFrames, browserFrames,
    browserResources: b ? records(b.resources) : [],
    scope: 'exact source, capture-specific uploaded native RGBA, browser preparation bytes, and frame hashes verified' };
}
