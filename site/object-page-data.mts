import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parseObjectDescriptor } from '@cssearth/objects';
import { requireAssets, requireControls } from '../src/renderers/css/dist/index.js';
import { record } from './browser-types.mts';
import { hasErrorCode } from '../tools/source-values.mts';
import { listSharedBankFiles, sharedBankPath } from '../src/platform/prepared-shared-banks.mts';
import type { SharedReference } from '../src/platform/prepared-shared.mts';

/** Server/build-only metadata read. Scene trees remain separate runtime assets. */
export async function readPreparedObjectBytes(id: string, root = process.cwd()) {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object page identity.');
  const directory = resolve(root, 'src/planets', id);
  const descriptor = parseObjectDescriptor(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')));
  if (descriptor.id !== id || descriptor.prepared?.url !== 'prepared/object.json') {
    throw new TypeError(`${id}: invalid prepared page reference.`);
  }
  const bytes = await readFile(resolve(directory, 'prepared/object.json'));
  if (createHash('sha256').update(bytes).digest('hex') !== descriptor.prepared.sha256) {
    throw new Error(`${id}: prepared page data differs from its descriptor pin.`);
  }
  return { descriptor, bytes };
}

export async function loadObjectPageData(id: string, root = process.cwd()) {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object page identity.');
  const directory = resolve(root, 'src/planets', id);
  const descriptor = parseObjectDescriptor(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')));
  const page = descriptor.properties.page;
  const reference = record(page) && record(page.metadata) ? page.metadata : null;
  if (descriptor.id !== id || reference?.url !== 'prepared/page.json') {
    throw new TypeError(`${id}: invalid prepared page reference.`);
  }
  const bytes = await readFile(resolve(directory, reference.url));
  if (createHash('sha256').update(bytes).digest('hex') !== reference.sha256) {
    throw new Error(`${id}: prepared page data differs from its descriptor pin.`);
  }
  const object: unknown = JSON.parse(bytes.toString('utf8'));
  if (!record(object) || object.schema !== 'cssearth-object-page@1' || object.id !== id ||
      object.sceneSha256 !== descriptor.prepared?.sha256 || !object.assets || !object.controls) {
    throw new TypeError(`${id}: incomplete prepared page data.`);
  }
  requireAssets(object.assets);
  requireControls(object.controls);
  return { assets: object.assets, controls: object.controls };
}

/** Every checked-in shared bank, for the static bank endpoint. */
export async function listSharedBanks(root = process.cwd()) {
  return (await listSharedBankFiles(root)).map(({ reference }) => reference);
}

/** Bank bytes, only when they reproduce their content address. */
export async function readSharedBankBytes(reference: SharedReference, root = process.cwd()) {
  let bytes: Buffer;
  try { bytes = await readFile(sharedBankPath(root, reference)); }
  catch (error) { if (hasErrorCode(error, 'ENOENT')) return null; throw error; }
  if (createHash('sha256').update(bytes).digest('hex') !== reference.sha256) throw new Error(`Shared bank ${reference.kind}/${reference.sha256} differs from its content address.`);
  return bytes;
}
