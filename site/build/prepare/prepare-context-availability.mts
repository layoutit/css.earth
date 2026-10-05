import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseObjectDescriptor, readSourceManifestInputs, readVolumePresentationPreviews } from '@cssearth/objects';
import { PREPARED_VOLUME_DATASET_INDEX_SCHEMA, parseDensityVolumeFrame } from '@cssearth/objects';
import { readVolumeDatasetBank } from '@cssearth/objects/node';
import { lineageSource } from '@cssearth/objects/provenance';
import type { ContextAvailability } from '@cssearth/objects/provenance';
import { sourceArray, sourceObject } from '@cssearth/objects/sources';
import { parsePreparedVolumePresentation } from '../../content/volume-presentation.mts';
import { readContextObjects } from '@cssearth/objects/node';
import { hasErrorCode } from '@cssearth/core';
import { requireInventory } from '@cssearth/objects/node';

const root = resolve(import.meta.dirname, '../../..');
type PublicAssetAvailability = 'local' | 'manifest';

/** Verify complete volume packages once before serving; no source processing or downloads. */
export async function inspectContextAvailability(projectRoot = root, { publicAssets = 'local' }: {
  publicAssets?: PublicAssetAvailability;
} = {}): Promise<ContextAvailability> {
  const contexts = await readContextObjects(resolve(projectRoot, 'src/objects'));
  const entries = await Promise.all(contexts.filter(object => object.type === 'volume-dataset-bank').map(async ({ id }) => {
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
    // Each file the package names must be present; inventory.json and the R2 restore own its bytes.
    const present = new Set<string>();
    const verify = async (base: string, path: string) => {
      const file = resolve(base, path);
      if (present.has(file)) return;
      await read(base, path);
      present.add(file);
    };
    try {
      const descriptor = parseObjectDescriptor(JSON.parse((await read(directory, 'object.json')).toString()));
      if (descriptor.prepared?.format !== PREPARED_VOLUME_DATASET_INDEX_SCHEMA) throw new TypeError(`${id}: object.json names format ${JSON.stringify(descriptor.prepared?.format ?? null)}; a volume dataset bank is stored as ${PREPARED_VOLUME_DATASET_INDEX_SCHEMA}.`);
      // The bank whole, from its files: its index, each dataset's volume and its stars (@cssearth/objects volume-dataset-bank-files.ts).
      const prepared = resolve(directory, 'prepared'), bank = await readVolumeDatasetBank(prepared, async name => new Uint8Array(await read(prepared, name)));
      const frame = JSON.stringify(parseDensityVolumeFrame(descriptor.properties.frame));
      for (const dataset of bank.datasets) if (JSON.stringify(dataset.volume.frame) !== frame) throw new TypeError(`${id}: dataset ${dataset.id} is not in its descriptor's frame.`);
      const sources = sourceArray(readSourceManifestInputs(JSON.parse((await read(directory, 'source/manifest.json')).toString())).inputs, raw => lineageSource(raw));
      const presentation = parsePreparedVolumePresentation(readVolumePresentationPreviews(JSON.parse((await read(directory, 'prepared/presentation.json')).toString())), bank, sources);
      for (const dataset of bank.datasets) for (const resource of dataset.volume.resources)
        await verify(resolve(directory, 'prepared'), resource.path);
      const published = publicAssets === 'manifest'
        ? requireInventory(id, JSON.parse((await read(directory, 'inventory.json')).toString()))
        : null;
      for (const dataset of presentation.controls) for (const url of new Set([dataset.thumbnailUrl, dataset.texture?.url])) {
        if (!url?.startsWith(`/scenes/${id}/`)) throw new TypeError(`Invalid dataset preview URL: ${url}.`);
        if (published) {
          const filename = url.slice(`/scenes/${id}/`.length);
          if (!published.assets.some(candidate => candidate.filename === filename && candidate.location === 'public'))
            throw new TypeError(`Unpublished dataset preview: ${id}/inventory.json has no public asset ${filename} for ${url}.`);
        } else await verify(resolve(projectRoot, 'public'), url.slice(1));
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

// Entry script: node site/build/prepare/prepare-context-availability.mts [--strict].
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.slice(2).some(arg => arg !== '--strict')) throw new TypeError('Usage: prepare-context-availability [--strict]');
  const { failures } = await prepareContextAvailability({ strict: process.argv.includes('--strict') });
  console.log(failures.length ? failures.join('\n') : 'All prepared context packages are available.');
}
