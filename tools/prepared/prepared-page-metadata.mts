import { sha256 } from '../../src/platform/sha256.mts';
import { requireRecord } from '../sources/source-values.mts';

/** The page's share of the runtime: assets and controls beside the scene. It is a build output that
 * restore-object-json writes from the restored runtime, never committed, and the descriptor names it by path only. */
export function preparePageMetadata(id: string, input: unknown) {
  const definition = requireRecord(input);
  if (definition.id !== id || !definition.assets || !definition.controls) {
    throw new TypeError(`${id}: invalid prepared page metadata inputs.`);
  }
  const text = JSON.stringify({ schema: 'cssearth-object-page@1', id, assets: definition.assets, controls: definition.controls });
  return { text, reference: { url: 'prepared/page.json' } };
}

/** Scene-only changes do not change source citations. Reuse the source graph
 * only after proving that its scene inputs did not change in content. */
export async function refreshSourceScenePins(before: ReadonlyMap<string, string>, root: string) {
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const { writePreparedSet } = await import('./write-prepared-set.mts');

  const shape = (_path: string, text: string) => requireRecord(JSON.parse(text));
  const outputs = [];
  for (const path of ['site/prepared-sources.json']) {
    const value = requireRecord(JSON.parse(await readFile(resolve(root, path), 'utf8'))), closure = { ...requireRecord(value.closure) };
    for (const [input, previous] of before) {
      if (!/^src\/objects\/[a-z0-9-]+\/(?:object|prepared\/page)\.json$/u.test(input)) throw new Error('Scene re-pin received a non-scene input.');
      if (closure[input] !== sha256(previous)) throw new Error(`Source graph input was already stale: ${input}`);
      const current = await readFile(resolve(root, input), 'utf8');
      if (JSON.stringify(shape(input, previous)) !== JSON.stringify(shape(input, current))) throw new Error(`Source graph content changed: ${input}`);
      closure[input] = sha256(current);
    }
    outputs.push({ path: resolve(root, path), text: JSON.stringify({ ...value, closure }, null, 2)+'\n' });
  }
  await writePreparedSet(outputs);
}
