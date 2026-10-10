import { parseProductInputEvidence } from '../../provenance/product-input-evidence.js';
import { sourceArray, sourceId, sourceObject, sourcePath, sourceText, sourceUnique, sourceUrl } from '../../sources/catalog.js';
import type { ProductInputEvidence } from '../../provenance/product-input-evidence.js';

export const VOLUME_PRESENTATION_SOURCE_SCHEMA = 'cssearth-volume-presentation-source@2';

type Crop = { left: number; top: number; width: number; height: number };
/** A preview whose file is in this repository (authored here, or a download kept beside its source) is identified by that
 * file; a preview fetched into the ignored cache is named by its path there. */
export interface TrackedVolumeSourcePreview { path: string; url?: string; authoredFrom?: string; crop?: Crop; }
interface CachedVolumeSourcePreview { path: string; url?: string; skyBands?: { path: string }; crop?: Crop; }
export type VolumeSourcePreview = TrackedVolumeSourcePreview | CachedVolumeSourcePreview;
export interface VolumeDatasetSource {
  id: string; label: string; title: string; description: string; summary: string; detail: string;
  facts: { id: string; label: string; value: string }[]; input: string; preview: VolumeSourcePreview;
  /** Further inputs this one dataset was built from, each with its role, beyond its own image and the shared inputs. */
  inputEvidence: ProductInputEvidence[];
}
export interface VolumePresentationSource {
  objectId: string; name: string; defaultDataset: string; bank: { path: string };
  sharedInputs: string[]; inputEvidence: ProductInputEvidence[]; datasets: VolumeDatasetSource[];
}

const integer = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new TypeError('Expected a positive integer.');
  return value;
};

/** Ignored scratch: the shared `.local/` at the repository root, or one object's own `src/objects/<id>/.local/`. A source
 * record may name a file there (a download, a composite), which is never tracked and is fetched again when missing. */
export const isScratchSourcePath = (path: string): boolean => /^(?:\.local\/|src\/objects\/[a-z0-9][a-z0-9-]*\/\.local\/)/u.test(path);
/** The path a scratch file is mirrored by under `source-cache/local/`: the shared cache's own path, or `objects/<id>/…` for
 * an object's scratch. */
export function scratchSourceCachePath(path: string): string {
  const object = /^src\/objects\/([a-z0-9][a-z0-9-]*)\/\.local\/(.+)$/u.exec(path);
  if (object) return `objects/${object[1]}/${object[2]}`;
  if (path.startsWith('.local/')) return path.slice('.local/'.length);
  throw new TypeError(`Not a scratch path: ${path}`);
}

export const isTrackedVolumeSourcePreview = (preview: VolumeSourcePreview): preview is TrackedVolumeSourcePreview => !isScratchSourcePath(preview.path);

export function parseVolumeSourcePreview(raw: unknown): VolumeSourcePreview {
  const value = sourceObject(raw, ['path', 'url', 'skyBands', 'authoredFrom', 'crop']);
  const path = sourcePath(value.path);
  const result: VolumeSourcePreview = isScratchSourcePath(path) ? { path }
    : { path, ...(value.authoredFrom === undefined ? {} : { authoredFrom: sourceId(value.authoredFrom) }) };
  const kinds = [value.url, value.skyBands, value.authoredFrom].filter(candidate => candidate !== undefined);
  if (kinds.length !== 1) throw new TypeError('A preview names exactly one of a URL, a sky band recipe or the input it is drawn from.');
  if (value.authoredFrom !== undefined) { /* named above */ }
  else if (value.url !== undefined) result.url = sourceUrl(value.url);
  else if (isTrackedVolumeSourcePreview(result)) throw new TypeError('A tracked preview names its URL or the input it is drawn from.');
  else {
    result.skyBands = { path: sourcePath(sourceObject(value.skyBands, ['path']).path) };
  }
  if (value.crop !== undefined) {
    const crop = sourceObject(value.crop, ['left', 'top', 'width', 'height']);
    const offset = (raw: unknown) => { if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < 0) throw new TypeError('Invalid crop offset.'); return raw; };
    result.crop = { left: offset(crop.left), top: offset(crop.top), width: integer(crop.width), height: integer(crop.height) };
  }
  return result;
}

export function parseVolumePresentationSource(raw: unknown): VolumePresentationSource {
  const value = sourceObject(raw, ['schema', 'objectId', 'name', 'defaultDataset', 'bank', 'recipes', 'sharedInputs', 'inputEvidence', 'datasets']);
  if (value.schema !== VOLUME_PRESENTATION_SOURCE_SCHEMA) throw new TypeError('Invalid volume presentation source.');
  const datasets = sourceArray(value.datasets, raw => {
    const dataset = sourceObject(raw, ['id', 'label', 'title', 'description', 'summary', 'detail', 'facts', 'input', 'preview', 'inputEvidence']);
    const result = { id: sourceId(dataset.id), label: sourceText(dataset.label), title: sourceText(dataset.title), description: sourceText(dataset.description),
      summary: sourceText(dataset.summary), detail: sourceText(dataset.detail), input: sourceId(dataset.input), preview: parseVolumeSourcePreview(dataset.preview),
      inputEvidence: [...sourceArray(dataset.inputEvidence ?? [], parseProductInputEvidence)],
      facts: [...sourceArray(dataset.facts, raw => { const fact = sourceObject(raw, ['id', 'label', 'value']); return { id: sourceId(fact.id), label: sourceText(fact.label), value: sourceText(fact.value) }; })] };
    return result;
  });
  sourceUnique(datasets.map(dataset => dataset.id), 'volume dataset');
  const defaultDataset = sourceId(value.defaultDataset);
  if (!datasets.length || !datasets.some(dataset => dataset.id === defaultDataset)) throw new TypeError('Invalid volume default dataset.');
  return { objectId: sourceId(value.objectId), name: sourceText(value.name), defaultDataset, bank: { path: sourcePath(sourceObject(value.bank, ['path']).path) }, datasets: [...datasets],
    sharedInputs: [...sourceArray(value.sharedInputs, sourceId)], inputEvidence: [...sourceArray(value.inputEvidence ?? [], parseProductInputEvidence)] };
}

/** A source directory also contains unrelated unversioned presentation records. */
export function hasVolumePresentationSource(value: unknown): boolean {
  return sourceObject(value).schema === VOLUME_PRESENTATION_SOURCE_SCHEMA;
}
