import { isRecord } from '@cssearth/core';
import { parseDatasetLens } from './prepared-panel-content.mts';

/** Validate a package's `prepared/datasets.json`, resolving its pictures' package paths through `assetUrl`. */
export function parsePageDatasets(objectId: string, raw: unknown, assetUrl: (path: string) => unknown) {
  const fail = (message: string): never => { throw new TypeError(`${objectId} prepared/datasets.json: ${message}`); };
  if (!isRecord(raw) || raw.schema !== 'cssearth-map-sphere-datasets@1' || raw.objectId !== objectId || !Array.isArray(raw.controls) || !raw.controls.length) {
    return fail('expected cssearth-map-sphere-datasets@1 for this object with its lens controls.');
  }
  const resolve = (path: unknown) => {
    const url = typeof path === 'string' ? assetUrl(path) : undefined;
    return typeof url === 'string' ? url : fail(`${String(path)} is not a published file of the package.`);
  };
  const views: Record<string, string> = {};
  const controls = raw.controls.map((value: unknown) => {
    if (!isRecord(value) || (value.view !== 'cutaway' && value.view !== 'full') || !isRecord(value.texture)) return fail('each lens names its view (cutaway or full) and its picture.');
    const { view, ...control } = value, lens = parseDatasetLens({ ...control, thumbnailUrl: resolve(control.thumbnailUrl), texture: { ...value.texture, url: resolve(value.texture.url) } });
    if (Object.hasOwn(views, lens.id)) fail(`lens ${lens.id} is listed twice.`);
    views[lens.id] = view;
    return lens;
  });
  if (typeof raw.defaultLens !== 'string' || !Object.hasOwn(views, raw.defaultLens)) return fail('its default lens is one of its lenses.');
  return { defaultLens: raw.defaultLens, controls, views };
}
