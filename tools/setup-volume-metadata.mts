import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sourceObject, sourceText } from '../src/platform/source-catalog.mts';
import { preparedAssets, runtimeAssets } from './runtime-assets.mts';
import { installRuntimeAssets } from './setup.mts';
import { hasErrorCode } from './source-values.mts';

export const VOLUME_METADATA_FILENAMES = ['presentation.json', 'provenance.json'] as const;

/** Select only the small R2-backed package metadata needed to compile deploy catalogues. Volume and context
 * payloads stay remote; restoring the full runtime-assets closure here can be tens of gigabytes. */
export async function preparedVolumeMetadataAssets(root = resolve(import.meta.dirname, '..')) {
  const ids: string[] = [];
  const folders = await readdir(resolve(root, 'src/objects'), { withFileTypes: true });
  for (const folder of folders.filter(folder => folder.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = resolve(root, 'src/objects', folder.name, 'source/presentation.json');
    const bytes = await readFile(path).catch((error: unknown) => {
      if (hasErrorCode(error, 'ENOENT')) return undefined;
      throw error;
    });
    if (!bytes) continue;
    const presentation = sourceObject(JSON.parse(bytes.toString('utf8')));
    const volume = presentation.schema === 'cssearth-volume-presentation-source@1';
    const context = presentation.provenance !== undefined && existsSync(resolve(root, 'src/objects', folder.name, 'runtime-assets.json'));
    if (!volume && !context) continue;
    if (volume && sourceText(presentation.objectId) !== folder.name) throw new TypeError(`Mismatched volume presentation object: ${folder.name}.`);
    ids.push(folder.name);
  }

  const preparedIds = ids.filter(id => existsSync(resolve(root, 'src/objects', id, 'prepared-assets.json')));
  const assets = [
    ...await runtimeAssets(root, ids, { filenames: VOLUME_METADATA_FILENAMES }),
    ...await preparedAssets(root, preparedIds, { filenames: VOLUME_METADATA_FILENAMES }),
  ];
  for (const id of ids) for (const filename of VOLUME_METADATA_FILENAMES) {
    const matches = assets.filter(asset => asset.id === id && asset.filename === filename);
    if (matches.length !== 1 || matches[0]!.location === 'public' ||
        matches[0]!.file !== resolve(root, 'src/objects', id, 'prepared', filename)) {
      throw new TypeError(`Catalogue package ${id} must inventory exactly one prepared/${filename} runtime asset.`);
    }
  }
  return { ids, assets };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(import.meta.dirname, '..');
  const { ids, assets } = await preparedVolumeMetadataAssets(root);
  console.log(`Setting up catalogue metadata for ${ids.join(', ')}: ${assets.length} file(s); bulk data stays on R2.`);
  const result = await installRuntimeAssets(assets, { onProgress: ({ completed, total }) => {
    if (completed % 10 === 0 || completed === total) console.log(`Volume metadata: ${completed}/${total}`);
  } });
  console.log(`Volume metadata setup complete: ${result.installed} downloaded, ${result.reused} reused.`);
}
