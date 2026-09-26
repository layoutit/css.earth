import { resolve } from 'node:path';
import { inventoryAssets, inventoriedObjectIds, volumeMetadataAssets } from '../assets/runtime-assets.mts';
import type { RuntimeAssetLocation } from '../assets/runtime-assets.mts';
import { installRuntimeAssets } from '../assets/setup.mts';

const projectRoot = resolve(import.meta.dirname, '../..');

export type CiInputMode = 'universe' | 'universe-preparation';

export function requireCiInputMode(args: readonly string[]): CiInputMode {
  if (args.length !== 1 || (args[0] !== 'universe' && args[0] !== 'universe-preparation')) {
    throw new TypeError('Usage: node tools/prepare/cli/prepare-ci-inputs.mts <universe|universe-preparation> (run pnpm build:tools first).');
  }
  return args[0];
}

/** Inputs consumed by the preparation job, after build:tools has generated the registry and world context.
 * Registry-wide navigation tests require every prepared runtime. Real volume/shell tests require their full
 * prepared banks. Only the Mimas finalization fixture reads body textures, through interior-fill sampling;
 * other bodies' public texture banks are not inputs to this job. This is a test-fixture selection, not a registry.
 * No transports are serialized here: preparation tests read runtime.json directly or finalize into temp dirs. */
export async function ciPreparationInputs(root = projectRoot): Promise<RuntimeAssetLocation[]> {
  const metadata = await volumeMetadataAssets(root);
  const assets = [
    ...await inventoryAssets(root, inventoriedObjectIds([], root), { location: 'prepared' }),
    ...await inventoryAssets(root, ['mimas'], { location: 'public' }),
    ...metadata.assets,
  ];
  return uniqueCiInputs(assets);
}

function uniqueCiInputs(assets: readonly RuntimeAssetLocation[]): RuntimeAssetLocation[] {
  const selected = new Map<string, RuntimeAssetLocation>();
  for (const asset of assets) {
    const previous = selected.get(asset.file);
    if (previous && (previous.sha256 !== asset.sha256 || previous.bytes !== asset.bytes)) {
      throw new TypeError(`Conflicting CI input inventories for ${asset.id}/${asset.filename}.`);
    }
    selected.set(asset.file, asset);
  }
  return [...selected.values()];
}

/** Published-package inputs for runtime and catalogue-consumer checks, not scientific authoring replay.
 * Runtime ownership, activation and shell contracts inspect every registered body's runtime/scene JSON;
 * catalogue and feature consumers also inspect inventoried context/public JSON. Keep that open-ended JSON
 * closure. The renderer's volume/loader and shell/loader suites additionally inspect every prepared image in
 * the real Milky Way and Heliosphere fixture banks. Sky and point-field renderer tests read the canonical
 * stellar-neighbourhood binary bank, but not its atlas. Source checks also require the inventoried
 * photometric phase-chart SVG family.
 * These are test fixtures, never a second application registry.
 *
 * This selection intentionally does NOT support prepare:provenance, restore-environment-images, or the full
 * authoring test:sources prerequisite: those replay source preparation and can verify other texture banks.
 * The caller must compile catalogues from restored provenance.
 */
export async function ciUniverseInputs(root = projectRoot): Promise<RuntimeAssetLocation[]> {
  const assets = await inventoryAssets(root, inventoriedObjectIds([], root));
  return uniqueCiInputs(assets.filter(asset => {
    if (asset.filename.endsWith('.json')) return true;
    if (asset.filename.endsWith('-photometric-phase-curve.svg')) return true;
    const preparedDirectory = resolve(root, 'src/objects', asset.id, 'prepared') + '/';
    if (!asset.file.startsWith(preparedDirectory)) return false;
    // The shared context must arrive from one publish: the full context, its summary and the orbit banks they
    // describe. Restoring the JSON halves alone pairs a context with whatever banks a runner happens to hold, which
    // decode into orbits that belong to another run.
    if (asset.id === 'sun' && asset.filename.startsWith('world-orbits/')) return true;
    return asset.id === 'milky-way' || asset.id === 'heliosphere' ||
      asset.id === 'stellar-neighbourhood' && asset.filename.endsWith('.bin');
  }));
}

type CiRestoreOptions = {
  root?: string;
  fetcher?: typeof fetch;
  onProgress?: NonNullable<Parameters<typeof installRuntimeAssets>[1]>['onProgress'];
};

async function restoreSelectedCiInputs(assets: readonly RuntimeAssetLocation[], { fetcher = fetch, onProgress }: CiRestoreOptions) {
  const result = await installRuntimeAssets(assets, { fetcher, onProgress });
  return { files: assets.length, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0), ...result };
}

export async function restoreCiUniverseInputs({ root = projectRoot, ...options }: CiRestoreOptions = {}) {
  return restoreSelectedCiInputs(await ciUniverseInputs(root), options);
}

/** The ordinary SHA/size verifier remains the only installer. CI never permits missing selected inputs. */
export async function restoreCiPreparationInputs({ root = projectRoot, ...options }: CiRestoreOptions = {}) {
  return restoreSelectedCiInputs(await ciPreparationInputs(root), options);
}
