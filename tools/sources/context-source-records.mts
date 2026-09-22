import { sha256 } from '../../src/platform/sha256.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseSourceBinding, sourceArray, sourceObject, sourcePath, sourceText, sourceDigest } from '../../src/platform/source-catalog.mts';
import type { ProvenanceSource } from '../../src/platform/object-provenance.mts';

export async function manifestSources(manifest: Record<string, unknown>, root: string, input: (path: string) => Promise<Buffer>): Promise<ProvenanceSource[]> {
  const entries: ProvenanceSource[] = [];
  for (const collection of ['inputs', 'documents', 'generatedIntermediates']) {
    for (const raw of sourceArray(manifest[collection] ?? [], sourceObject)) {
      const path = sourcePath(raw.path);
      // A download or a cached file carries a manifest pin. A file authored and tracked here is identified from its bytes.
      const pinned = raw.expectedSha256 !== undefined;
      const installed = (path.startsWith('.local/') || collection === 'generatedIntermediates') ? await readFile(resolve(root, path)).catch((error: unknown) => {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null; throw error;
      }) : await input(path);
      if (!pinned && installed === null) throw new Error(`Unpinned source is missing: ${path}${collection === 'generatedIntermediates' ? '. It is generated; rebuild it with the step that writes it first.' : ''}`);
      const bytes = pinned ? raw.expectedBytes : installed!.length, pin = pinned ? sourceDigest(raw.expectedSha256) : sha256(installed!);
      if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes <= 0) throw new TypeError(`Invalid source size: ${path}`);
      if (pinned && installed && (installed.length !== bytes || sha256(installed) !== pin)) throw new Error(`Changed source document: ${path}${collection !== 'generatedIntermediates' ? ''
        : path.endsWith('sun/prepared/world-context.json') ? '. It is generated; run pnpm prepare:world-context first.' : '. It is generated; rebuild it with the step that writes it first.'}`);
      entries.push({ id: typeof raw.id === 'string' ? raw.id : `document-${sha256(path).slice(0,16)}`, path, bytes, sha256: pin,
        kind: typeof raw.kind === 'string' ? raw.kind : collection === 'inputs' ? 'source-input' : 'source-document',
        origin: typeof raw.origin === 'string' ? raw.origin : 'unrecorded', credit: typeof raw.credit === 'string' ? raw.credit : 'unrecorded',
        acquisition: typeof raw.acquisition === 'string' ? raw.acquisition : 'unrecorded',
        dependencies: [...sourceArray(raw.dependencies ?? [], sourceText)], verification: pinned && (path.startsWith('.local/') || collection === 'generatedIntermediates') ? 'manifest-pin' : 'bytes-verified',
        sourceBinding: parseSourceBinding(raw.sourceBinding),
        ...(typeof raw.sourceUrl === 'string' ? { sourceUrl: raw.sourceUrl } : {}),
        ...(typeof raw.title === 'string' ? { title: raw.title } : {}),
        ...(typeof raw.license === 'string' ? { license: raw.license } : {}) });
    }
  }
  return entries;
}
