import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

/** Server/build-only metadata read. Scene trees remain separate runtime assets. */
export async function readPreparedObjectBytes(id, root = process.cwd()) {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object page identity.');
  const directory = resolve(root, 'src/planets', id);
  const descriptor = JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8'));
  if (descriptor.id !== id || descriptor.prepared?.url !== 'prepared/object.json') {
    throw new TypeError(`${id}: invalid prepared page reference.`);
  }
  const bytes = await readFile(resolve(directory, 'prepared/object.json'));
  if (createHash('sha256').update(bytes).digest('hex') !== descriptor.prepared.sha256) {
    throw new Error(`${id}: prepared page data differs from its descriptor pin.`);
  }
  return { descriptor, bytes };
}

export async function loadObjectPageData(id, root = process.cwd()) {
  const { bytes } = await readPreparedObjectBytes(id, root);
  const object = JSON.parse(bytes);
  if (object.schema !== 'cssearth-prepared-object@1' || object.id !== id ||
      !object.data?.assets || !object.data.controls) {
    throw new TypeError(`${id}: incomplete prepared page data.`);
  }
  return { assets: object.data.assets, controls: object.data.controls };
}
