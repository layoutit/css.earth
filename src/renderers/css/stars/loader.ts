import { parseDensityVolumeFrame, parseObjectDescriptor, readPreparedObject } from '@cssearth/objects';
import type { ObjectDescriptor } from '@cssearth/objects';
import type { PreparedCssTransport } from '../loader.js';
import type { PreparedCssPointField, PreparedPointAppearance } from './types.js';
import { decodePreparedCssPointField, parsePreparedCssPointFieldManifest } from './validation.js';

/** Loads one pinned point-field manifest and the binary column bank it pins. Image
 * resources stay in the prepared asset bank. */
export async function loadPreparedCssPointField(input: unknown, transport: PreparedCssTransport): Promise<PreparedCssPointField> {
  const { descriptor, manifest } = await loadManifest(input, transport);
  const url = descriptor.prepared!.url;
  // The bank sits beside its manifest. Length and digest are verified before any byte is decoded.
  const bank = await transport.read(`${url.slice(0, url.lastIndexOf('/') + 1)}${manifest.bank.path}`);
  if (bank.byteLength !== manifest.bank.bytes || await sha256(bank) !== manifest.bank.sha256) {
    throw new TypeError('Prepared point-field bank length or SHA-256 identity mismatch.');
  }
  return decodePreparedCssPointField(manifest, bank);
}

/** The application needs the prepared optics and bounded direct display sample,
 * not the complete individual-star bank. */
export async function loadPreparedPointAppearance(input: unknown, transport: PreparedCssTransport): Promise<PreparedPointAppearance> {
  const { manifest } = await loadManifest(input, transport);
  const { id, frame, atlas, photometry, directPoints, resources } = manifest;
  return { id, frame, atlas, photometry, ...(directPoints === undefined ? {} : { directPoints }), resources };
}

async function loadManifest(input: unknown, transport: PreparedCssTransport) {
  const { descriptor, frame } = parsePointFieldDescriptor(input);
  const url = descriptor.prepared!.url;
  const bytes = await transport.read(url);
  const envelope: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const manifest = readPreparedObject(envelope, descriptor, parsePreparedCssPointFieldManifest).data;
  if (manifest.id !== descriptor.id || JSON.stringify(manifest.frame) !== JSON.stringify(frame)) {
    throw new TypeError('Prepared point field frame does not match its authored descriptor.');
  }
  return { descriptor, manifest };
}

function parsePointFieldDescriptor(input: unknown): { readonly descriptor: ObjectDescriptor; readonly frame: PreparedCssPointField['frame'] } {
  const descriptor = parseObjectDescriptor(input);
  if (descriptor.type !== 'point-field' || descriptor.prepared?.format !== 'cssearth-css-point-field-bank@1') {
    throw new TypeError('A point field requires its prepared artifact.');
  }
  const properties = descriptor.properties as Record<string, unknown>;
  if (Object.keys(properties).length !== 2 || !('frame' in properties) || !('preparation' in properties)) {
    throw new TypeError('Point-field descriptor properties are invalid.');
  }
  const preparation = properties.preparation;
  if (!preparation || typeof preparation !== 'object' || Array.isArray(preparation)) throw new TypeError('Point-field preparation reference is invalid.');
  const reference = preparation as Record<string, unknown>;
  if (Object.keys(reference).length !== 1 || typeof reference.source !== 'string' || !reference.source || reference.source.startsWith('/') || reference.source.split('/').includes('..')) throw new TypeError('Point-field preparation reference is invalid.');
  return Object.freeze({ descriptor, frame: parseDensityVolumeFrame(properties.frame) });
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...hash].map(value => value.toString(16).padStart(2, '0')).join('');
}
