/**
 * Package an already-prepared physical density volume as one selectable lens.
 *
 * This is deliberately a delivery adapter, not another volume baker: it copies
 * the authenticated prepared closure, namespaces its resource paths, and keeps
 * the source frame, bounds, provenance and display approximation byte-for-byte
 * in meaning. In particular it never constructs a depth coordinate.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { parseDensityVolumeObjectDescriptor } from '@cssearth/objects';
import { sha256 } from '../../platform/sha256.mts';
import { loadPreparedCssVolume } from '../../renderers/css/volume/loader.js';
import { validatePreparedVolumeLenses } from '../../renderers/css/volume/prepared-volume-lenses.js';
import type { PreparedCssVolume } from '../../renderers/css/volume/types.js';

export interface DensityVolumeLensBankPromotion {
  /** Directory containing the authored density-volume object.json. */
  readonly sourceDirectory: string;
  /** New object package directory. It must not be the source directory. */
  readonly destinationDirectory: string;
  readonly id: string;
  readonly lensId: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly sourceUrl: string;
  /** Presentation framing is authored by the caller; it is not inferred from a measurement. */
  readonly framingRadiusUnits: number;
  readonly attachedTo?: string;
}

export interface DensityVolumeLensBankPromotionResult {
  readonly descriptorPath: string;
  readonly preparedPath: string;
  readonly deliveryPath: string;
  readonly resourceCount: number;
}

const ID = /^[a-z][a-z0-9-]*$/u;
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

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

function validateRequest(request: DensityVolumeLensBankPromotion) {
  requireId(request.id, 'Bank id'); requireId(request.lensId, 'Lens id');
  requireText(request.label, 'Lens label'); requireText(request.title, 'Lens title');
  requireText(request.description, 'Lens description');
  if (!/^https:\/\//u.test(request.sourceUrl)) throw new TypeError('Lens source URL must use HTTPS.');
  if (!Number.isFinite(request.framingRadiusUnits) || request.framingRadiusUnits <= 0) {
    throw new TypeError('Lens framing radius must be a positive finite authored value.');
  }
  if (request.attachedTo !== undefined) requireId(request.attachedTo, 'Attached body id');
}

function rewrittenVolume(source: PreparedCssVolume, bankId: string, lensId: string): PreparedCssVolume {
  const path = (value: string) => `${lensId}/${value}`;
  const faces = <T extends { readonly texturePath: string }>(items: readonly T[]) => items.map(item => ({ ...item, texturePath: path(item.texturePath) }));
  const volume = {
    ...source,
    id: `${bankId}-${lensId}`,
    stacks: source.stacks.map(stack => ({ ...stack, leaves: stack.leaves.map(leaf => ({ ...leaf, texturePath: path(leaf.texturePath) })) })),
    resources: source.resources.map(resource => ({ ...resource, path: path(resource.path) })),
    ...(source.sky === undefined ? {} : { sky: { ...source.sky, faces: faces(source.sky.faces),
      ...(source.sky.nearFaces === undefined ? {} : { nearFaces: faces(source.sky.nearFaces) }) } }),
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
  validateRequest(request);
  const sourceDirectory = resolve(request.sourceDirectory), destinationDirectory = resolve(request.destinationDirectory);
  if (sourceDirectory === destinationDirectory) throw new TypeError('A promoted bank needs a distinct destination package.');
  const descriptorPath = local(sourceDirectory, 'object.json');
  const descriptorBytes = await readFile(descriptorPath), authoredDescriptor: unknown = JSON.parse(descriptorBytes.toString('utf8'));
  const descriptor = parseDensityVolumeObjectDescriptor(authoredDescriptor);
  // The existing loader owns parsing its raw descriptor boundary; passing the
  // derived DensityVolumeObjectDescriptor would add its convenience fields.
  const source = await loadPreparedCssVolume(authoredDescriptor, { read: path => readFile(local(sourceDirectory, path)) });
  const preparedPath = local(sourceDirectory, descriptor.prepared!.url), preparedBytes = await readFile(preparedPath);
  if (sha256(preparedBytes) !== descriptor.prepared!.sha256) throw new TypeError('Source density-volume prepared artifact changed during promotion.');
  const preparedDirectory = dirname(preparedPath), resources = await Promise.all(source.resources.map(async resource => {
    const bytes = await readFile(local(preparedDirectory, resource.path));
    if (bytes.length !== resource.bytes || sha256(bytes) !== resource.sha256) {
      throw new TypeError(`Source density-volume resource pin mismatch: ${resource.path}`);
    }
    return { resource, bytes };
  }));
  const volume = rewrittenVolume(source, request.id, request.lensId);
  const data = validatePreparedVolumeLenses({ schema: 'cssearth-volume-lenses@1', id: request.id, defaultLens: request.lensId,
    framingRadiusUnits: request.framingRadiusUnits, contextVisibility: 'independent', starsEnabled: false,
    ...(request.attachedTo === undefined ? {} : { attachedTo: request.attachedTo }),
    provenance: { sourceDensityVolume: source.provenance, interpretation: 'Promoted prepared physical density volume. No depth was inferred or reconstructed.' },
    lenses: [{ id: request.lensId, label: request.label, title: request.title, description: request.description, sourceUrl: request.sourceUrl,
      volume, stars: { frame: source.frame, points: [] }, brightness: { overall: 1, x: 1, y: 1, z: 1 } }] });
  const envelope = json({ schema: 'cssearth-prepared-object@1', id: request.id, type: 'volume-lens-bank', format: 'cssearth-volume-lenses@1', data });
  const delivery = json({ schema: 'cssearth-density-volume-lens-bank-source@1', source: {
    id: descriptor.id, descriptor: { path: 'object.json', sha256: sha256(descriptorBytes) },
    prepared: { path: descriptor.prepared!.url, sha256: descriptor.prepared!.sha256 }, frame: source.frame, provenance: source.provenance,
    resources: resources.map(({ resource }) => ({ path: resource.path, sha256: resource.sha256, bytes: resource.bytes })),
  }, promotion: { id: request.id, lensId: request.lensId, framingRadiusUnits: request.framingRadiusUnits,
    ...(request.attachedTo === undefined ? {} : { attachedTo: request.attachedTo }),
    interpretation: 'Copies the prepared physical volume unchanged in frame and bounds; no depth inference or reconstruction.' } });
  const preparedOutput = local(destinationDirectory, 'prepared/lenses.json'), deliveryPath = local(destinationDirectory, 'source/delivery.json');
  // Verify every input before writing any package entry, then publish the descriptor last.
  await mkdir(dirname(deliveryPath), { recursive: true }); await writeFile(deliveryPath, delivery);
  for (const { resource, bytes } of resources) {
    const output = local(destinationDirectory, `prepared/${request.lensId}/${resource.path}`);
    await mkdir(dirname(output), { recursive: true }); await writeFile(output, bytes);
  }
  await writeFile(preparedOutput, envelope);
  const destinationDescriptor = json({ schema: 'cssearth-object@1', id: request.id, type: 'volume-lens-bank', properties: {
    frame: source.frame, preparation: { source: 'source/delivery.json', sha256: sha256(delivery) },
  }, prepared: { format: 'cssearth-volume-lenses@1', url: 'prepared/lenses.json', sha256: sha256(envelope) } });
  const destinationDescriptorPath = local(destinationDirectory, 'object.json');
  await writeFile(destinationDescriptorPath, destinationDescriptor);
  return Object.freeze({ descriptorPath: destinationDescriptorPath, preparedPath: preparedOutput, deliveryPath, resourceCount: resources.length });
}
