/** Restore a delivered finite-emission lens bank from its checked-in compact inputs; no lab, no research services. */
import assert from 'node:assert/strict';
import { mkdir, readFile, rename, rm, readdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { restoreCompactFiniteEmission } from '@cssearth/volume-bake/compact-inputs/finite-emission';
import { hash, localPath, pinned, type Pin } from '@cssearth/volume-bake/compact-inputs/io';
import { cloudDensityWeight, validateCloudDensityFilter, type CloudDensityFilter } from '@cssearth/volume-core/fields/cloud-density';
import { parsePreparedLmcStars } from '@cssearth/volume-core/contracts/prepared-catalogue-stars';
import { compileCssVolume } from '../../../src/renderers/css/preparation/volume.js';
import { prepareVolumeAtlases } from '../../../src/preparation/volume/atlas.js';
import { validatePreparedVolumeLenses } from '../../../src/renderers/css/volume/prepared-volume-lenses.js';
import { writeAtomic } from './io.ts';

const record = (value: unknown, at: string): Record<string, unknown> => {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `Expected an object: ${at}`);
  return value as Record<string, unknown>;
};
const text = (value: unknown, at: string): string => { assert.ok(typeof value === 'string' && value, `Expected text: ${at}`); return value; };
const json = (bytes: Uint8Array, gzipped: boolean): unknown => JSON.parse((gzipped ? gunzipSync(bytes) : Buffer.from(bytes)).toString('utf8'));
const stringify = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
function parsePin(value: unknown, at: string): Pin {
  const pin = record(value, at);
  return { path: text(pin.path, `${at} path`) };
}
const read = async (root: string, pin: Pin) => json(await pinned(root, pin), pin.path.endsWith('.gz'));

