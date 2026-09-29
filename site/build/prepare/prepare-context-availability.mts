import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseObjectDescriptor } from '@cssearth/objects';
import { loadPreparedVolumeLenses } from '@cssearth/renderer/universe';
import { validateObjectProvenance } from '@cssearth/objects/provenance';
import type { ContextAvailability } from '@cssearth/objects/provenance';
import { parsePreparedVolumePresentation } from '../../volume-presentation.mts';
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
      const bank = await loadPreparedVolumeLenses(descriptor, { read: async path => new Uint8Array(await read(directory, path)).buffer });
      const provenance = validateObjectProvenance(JSON.parse((await read(directory, 'prepared/provenance.json')).toString()), id);
      const presentation = parsePreparedVolumePresentation(JSON.parse((await read(directory, 'prepared/presentation.json')).toString()), bank, provenance);
      for (const lens of bank.lenses) for (const resource of lens.volume.resources)
        await verify(resolve(directory, 'prepared'), resource.path);
      const outputs = provenance.products.flatMap(product => product.outputs);
      const bankUrl = `src/objects/${id}/${descriptor.prepared!.url}`;
      if (!outputs.some(output => output.url === bankUrl)) throw new TypeError(`${id}: prepared/provenance.json products[].outputs[].url never names the prepared bank ${bankUrl}.`);
      await verify(projectRoot, bankUrl);
      const published = publicAssets === 'manifest'
        ? requireInventory(id, JSON.parse((await read(directory, 'inventory.json')).toString()))
        : null;
      for (const lens of presentation.controls) for (const url of new Set([lens.thumbnailUrl, lens.texture?.url])) {
        if (!url?.startsWith(`/scenes/${id}/`)) throw new TypeError(`Invalid dataset preview URL: ${url}.`);
        if (!outputs.some(output => output.url === url)) throw new TypeError(`${id}: prepared/provenance.json products[].outputs[].url never names the dataset preview ${url}.`);
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
