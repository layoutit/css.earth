import { loadPreparedCssObject } from '../src/renderers/css/dist/index.js';
import { readPreparedObjectBytes, readSharedBankBytes } from '../site/object-page-data.mts';
import { serializePreparedScene } from './serialize-prepared-scene.mts';

export async function loadPreparedSceneMarkup(id: string) {
  const { descriptor, bytes } = await readPreparedObjectBytes(id);
  const definition = await loadPreparedCssObject(descriptor, {
    async read() { return Uint8Array.from(bytes).buffer; },
    async readShared(reference) {
      const bytes = await readSharedBankBytes(reference);
      if (!bytes) throw new Error(`${id}: prepared bank ${reference.kind}/${reference.sha256} is missing.`);
      return Uint8Array.from(bytes).buffer;
    },
  });
  return { ...serializePreparedScene(definition), sha256: descriptor.prepared?.sha256, descriptor };
}
