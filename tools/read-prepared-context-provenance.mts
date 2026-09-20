import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceArray, sourceObject, sourceText } from '../src/platform/source-catalog.mts';
import { validateObjectProvenance } from '../src/platform/object-provenance.mts';
import type { ProvenanceDocument } from '../src/platform/object-provenance.mts';

export interface PreparedContextProvenance {
  id: string; name: string; route: string; base: string; controls: readonly never[]; provenance: ProvenanceDocument;
  outputs: readonly { path: string; text: string | Uint8Array }[];
}

/** Read the prepared context packages installed by setup:assets. Deploy catalogue compilation must not replay
 * authoring provenance against a platform-specific generated intermediate. */
export async function readPreparedContextProvenance({ root = process.cwd(), input = path => readFile(resolve(root, path)) }: {
  root?: string; input?: (path: string) => Promise<Buffer>;
} = {}): Promise<PreparedContextProvenance[]> {
  const results: PreparedContextProvenance[] = [];
  for (const folder of (await readdir(resolve(root, 'src/objects'), { withFileTypes: true })).sort((a,b)=>a.name.localeCompare(b.name))) {
    if (!folder.isDirectory()) continue;
    const id = folder.name, base = `src/objects/${id}`, sourcePresentationPath = `${base}/source/presentation.json`;
    const sourcePresentationBytes = await readFile(resolve(root, sourcePresentationPath)).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
      throw error;
    });
    if (sourcePresentationBytes === null || !sourceObject(JSON.parse(sourcePresentationBytes.toString())).provenance) continue;
    await input(sourcePresentationPath);
    const provenance = validateObjectProvenance(JSON.parse((await input(`${base}/prepared/provenance.json`)).toString()), id);
    const presentation = sourceObject(JSON.parse((await input(`${base}/prepared/presentation.json`)).toString()));
    const products = sourceArray(presentation.products, sourceObject);
    if (products.length !== provenance.products.length || products.some((product, index) => product.id !== provenance.products[index]?.id)) {
      throw new Error(`Prepared context presentation differs from provenance: ${id}`);
    }
    results.push({ id, name: sourceText(presentation.name), route: '/sun/', base, controls: [], provenance, outputs: [] });
  }
  return results;
}
