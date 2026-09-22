import { requireRecord } from '../sources/source-values.mts';
import { refreshSourceScenePins } from '../prepared/prepared-page-metadata.mts';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { SCENE_OBJECTS } from '../../site/objects.mts';
import { parsePreparedObjectRuntime } from '../../src/renderers/css/dist/index.js';
import { preparePresentationBindings } from '../prepared/prepared-presentation-bindings.mts';
import { repinObjectJson } from './prepare-object-json.mts';

/** Refresh only fill metadata, reading existing local images. No surface,
 * texture, lighting, geometry, motion, facing or depth bank is rebuilt. */
export async function prepareInteriorFills(ids: readonly string[], root = process.cwd()) {
  if (!ids.length || ids.some(id => !SCENE_OBJECTS.some(object => object.id === id))) throw new Error('Choose registered scene objects.');
  const selected: string[] = [];
  for (const id of ids) {
    const descriptor = requireRecord(JSON.parse(await readFile(resolve(root, 'src/objects', id, 'object.json'), 'utf8')));
    const shape = requireRecord(requireRecord(requireRecord(descriptor.properties).recipe).shape);
    if (shape.kind === 'sphere' || shape.kind === 'ellipsoid') selected.push(id);
    else console.log(JSON.stringify({ id, status: 'excluded-irregular' }));
  }
  const before = new Map<string, string>();
  for (const id of selected) for (const suffix of ['object.json', 'prepared/page.json']) {
    const path = `src/objects/${id}/${suffix}`; before.set(path, await readFile(resolve(root, path), 'utf8'));
  }
  const browser = await chromium.launch({ headless: true });
  try {
    for (const id of selected) {
      const path = resolve(root, 'src/objects', id, 'prepared/runtime.json');
      const original = parsePreparedObjectRuntime(JSON.parse(await readFile(path, 'utf8')));
      const prepared = await preparePresentationBindings(original, root, { interiorOnly: true, browser });
      parsePreparedObjectRuntime(prepared);
      const fill = prepared.viewBindings.find(binding => binding.kind === 'interior-disc');
      if (!fill) { console.log(JSON.stringify({ id, status: 'no-safe-interior' })); continue; }
      await writeFile(path, JSON.stringify(prepared)+'\n');
      await repinObjectJson(id, root);
      console.log(JSON.stringify({ id, status: 'prepared', fill }));
    }
  } finally { await browser.close(); await refreshSourceScenePins(before, root); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  await prepareInteriorFills(args.includes('--all') ? SCENE_OBJECTS.map(object => object.id) : args);
}
