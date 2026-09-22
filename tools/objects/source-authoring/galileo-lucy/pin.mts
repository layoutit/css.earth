import { sha256 } from '../../../../src/platform/sha256.mts';
import {refreshSourceRecord} from '../../../sources/source-authoring-templates.mts';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseAuthoringManifest, parseAuthoringDescriptor } from '../../../sources/source-authoring-templates.mts';
import { bodies } from './catalog.mts';
const read = async (p: string): Promise<unknown> => JSON.parse(await readFile(p, 'utf8'));
const write = async (p: string, value: unknown) => writeFile(p, JSON.stringify(value, null, 2) + '\n');
const pin = (bytes: Uint8Array) => ({ expectedBytes: bytes.length, expectedSha256: sha256(bytes) });
for (const { id } of bodies) {
  const p = resolve('src/objects', id), s = resolve(p, 'source'), manifest = parseAuthoringManifest(await read(resolve(s, 'manifest.json')));
  const exclude = new Set(['manifest.json', ...manifest.inputs.map(x => x.path), ...manifest.generatedIntermediates.map(x => x.path)]);
  const documents: { path: string; expectedBytes: number; expectedSha256: string }[] = [];
  async function walk(dir: string, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (entry.isDirectory()) await walk(resolve(dir, entry.name), path + '/');
      else if (!exclude.has(path)) documents.push(refreshSourceRecord(manifest.documents,{path, ...pin(await readFile(resolve(dir, entry.name)))}));
    }
  }
  await walk(s); manifest.documents = documents.sort((a, b) => a.path.localeCompare(b.path)); await write(resolve(s, 'manifest.json'), manifest);
}
