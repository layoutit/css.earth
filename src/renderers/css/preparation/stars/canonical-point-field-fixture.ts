import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseObjectDescriptor, readPreparedObject } from '@cssearth/objects';
import type { PreparedCssPointField, PreparedCssPointFieldManifest } from '@cssearth/renderer/stars/types.ts';
import { decodePreparedCssPointField, parsePreparedCssPointFieldManifest } from '@cssearth/renderer/stars/validation.ts';

const base = new URL('../../../../objects/stellar-neighbourhood/', import.meta.url);
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Node test fixture: the checked-in stellar neighbourhood manifest and bank. */
export function readCanonicalPointFieldFiles(): { readonly descriptor: unknown; readonly url: string; readonly bankUrl: string;
  readonly manifestBytes: Uint8Array; readonly bankBytes: Uint8Array; readonly manifest: PreparedCssPointFieldManifest } {
  const descriptor: unknown = JSON.parse(readFileSync(new URL('object.json', base), 'utf8'));
  const parsed = parseObjectDescriptor(descriptor), prepared = parsed.prepared;
  if (!prepared) throw new TypeError('The stellar neighbourhood descriptor has no prepared artifact.');
  const manifestBytes = readFileSync(new URL(prepared.url, base));
  const manifest = readPreparedObject(JSON.parse(manifestBytes.toString('utf8')), parsed, parsePreparedCssPointFieldManifest).data;
  const bankUrl = `${prepared.url.slice(0, prepared.url.lastIndexOf('/') + 1)}${manifest.bank.path}`;
  const bankBytes = readFileSync(new URL(bankUrl, base));
  if (bankBytes.length !== manifest.bank.bytes || digest(bankBytes) !== manifest.bank.sha256) throw new TypeError('Checked-in point-field bank drifted from its pin.');
  return { descriptor, url: prepared.url, bankUrl, manifestBytes, bankBytes, manifest };
}

/** The checked-in point field decoded exactly as the runtime loader decodes it. */
export function readCanonicalPointField(): PreparedCssPointField {
  const { manifest, bankBytes } = readCanonicalPointFieldFiles();
  return decodePreparedCssPointField(manifest, bankBytes);
}
