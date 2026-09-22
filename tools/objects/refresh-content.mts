#!/usr/bin/env node
/** Re-prepare only an object's prepared content record after an edit that touches nothing else (a credit, a provenance path),
 * with the content stage full preparation uses. The stage runs into a scratch folder; the tool refuses unless every other
 * prepared file the stage writes is byte-identical to the object's current one, so no lens, scene or image drifts. Pins are
 * refreshed first; provenance is recorded afterwards, per object.
 *
 *   node tools/objects/refresh-content.mts <object-id> [<object-id> ...] */
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readAuthoredSources } from './authored-sources.ts';

/** Prepared files the content stage writes that depend on lens images in the public folder, which the scratch run omits. */
const IMAGE_DERIVED = new Set(['lenses.json']);

export async function refreshContent(id: string, root = process.cwd()) {
  const objectDirectory = resolve(root, 'src/objects', id), sourceDirectory = resolve(objectDirectory, 'source'), preparedDirectory = resolve(objectDirectory, 'prepared');
  const { descriptor } = await readAuthoredSources(objectDirectory);
  const content = descriptor.recipe.sources.find(source => source.id === 'content');
  if (!content) throw new TypeError(`${id} has no content source.`);
  const { prepareObjectContentAssets } = await import(pathToFileURL(resolve(root, 'tools/objects/dist/content/prepare.js')).href) as { prepareObjectContentAssets: (context: unknown) => Promise<unknown> };
  await mkdir(resolve(root, '.local/content-refresh'), { recursive: true });
  const stage = await mkdtemp(resolve(root, '.local/content-refresh', `${id}-`));
  try {
    const output = resolve(stage, 'prepared'), publicDirectory = resolve(stage, 'public');
    await mkdir(output, { recursive: true }); await mkdir(publicDirectory, { recursive: true });
    await copyFile(resolve(preparedDirectory, 'assets.json'), resolve(output, 'assets.json')).catch(() => undefined);
    await prepareObjectContentAssets({ sourceDirectory, publicDirectory, outputDirectory: output, config: { contentPath: relative(sourceDirectory, resolve(objectDirectory, content.path)) } });
    const drift: string[] = [];
    for (const name of await readdir(output)) {
      if (name === 'assets.json' || name === 'content.json' || IMAGE_DERIVED.has(name)) continue;
      const staged = await readFile(resolve(output, name)), current = await readFile(resolve(preparedDirectory, name)).catch(() => null);
      if (!current || !staged.equals(current)) drift.push(name);
    }
    if (drift.length) throw new Error(`${id}: the content stage would also change ${drift.join(', ')}; prepare the object fully instead.`);
    const staged = await readFile(resolve(output, 'content.json')), current = await readFile(resolve(preparedDirectory, 'content.json'));
    if (staged.equals(current)) return false;
    await writeFile(resolve(preparedDirectory, 'content.json'), staged);
    return true;
  } finally { await rm(stage, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const ids = process.argv.slice(2);
  if (!ids.length || ids.some(id => !/^[a-z][a-z0-9-]*$/u.test(id))) throw new TypeError('Usage: refresh-content <object-id> [<object-id> ...]');
  const changed: string[] = [];
  for (const id of ids) if (await refreshContent(id)) changed.push(id);
  console.log(`content refreshed for ${changed.length} of ${ids.length} objects`);
  if (changed.length) {
    const run = spawnSync('node', ['tools/prepare/prepare-provenance.mts', ...changed], { stdio: 'inherit' });
    if (run.status !== 0) process.exitCode = 1;
  }
}
