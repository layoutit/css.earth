/**
 * Package an already-prepared physical density volume as one selectable dataset.
 *
 * This is deliberately a delivery adapter, not another volume baker: it copies
 * the authenticated prepared closure, namespaces its resource paths, and keeps
 * the source bounds, provenance and display approximation byte-for-byte in
 * meaning. A caller may explicitly re-anchor the presentation frame while the
 * measurement frame remains recorded in provenance. It never constructs a
 * depth coordinate.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { parseDensityVolumeObjectDescriptor } from '@cssearth/objects';
import { loadPreparedCssVolume } from '@cssearth/renderer/volume/loader.ts';
import { validatePreparedVolumeDatasets } from '@cssearth/renderer/volume/prepared-volume-datasets.ts';
import type { PreparedCssVolume } from '@cssearth/renderer/volume/types.ts';

export interface DensityVolumeDatasetBankSource {
  /** Directory containing the authored density-volume object.json. */
  readonly sourceDirectory: string;
  readonly datasetId: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly sourceUrl: string;
}

interface DensityVolumeDatasetBankBase {
  /** New object package directory. It must not be a source directory. */
  readonly destinationDirectory: string;
  readonly id: string;
  /** Presentation framing is authored by the caller; it is not inferred from a measurement. */
  readonly framingRadiusUnits: number;
  readonly attachedTo?: string;
  /** Optional scene attachment. It may change pose/epoch, never scale or bounds. */
  readonly presentationFrame?: PreparedCssVolume['frame'];
}

/** The original one-source form remains supported. */
export interface DensityVolumeDatasetBankSinglePromotion extends DensityVolumeDatasetBankBase, DensityVolumeDatasetBankSource {}

/** Promote several authenticated physical grids into one existing selectable bank. */
export interface DensityVolumeDatasetBankMultiPromotion extends DensityVolumeDatasetBankBase {
  readonly sources: readonly DensityVolumeDatasetBankSource[];
  readonly defaultDataset: string;
}

export type DensityVolumeDatasetBankPromotion = DensityVolumeDatasetBankSinglePromotion | DensityVolumeDatasetBankMultiPromotion;

export interface DensityVolumeDatasetBankPromotionResult {
  readonly descriptorPath: string;
  readonly preparedPath: string;
  readonly deliveryPath: string;
  readonly resourceCount: number;
}

const ID = /^[a-z][a-z0-9-]*$/u;
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const readArrayBuffer = async (path: string): Promise<ArrayBuffer> => Uint8Array.from(await readFile(path)).buffer;

function local(root: string, path: string): string {
  const target = resolve(root, path), rel = relative(root, target);
  if (isAbsolute(path) || rel === '..' || rel.startsWith(`..${sep}`) || /[\\\u0000]/u.test(path)) {
    throw new TypeError('A density-volume promotion resource escapes its package.');
  }
  return target;
}

function requireId(value: string, name: string) {
  if (!ID.test(value)) throw new TypeError(`${name} must be a lowercase package identifier.`);
  return value;
}

