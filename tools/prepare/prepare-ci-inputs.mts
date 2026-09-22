import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inventoryAssets, inventoriedObjectIds, volumeMetadataAssets } from '../assets/runtime-assets.mts';
import type { RuntimeAssetLocation } from '../assets/runtime-assets.mts';
import { installRuntimeAssets } from '../assets/setup.mts';

const projectRoot = resolve(import.meta.dirname, '../..');

export type CiInputMode = 'universe' | 'universe-preparation';

export function requireCiInputMode(args: readonly string[]): CiInputMode {
  if (args.length !== 1 || (args[0] !== 'universe' && args[0] !== 'universe-preparation')) {
    throw new TypeError('Usage: node tools/prepare/prepare-ci-inputs.mts <universe|universe-preparation> (run pnpm build:tools first).');
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
 * the real Milky Way and Heliosphere fixture banks. Minimap data reads the stellar-neighbourhood binary bank,
 * not its atlas image. Source checks also require the inventoried photometric phase-chart SVG family.
 * These are test fixtures, never a second application registry.
 *
 * This selection intentionally does NOT support prepare:provenance, restore-environment-images, or the full
 * authoring test:sources prerequisite: those replay source preparation and can verify other texture banks.
 * The caller must generate minimap data with --data-only and compile catalogues from restored provenance.
 */
export async function ciUniverseInputs(root = projectRoot): Promise<RuntimeAssetLocation[]> {
  const assets = await inventoryAssets(root, inventoriedObjectIds([], root));
  return uniqueCiInputs(assets.filter(asset => {
    if (asset.filename.endsWith('.json')) return true;
    if (asset.filename.endsWith('-photometric-phase-curve.svg')) return true;
    const preparedDirectory = resolve(root, 'src/objects', asset.id, 'prepared') + '/';
    if (!asset.file.startsWith(preparedDirectory)) return false;
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = requireCiInputMode(process.argv.slice(2));
  const restore = mode === 'universe' ? restoreCiUniverseInputs : restoreCiPreparationInputs;
  const result = await restore({ onProgress: ({ completed, total }) => {
    if (completed % 100 === 0 || completed === total) console.log(`${mode} inputs: ${completed}/${total}`);
  } });
  console.log(`${mode} inputs ready: ${JSON.stringify(result)}`);
}
