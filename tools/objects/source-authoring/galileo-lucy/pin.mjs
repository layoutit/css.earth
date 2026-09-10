import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { bodies } from './catalog.mjs';
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const write = async (p, value) => writeFile(p, JSON.stringify(value, null, 2) + '\n');
const pin = bytes => ({ expectedBytes: bytes.length, expectedSha256: createHash('sha256').update(bytes).digest('hex') });
for (const { id } of bodies) {
  const p = resolve('src/planets', id), s = resolve(p, 'source'), manifest = await read(resolve(s, 'manifest.json'));
  const exclude = new Set(['manifest.json', ...manifest.inputs.map(x => x.path), ...manifest.generatedIntermediates.map(x => x.path)]);
  const documents = [];
  async function walk(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (entry.isDirectory()) await walk(resolve(dir, entry.name), path + '/');
      else if (!exclude.has(path)) documents.push({ path, ...pin(await readFile(resolve(dir, entry.name))), purpose: 'Source evidence or authored preparation input.' });
    }
  }
  await walk(s); manifest.documents = documents.sort((a, b) => a.path.localeCompare(b.path)); await write(resolve(s, 'manifest.json'), manifest);
  const descriptor = await read(resolve(p, 'object.json'));
  for (const source of descriptor.properties.recipe.sources) source.sha256 = pin(await readFile(resolve(p, source.path))).expectedSha256;
  await write(resolve(p, 'object.json'), descriptor);
}
