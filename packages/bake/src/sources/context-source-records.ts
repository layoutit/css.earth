import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode } from '@cssearth/core';
import { checkLineage, lineageSource } from '@cssearth/objects/provenance';
import type { LineageSource, ObjectLineage } from '@cssearth/objects/provenance';
import { sourceArray, sourceId, sourceObject, sourceText } from '@cssearth/objects/sources';

/** Every record a context or image-layer manifest lists: its inputs, documents and generated intermediates. */
export function manifestSources(manifest: Record<string, unknown>): LineageSource[] {
  return ['inputs', 'documents', 'generatedIntermediates'].flatMap(collection => sourceArray(manifest[collection] ?? [], raw =>
    lineageSource(raw, { id: `document:${sourceText(sourceObject(raw).path)}`, credit: 'unrecorded' })));
}

export interface ContextLineage { id: string; name: string; route: string; base: string; controls: readonly never[]; lineage: ObjectLineage }

/** Each catalogue context's lineage, read from the products its `source/presentation.json` declares and its manifest.
 * `route` is the application route that shows the context objects; the application passes it in. */
export async function contextLineages({ route, root = process.cwd(), input = (path: string) => readFile(resolve(root, path)) }: {
  route: string; root?: string; input?: (path: string) => Promise<Buffer>;
}): Promise<ContextLineage[]> {
  const results: ContextLineage[] = [];
  for (const folder of (await readdir(resolve(root, 'src/objects'), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!folder.isDirectory()) continue;
    const id = folder.name, base = `src/objects/${id}`, presentationPath = `${base}/source/presentation.json`;
    const exists = await readFile(resolve(root, presentationPath)).then(() => true, (error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return false; throw error; });
    if (!exists) continue;
    const raw = sourceObject(JSON.parse((await input(presentationPath)).toString()));
    if (raw.provenance === undefined) continue;
    const presentation = sourceObject(raw.provenance);
    const manifest = sourceObject(JSON.parse((await input(`${base}/source/manifest.json`)).toString()));
    if (manifest.schema !== 'cssearth-volume-source-manifest@2' || manifest.pathBase !== 'repository') throw new TypeError(`Invalid context manifest: ${id}`);
    const products = sourceArray(presentation.products, raw => {
      const value = sourceObject(raw), interpretation = sourceObject(value.interpretation);
      return { id: sourceText(value.id), label: sourceText(value.label), inputs: [...sourceArray(value.inputs, sourceText)], parents: [], datasetIds: [],
        observationAttribution: 'none' as const, limitations: [...sourceArray(value.limitations, sourceText)],
        interpretation: { ...(typeof interpretation.kind === 'string' ? { kind: interpretation.kind } : {}),
          ...(typeof interpretation.sourceKind === 'string' ? { sourceKind: interpretation.sourceKind } : {}) } };
    });
    // A bank an object shows through one of its datasets names that object: its page is where the bank is seen.
    const host = raw.host === undefined ? undefined : sourceId(raw.host);
    results.push({ id, name: sourceText(presentation.name), route: host === undefined ? route : `/${host}/`, base, controls: [],
      lineage: checkLineage({ objectId: id, manifestPath: 'source/manifest.json', sources: manifestSources(manifest), products }) });
  }
  return results;
}