function requireText(value: string, name: string) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be non-empty.`);
  return value;
}

function isMulti(request: DensityVolumeDatasetBankPromotion): request is DensityVolumeDatasetBankMultiPromotion {
  return 'sources' in request;
}

function validateDataset(source: DensityVolumeDatasetBankSource) {
  requireId(source.datasetId, 'Dataset id'); requireText(source.label, 'Dataset label'); requireText(source.title, 'Dataset title');
  requireText(source.description, 'Dataset description');
  if (!/^https:\/\//u.test(source.sourceUrl)) throw new TypeError('Dataset source URL must use HTTPS.');
}

function normalizedSources(request: DensityVolumeDatasetBankPromotion): readonly DensityVolumeDatasetBankSource[] {
  return isMulti(request) ? request.sources : [request];
}

function validateRequest(request: DensityVolumeDatasetBankPromotion): readonly DensityVolumeDatasetBankSource[] {
  requireId(request.id, 'Bank id');
  if (!Number.isFinite(request.framingRadiusUnits) || request.framingRadiusUnits <= 0) {
    throw new TypeError('Dataset framing radius must be a positive finite authored value.');
  }
  if (request.attachedTo !== undefined) requireId(request.attachedTo, 'Attached body id');
  const sources = normalizedSources(request);
  if (!sources.length) throw new TypeError('A density-volume bank needs at least one source dataset.');
  const ids = new Set<string>();
  for (const source of sources) {
    validateDataset(source);
    if (ids.has(source.datasetId)) throw new TypeError('A density-volume bank dataset id must be unique.');
    ids.add(source.datasetId);
  }
  const defaultDataset = isMulti(request) ? request.defaultDataset : request.datasetId;
  if (!ids.has(defaultDataset)) throw new TypeError('The default density-volume dataset must be promoted by this bank.');
  return sources;
}

function rewrittenVolume(source: PreparedCssVolume, bankId: string, datasetId: string, frame: PreparedCssVolume['frame']): PreparedCssVolume {
  const path = (value: string) => `${datasetId}/${value}`;
  const faces = <T extends { readonly texturePath: string }>(items: readonly T[]) => items.map(item => ({ ...item, texturePath: path(item.texturePath) }));
  const volume = {
    ...source,
    id: `${bankId}-${datasetId}`,
    frame,
    stacks: source.stacks.map(stack => ({ ...stack, leaves: stack.leaves.map(leaf => ({ ...leaf, texturePath: path(leaf.texturePath) })) })),
    resources: source.resources.map(resource => ({ ...resource, path: path(resource.path) })),
    ...(source.sky === undefined ? {} : { sky: { ...source.sky, faces: faces(source.sky.faces) } }),
    ...(source.impostors === undefined ? {} : { impostors: { ...source.impostors,
      views: source.impostors.views.map(view => ({ ...view, texturePath: path(view.texturePath) })) } }),
  };
  // This also proves every remapped texture reference still names an exact resource.
  return volume as PreparedCssVolume;
}

/**
 * Promote a prepared density-volume package into the existing selectable-bank
 * contract. The source loader authenticates the input envelope; this function
 * authenticates every copied resource before publishing the destination object.
 */
export async function promoteDensityVolumeDatasetBank(request: DensityVolumeDatasetBankPromotion): Promise<DensityVolumeDatasetBankPromotionResult> {
  const requestedSources = validateRequest(request), destinationDirectory = resolve(request.destinationDirectory);
  if (requestedSources.some(source => resolve(source.sourceDirectory) === destinationDirectory)) {
    throw new TypeError('A promoted bank needs a distinct destination package.');
  }
  const loaded = await Promise.all(requestedSources.map(async requestSource => {
    const sourceDirectory = resolve(requestSource.sourceDirectory), descriptorPath = local(sourceDirectory, 'object.json');
    const descriptorBytes = await readFile(descriptorPath), authoredDescriptor: unknown = JSON.parse(descriptorBytes.toString('utf8'));
    const descriptor = parseDensityVolumeObjectDescriptor(authoredDescriptor);
    // The existing loader owns parsing its raw descriptor boundary; passing the
    // derived DensityVolumeObjectDescriptor would add its convenience fields.
    const source = await loadPreparedCssVolume(authoredDescriptor, { read: path => readArrayBuffer(local(sourceDirectory, path)) });
    const preparedPath = local(sourceDirectory, descriptor.prepared!.url);
    const preparedDirectory = dirname(preparedPath), resources = await Promise.all(source.resources.map(async resource => {
      const path = local(preparedDirectory, resource.path);
      const bytes = await readFile(path).catch((error: unknown) => {
        throw new Error(`${descriptor.id}: prepared resource ${resource.path} is missing at ${path}; restore it with pnpm setup:assets.`, { cause: error });
      });
      return { resource, bytes };
    }));
    return { requestSource, descriptor, source, resources };
  }));
  const presentationFrame = request.presentationFrame ?? loaded[0]!.source.frame;
  for (const { source } of loaded) {
    if (presentationFrame.metersPerUnit !== source.frame.metersPerUnit ||
        JSON.stringify(presentationFrame.boundsUnits) !== JSON.stringify(source.frame.boundsUnits)) {
      throw new TypeError('Every promoted density-volume source must preserve source scale and bounds in the authored presentation frame.');
    }
  }
  const defaultDataset = isMulti(request) ? request.defaultDataset : request.datasetId;
  const reanchored = request.presentationFrame !== undefined;
  const datasets = loaded.map(({ requestSource, source }) => ({ id: requestSource.datasetId, label: requestSource.label,
    title: requestSource.title, description: requestSource.description, sourceUrl: requestSource.sourceUrl,
    volume: rewrittenVolume(source, request.id, requestSource.datasetId, presentationFrame),
    stars: { frame: presentationFrame, points: [] }, brightness: { overall: 1, x: 1, y: 1, z: 1 } }));
  const sourceReceipts = loaded.map(({ requestSource, descriptor, source, resources }) => ({ datasetId: requestSource.datasetId,
    id: descriptor.id, descriptor: { path: 'object.json' },
    prepared: { path: descriptor.prepared!.url }, frame: source.frame, provenance: source.provenance,
    resources: resources.map(({ resource }) => ({ path: resource.path, bytes: resource.bytes })) }));
  const provenance = loaded.length === 1
    ? { sourceDensityVolume: loaded[0]!.source.provenance, measurementFrame: loaded[0]!.source.frame, presentationFrame,
      interpretation: reanchored
        ? 'The authenticated physical grid is attached to an explicitly authored scene frame. Its measurement frame and epoch remain recorded; no depth was inferred or reconstructed.'
        : 'Promoted prepared physical density volume. No depth was inferred or reconstructed.' }
    : { sources: sourceReceipts.map(({ datasetId, provenance: sourceDensityVolume, frame: measurementFrame }) => ({ datasetId, sourceDensityVolume, measurementFrame })),
      presentationFrame, interpretation: 'Each selectable dataset retains its authenticated physical source, measurement frame and resources. All datasets share the explicitly authored presentation scale and bounds; no depth was inferred or reconstructed.' };
  const data = validatePreparedVolumeDatasets({ schema: 'cssearth-volume-datasets@1', id: request.id, defaultDataset,
    framingRadiusUnits: request.framingRadiusUnits, contextVisibility: 'independent', starsEnabled: false,
    ...(request.attachedTo === undefined ? {} : { attachedTo: request.attachedTo }),
    provenance, datasets });
  const envelope = json({ schema: 'cssearth-prepared-object@1', id: request.id, type: 'volume-dataset-bank', format: 'cssearth-volume-datasets@1', data });
  const delivery = json({ schema: 'cssearth-density-volume-dataset-bank-source@1',
    ...(request.attachedTo === undefined ? {} : { attachedTo: request.attachedTo }),
    ...(sourceReceipts.length === 1 ? { source: sourceReceipts[0] } : { sources: sourceReceipts }),
    promotion: { id: request.id, defaultDataset, datasetIds: datasets.map(dataset => dataset.id), framingRadiusUnits: request.framingRadiusUnits,
    ...(request.attachedTo === undefined ? {} : { attachedTo: request.attachedTo }),
    presentationFrame,
    interpretation: reanchored
      ? 'Copies the prepared physical volume unchanged in scale and bounds, then attaches it to an explicitly authored scene frame. The source measurement frame is retained above; no depth inference or reconstruction.'
      : 'Copies the prepared physical volume unchanged in frame and bounds; no depth inference or reconstruction.' } });
  const preparedOutput = local(destinationDirectory, 'prepared/datasets.json'), deliveryPath = local(destinationDirectory, 'source/delivery.json');
  // Verify every input before writing any package entry, then publish the descriptor last.
  await mkdir(dirname(deliveryPath), { recursive: true }); await writeFile(deliveryPath, delivery);
  for (const { requestSource, resources } of loaded) for (const { resource, bytes } of resources) {
    const output = local(destinationDirectory, `prepared/${requestSource.datasetId}/${resource.path}`);
    await mkdir(dirname(output), { recursive: true }); await writeFile(output, bytes);
  }
  await writeFile(preparedOutput, envelope);
  const destinationDescriptor = json({ schema: 'cssearth-object@2', id: request.id, type: 'volume-dataset-bank', properties: {
    frame: presentationFrame, preparation: { source: 'source/delivery.json' },
  }, prepared: { format: 'cssearth-volume-datasets@1', url: 'prepared/datasets.json' } });
  const destinationDescriptorPath = local(destinationDirectory, 'object.json');
  await writeFile(destinationDescriptorPath, destinationDescriptor);
  return Object.freeze({ descriptorPath: destinationDescriptorPath, preparedPath: preparedOutput, deliveryPath,
    resourceCount: loaded.reduce((count, source) => count + source.resources.length, 0) });
}
