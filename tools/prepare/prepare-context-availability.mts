import { sha256 } from '@cssearth/core/node';
import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseObjectDescriptor } from '@cssearth/objects';
import { loadPreparedVolumeLenses } from '@cssearth/renderer/universe';
import { validateObjectProvenance } from '../../src/platform/object-provenance.mts';
import type { ContextAvailability } from '../../src/platform/context-availability.mts';
import { parsePreparedVolumePresentation } from '../../site/volume-presentation.mts';
import { readContextObjects } from './prepare-catalog.mts';
import { hasErrorCode } from '@cssearth/core';
import { requireInventory } from '../../src/platform/runtime-asset-closure.mts';

const root = resolve(import.meta.dirname, '../..');
type PublicAssetAvailability = 'local' | 'manifest';

/** Verify complete volume packages once before serving; no source processing or downloads. */
export async function inspectContextAvailability(projectRoot = root, { publicAssets = 'local' }: {
  publicAssets?: PublicAssetAvailability;
} = {}): Promise<ContextAvailability> {
  const contexts = await readContextObjects(resolve(projectRoot, 'src/objects'));
  const entries = await Promise.all(contexts.filter(object => object.type === 'volume-lens-bank').map(async ({ id }) => {
    const directory = resolve(projectRoot, 'src/objects', id);
    const read = async (base: string, path: string) => {
      const file = resolve(base, path), local = relative(base, file);
      if (!local || local === '..' || local.startsWith(`..${sep}`)) throw new TypeError(`Invalid prepared path: ${path}.`);
      try { return await readFile(file); }
      catch (error) {
        if (hasErrorCode(error, 'ENOENT')) throw new Error(`Missing ${relative(projectRoot, file)}.`);
        throw error;
      }
    };
    const verified = new Map<string, string>();
    const verify = async (base: string, path: string, pin: { sha256: string; bytes: number }) => {
      const file = resolve(base, path), identity = `${pin.sha256}/${pin.bytes}`;
      if (verified.has(file)) {
        if (verified.get(file) !== identity) throw new TypeError(`Conflicting prepared pins: ${path}.`);
        return;
      }
      const bytes = await read(base, path);
      if (bytes.length !== pin.bytes || sha256(bytes) !== pin.sha256)
        throw new TypeError(`Prepared identity mismatch: ${relative(projectRoot, file)}.`);
      verified.set(file, identity);
    };
    try {
      const descriptor = parseObjectDescriptor(JSON.parse((await read(directory, 'object.json')).toString()));
      const bank = await loadPreparedVolumeLenses(descriptor, { read: async path => new Uint8Array(await read(directory, path)).buffer });
      const provenance = validateObjectProvenance(JSON.parse((await read(directory, 'prepared/provenance.json')).toString()), id);
      const presentation = parsePreparedVolumePresentation(JSON.parse((await read(directory, 'prepared/presentation.json')).toString()), bank, provenance);
      for (const lens of bank.lenses) for (const resource of lens.volume.resources)
        await verify(resolve(directory, 'prepared'), resource.path, resource);
      const outputs = provenance.products.flatMap(product => product.outputs);
      const bankUrl = `src/objects/${id}/${descriptor.prepared!.url}`;
      const bankPin = outputs.find(output => output.url === bankUrl);
      if (!bankPin) throw new TypeError(`Unbound prepared bank: ${bankUrl}.`);
      await verify(projectRoot, bankUrl, bankPin);
      const published = publicAssets === 'manifest'
        ? requireInventory(id, JSON.parse((await read(directory, 'inventory.json')).toString()))
        : null;
      for (const lens of presentation.controls) for (const url of new Set([lens.thumbnailUrl, lens.texture?.url])) {
        if (!url?.startsWith(`/scenes/${id}/`)) throw new TypeError(`Invalid dataset preview URL: ${url}.`);
        const pin = outputs.find(output => output.url === url);
        if (!pin) throw new TypeError(`Unpinned dataset preview: ${url}.`);
        if (published) {
          const filename = url.slice(`/scenes/${id}/`.length);
          const asset = published.assets.find(candidate => candidate.filename === filename && candidate.location === 'public');
          if (!asset || asset.sha256 !== pin.sha256 || asset.bytes !== pin.bytes)
            throw new TypeError(`Unpublished dataset preview: ${url}.`);
        } else await verify(resolve(projectRoot, 'public'), url.slice(1), pin);
      }
      return [id, { available: true }] as const;
    } catch (error) {
      return [id, { available: false, reason: error instanceof Error ? error.message : String(error) }] as const;
    }
  }));
  return Object.fromEntries(entries);
}

export async function prepareContextAvailability({ projectRoot = root, strict = false, publicAssets = 'local' }: {
  projectRoot?: string; strict?: boolean; publicAssets?: PublicAssetAvailability;
} = {}) {
  const availability = await inspectContextAvailability(projectRoot, { publicAssets });
  const failures = Object.entries(availability).flatMap(([id, state]) => state.available ? [] : [`${id}: ${state.reason}`]);
  if (strict && failures.length) throw new Error(`Prepared context packages unavailable:\n${failures.join('\n')}`);
  return { availability, failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.slice(2).some(arg => arg !== '--strict')) throw new TypeError('Usage: prepare-context-availability [--strict]');
  const { failures } = await prepareContextAvailability({ strict: process.argv.includes('--strict') });
  console.log(failures.length ? failures.join('\n') : 'All prepared context packages are available.');
}
