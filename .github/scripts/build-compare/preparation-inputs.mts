/** Selected public inputs for preparation and prerender, never the full scenes bank. */
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {readPreparedFeaturePins,parseArrivalBillboard} from '@cssearth/objects';
import {readCatalog,readObjectDescriptors} from '@cssearth/objects/node';
import {prepareSceneDistance} from '@cssearth/bake/navigation';
import {array,record,string} from './records.mts';
export function publicPreparationUrls(features: unknown, places: unknown, controls: unknown, sidebar: unknown, id: string, arrival?: unknown): string[] {
  const urls = new Set<string>();
  const add = (value: unknown): void => {
    const url = string(value);
    if (!/^\/(?:scenes|navigation)\/[a-z0-9_@./-]+$/u.test(url) || url.includes('/../')) throw new Error(`Unsafe preparation input: ${url}`);
    if (url.startsWith('/scenes/')) urls.add(url);
  };
  if (features !== undefined) {
    for (const pin of readPreparedFeaturePins(features, id).pins) add(pin.url);
    // prepareFeatureIndex reads places only when this body has features.
    if (places !== undefined) add(record(places).url);
  }
  if (controls !== undefined) {
    const datasets = array(record(record(controls).datasets).controls).map(record);
    const images = record(record(sidebar).images);
    if (datasets.length >= 2) for (const dataset of datasets) {
      const override = images[`${id}/${string(dataset.id)}`];
      add(override === undefined ? dataset.thumbnailUrl : record(override).url2x);
    }
  }
  // ObjectLayout embeds this exact default-view image when its public copy is installed.
  if (arrival !== undefined) add(parseArrivalBillboard(arrival).url);
  return [...urls].sort();
}
export async function preparationUrls(root: string): Promise<string[]> {
  const read = async (path: string): Promise<unknown> => readFile(path, 'utf8').then(JSON.parse, (error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  });
  const sidebar = await read(join(root, 'public/navigation/sidebar-thumbnails.json'));
  if (sidebar === undefined) throw new Error('Missing tracked sidebar thumbnail manifest');
  const urls = new Set<string>();
  // Match the feature-index scene registry; sprite generation additionally scans every object folder.
  const directory = join(root, 'src/objects'), descriptors = await readObjectDescriptors(directory);
  const objects = await readCatalog(directory, prepareSceneDistance, descriptors);
  const sceneIds = new Set(objects.filter(object => record(descriptors.get(object.id)).type !== 'system').map(object => object.id));
  const {readdir} = await import('node:fs/promises');
  for (const entry of await readdir(join(root, 'src/objects'), {withFileTypes:true})) {
    if (!entry.isDirectory()) continue;
    const id = entry.name, prepared = join(root, 'src/objects', id, 'prepared');
    const [features, places, controls, arrival] = await Promise.all([sceneIds.has(id) ? read(join(prepared, 'features.json')) : undefined, sceneIds.has(id) ? read(join(prepared, 'places.json')) : undefined, read(join(prepared, 'controls.json')), sceneIds.has(id) ? read(join(prepared, 'arrival-billboard.json')) : undefined]);
    for (const url of publicPreparationUrls(features, places, controls, sidebar, id, arrival)) urls.add(url);
  }
  return [...urls].sort();
}
