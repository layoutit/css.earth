import { decodePreparedCssObject } from './prepared-object-decoder.js';
import type { PreparedObjectDecodeRequest, PreparedObjectDecodeResult } from './prepared-object-worker-client.js';

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<PreparedObjectDecodeRequest>) => void) | null;
  postMessage(result: PreparedObjectDecodeResult): void;
};
scope.onmessage = async ({ data }) => {
  try {
    const definition = await decodePreparedCssObject(data.descriptor, data.bytes);
    scope.postMessage({ ok: true, definition });
  } catch (error) {
    scope.postMessage({ ok: false, name: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message : String(error) });
  }
};
