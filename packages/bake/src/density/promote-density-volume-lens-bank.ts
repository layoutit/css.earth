/**
 * Package an already-prepared physical density volume as one selectable lens.
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
import { sha256 } from '@cssearth/core/node';
import { loadPreparedCssVolume } from '@cssearth/renderer/volume/loader.ts';
import { validatePreparedVolumeLenses } from '@cssearth/renderer/volume/prepared-volume-lenses.ts';
import type { PreparedCssVolume } from '@cssearth/renderer/volume/types.ts';

export interface DensityVolumeLensBankLens {
  /** Directory containing the authored density-volume object.json. */
  readonly sourceDirectory: string;
  readonly lensId: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly sourceUrl: string;
}

interface DensityVolumeLensBankBase {
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
export interface DensityVolumeLensBankSinglePromotion extends DensityVolumeLensBankBase, DensityVolumeLensBankLens {}

/** Promote several authenticated physical grids into one existing selectable bank. */
export interface DensityVolumeLensBankMultiPromotion extends DensityVolumeLensBankBase {
  readonly sources: readonly DensityVolumeLensBankLens[];
  readonly defaultLens: string;
}

export type DensityVolumeLensBankPromotion = DensityVolumeLensBankSinglePromotion | DensityVolumeLensBankMultiPromotion;

export interface DensityVolumeLensBankPromotionResult {
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

function isMulti(request: DensityVolumeLensBankPromotion): request is DensityVolumeLensBankMultiPromotion {
  return 'sources' in request;
}

function validateLens(source: DensityVolumeLensBankLens) {
  requireId(source.lensId, 'Lens id'); requireText(source.label, 'Lens label'); requireText(source.title, 'Lens title');
  requireText(source.description, 'Lens description');
  if (!/^https:\/\//u.test(source.sourceUrl)) throw new TypeError('Lens source URL must use HTTPS.');
}

function normalizedSources(request: DensityVolumeLensBankPromotion): readonly DensityVolumeLensBankLens[] {
  return isMulti(request) ? request.sources : [request];
}

function validateRequest(request: DensityVolumeLensBankPromotion): readonly DensityVolumeLensBankLens[] {
  requireId(request.id, 'Bank id');
  if (!Number.isFinite(request.framingRadiusUnits) || request.framingRadiusUnits <= 0) {
    throw new TypeError('Lens framing radius must be a positive finite authored value.');
  }
  if (request.attachedTo !== undefined) requireId(request.attachedTo, 'Attached body id');
  const sources = normalizedSources(request);
  if (!sources.length) throw new TypeError('A density-volume bank needs at least one source lens.');
  const ids = new Set<string>();
  for (const source of sources) {
    validateLens(source);
    if (ids.has(source.lensId)) throw new TypeError('A density-volume bank lens id must be unique.');
    ids.add(source.lensId);
  }
  const defaultLens = isMulti(request) ? request.defaultLens : request.lensId;
  if (!ids.has(defaultLens)) throw new TypeError('The default density-volume lens must be promoted by this bank.');
  return sources;
}

function rewrittenVolume(source: PreparedCssVolume, bankId: string, lensId: string, frame: PreparedCssVolume['frame']): PreparedCssVolume {
  const path = (value: string) => `${lensId}/${value}`;
  const faces = <T extends { readonly texturePath: string }>(items: readonly T[]) => items.map(item => ({ ...item, texturePath: path(item.texturePath) }));
  const volume = {
    ...source,
    id: `${bankId}-${lensId}`,
    frame,
    stacks: source.stacks.map(stack => ({ ...stack, leaves: stack.leaves.map(leaf => ({ ...leaf, texturePath: path(leaf.texturePath) })) })),
    resources: source.resources.map(resource => ({ ...resource, path: path(resource.path) })),
    ...(source.sky === undefined ? {} : { sky: { ...source.sky, faces: faces(source.sky.faces),
      ...(source.sky.nearFaces === undefined ? {} : { nearFaces: faces(source.sky.nearFaces) }) } }),
    ...(source.detailPlanes === undefined ? {} : { detailPlanes: source.detailPlanes.map(leaf => ({ ...leaf, texturePath: path(leaf.texturePath) })) }),
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
export async function promoteDensityVolumeLensBank(request: DensityVolumeLensBankPromotion): Promise<DensityVolumeLensBankPromotionResult> {
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
    const preparedPath = local(sourceDirectory, descriptor.prepared!.url), preparedBytes = await readFile(preparedPath);
    const preparedDirectory = dirname(preparedPath), resources = await Promise.all(source.resources.map(async resource => {
      const bytes = await readFile(local(preparedDirectory, resource.path));
      if (bytes.length !== resource.bytes || sha256(bytes) !== resource.sha256) {
        throw new TypeError(`Source density-volume resource pin mismatch: ${resource.path}`);
      }
      return { resource, bytes };
    }));
    return { requestSource, descriptorBytes, descriptor, source, resources, preparedBytes };
  }));
  const presentationFrame = request.presentationFrame ?? loaded[0]!.source.frame;
  for (const { source } of loaded) {
    if (presentationFrame.metersPerUnit !== source.frame.metersPerUnit ||
        JSON.stringify(presentationFrame.boundsUnits) !== JSON.stringify(source.frame.boundsUnits)) {
      throw new TypeError('Every promoted density-volume source must preserve source scale and bounds in the authored presentation frame.');
    }
  }
  const defaultLens = isMulti(request) ? request.defaultLens : request.lensId;
  const reanchored = request.presentationFrame !== undefined;
  const lenses = loaded.map(({ requestSource, source }) => ({ id: requestSource.lensId, label: requestSource.label,
    title: requestSource.title, description: requestSource.description, sourceUrl: requestSource.sourceUrl,
    volume: rewrittenVolume(source, request.id, requestSource.lensId, presentationFrame),
    stars: { frame: presentationFrame, points: [] }, brightness: { overall: 1, x: 1, y: 1, z: 1 } }));
  const sourceReceipts = loaded.map(({ requestSource, descriptorBytes, descriptor, source, resources, preparedBytes }) => ({ lensId: requestSource.lensId,
    id: descriptor.id, descriptor: { path: 'object.json', sha256: sha256(descriptorBytes) },
    prepared: { path: descriptor.prepared!.url, sha256: sha256(preparedBytes) }, frame: source.frame, provenance: source.provenance,
    resources: resources.map(({ resource }) => ({ path: resource.path, sha256: resource.sha256, bytes: resource.bytes })) }));
  const provenance = loaded.length === 1
    ? { sourceDensityVolume: loaded[0]!.source.provenance, measurementFrame: loaded[0]!.source.frame, presentationFrame,
      interpretation: reanchored
        ? 'The authenticated physical grid is attached to an explicitly authored scene frame. Its measurement frame and epoch remain recorded; no depth was inferred or reconstructed.'
        : 'Promoted prepared physical density volume. No depth was inferred or reconstructed.' }
    : { sources: sourceReceipts.map(({ lensId, provenance: sourceDensityVolume, frame: measurementFrame }) => ({ lensId, sourceDensityVolume, measurementFrame })),
      presentationFrame, interpretation: 'Each selectable lens retains its authenticated physical source, measurement frame and resources. All lenses share the explicitly authored presentation scale and bounds; no depth was inferred or reconstructed.' };
  const data = validatePreparedVolumeLenses({ schema: 'cssearth-volume-lenses@1', id: request.id, defaultLens,
    framingRadiusUnits: request.framingRadiusUnits, contextVisibility: 'independent', starsEnabled: false,
    ...(request.attachedTo === undefined ? {} : { attachedTo: request.attachedTo }),
    provenance, lenses });
  const envelope = json({ schema: 'cssearth-prepared-object@1', id: request.id, type: 'volume-lens-bank', format: 'cssearth-volume-lenses@1', data });
  const delivery = json({ schema: 'cssearth-density-volume-lens-bank-source@1',
    ...(request.attachedTo === undefined ? {} : { attachedTo: request.attachedTo }),
    ...(sourceReceipts.length === 1 ? { source: sourceReceipts[0] } : { sources: sourceReceipts }),
    promotion: { id: request.id, defaultLens, lensIds: lenses.map(lens => lens.id), framingRadiusUnits: request.framingRadiusUnits,
    ...(request.attachedTo === undefined ? {} : { attachedTo: request.attachedTo }),
    presentationFrame,
    interpretation: reanchored
      ? 'Copies the prepared physical volume unchanged in scale and bounds, then attaches it to an explicitly authored scene frame. The source measurement frame is retained above; no depth inference or reconstruction.'
      : 'Copies the prepared physical volume unchanged in frame and bounds; no depth inference or reconstruction.' } });
  const preparedOutput = local(destinationDirectory, 'prepared/lenses.json'), deliveryPath = local(destinationDirectory, 'source/delivery.json');
  // Verify every input before writing any package entry, then publish the descriptor last.
  await mkdir(dirname(deliveryPath), { recursive: true }); await writeFile(deliveryPath, delivery);
  for (const { requestSource, resources } of loaded) for (const { resource, bytes } of resources) {
    const output = local(destinationDirectory, `prepared/${requestSource.lensId}/${resource.path}`);
    await mkdir(dirname(output), { recursive: true }); await writeFile(output, bytes);
  }
  await writeFile(preparedOutput, envelope);
  const destinationDescriptor = json({ schema: 'cssearth-object@1', id: request.id, type: 'volume-lens-bank', properties: {
    frame: presentationFrame, preparation: { source: 'source/delivery.json' },
  }, prepared: { format: 'cssearth-volume-lenses@1', url: 'prepared/lenses.json' } });
  const destinationDescriptorPath = local(destinationDirectory, 'object.json');
  await writeFile(destinationDescriptorPath, destinationDescriptor);
  return Object.freeze({ descriptorPath: destinationDescriptorPath, preparedPath: preparedOutput, deliveryPath,
    resourceCount: loaded.reduce((count, source) => count + source.resources.length, 0) });
}
