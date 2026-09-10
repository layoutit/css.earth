import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { parsePreparedClusterCatalog } from '@cssearth/catalog';
import { parseMcxcRows, prepareClusterCatalog } from '../../src/preparation/cluster-catalog/prepare.js';
import type { ClusterRecipe } from '../../src/preparation/cluster-catalog/prepare.js';
import { verifiedBytes, sha256 } from '../../src/preparation/volume/source.js';

export async function prepareClusterCatalogObject(directory: string) {
  const objectDirectory = resolve(directory), sourceDirectory = resolve(objectDirectory, 'source');
  const recipe = JSON.parse(await readFile(resolve(sourceDirectory, 'catalogue.json'), 'utf8')) as ClusterRecipe;
  const inputs = new Map<string, Buffer>();
  for (const source of recipe.sources) {
    const bytes = await verifiedBytes(sourceDirectory, source);
    if (bytes.length !== source.bytes) throw new TypeError(`Cluster source size mismatch: ${source.path}`);
    inputs.set(source.id, bytes);
  }
  const source = inputs.get(recipe.catalogueSourceId);
  if (!source) throw new TypeError('Missing pinned cluster release.');
  const data = parsePreparedClusterCatalog(prepareClusterCatalog(parseMcxcRows(gunzipSync(source).toString('ascii')), recipe));
  const bytes = Buffer.from(JSON.stringify(data) + '\n'), output = resolve(objectDirectory, 'prepared');
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'catalogue.json'), bytes);
  const receipt = { schema: data.schema, path: 'catalogue.json', sha256: sha256(bytes), bytes: bytes.length, objects: data.objects.length };
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(`PREPARED CLUSTER CATALOGUE: ${JSON.stringify(receipt)}`);
  return data;
}
if (process.argv[1] && /(?:^|[/\\])prepare-cluster-catalog\.(?:ts|js|mjs)$/.test(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2] || process.argv[3]) throw new TypeError('Usage: prepare-cluster-catalog <object-directory>');
  await prepareClusterCatalogObject(process.argv[2]);
}
