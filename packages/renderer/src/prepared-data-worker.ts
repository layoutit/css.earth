import { decodePreparedCssObject } from './prepared-object-decoder.js';
import { readPreparedHere } from './prepared-data/readers.js';
import type { PreparedDataRequest, PreparedDataResult } from './prepared-data-worker-client.js';

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<PreparedDataRequest>) => void) | null;
  postMessage(result: PreparedDataResult, transfer?: Transferable[]): void;
};
scope.onmessage = async ({ data }) => {
  try {
    if (data.kind === 'object') scope.postMessage({ id: data.id, ok: true, value: await decodePreparedCssObject(data.descriptor, data.bytes) });
    else {
      const { value, transfer } = await readPreparedHere(data.reader, data.url);
      scope.postMessage({ id: data.id, ok: true, value }, [...transfer]);
    }
  } catch (error) {
    scope.postMessage({ id: data.id, ok: false, name: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message : String(error) });
  }
};
