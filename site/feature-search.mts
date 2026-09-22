import { record } from './browser-types.mts';
import { searchDestinations } from './destination-search.mts';

/** A row of the prepared cross-body feature index: enough to list, navigate and select. */
export interface IndexedFeature { readonly objectId: string; readonly id: string; readonly name: string; readonly type: string; readonly diameterKm: number; readonly searchNames: readonly string[]; readonly searchContext: string; }
export interface FeatureIndex { readonly objects: readonly { readonly id: string; readonly name: string; readonly route: string; readonly count: number; readonly lensIds?: readonly string[] }[]; readonly features: readonly IndexedFeature[]; }
export interface FeatureIndexPin { readonly url: string; readonly bytes: number; readonly sha256: string; readonly count: number; }

export const kilometres = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

export function parseFeaturePin(source: string | undefined): FeatureIndexPin | null {
  const value: unknown = JSON.parse(source ?? 'null');
  if (!record(value) || value.count === 0) return null;
  if (typeof value.url !== 'string' || !value.url.startsWith('/') || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(value.sha256) ||
      !Number.isSafeInteger(value.bytes) || Number(value.bytes) < 1 || !Number.isSafeInteger(value.count)) throw new TypeError('Feature index pin is invalid.');
  return { url: value.url, bytes: Number(value.bytes), sha256: value.sha256, count: Number(value.count) };
}
export function parseFeatureIndex(value: unknown, pin: FeatureIndexPin): FeatureIndex {
  if (!record(value) || value.schema !== 'cssearth-prepared-feature-index@1' || !Array.isArray(value.objects) || !Array.isArray(value.features) || value.features.length !== pin.count) throw new TypeError('Feature index is incompatible.');
  for (const feature of value.features as unknown[]) {
    if (!record(feature) || ['objectId', 'id', 'name', 'type', 'searchContext'].some(key => typeof feature[key] !== 'string') || typeof feature.diameterKm !== 'number' ||
        !Array.isArray(feature.searchNames) || !feature.searchNames.every(name => typeof name === 'string')) throw new TypeError('Feature index row is invalid.');
  }
  for (const object of value.objects as unknown[]) {
    if (!record(object) || ['id', 'name', 'route'].some(key => typeof object[key] !== 'string')) throw new TypeError('Feature index object is invalid.');
    if (object.lensIds !== undefined && (!Array.isArray(object.lensIds) || !object.lensIds.length || !object.lensIds.every(id => typeof id === 'string' && id.length > 0))) throw new TypeError('Feature index datasets are invalid.');
  }
  return value as unknown as FeatureIndex;
}

// Built once per loaded index: rebuilding it lowercased every body name for every feature on each keystroke.
const candidatesByIndex = new WeakMap<FeatureIndex, readonly { feature: IndexedFeature; names: readonly string[]; searchContext: string }[]>();
function featureCandidates(index: FeatureIndex) {
  let candidates = candidatesByIndex.get(index);
  if (!candidates) {
    const names = new Map(index.objects.map(object => [object.id, object.name.toLocaleLowerCase('en')]));
    candidates = index.features.map(feature => ({ feature, names: feature.searchNames, searchContext: `${feature.searchContext} ${names.get(feature.objectId) ?? ''}` }));
    candidatesByIndex.set(index, candidates);
  }
  return candidates;
}
export function matchFeatures(index: FeatureIndex, query: string, objectId: string, limit = 8) {
  const ranked = searchDestinations(featureCandidates(index), query, limit).map(match => match.feature);
  return [...ranked.filter(feature => feature.objectId === objectId), ...ranked.filter(feature => feature.objectId !== objectId)];
}
export function featureResult(feature: IndexedFeature, index: FeatureIndex, objectId: string) {
  const object = index.objects.find(object => object.id === feature.objectId);
  if (!object || !/^\/[a-z][a-z0-9-]*\/$/u.test(object.route)) throw new TypeError('Feature object route is invalid.');
  const body = feature.objectId === objectId ? '' : ` · ${object.name}`;
  const size = feature.diameterKm > 0 ? `${kilometres.format(feature.diameterKm)} km`
    : ['LS', 'IM', 'SS', 'RT'].includes(feature.searchContext) || /site|traverse|position/u.test(feature.type.toLowerCase()) ? '' : 'size unpublished';
  const context = `${feature.type}${size ? ` · ${size}` : ''}${body}`;
  return { name: feature.name, context, label: `${feature.name}, ${feature.type}${size ? `, ${feature.diameterKm > 0 ? `${kilometres.format(feature.diameterKm)} kilometres` : size}` : ''}${body}`,
    href: `${object.route}?feature=${encodeURIComponent(feature.id)}` };
}
