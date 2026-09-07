import { parseDensityVolumeFrame, parseObjectDescriptor, readPreparedObject } from '@cssearth/objects';
import type { ObjectDescriptor } from '@cssearth/objects';
import type { PreparedCssTransport } from '../loader.js';
import type { PreparedCssPointField } from './types.js';
import { parsePreparedCssPointField } from './validation.js';

/** Loads one pinned point-field transport; resources stay in the prepared asset bank. */
export async function loadPreparedCssPointField(input: unknown, transport: PreparedCssTransport): Promise<PreparedCssPointField> {
  const { descriptor, frame } = parsePointFieldDescriptor(input);
  const bytes = await transport.read(descriptor.prepared!.url);
  const digest = await sha256(bytes);
  if (digest !== descriptor.prepared!.sha256) throw new TypeError('Prepared point field SHA-256 identity mismatch.');
  const envelope: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const payload = readPreparedObject(envelope, descriptor, parsePreparedCssPointField).data;
  if (payload.id !== descriptor.id || JSON.stringify(payload.frame) !== JSON.stringify(frame)) {
    throw new TypeError('Prepared point field frame does not match its authored descriptor.');
  }
  return payload;
}

function parsePointFieldDescriptor(input: unknown): { readonly descriptor: ObjectDescriptor; readonly frame: PreparedCssPointField['frame'] } {
  const descriptor = parseObjectDescriptor(input);
  if (descriptor.type !== 'point-field' || descriptor.prepared?.format !== 'cssearth-css-point-field@1') {
    throw new TypeError('A point field requires its prepared artifact.');
  }
  const properties = descriptor.properties as Record<string, unknown>;
  if (Object.keys(properties).length !== 2 || !('frame' in properties) || !('preparation' in properties)) {
    throw new TypeError('Point-field descriptor properties are invalid.');
  }
  const preparation = properties.preparation;
  if (!preparation || typeof preparation !== 'object' || Array.isArray(preparation)) throw new TypeError('Point-field preparation reference is invalid.');
  const reference = preparation as Record<string, unknown>;
  if (Object.keys(reference).length !== 2 || typeof reference.source !== 'string' || !reference.source || reference.source.startsWith('/') || reference.source.split('/').includes('..') ||
      typeof reference.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(reference.sha256)) throw new TypeError('Point-field preparation reference is invalid.');
  return Object.freeze({ descriptor, frame: parseDensityVolumeFrame(properties.frame) });
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...hash].map(value => value.toString(16).padStart(2, '0')).join('');
}
