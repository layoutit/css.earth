import { parseObjectDescriptor, parseDensityVolumeFrame, readPreparedObject } from '@cssearth/objects';
import type { PreparedCssTransport } from '../loader.js';
import { validatePreparedCssSurfaceShell } from './validation.js';
import type { PreparedCssSurfaceShell } from './types.js';

/** Load only the prepared shell; no source geometry enters the browser. */
export async function loadPreparedCssSurfaceShell(input: unknown, transport: PreparedCssTransport): Promise<PreparedCssSurfaceShell> {
  const descriptor = parseObjectDescriptor(input);
  if (descriptor.type !== 'surface-shell' || descriptor.prepared?.format !== 'cssearth-surface-shell@1') {
    throw new TypeError('A surface shell requires its prepared artifact.');
  }
  const frame = parseDensityVolumeFrame(descriptor.properties.frame);
  const bytes = await transport.read(descriptor.prepared.url);
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const payload = readPreparedObject(value, descriptor, validatePreparedCssSurfaceShell).data;
  if (payload.id !== descriptor.id || JSON.stringify(payload.frame) !== JSON.stringify(frame)) {
    throw new TypeError('Prepared shell frame does not match its authored descriptor.');
  }
  return payload;
}
