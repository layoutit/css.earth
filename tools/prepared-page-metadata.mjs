import { createHash } from 'node:crypto';

/** Emitted from the same finalized definition as the hash-addressed scene. */
export function preparePageMetadata(id, sceneSha256, definition) {
  if (definition.id !== id || !/^[a-f0-9]{64}$/u.test(sceneSha256) || !definition.assets || !definition.controls) {
    throw new TypeError(`${id}: invalid prepared page metadata inputs.`);
  }
  const text = JSON.stringify({ schema: 'cssearth-object-page@1', id, sceneSha256,
    assets: definition.assets, controls: definition.controls });
  return { text, reference: { url: 'prepared/page.json', sha256: createHash('sha256').update(text).digest('hex') } };
}
