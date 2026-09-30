import { readFileSync } from 'node:fs';
import { parseObjectDescriptor, readPreparedObject } from '@cssearth/objects';
import type { PreparedCssPointField, PreparedCssPointFieldManifest } from '../src/stars/types.ts';
import { decodePreparedCssPointField, parsePreparedCssPointFieldManifest } from '../src/stars/validation.ts';
import { unpackPreparedBinary } from '@cssearth/objects/node';

const base = new URL('./fixtures/point-field/', import.meta.url);

/** Node test fixture: a sampled stellar neighbourhood manifest and bank. */
export function readCanonicalPointFieldFiles(): { readonly descriptor: unknown; readonly url: string; readonly bankUrl: string;
  readonly manifestBytes: Uint8Array; readonly bankFile: Uint8Array; readonly bankBytes: Uint8Array; readonly manifest: PreparedCssPointFieldManifest } {
  const descriptor: unknown = JSON.parse(readFileSync(new URL('object.json', base), 'utf8'));
  const parsed = parseObjectDescriptor(descriptor), prepared = parsed.prepared;
  if (!prepared) throw new TypeError('The stellar neighbourhood descriptor has no prepared artifact.');
  const manifestBytes = readFileSync(new URL(prepared.url, base));
  const manifest = readPreparedObject(JSON.parse(manifestBytes.toString('utf8')), parsed, parsePreparedCssPointFieldManifest).data;
  const bankUrl = `${prepared.url.slice(0, prepared.url.lastIndexOf('/') + 1)}${manifest.bank.path}`;
  // The bank is packed as the site publishes it (@cssearth/objects prepared-binary.ts).
  const bankFile = readFileSync(new URL(bankUrl, base)), bankBytes = new Uint8Array(unpackPreparedBinary(bankFile, bankUrl));
  if (bankBytes.length !== manifest.bank.bytes) {
    throw new TypeError(`stellar-neighbourhood ${bankUrl} holds ${bankBytes.length} bytes; its manifest bank.bytes says ${manifest.bank.bytes}.`);
  }
  return { descriptor, url: prepared.url, bankUrl, manifestBytes, bankFile, bankBytes, manifest };
}

/** The local prepared point field decoded exactly as the runtime loader decodes it. */
export function readCanonicalPointField(): PreparedCssPointField {
  const { manifest, bankBytes } = readCanonicalPointFieldFiles();
  return decodePreparedCssPointField(manifest, bankBytes);
}
