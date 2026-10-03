import { SOURCE_MANIFEST_SCHEMA } from '@cssearth/objects';
import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { hasErrorCode, requireArray, requireRecord, requireString } from '@cssearth/core';

import { checkLineage, lineageSource } from '@cssearth/objects/provenance';
import type { LineageSource, ObjectLineage } from '@cssearth/objects/provenance';
import { lineageProducts } from './lineage-recipes.ts';

const json = async (path: string) => requireRecord(JSON.parse(await readFile(path, 'utf8')));
const optionalJson = (path: string) => json(path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
const texts = (value: unknown) => requireArray(value).map(item => requireString(item));
const contained = (root: string, path: string) => {
  const result = resolve(root, path), offset = relative(root, result);
  if (offset === '..' || offset.startsWith('../') || offset.startsWith('..\\')) throw new TypeError(`Source path escapes its package: ${path}.`);
  return result;
};

/**
 * Which of a layered body's manifest sources each of its prepared products reads, from its source records alone: the
 * manifest, the recipes its descriptor names, its acquisition record and its prepared dataset controls. The catalogues build
 * it in memory; nothing writes it.
 */
export async function bodyLineage(objectDirectory: string): Promise<ObjectLineage> {
  const sourceDirectory = resolve(objectDirectory, 'source');
  const descriptor = await json(resolve(objectDirectory, 'object.json')), id = requireString(descriptor.id);
  const manifest = await json(resolve(sourceDirectory, 'manifest.json'));
  if (manifest.schema !== SOURCE_MANIFEST_SCHEMA) throw new TypeError(`Unsupported source manifest schema: ${id}.`);
  const inputs = requireArray(manifest.inputs).map(raw => ({ raw: requireRecord(raw), kind: 'source-input' }));
  const documents = [...requireArray(manifest.documents ?? []).map(raw => ({ raw: requireRecord(raw), kind: 'source-document' })),
    ...requireArray(manifest.generatedIntermediates ?? []).map(raw => ({ raw: requireRecord(raw), kind: 'generated-intermediate' }))];
  const byPath = new Map([...inputs, ...documents].map(entry => [requireString(entry.raw.path), entry]));
  const recipes = new Map<string, { path: string; parameters: Record<string, unknown> }>();
  for (const reference of requireArray(requireRecord(requireRecord(descriptor.properties).recipe).sources).map(item => requireRecord(item))) {
    // The descriptor names its recipes; the manifest declares them.
    const path = requireString(reference.path);
    if (!byPath.has(path.replace(/^source\//u, ''))) throw new Error(`Recipe is not in the source manifest: ${id}/${path}.`);
    recipes.set(requireString(reference.id), { path, parameters: await json(contained(objectDirectory, path)) });
  }
  const contentPath = recipes.get('content')?.path.replace(/^source\//u, '');
  const noiseRecipe = requireRecord(recipes.get('paged-ellipsoid')?.parameters.geographic ?? {}).noise;
  const noise = noiseRecipe == null ? undefined : await (async () => {
    const directory = requireString(requireRecord(noiseRecipe).directory), pin = await json(contained(sourceDirectory, `${directory}/manifest.json`));
    return { id: requireString(pin.id), directory, file: requireString(pin.file) };
  })();
  const datasets = await optionalJson(resolve(objectDirectory, 'prepared/datasets.json'));
  const acquisition = await optionalJson(resolve(sourceDirectory, 'preparation/acquisition.json'));
  const operations = requireArray(acquisition?.operations ?? []).map(item => requireRecord(item));
  const products = lineageProducts({ id, recipes, paths: new Set(byPath.keys()), controls: requireArray(datasets?.controls ?? []), noise,
    inputs: inputs.map(({ raw }) => ({ path: requireString(raw.path), consumers: texts(raw.consumers),
      ...(raw.datasetId === undefined ? {} : { datasetId: requireString(raw.datasetId) }) })) });
  const sources = new Map<string, LineageSource>(), idByPath = new Map<string, string>();
  const bind = async (path: string, visiting = new Set<string>()): Promise<string> => {
    const entry = byPath.get(path);
    if (!entry) throw new Error(`Product input is not in the source manifest: ${id}/${path}.`);
    if (visiting.has(path)) throw new Error(`Cyclic acquisition dependency: ${id}/${path}.`);
    const known = idByPath.get(path);
    if (known) return known;
    // A document keeps its recorded id; the content recipe is the authored object information.
    const kind = path === contentPath ? 'authored-content' : typeof entry.raw.kind === 'string' ? entry.raw.kind : entry.kind;
    const localId = typeof entry.raw.id === 'string' ? entry.raw.id : `${kind === 'authored-content' ? 'authored-document' : kind}:${path}`;
    // A file built from another declared file (a GeoTIFF crop, a mapped composition) depends on that file and its recipe.
    const operation = operations.find(candidate => candidate.path === path);
    const ancestors = new Set([...visiting, path]), dependencies: string[] = [];
    if (typeof operation?.fileSource === 'string') dependencies.push(await bind(operation.fileSource, ancestors));
    if (operation?.kind === 'geotiff-grid' || operation?.kind === 'geotiff-image') dependencies.push(await bind(requireString(operation.recipePath), ancestors));
    if (operation?.kind === 'mapped-composition') {
      const recipePath = requireString(operation.recipePath);
      const plan = await json(contained(sourceDirectory, recipePath));
      dependencies.push(await bind(recipePath, ancestors), await bind(requireString(plan.input), ancestors));
    }
    const authored = kind === 'authored-content' || kind === 'authored-document';
    sources.set(localId, lineageSource(entry.raw, { id: localId, dependencies,
      ...(entry.kind === 'source-input' ? {} : { credit: authored ? 'cssEarth contributors' : 'Credit not recorded in source manifest.' }) }));
    idByPath.set(path, localId);
    return localId;
  };
  const bound = [];
  for (const { inputPaths, inputRoles, ...product } of products) {
    const ids = [];
    for (const path of inputPaths) ids.push(await bind(path));
    const evidence = Object.entries(inputRoles ?? {}).map(([path, role]) => ({ sourceId: idByPath.get(path)!, ...role }));
    bound.push({ ...product, inputs: [...new Set(ids)], ...(evidence.length ? { inputEvidence: evidence } : {}) });
  }
  return checkLineage({ objectId: id, manifestPath: 'source/manifest.json', sources: [...sources.values()], products: bound });
}
