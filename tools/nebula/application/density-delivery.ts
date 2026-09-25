/** Restore accepted app textures from regenerated cloud slices; keep reference metadata immutable. */
import assert from 'node:assert/strict';
import { prepareVolumeAtlases } from '../../../src/preparation/volume/atlas.js';
import { validatePreparedVolumeLenses } from '../../../src/renderers/css/volume/prepared-volume-lenses.js';
import { validatePreparedCssVolume } from '../../../src/renderers/css/volume/validation.js';
import { hash, localPath, pinned, type Pin, writeAtomic } from '@cssearth/bake/volume/node';

export interface BakeDelivery { directory: string; manifest: Pin; atlasInputs?: Pin; compactInputs?: Pin }
async function deliveryFiles(root: string, delivery: BakeDelivery) {
  localPath(root, delivery.directory);
  const manifest = JSON.parse((await pinned(root, delivery.manifest)).toString());
  assert.equal(manifest.schema, 'cssearth-volume-lens-manifest@1');
  const images = Object.entries(manifest.outputs).filter(([path]) => /^prepared\/[a-z][a-z0-9-]*\/(?:slices\/[xyz]\/\d+|atlases\/[a-z0-9-]+)\.webp$/.test(path)) as [string, {sha256: string; bytes: number}][];
  assert.ok(images.length > 0, 'Delivery manifest has no cloud textures.');
  for (const [path, pin] of Object.entries(manifest.outputs) as [string, {bytes: number}][]) {
    if (images.some(([imagePath]) => imagePath === path)) continue;
    const bytes = await pinned(root, { path: `${delivery.directory}/${path}` });
    assert.equal(bytes.length, pin.bytes, `Artifact size differs: ${path}`);
  }
  return images;
}

export async function deliveryReady(root: string, delivery: BakeDelivery) {
  const images = await deliveryFiles(root, delivery);
  let ready = true;
  for (const [path, pin] of images) {
    try { assert.equal((await pinned(root, { path: `${delivery.directory}/${path}` })).length, pin.bytes, `Artifact size differs: ${path}`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; ready = false; }
  }
  return ready;
}

export async function restoreDelivery(root: string, delivery: BakeDelivery, results: {imageId: string; directory: string}[]) {
  const images = await deliveryFiles(root, delivery);
  if (delivery.atlasInputs) return restoreAtlasDelivery(root, delivery, results, images);
  const writes: {path: string; bytes: Buffer}[] = [];
  for (const result of results) {
    const sourceDirectory = result.directory;
    const prefix = `prepared/${result.imageId}/`, selected = images.filter(([path]) => path.startsWith(prefix));
    assert.ok(selected.length, `Delivery does not contain ${result.imageId}.`);
    for (const [path, pin] of selected) {
      // Retain even accepted transparent slabs: the reference manifest still names them.
      const bytes = await pinned(root, { path: `${sourceDirectory}/${path.slice(prefix.length)}` });
      assert.equal(bytes.length, pin.bytes);
      writes.push({ path: localPath(root, `${delivery.directory}/${path}`), bytes });
    }
  }
  // Verify the complete selected set before replacing any delivery file.
  for (const output of writes) await writeAtomic(output.path, output.bytes);
  console.log(`DELIVERY_READY ${delivery.directory}: ${writes.length} textures reproduced exactly`);
}

/** Repack regenerated accepted slices, then verify every output against the pinned delivery. */
async function restoreAtlasDelivery(root: string, delivery: BakeDelivery, results: {imageId: string; directory: string}[],
  images: [string, {sha256: string; bytes: number}][]) {
  assert.ok(delivery.atlasInputs);
  const inputs = JSON.parse((await pinned(root, delivery.atlasInputs)).toString());
  assert.equal(inputs.schema, 'cssearth-volume-atlas-inputs@1');
  assert.ok(Array.isArray(inputs.lenses));
  const manifest = JSON.parse((await pinned(root, delivery.manifest)).toString());
  const envelope = JSON.parse((await pinned(root, { path: `${delivery.directory}/prepared/lenses.json` })).toString());
  const bank = validatePreparedVolumeLenses(envelope.data);
  const writes: {path: string; bytes: Buffer}[] = [];
  for (const result of results) {
    const sourceDirectory = result.directory;
    const accepted = bank.lenses.find(lens => lens.id === result.imageId);
    const input = inputs.lenses.find((lens: {id: string}) => lens.id === result.imageId);
    assert.ok(accepted && input && Array.isArray(input.textures));
    const volume = validatePreparedCssVolume({ ...accepted.volume, resources: input.resources,
      stacks: accepted.volume.stacks.map(stack => ({ ...stack, leaves: stack.leaves.map(leaf => {
        const mapping = input.textures.find((value: {id: string}) => value.id === leaf.id);
        assert.ok(mapping && typeof mapping.path === 'string');
        // Its own slice spans the leaf's box, at whatever texel density the box was compiled.
        return { ...leaf, texturePath: mapping.path, style: { ...leaf.style,
          backgroundSize: `${leaf.style.width} ${leaf.style.height}`, backgroundPosition: '0px 0px' } };
      }) })) });
    const baked = await prepareVolumeAtlases({ volume, prefix: `${result.imageId}/atlases`,
      readResource: async path => {
        assert.ok(path.startsWith(`${result.imageId}/`));
        const resource = volume.resources.find(value => value.path === path);
        assert.ok(resource);
        return pinned(root, {path: `${sourceDirectory}/${path.slice(result.imageId.length + 1)}`});
      },
      writeResource: async (path, bytes) => {
        const expected = images.find(([name]) => name === `prepared/${path}`)?.[1];
        assert.ok(expected, `Unexpected delivery atlas ${path}`);
        assert.equal(hash(bytes), expected.sha256, `Atlas replay differs: ${path}`);
        assert.equal(bytes.length, expected.bytes);
        writes.push({path: localPath(root, `${delivery.directory}/prepared/${path}`), bytes: Buffer.from(bytes)});
      }
    });
    assert.deepEqual(baked, accepted.volume, 'Atlas replay changed accepted volume metadata.');
  }
  for (const output of writes) await writeAtomic(output.path, output.bytes);
  console.log(`DELIVERY_READY ${delivery.directory}: ${writes.length} atlases reproduced exactly`);
}
