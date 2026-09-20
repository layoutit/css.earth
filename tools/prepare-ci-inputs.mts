import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { preparedAssetObjectIds, preparedAssets, runtimeAssets } from './runtime-assets.mts';
import type { RuntimeAssetLocation } from './runtime-assets.mts';
import { installRuntimeAssets } from './setup.mts';
import { preparedVolumeMetadataAssets } from './setup-volume-metadata.mts';

const projectRoot = resolve(import.meta.dirname, '..');

export function requireCiInputMode(args: readonly string[]): 'universe-preparation' {
  if (args.length !== 1 || args[0] !== 'universe-preparation') {
    throw new TypeError('Usage: node tools/prepare-ci-inputs.mts universe-preparation (run pnpm build:tools first).');
  }
  return args[0];
}

/** Inputs consumed by the preparation job, after build:tools has generated the registry and world context.
 * Registry-wide navigation tests require every prepared runtime. Real volume/shell tests require their full
 * prepared banks. Only the Mimas finalization fixture reads body textures, through interior-fill sampling;
 * other bodies' public texture banks are not inputs to this job. This is a test-fixture selection, not a registry.
 * No transports are serialized here: preparation tests read runtime.json directly or finalize into temp dirs. */
export async function ciPreparationInputs(root = projectRoot): Promise<RuntimeAssetLocation[]> {
  const preparedIds = preparedAssetObjectIds([], root);
  const metadata = await preparedVolumeMetadataAssets(root);
  const assets = [
    ...await preparedAssets(root, preparedIds),
    ...await runtimeAssets(root, ['mimas']),
    ...metadata.assets,
  ];
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

/** The ordinary SHA/size verifier remains the only installer. CI never permits missing selected inputs. */
export async function restoreCiPreparationInputs({ root = projectRoot, fetcher = fetch,
  onProgress }: { root?: string; fetcher?: typeof fetch;
    onProgress?: NonNullable<Parameters<typeof installRuntimeAssets>[1]>['onProgress'] } = {}) {
  const assets = await ciPreparationInputs(root);
  const result = await installRuntimeAssets(assets, { fetcher, onProgress });
  return { files: assets.length, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0), ...result };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  requireCiInputMode(process.argv.slice(2));
  const result = await restoreCiPreparationInputs({ onProgress: ({ completed, total }) => {
    if (completed % 100 === 0 || completed === total) console.log(`Preparation inputs: ${completed}/${total}`);
  } });
  console.log(`Preparation inputs ready: ${JSON.stringify(result)}`);
}
