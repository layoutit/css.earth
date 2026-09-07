import { parseDensityVolumeObjectDescriptor, readPreparedObject } from '@cssearth/objects';
import type { PreparedCssTransport } from '../loader.js';
import { validatePreparedCssVolume } from './validation.js';
import type { PreparedCssVolume } from './types.js';

/** Transport a pinned prepared density object; never bake a missing runtime resource. */
export async function loadPreparedCssVolume(input: unknown, transport: PreparedCssTransport): Promise<PreparedCssVolume> {
  const descriptor = parseDensityVolumeObjectDescriptor(input);
  if (descriptor.prepared?.format !== 'cssearth-density-volume@1') throw new TypeError('A volume requires its prepared artifact.');
  const bytes = await transport.read(descriptor.prepared.url);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const digest = [...hash].map(value => value.toString(16).padStart(2, '0')).join('');
  if (digest !== descriptor.prepared.sha256) throw new TypeError('Prepared volume SHA-256 identity mismatch.');
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const payload = readPreparedObject(value, descriptor, validatePreparedCssVolume).data;
  if (payload.id !== descriptor.id || JSON.stringify(payload.frame) !== JSON.stringify(descriptor.volume)) {
    throw new TypeError('Prepared volume frame does not match its authored descriptor.');
  }
  return payload;
}
