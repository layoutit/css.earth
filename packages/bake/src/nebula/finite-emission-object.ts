import { OBJECT_SCHEMA, PREPARED_OBJECT_SCHEMA, PREPARED_VOLUME_DATASETS_SCHEMA, parsePreparedLmcStars, cloudDensityWeight, validateCloudDensityFilter, type CloudDensityFilter, validatePreparedVolumeDatasets } from '@cssearth/objects';
import { PREPARED_VOLUME_DATASET_INDEX_SCHEMA } from '@cssearth/objects';
import { readVolumeDatasetBank, writeVolumeDatasetBank } from '@cssearth/objects/node';
import { isRecord, isNonemptyText } from '@cssearth/core';
/** Restore a delivered finite-emission dataset bank from its checked-in compact inputs; no lab, no research services. */
import assert from 'node:assert/strict';
import { mkdir, readFile, rename, rm, readdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { restoreCompactFiniteEmission, localPath, pinned, type CompilerPin, writeAtomic } from '../volume/node/index.ts';

import { compileCssVolume, prepareVolumeImpostors } from '../volume-leaves/index.ts';
import { prepareVolumeAtlases } from '../density/index.ts';

const record = (value: unknown, at: string): Record<string, unknown> => { assert.ok(isRecord(value), `Expected an object: ${at}`); return value; };
const text = (value: unknown, at: string): string => { assert.ok(isNonemptyText(value), `Expected text: ${at}`); return value; };
const json = (bytes: Uint8Array, gzipped: boolean): unknown => JSON.parse((gzipped ? gunzipSync(bytes) : Buffer.from(bytes)).toString('utf8'));
const stringify = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
function parsePin(value: unknown, at: string): CompilerPin {
  const pin = record(value, at);
  return { path: text(pin.path, `${at} path`) };
}
const read = async (root: string, pin: CompilerPin) => json(await pinned(root, pin), pin.path.endsWith('.gz'));

/** True when the descriptor names a prepared bank and every texture it lists is present at its recorded size. */
async function deliveredBankVerified(directory: string, installed: string): Promise<boolean> {
  try {
    const descriptor = record(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')), 'descriptor');
    record(descriptor.prepared, 'descriptor delivery');
    const data = await readVolumeDatasetBank(installed);
    for (const dataset of data.datasets) for (const resource of dataset.volume.resources) {
      const texture = await readFile(resolve(installed, resource.path));
      if (texture.length !== resource.bytes) return false;
    }
    return true;
  } catch { return false; }
}
/** Build the filter from validated primitives; the shared validator then enforces its own bounds. */
function parseDensityFilter(value: unknown, at: string): CloudDensityFilter {
  const raw = record(value, at), cutoff = raw.cutoff, softness = raw.softness, showRemoved = raw.showRemoved;
  assert.ok(typeof cutoff === 'number' && Number.isFinite(cutoff), `${at} needs a finite cutoff`);
  assert.ok(typeof softness === 'number' && Number.isFinite(softness), `${at} needs a finite softness`);
  assert.ok(typeof showRemoved === 'boolean', `${at} needs an explicit removed-signal choice`);
  return { cutoff, softness, showRemoved };
}

/**
 * Regenerate `prepared/datasets.json`, its axis atlases and the descriptor from delivered inputs alone.
 * Slice textures are an intermediate: the delivery ships three atlases per dataset, as the other nebulae do.
 */
export async function prepareFiniteEmissionObject(root: string, directory: string, compactInputs: CompilerPin, ifMissing: boolean, allowMissing = false) {
  const inputs = record(await read(root, compactInputs), 'compact inputs');
  const bankId = text(inputs.bankId, 'bank id'), defaultDataset = text(inputs.defaultDataset, 'default dataset');
  const framingRadiusUnits = inputs.framingRadiusUnits;
  assert.ok(typeof framingRadiusUnits === 'number' && framingRadiusUnits > 0, 'A delivered bank needs a framing radius.');
  const frame = record(inputs.frame, 'delivered frame');
  const installed = resolve(directory, 'prepared');
  // A cached delivery counts only when the descriptor names a prepared bank and every atlas that bank lists is present
  // with its recorded byte count.
  if (ifMissing && await deliveredBankVerified(directory, installed)) return { id: bankId, status: 'verified' };
  // Deploy builds may tolerate a bank missing from R2 instead of baking one from scratch here (no source
  // acquisition service runs at build time): report it unavailable and move on, loudly.
  if (allowMissing) {
    console.warn(`Prepared bank unavailable for ${bankId}; not baking a replacement (allow-missing). It will report unavailable.`);
    return { id: bankId, status: 'unavailable' };
  }

  const starsPayload = parsePreparedLmcStars(await read(root, parsePin(inputs.stars, 'delivered stars')), frame as never);
  const staging = resolve(directory, `.prepared-finite-${process.pid}`);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  try {
    const restored = await restoreCompactFiniteEmission(root, compactInputs, staging);
    const delivered = Array.isArray(inputs.datasets) ? inputs.datasets.map(value => record(value, 'delivered dataset')) : [];
    assert.equal(restored.length, delivered.length, 'Every delivered dataset must be restored.');
    const datasets = [], receipts = [];
    for (const dataset of restored) {
      const spec = delivered.find(entry => entry.imageId === dataset.imageId);
      assert.ok(spec, `Delivered inputs do not describe ${dataset.imageId}`);
      const filter = validateCloudDensityFilter(parseDensityFilter(spec.densityFilter, `${dataset.imageId} density filter`));
      const starOptions = record(spec.stars, `${dataset.imageId} star presentation`);
      const size = starOptions.size, brightness = starOptions.brightness;
      assert.ok(typeof size === 'number' && typeof brightness === 'number', 'Delivered star presentation must be numeric.');
      const enabledIds = Array.isArray(spec.enabledIds) ? spec.enabledIds.map(value => text(value, 'enabled part')) : [];
      assert.ok(enabledIds.length > 0, `${dataset.imageId} names no enabled cloud part.`);

      // The accepted bank embeds this dataset's own provenance, so the replay attaches the same pinned record.
      const provenance = await read(root, parsePin(spec.provenance, `${dataset.imageId} provenance`));
      const compiled = compileCssVolume({ id: `${bankId}-${dataset.imageId}`, frame: frame as never,
        slices: { ...dataset.slices, provenance } as never, recipe: { anchors: [] } });
      // Delivered resources live under the dataset id, exactly as the accepted delivery laid them out.
      const prefixed = { ...compiled,
        resources: compiled.resources.map(resource => ({ ...resource, path: `${dataset.imageId}/${resource.path}` })),
        stacks: compiled.stacks.map(stack => ({ ...stack,
          leaves: stack.leaves.map(leaf => ({ ...leaf, texturePath: `${dataset.imageId}/${leaf.texturePath}` })) })) };
      receipts.push({ id: dataset.imageId,
        textures: prefixed.resources.map(resource => ({ path: resource.path, bytes: resource.bytes })),
        coverage: dataset.coverage });

      const points = starsPayload.stars.map(star => {
        const weight = cloudDensityWeight(star.cloudSignal, filter);
        const support = star.cloudPartIds.some(id => enabledIds.includes(id)) ? (filter.showRemoved ? 1 - weight : weight) : 0;
        return { id: star.id, positionUnits: star.positionUnits, colorCss: star.colorCss,
          sizePx: star.sizePx * size, opacity: star.opacity * support * brightness };
      });
      const presentation = record(spec.presentation, `${dataset.imageId} presentation`);
      const datasetBrightness = record(spec.brightness, `${dataset.imageId} brightness`);
      const attenuation = (key: string) => {
        const value = datasetBrightness[key];
        assert.ok(typeof value === 'number' && Number.isFinite(value), `${dataset.imageId} brightness ${key} must be a number.`);
        return value;
      };
      // Render the impostor views before the slices are packed, so a galaxy that covers a few pixels is drawn as one
      // billboard. Without them the renderer keeps every slice of the cloud in the layer tree at any distance: on an
      // iPhone the Magellanic Clouds alone held 526 layers and 1.3 GB of layer memory while the camera was light-years
      // away. The atlas packer rewrites slice textures only, so these views pass through it unchanged.
      const projected = await prepareVolumeImpostors({ volume: prefixed,
        brightness: { overall: attenuation('overall'), x: attenuation('x'), y: attenuation('y'), z: attenuation('z') },
        prefix: `${dataset.imageId}/impostors`,
        readResource: path => readFile(localPath(staging, path)),
        writeResource: async (path: string, bytes: Uint8Array) => writeAtomic(localPath(staging, `atlases-out/${path}`), Buffer.from(bytes)) });
      // Pack the axis atlases from the restored slices; three requests per dataset instead of one per slab.
      const baked = await prepareVolumeAtlases({ volume: projected, prefix: `${dataset.imageId}/atlases`,
        readResource: path => readFile(localPath(staging, path)),
        writeResource: async (path: string, bytes: Uint8Array) => writeAtomic(localPath(staging, `atlases-out/${path}`), Buffer.from(bytes)) });
      datasets.push({ id: dataset.imageId, label: text(presentation.label, 'dataset label'), title: text(presentation.label, 'dataset title'),
        description: text(presentation.description, 'dataset description'), sourceUrl: presentation.sourceUrl,
        volume: baked, brightness: datasetBrightness, stars: { frame: starsPayload.frame, points } });
    }
    const first = delivered.find(entry => entry.imageId === defaultDataset);
    assert.ok(first, 'The delivered default dataset is missing.');
    const data = validatePreparedVolumeDatasets({ schema: PREPARED_VOLUME_DATASETS_SCHEMA, id: bankId, defaultDataset, framingRadiusUnits,
      starsEnabled: Boolean(record(first.stars, 'default star presentation').enabled), datasets });

    await mkdir(installed, { recursive: true });
    // Replace each installed dataset directory; a rename onto a populated one fails, and a re-prepare is normal.
    for (const entry of await readdir(resolve(staging, 'atlases-out'))) {
      await rm(resolve(installed, entry), { recursive: true, force: true });
      await rename(resolve(staging, 'atlases-out', entry), resolve(installed, entry));
    }
    // The bank's files, after its dataset directories are in place: the index, one volume a dataset, the stars and the record.
    await writeVolumeDatasetBank(installed, data);
    await writeAtomic(resolve(installed, 'delivery.json'), stringify({ schema: 'cssearth-finite-emission-delivery-receipt@2',
      compactInputs, datasets: receipts }));
    await writeAtomic(resolve(directory, 'object.json'), stringify({ schema: OBJECT_SCHEMA, id: bankId, type: 'volume-dataset-bank',
      properties: { frame, preparation: { source: 'source/compact-delivery.json' } },
      prepared: { format: PREPARED_VOLUME_DATASET_INDEX_SCHEMA, url: 'prepared/datasets.json' } }));
    console.log(`DELIVERY_READY ${directory}: ${datasets.length} datasets, ${datasets.reduce((sum, dataset) => sum + dataset.volume.resources.length, 0)} atlases`);
    return { id: bankId, status: 'prepared' };
  } finally { await rm(staging, { recursive: true, force: true }); }
}
