import { requireRecord } from './source-values.mts';
import { createHash } from 'node:crypto';

/** Emitted from the same finalized definition as the hash-addressed scene. */
export function preparePageMetadata(id: string, sceneSha256: string, input: unknown) {
  const definition = requireRecord(input);
  if (definition.id !== id || !/^[a-f0-9]{64}$/u.test(sceneSha256) || !definition.assets || !definition.controls) {
    throw new TypeError(`${id}: invalid prepared page metadata inputs.`);
  }
  const text = JSON.stringify({ schema: 'cssearth-object-page@1', id, sceneSha256,
    assets: definition.assets, controls: definition.controls });
  return { text, reference: { url: 'prepared/page.json', sha256: createHash('sha256').update(text).digest('hex') } };
}

/** Scene-only changes do not change source citations. Reuse the source graph
 * only after proving that its pinned inputs changed solely in scene hashes. */
export async function refreshSourceScenePins(before: ReadonlyMap<string, string>, root: string) {
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const { writePreparedSet } = await import('./write-prepared-set.mts');
  const hash = (text: string) => createHash('sha256').update(text).digest('hex');
  const shape = (path: string, text: string) => {
    const value = requireRecord(JSON.parse(text));
    if (path.endsWith('/prepared/page.json')) return { ...value, sceneSha256: null };
    const properties = requireRecord(value.properties), page = requireRecord(properties.page);
    return { ...value, prepared: { ...requireRecord(value.prepared), sha256: null },
      properties: { ...properties, page: { ...page, metadata: { ...requireRecord(page.metadata), sha256: null } } } };
  };
  const outputs = [];
  for (const path of ['site/prepared-sources.json', 'site/prepared-machines.json']) {
    const value = requireRecord(JSON.parse(await readFile(resolve(root, path), 'utf8'))), closure = { ...requireRecord(value.closure) };
    for (const [input, previous] of before) {
      if (!/^src\/objects\/[a-z0-9-]+\/(?:object|prepared\/page)\.json$/u.test(input)) throw new Error('Scene re-pin received a non-scene input.');
      if (closure[input] !== hash(previous)) throw new Error(`Source graph input was already stale: ${input}`);
      const current = await readFile(resolve(root, input), 'utf8');
      if (JSON.stringify(shape(input, previous)) !== JSON.stringify(shape(input, current))) throw new Error(`Source graph content changed: ${input}`);
      closure[input] = hash(current);
    }
    outputs.push({ path: resolve(root, path), text: JSON.stringify({ ...value, closure }, null, 2)+'\n' });
  }
  await writePreparedSet(outputs);
}
