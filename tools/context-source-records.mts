import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseSourceBinding, sourceArray, sourceObject, sourcePath, sourceText, sourceDigest } from '../src/platform/source-catalog.mts';
import type { ProvenanceSource } from '../src/platform/object-provenance.mts';
export const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export async function manifestSources(manifest: Record<string, unknown>, root: string, input: (path: string) => Promise<Buffer>): Promise<ProvenanceSource[]> {
  const entries: ProvenanceSource[] = [];
  for (const collection of ['inputs', 'documents', 'generatedIntermediates']) {
    for (const raw of sourceArray(manifest[collection] ?? [], sourceObject)) {
      const path = sourcePath(raw.path), bytes = raw.expectedBytes;
      if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes <= 0) throw new TypeError(`Invalid source size: ${path}`);
      const sha256 = sourceDigest(raw.expectedSha256);
      const installed = (path.startsWith('.local/') || collection === 'generatedIntermediates') ? await readFile(resolve(root, path)).catch((error: unknown) => {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null; throw error;
      }) : await input(path);
      if (installed && (installed.length !== bytes || hash(installed) !== sha256)) throw new Error(`Changed source document: ${path}`);
      entries.push({ id: typeof raw.id === 'string' ? raw.id : `document-${hash(path).slice(0,16)}`, path, bytes, sha256,
        kind: typeof raw.kind === 'string' ? raw.kind : collection === 'inputs' ? 'source-input' : 'source-document',
        origin: typeof raw.origin === 'string' ? raw.origin : 'unrecorded', credit: typeof raw.credit === 'string' ? raw.credit : 'unrecorded',
        acquisition: typeof raw.acquisition === 'string' ? raw.acquisition : 'unrecorded',
        dependencies: [...sourceArray(raw.dependencies ?? [], sourceText)], verification: path.startsWith('.local/') || collection === 'generatedIntermediates' ? 'manifest-pin' : 'bytes-verified',
        sourceBinding: parseSourceBinding(raw.sourceBinding),
        ...(typeof raw.sourceUrl === 'string' ? { sourceUrl: raw.sourceUrl } : {}),
        ...(typeof raw.title === 'string' ? { title: raw.title } : {}),
        ...(typeof raw.license === 'string' ? { license: raw.license } : {}) });
    }
  }
  return entries;
}
