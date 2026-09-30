import { isRecord } from '@cssearth/core';
import { parseDatasetControl } from './prepared-panel-content.mts';

/** Validate a package's `prepared/datasets.json`, resolving its pictures' package paths through `assetUrl`. */
export function parsePageDatasets(objectId: string, raw: unknown, assetUrl: (path: string) => unknown) {
  const fail = (message: string): never => { throw new TypeError(`${objectId} prepared/datasets.json: ${message}`); };
  if (!isRecord(raw) || raw.schema !== 'cssearth-map-sphere-datasets@2' || raw.objectId !== objectId || !Array.isArray(raw.controls) || !raw.controls.length) {
    return fail('expected cssearth-map-sphere-datasets@2 for this object with its dataset controls.');
  }
  const resolve = (path: unknown) => {
    const url = typeof path === 'string' ? assetUrl(path) : undefined;
    return typeof url === 'string' ? url : fail(`${String(path)} is not a published file of the package.`);
  };
  const views: Record<string, string> = {};
  const controls = raw.controls.map((value: unknown) => {
    if (!isRecord(value) || (value.view !== 'cutaway' && value.view !== 'full' && value.view !== 'hidden') || !isRecord(value.texture)) return fail('each dataset names its view (cutaway, full or hidden) and its picture.');
    const { view, ...control } = value, dataset = parseDatasetControl({ ...control, thumbnailUrl: resolve(control.thumbnailUrl), texture: { ...value.texture, url: resolve(value.texture.url) } });
    if (Object.hasOwn(views, dataset.id)) fail(`dataset ${dataset.id} is listed twice.`);
    views[dataset.id] = view;
    return dataset;
  });
  if (typeof raw.defaultDataset !== 'string' || !Object.hasOwn(views, raw.defaultDataset)) return fail('its default dataset is one of its datasets.');
  return { defaultDataset: raw.defaultDataset, controls, views };
}
