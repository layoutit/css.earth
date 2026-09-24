import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { parseAuthoredObjectDescriptor, type AuthoredObjectDescriptor, type SourceReference } from '@cssearth/objects';
import { createSourceManifest } from '../../src/platform/source-manifest.mts';
import { sha256 } from '@cssearth/core/node';

/** A recipe source bound to its manifest record, with the digest of the bytes that were read. */
export interface BoundSource { readonly id: string; readonly path: string; readonly sha256: string; }
export interface VerifiedSource { readonly reference: BoundSource; readonly path: string; readonly value: unknown; }
export interface AuthoredSources {
  readonly descriptor: AuthoredObjectDescriptor;
  readonly manifest: Awaited<ReturnType<typeof createSourceManifest>>;
  /** Every recipe source, declared in the manifest, in recipe order. */
  readonly entries: readonly VerifiedSource[];
  readonly sources: ReadonlyMap<string, VerifiedSource>;
}

function contained(root: string, path: string): string {
  const resolved = resolve(root, path), offset = relative(root, resolved);
  if (offset === '..' || offset.startsWith('../') || offset.startsWith('..\\')) throw new TypeError(`Source ${path} escapes its object directory.`);
  return resolved;
}

/** The manifest record for a descriptor path (`source/...`). Every recipe source must be declared there. */
export function manifestRecord(manifest: AuthoredSources['manifest'], reference: SourceReference) {
  const sourcePath = reference.path.startsWith('source/') ? reference.path.slice('source/'.length) : null;
  const entry = sourcePath === null ? undefined : [...manifest.manifest.inputs, ...manifest.manifest.documents, ...manifest.manifest.generatedIntermediates]
    .find(candidate => candidate.path === sourcePath);
  if (!entry) throw new TypeError(`Recipe source ${reference.id} (${reference.path}) is not declared in the source manifest.`);
  return entry;
}

/** Read one recipe source declared in the manifest. */
export async function verifiedSource(objectDirectory: string, manifest: AuthoredSources['manifest'], reference: SourceReference): Promise<VerifiedSource> {
  manifestRecord(manifest, reference);
  const path = contained(objectDirectory, reference.path), bytes = await readFile(path);
  const reference_ = Object.freeze({ id: reference.id, path: reference.path, sha256: sha256(bytes) });
  try { return Object.freeze({ reference: reference_, path, value: JSON.parse(bytes.toString('utf8')) as unknown }); }
  catch { throw new TypeError(`Source ${reference.path} must be JSON configuration.`); }
}

/** The authored descriptor, its manifest, and every recipe source verified against the manifest. */
export async function readAuthoredSources(objectDirectory: string, descriptorValue?: unknown): Promise<AuthoredSources> {
  const descriptor = parseAuthoredObjectDescriptor(descriptorValue ?? JSON.parse(await readFile(resolve(objectDirectory, 'object.json'), 'utf8')) as unknown);
  const manifest = await createSourceManifest({ objectId: descriptor.id, objectName: descriptor.id, sourceRoot: resolve(objectDirectory, 'source') });
  const entries = await Promise.all(descriptor.recipe.sources.map(reference => verifiedSource(objectDirectory, manifest, reference)));
  return Object.freeze({ descriptor, manifest, entries, sources: new Map(entries.map(entry => [entry.reference.id, entry])) });
}
