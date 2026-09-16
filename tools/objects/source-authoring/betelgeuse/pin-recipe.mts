#!/usr/bin/env node
/** Refresh the sha256 pins of an object's recipe sources from the files on disk. Usage: node pin-recipe.mts <object-id> */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const id = process.argv[2];
if (!id) throw new TypeError('Usage: pin-recipe <object-id>');
const directory = resolve(process.cwd(), 'src/objects', id), path = resolve(directory, 'object.json');
const descriptor = JSON.parse(await readFile(path, 'utf8'));
for (const source of descriptor.properties.recipe.sources) {
  const bytes = await readFile(resolve(directory, source.path));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (source.sha256 !== sha256) { console.log(`${source.id}: ${source.sha256 || '(unpinned)'} -> ${sha256}`); source.sha256 = sha256; }
}
await writeFile(path, `${JSON.stringify(descriptor, null, 2)}\n`);
