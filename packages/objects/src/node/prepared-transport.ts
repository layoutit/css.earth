import { PREPARED_OBJECT_SCHEMA } from '../descriptor.js';
import { OBJECT_PAGE_SCHEMA } from '../prepared-data/object-page-schema.js';
// A scene body's transports, built from its restored `prepared/runtime.json` when read. The descriptor names them
// `prepared/object.json` and `prepared/page.json`, the paths the site serves (`/objects/<id>/object.json`), but no copy is
// written to disk: rewriting 1.18 GB of runtimes into near-identical files cost every dev start and deploy about 40 s.
import { open, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isRecord, requireRecord } from '@cssearth/core';

const HEAD_BYTES = 65536;

/** The top-level fields `keys` of the JSON object in the file at `path`, read from its start: the scan stops once every
 * key is read, so a field near the head of a large file costs a few kilobytes. A file whose head does not hold them is
 * read further, up to the whole file. A key the object lacks is absent from the result. */
export async function readJsonHead(path: string, keys: readonly string[]): Promise<Record<string, unknown>> {
  const handle = await open(path);
  try {
    const size = (await handle.stat()).size;
    for (let length = Math.min(size, HEAD_BYTES); ; length = Math.min(size, length * 4)) {
      const { buffer, bytesRead } = await handle.read({ buffer: Buffer.alloc(length), position: 0 });
      const found = scanHead(buffer.toString('utf8', 0, bytesRead), keys);
      if (found) return found;
      if (length === size) throw new TypeError(`${path}: not a JSON object.`);
    }
  } finally { await handle.close(); }
}

/** The wanted fields, or null when `text` ends before they are all read. */
function scanHead(text: string, keys: readonly string[]): Record<string, unknown> | null {
  const wanted = new Set(keys), found: Record<string, unknown> = {};
  let index = skipSpace(text, 0);
  if (text[index] !== '{') throw new TypeError('A prepared transport must be a JSON object.');
  index = skipSpace(text, index + 1);
  while (wanted.size) {
    if (index >= text.length) return null;
    if (text[index] === '}') return found;
    const keyEnd = stringEnd(text, index);
    if (keyEnd < 0) return null;
    const key = JSON.parse(text.slice(index, keyEnd)) as string;
    index = skipSpace(text, keyEnd);
    if (text[index] !== ':') throw new TypeError('A prepared transport has a malformed key.');
    const start = skipSpace(text, index + 1), end = valueEnd(text, start);
    if (end < 0) return null;
    if (wanted.delete(key)) found[key] = JSON.parse(text.slice(start, end));
    index = skipSpace(text, end);
    if (text[index] === ',') index = skipSpace(text, index + 1);
  }
  return found;
}

const skipSpace = (text: string, index: number) => { while (index < text.length && /\s/u.test(text[index]!)) index++; return index; };

/** The index after the JSON string that starts at `index`, or -1 when the text ends first. */
function stringEnd(text: string, index: number) {
  for (let at = index + 1; at < text.length; at++) {
    if (text[at] === '\\') at++;
    else if (text[at] === '"') return at + 1;
  }
  return -1;
}

/** The index after the JSON value that starts at `index`, or -1 when the text ends first. */
function valueEnd(text: string, index: number) {
  const first = text[index];
  if (first === '"') return stringEnd(text, index);
  if (first !== '{' && first !== '[') {
    let at = index;
    while (at < text.length && !/[,}\]\s]/u.test(text[at]!)) at++;
    return at < text.length ? at : -1;
  }
  let depth = 0;
  for (let at = index; at < text.length; at++) {
    const char = text[at];
    if (char === '"') { at = stringEnd(text, at) - 1; if (at < 0) return -1; }
    else if (char === '{' || char === '[') depth++;
    else if ((char === '}' || char === ']') && --depth === 0) return at + 1;
  }
  return -1;
}

interface SceneDescriptor { readonly id: string; readonly type: string; readonly prepared?: { readonly format: string; readonly url: string } }

/** The `cssearth-prepared-object@1` transport of the scene body in `objectDirectory`, byte for byte what
 * `JSON.stringify({ schema, id, type, format, data })` gives for its runtime. */
export async function preparedObjectText(objectDirectory: string, descriptor: SceneDescriptor) {
  if (!descriptor.prepared) throw new TypeError(`${descriptor.id}: no prepared reference.`);
  return preparedObjectTransport(descriptor, (await readFile(resolve(objectDirectory, 'prepared/runtime.json'), 'utf8')).trimEnd());
}

/** The `cssearth-prepared-object@1` transport that carries `data`, the JSON text of a runtime. */
export function preparedObjectTransport(descriptor: SceneDescriptor, data: string) {
  if (!descriptor.prepared) throw new TypeError(`${descriptor.id}: no prepared reference.`);
  return `{"schema":"${PREPARED_OBJECT_SCHEMA}","id":${JSON.stringify(descriptor.id)},"type":${JSON.stringify(descriptor.type)},` +
    `"format":${JSON.stringify(descriptor.prepared.format)},"data":${data}}`;
}

/** A scene body's page data: the runtime's asset table, read from its head, and its published `prepared/controls.json`,
 * which is the runtime's controls. */
export async function preparedPageData(objectDirectory: string, id: string) {
  const { assets } = await readJsonHead(resolve(objectDirectory, 'prepared/runtime.json'), ['assets']);
  const controls: unknown = JSON.parse(await readFile(resolve(objectDirectory, 'prepared/controls.json'), 'utf8'));
  if (!isRecord(assets)) throw new TypeError(`${id}: prepared/runtime.json has no asset table.`);
  return { schema: OBJECT_PAGE_SCHEMA, id, assets, controls: requireRecord(controls, `${id} prepared controls`) };
}
