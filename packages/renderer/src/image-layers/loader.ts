import { validatePreparedImageLayerBank, type PreparedCssImageLayers, PREPARED_IMAGE_LAYER_BANK_SCHEMA, parseImageLayerBankDescriptor } from '@cssearth/objects';
import type { PreparedCssTransport } from '../loader.js';

export async function loadPreparedCssImageLayers(input: unknown, transport: PreparedCssTransport): Promise<PreparedCssImageLayers> {
  const descriptor = parseImageLayerBankDescriptor(input);
  if (descriptor.prepared?.format !== PREPARED_IMAGE_LAYER_BANK_SCHEMA) throw new TypeError('Image layers require a prepared bank.');
  const bytes = await transport.read(descriptor.prepared.url);
  const payload = validatePreparedImageLayerBank(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  if (payload.id !== descriptor.id || JSON.stringify(payload.frame) !== JSON.stringify(descriptor.frame)) {
    throw new TypeError('Prepared image-layer identity/frame mismatch.');
  }
  return payload;
}
