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
      // Every source is identified from its bytes: a file authored here through the source reader, a download or a
      // generated file from the checkout.
      const installed = (path.startsWith('.local/') || collection === 'generatedIntermediates') ? await readFile(resolve(root, path)).catch((error: unknown) => {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null; throw error;
      }) : await input(path);
      if (installed === null) throw new Error(`Source is missing: ${path}${collection !== 'generatedIntermediates' ? '. Restore it with pnpm setup:sources first.'
        : path.endsWith('sun/prepared/world-context.json') ? '. It is generated; run pnpm prepare:world-context first.' : '. It is generated; rebuild it with the step that writes it first.'}`);
      const bytes = installed.length, pin = sha256(installed);
      if (bytes <= 0) throw new TypeError(`Empty source: ${path}`);
      entries.push({ id: typeof raw.id === 'string' ? raw.id : `document-${sha256(path).slice(0,16)}`, path, bytes, sha256: pin,
        kind: typeof raw.kind === 'string' ? raw.kind : collection === 'inputs' ? 'source-input' : 'source-document',
        origin: typeof raw.origin === 'string' ? raw.origin : 'unrecorded', credit: typeof raw.credit === 'string' ? raw.credit : 'unrecorded',
        acquisition: typeof raw.acquisition === 'string' ? raw.acquisition : 'unrecorded',
        dependencies: [...sourceArray(raw.dependencies ?? [], sourceText)], verification: 'bytes-verified',
        sourceBinding: parseSourceBinding(raw.sourceBinding),
        ...(typeof raw.sourceUrl === 'string' ? { sourceUrl: raw.sourceUrl } : {}),
        ...(typeof raw.title === 'string' ? { title: raw.title } : {}),
        ...(typeof raw.license === 'string' ? { license: raw.license } : {}) });
    }
  }
  return entries;
}
