import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { authoredObject } from './authored-object.mjs';
export async function loadObjectTestDefinition(id, root = process.cwd()) {
  if (await authoredObject(id, root)) return JSON.parse(await readFile(resolve(root, 'objects/preparation', id, 'runtime.json'), 'utf8'));
  return (await import(pathToFileURL(resolve(root, 'src/planets', id, 'runtime/definition.mjs')).href)).runtimeDefinition;
}
