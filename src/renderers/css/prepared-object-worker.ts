import { decodePreparedCssObject, decodeSharedBank } from './prepared-object-decoder.js';
import type { SharedBankReader, SharedReference } from './prepared-object-decoder.js';
import { sharedReferenceKey } from '../../platform/prepared-shared.mts';
import type { PreparedObjectDecodeRequest, PreparedObjectDecodeResult } from './prepared-object-worker-client.js';

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<PreparedObjectDecodeRequest>) => void) | null;
  postMessage(result: PreparedObjectDecodeResult): void;
};
// Shared banks repeat across every object navigation; the retained worker
// keeps each decoded bank so later objects inline it without another fetch.
const banks = new Map<string, Promise<unknown>>();
function sharedBankReader(sharedUrl: string): SharedBankReader {
  return (reference: SharedReference) => {
    const key = sharedReferenceKey(reference);
    let bank = banks.get(key);
    if (!bank) {
      bank = fetch(`${sharedUrl}/${reference.kind}/${reference.sha256}.json`).then(response => {
        if (!response.ok) throw new Error(`Prepared shared bank request failed: ${response.status}.`);
        return response.arrayBuffer();
      }).then(bytes => decodeSharedBank(reference, bytes));
      bank.catch(() => { if (banks.get(key) === bank) banks.delete(key); });
      banks.set(key, bank);
    }
    return bank;
  };
}
scope.onmessage = async ({ data }) => {
  try {
    const definition = await decodePreparedCssObject(data.descriptor, data.bytes,
      data.sharedUrl === undefined ? {} : { readSharedBank: sharedBankReader(data.sharedUrl) });
    scope.postMessage({ ok: true, definition });
  } catch (error) {
    scope.postMessage({ ok: false, name: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message : String(error) });
  }
};
