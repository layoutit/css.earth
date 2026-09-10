/** Restore accepted app textures from regenerated cloud slices; keep reference metadata immutable. */
import assert from 'node:assert/strict';
import { readPreparedReconstruction } from '../reconstruction/reconstruction-preparation.js';
import { localPath, pinned, writeAtomic, type Pin } from './io.js';

export interface BakeDelivery { directory: string; manifest: Pin }
async function deliveryFiles(root: string, delivery: BakeDelivery) {
  localPath(root, delivery.directory);
  const manifest = JSON.parse((await pinned(root, delivery.manifest)).toString());
  assert.equal(manifest.schema, 'cssearth-volume-lens-manifest@1');
  const images = Object.entries(manifest.outputs).filter(([path]) => /^prepared\/[a-z][a-z0-9-]*\/slices\/[xyz]\/\d+\.webp$/.test(path)) as [string, {sha256: string; bytes: number}][];
  assert.ok(images.length > 0, 'Delivery manifest has no cloud textures.');
  for (const [path, pin] of Object.entries(manifest.outputs) as [string, {sha256: string}][]) {
    if (images.some(([imagePath]) => imagePath === path)) continue;
    await pinned(root, { path: `${delivery.directory}/${path}`, sha256: pin.sha256 });
  }
  return images;
}

export async function deliveryReady(root: string, delivery: BakeDelivery) {
  const images = await deliveryFiles(root, delivery);
  let ready = true;
  for (const [path, pin] of images) {
    try { await pinned(root, { path: `${delivery.directory}/${path}`, sha256: pin.sha256 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; ready = false; }
  }
  return ready;
}

export async function restoreDelivery(root: string, delivery: BakeDelivery, results: {imageId: string; resultId?: string}[]) {
  const images = await deliveryFiles(root, delivery), writes: {path: string; bytes: Buffer}[] = [];
  for (const result of results) {
    assert.ok(result.resultId);
    const prepared = await readPreparedReconstruction(root, result.resultId);
    assert.equal(prepared.imageId, result.imageId);
    const prefix = `prepared/${result.imageId}/`, selected = images.filter(([path]) => path.startsWith(prefix));
    assert.ok(selected.length, `Delivery does not contain ${result.imageId}.`);
    for (const [path, pin] of selected) {
      // Retain even accepted transparent slabs: the reference manifest still names them.
      const bytes = await pinned(root, { path: `${prepared.subject.directory}/prepared/${path.slice(prefix.length)}`, sha256: pin.sha256 });
      assert.equal(bytes.length, pin.bytes);
      writes.push({ path: localPath(root, `${delivery.directory}/${path}`), bytes });
    }
  }
  // Verify the complete selected set before replacing any delivery file.
  for (const output of writes) await writeAtomic(output.path, output.bytes);
  console.log(`DELIVERY_READY ${delivery.directory}: ${writes.length} textures reproduced exactly`);
}
