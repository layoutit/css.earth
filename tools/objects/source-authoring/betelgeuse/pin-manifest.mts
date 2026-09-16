#!/usr/bin/env node
/** Refresh expectedBytes and expectedSha256 of every manifest entry from the files on disk. Usage: node pin-manifest.mts <object-id> */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const id = process.argv[2];
if (!id) throw new TypeError('Usage: pin-manifest <object-id>');
const root = resolve(process.cwd(), 'src/objects', id, 'source'), path = resolve(root, 'manifest.json');
const manifest = JSON.parse(await readFile(path, 'utf8'));
for (const list of ['inputs', 'generatedIntermediates', 'documents']) {
  for (const entry of manifest[list]) {
    const bytes = await readFile(resolve(root, entry.path)), sha256 = createHash('sha256').update(bytes).digest('hex');
    if (entry.expectedBytes !== bytes.length || entry.expectedSha256 !== sha256) { console.log(`${entry.path}: repinned`); entry.expectedBytes = bytes.length; entry.expectedSha256 = sha256; }
  }
}
await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
