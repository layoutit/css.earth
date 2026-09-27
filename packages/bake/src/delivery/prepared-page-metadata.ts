import { requireRecord } from '@cssearth/core';

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
