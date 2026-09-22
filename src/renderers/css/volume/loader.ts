import { parseDensityVolumeObjectDescriptor, readPreparedObject } from '@cssearth/objects';
import type { PreparedCssTransport } from '../loader.js';
import { validatePreparedCssVolume } from './validation.js';
import type { PreparedCssVolume } from './types.js';

/** Transport a prepared density object; never bake a missing runtime resource. */
export async function loadPreparedCssVolume(input: unknown, transport: PreparedCssTransport): Promise<PreparedCssVolume> {
  const descriptor = parseDensityVolumeObjectDescriptor(input);
  if (descriptor.prepared?.format !== 'cssearth-density-volume@1') throw new TypeError('A volume requires its prepared artifact.');
  const bytes = await transport.read(descriptor.prepared.url);
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const payload = readPreparedObject(value, descriptor, validatePreparedCssVolume).data;
  if (payload.id !== descriptor.id || JSON.stringify(payload.frame) !== JSON.stringify(descriptor.volume)) {
    throw new TypeError('Prepared volume frame does not match its authored descriptor.');
  }
  return payload;
}
