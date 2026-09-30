/** Discover the baked image datasets of the newest finite model owned by one lab subject. */
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parsePreparedLmcStars, type DensityVolumeFrame } from '@cssearth/bake/volume';
import type { PreparedReconstruction } from '../../features/reconstruction/reconstruction-types.ts';

export const finiteDatasetDirectory = '.local/nebula-lab';
const reconstructions = `${finiteDatasetDirectory}/reconstructions`;
const bundleName = /^finite-datasets-([a-z0-9][a-z0-9-]*)\.json$/;
const token = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value);
const imageId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]+$/.test(value);

export interface FiniteDatasetBundle {
  modelResultId: string;
  /** Repository-relative bundle index path. */
  bundle: string;
  /** One validated saved result per image, in bundle order. */
  datasets: { imageId: string; result: PreparedReconstruction }[];
  /** Newer model indexes that were rejected, so the view can say it is not showing the newest fit. */
  skipped: { modelResultId: string; reason: string }[];
}

function readBundle(value: unknown, modelResultId: string): { imageId: string; resultId: string }[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid finite dataset bundle.');
  const schema = Reflect.get(value, 'schema'), model = Reflect.get(value, 'modelResultId'), datasets = Reflect.get(value, 'datasets');
  if (schema !== 'cssearth-finite-dataset-bundle@1' || model !== modelResultId || !Array.isArray(datasets) || !datasets.length)
    throw new TypeError('Finite dataset bundle identity differs from its index name.');
  const rows = datasets.map((dataset: unknown) => {
    const id = dataset && typeof dataset === 'object' ? Reflect.get(dataset, 'imageId') : undefined;
    const resultId = dataset && typeof dataset === 'object' ? Reflect.get(dataset, 'resultId') : undefined;
    if (!imageId(id) || !token(resultId)) throw new TypeError('Invalid finite dataset entry.');
    return { imageId: id, resultId };
  });
  if (new Set(rows.map(row => row.imageId)).size !== rows.length) throw new TypeError('Finite dataset bundle repeats an image.');
  return rows;
}

const numbers = (value: unknown, length: number) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);
function isFrame(value: unknown): value is DensityVolumeFrame {
  if (!value || typeof value !== 'object') return false;
  return typeof Reflect.get(value, 'referenceFrame') === 'string' && Number.isFinite(Reflect.get(value, 'epochJdTt')) &&
    numbers(Reflect.get(value, 'originM'), 3) && numbers(Reflect.get(value, 'localToReferenceXyzw'), 4) && Number.isFinite(Reflect.get(value, 'metersPerUnit'));
}
const relativeFile = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && !value.startsWith('/') &&
  !value.split(/[\\/]/).includes('..') && !/[\u0000-\u001f?#]/.test(value);
/**
 * Optional image-independent star layer of one model, written by its star preparation command beside the dataset index.
 * The named file must name this model and share its physical frame; every dataset then references the same prepared stars.
 */
export async function finiteModelStarsPath(root: string, subjectId: string, modelResultId: string): Promise<string | undefined> {
  const text = await readFile(resolve(root, finiteDatasetDirectory, `finite-stars-${modelResultId}.json`), 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null; throw error;
  });
  if (text === null) return undefined;
  const value: unknown = JSON.parse(text);
  const stars = value && typeof value === 'object' ? Reflect.get(value, 'stars') : undefined;
  const path = stars && typeof stars === 'object' ? Reflect.get(stars, 'path') : undefined;
  if (!value || typeof value !== 'object' || Reflect.get(value, 'schema') !== 'cssearth-finite-model-stars@1' ||
      Reflect.get(value, 'modelResultId') !== modelResultId || Reflect.get(value, 'subjectId') !== subjectId || !relativeFile(path) ||
      Object.keys(stars ?? {}).join() !== 'path')
    throw new TypeError(`Finite model star index finite-stars-${modelResultId}.json must name model ${modelResultId}, subject ${subjectId} and stars.path only.`);
  const bytes = await readFile(resolve(root, path));
  const provenance: unknown = JSON.parse(await readFile(resolve(root, reconstructions, modelResultId, 'source/provenance.json'), 'utf8'));
  const request = provenance && typeof provenance === 'object' ? Reflect.get(provenance, 'request') : undefined;
  const frame = request && typeof request === 'object' ? Reflect.get(request, 'frame') : undefined;
  if (!isFrame(frame)) throw new TypeError('Finite model has no physical frame for its stars.');
  const payload = parsePreparedLmcStars(JSON.parse(bytes.toString()), frame);
  const finite = payload.provenance && typeof payload.provenance === 'object' ? Reflect.get(payload.provenance, 'finiteModel') : undefined;
  if (!finite || typeof finite !== 'object' || Reflect.get(finite, 'modelResultId') !== modelResultId)
    throw new TypeError('Prepared stars were realized in a different finite model.');
  return path;
}

/**
 * Bundles are ordered by the completion time of their model result (each named model directory is
 * replaced whole when it is re-fitted), then by the bundle's own write time. A re-fitted model therefore wins
 * as soon as its dataset index exists, and re-baking an older model's datasets cannot displace it.
 * A bundle is used only if every dataset validates, belongs to the requested subject and names that model.
 */
export async function discoverFiniteDatasetBundle(root: string, subjectId: string,
  readResult: (root: string, resultId: string) => Promise<PreparedReconstruction>): Promise<FiniteDatasetBundle | null> {
  const names = await readdir(resolve(root, finiteDatasetDirectory)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [] as string[]; throw error;
  });
  const found: { modelResultId: string; name: string; model: number; written: number }[] = [];
  for (const name of names) {
    const modelResultId = bundleName.exec(name)?.[1];
    if (!modelResultId) continue;
    // An index or model may disappear between listing and stat while a bake publishes; that entry is simply absent.
    const [bundle, model] = await Promise.all([stat(resolve(root, finiteDatasetDirectory, name)).catch(() => null),
      stat(resolve(root, reconstructions, modelResultId, 'result.json')).catch(() => null)]);
    if (bundle && model) found.push({ modelResultId, name, model: model.mtimeMs, written: bundle.mtimeMs });
  }
  found.sort((a, b) => b.model - a.model || b.written - a.written || (a.modelResultId < b.modelResultId ? 1 : -1));
  const skipped: FiniteDatasetBundle['skipped'] = [];
  for (const entry of found) {
    try {
      const rows = readBundle(JSON.parse(await readFile(resolve(root, finiteDatasetDirectory, entry.name), 'utf8')), entry.modelResultId);
      const datasets = [];
      for (const row of rows) {
        const result = await readResult(root, row.resultId);
        if (result.imageId !== row.imageId || result.finiteMaterial?.modelResultId !== entry.modelResultId ||
            result.subject.sourceSubjectId !== subjectId || result.subject.materialGeometry !== entry.modelResultId)
          throw new TypeError('Finite dataset does not belong to this model and subject.');
        datasets.push({ imageId: row.imageId, result });
      }
      const stars = await finiteModelStarsPath(root, subjectId, entry.modelResultId);
      if (stars) for (const dataset of datasets) dataset.result = { ...dataset.result, subject: { ...dataset.result.subject, stars } };
      return { modelResultId: entry.modelResultId, bundle: `${finiteDatasetDirectory}/${entry.name}`, datasets, skipped };
    } catch (error) { // An incomplete or foreign bundle is not a selectable model; report it and try the next newest.
      skipped.push({ modelResultId: entry.modelResultId, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return null;
}