/** True when the installed bank matches the committed descriptor and every texture it names is intact. */
async function deliveredBankVerified(directory: string, installed: string): Promise<boolean> {
  try {
    const descriptor = record(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')), 'descriptor');
    record(descriptor.prepared, 'descriptor delivery');
    const bytes = await readFile(resolve(installed, 'lenses.json'));
    const data = validatePreparedVolumeLenses(record(json(bytes, false), 'installed bank').data);
    for (const lens of data.lenses) for (const resource of lens.volume.resources) {
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
 * Regenerate `prepared/lenses.json`, its axis atlases and the descriptor from delivered inputs alone.
 * Slice textures are an intermediate: the delivery ships three atlases per lens, as the other nebulae do.
 */
export async function prepareFiniteEmissionObject(root: string, directory: string, compactInputs: Pin, ifMissing: boolean, allowMissing = false) {
  const inputs = record(await read(root, compactInputs), 'compact inputs');
  const bankId = text(inputs.bankId, 'bank id'), defaultLens = text(inputs.defaultLens, 'default lens');
  const framingRadiusUnits = inputs.framingRadiusUnits;
  assert.ok(typeof framingRadiusUnits === 'number' && framingRadiusUnits > 0, 'A delivered bank needs a framing radius.');
  const frame = record(inputs.frame, 'delivered frame');
  const installed = resolve(directory, 'prepared');
  // A cached delivery counts only when the installed bank is the one the committed descriptor pins, and
  // every atlas it names is present with the expected bytes. Presence alone would accept a stale bank.
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
    const delivered = Array.isArray(inputs.lenses) ? inputs.lenses.map(value => record(value, 'delivered lens')) : [];
    assert.equal(restored.length, delivered.length, 'Every delivered lens must be restored.');
    const lenses = [], receipts = [];
    for (const lens of restored) {
      const spec = delivered.find(entry => entry.imageId === lens.imageId);
      assert.ok(spec, `Delivered inputs do not describe ${lens.imageId}`);
      const filter = validateCloudDensityFilter(parseDensityFilter(spec.densityFilter, `${lens.imageId} density filter`));
      const starOptions = record(spec.stars, `${lens.imageId} star presentation`);
      const size = starOptions.size, brightness = starOptions.brightness;
      assert.ok(typeof size === 'number' && typeof brightness === 'number', 'Delivered star presentation must be numeric.');
      const enabledIds = Array.isArray(spec.enabledIds) ? spec.enabledIds.map(value => text(value, 'enabled part')) : [];
      assert.ok(enabledIds.length > 0, `${lens.imageId} names no enabled cloud part.`);

      // The accepted bank embeds this lens's own provenance, so the replay attaches the same pinned record.
      const provenance = await read(root, parsePin(spec.provenance, `${lens.imageId} provenance`));
      const compiled = compileCssVolume({ id: `${bankId}-${lens.imageId}`, frame: frame as never,
        slices: { ...lens.slices, provenance } as never, recipe: { anchors: [] } });
      // Delivered resources live under the lens id, exactly as the accepted delivery laid them out.
      const prefixed = { ...compiled,
        resources: compiled.resources.map(resource => ({ ...resource, path: `${lens.imageId}/${resource.path}` })),
        stacks: compiled.stacks.map(stack => ({ ...stack,
          leaves: stack.leaves.map(leaf => ({ ...leaf, texturePath: `${lens.imageId}/${leaf.texturePath}` })) })) };
      receipts.push({ id: lens.imageId, volumeSha256: hash(stringify(prefixed)),
        textures: prefixed.resources.map(resource => ({ path: resource.path, sha256: resource.sha256, bytes: resource.bytes })),
        coverage: lens.coverage });

      const points = starsPayload.stars.map(star => {
        const weight = cloudDensityWeight(star.cloudSignal, filter);
        const support = star.cloudPartIds.some(id => enabledIds.includes(id)) ? (filter.showRemoved ? 1 - weight : weight) : 0;
        return { id: star.id, positionUnits: star.positionUnits, colorCss: star.colorCss,
          sizePx: star.sizePx * size, opacity: star.opacity * support * brightness };
      });
      const presentation = record(spec.presentation, `${lens.imageId} presentation`);
      // Pack the axis atlases from the restored slices; three requests per lens instead of one per slab.
      const baked = await prepareVolumeAtlases({ volume: prefixed, prefix: `${lens.imageId}/atlases`,
        readResource: path => readFile(localPath(staging, path)),
        writeResource: async (path: string, bytes: Uint8Array) => writeAtomic(localPath(staging, `atlases-out/${path}`), Buffer.from(bytes)) });
      lenses.push({ id: lens.imageId, label: text(presentation.label, 'lens label'), title: text(presentation.label, 'lens title'),
        description: text(presentation.description, 'lens description'), sourceUrl: presentation.sourceUrl,
        volume: baked, brightness: record(spec.brightness, `${lens.imageId} brightness`), stars: { frame: starsPayload.frame, points } });
    }
    const first = delivered.find(entry => entry.imageId === defaultLens);
    assert.ok(first, 'The delivered default lens is missing.');
    const data = validatePreparedVolumeLenses({ schema: 'cssearth-volume-lenses@1', id: bankId, defaultLens, framingRadiusUnits,
      starsEnabled: Boolean(record(first.stars, 'default star presentation').enabled), lenses });
    const envelope = stringify({ schema: 'cssearth-prepared-object@1', id: bankId, type: 'volume-lens-bank', format: 'cssearth-volume-lenses@1', data });

    await mkdir(installed, { recursive: true });
    // Replace each installed lens directory; a rename onto a populated one fails, and a re-prepare is normal.
    for (const entry of await readdir(resolve(staging, 'atlases-out'))) {
      await rm(resolve(installed, entry), { recursive: true, force: true });
      await rename(resolve(staging, 'atlases-out', entry), resolve(installed, entry));
    }
    await writeAtomic(resolve(installed, 'lenses.json'), envelope);
    await writeAtomic(resolve(installed, 'delivery.json'), stringify({ schema: 'cssearth-finite-emission-delivery-receipt@1',
      compactInputs, modelResultId: text(inputs.modelResultId, 'model id'), lenses: receipts }));
    await writeAtomic(resolve(directory, 'object.json'), stringify({ schema: 'cssearth-object@1', id: bankId, type: 'volume-lens-bank',
      properties: { frame, preparation: { source: 'source/compact-delivery.json' } },
      prepared: { format: 'cssearth-volume-lenses@1', url: 'prepared/lenses.json' } }));
    console.log(`DELIVERY_READY ${directory}: ${lenses.length} lenses, ${lenses.reduce((sum, lens) => sum + lens.volume.resources.length, 0)} atlases`);
    return { id: bankId, status: 'prepared' };
  } finally { await rm(staging, { recursive: true, force: true }); }
}
