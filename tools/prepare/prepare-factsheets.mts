import { refuseDirectRun } from '../cli/library-entry.mts';
import { sha256 } from '@cssearth/core/node';
import {requireRecord,requireArray,hasErrorCode,shape,text,number,array,optional} from '@cssearth/core';
const parseSourceRef=shape({id:text,path:text});
const parseDescriptor=shape({id:text,properties:shape({recipe:shape({sources:array(parseSourceRef)})})});
const entry_=shape({path:text});
const parseManifest=shape({inputs:array(entry_),documents:array(entry_),generatedIntermediates:array(entry_)});
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { orderFacts } from '@cssearth/objects';
import { writePreparedText } from '@cssearth/bake/delivery';
import { verifyFactsheetSources } from '../sources/factsheet-sources.mts';
import { refreshPreparedInventory } from './prepare-object-json.mts';
import { readPreparedObjects } from '@cssearth/objects/node';

const SCENE_OBJECTS = readPreparedObjects(resolve(import.meta.dirname, '../..')).sceneObjects;


/** Re-publish authored facts without rebaking imagery or changing scene state. Reader text has its own publisher, prepare-text. */
export async function prepareFactsheet(objectDirectory:string, { check = false } = {}) {
  const read = async (file:string) => requireRecord(JSON.parse(await readFile(resolve(objectDirectory, file), 'utf8')));
  const descriptor = parseDescriptor(await read('object.json'));
  const reference = descriptor.properties.recipe.sources.find(source => source.id === 'content');
  assert.ok(reference, `${descriptor.id}: missing authored content`);
  const bytes = await readFile(resolve(objectDirectory, reference.path));
  const manifest = parseManifest(await read('source/manifest.json'));
  const entry = [...manifest.inputs, ...manifest.documents, ...manifest.generatedIntermediates]
    .find(source => `source/${source.path}` === reference.path);
  assert.ok(entry, `${descriptor.id}: content source missing from manifest`);
  const source = requireRecord(JSON.parse(bytes.toString('utf8')));
  const panel = requireRecord(source.panel);
  const { facts, moreFacts } = await verifyFactsheetSources(panel, { objectDirectory, manifest });
  const ordered = orderFacts(facts, moreFacts);
  const content = await read('prepared/content.json');
  assert.equal(content.objectId, descriptor.id);
  let written = false;
  const publish = async (path:string, value:unknown) => {
    if (check) assert.deepEqual(await read(path), value, `${descriptor.id}: stale ${path}`);
    else {
      const original = await readFile(resolve(objectDirectory, path), 'utf8');
      if (await writePreparedText(resolve(objectDirectory, path), `${JSON.stringify(value, null, original.startsWith('{\n') ? 2 : 0)}\n`)) written = true;
    }
  };
  await publish('prepared/content.json', { ...content, facts, moreFacts,
    ...(source.provenance ? { provenance: source.provenance } : {}) });
  try {
    const panel = await read('prepared/panel.json');
    await publish('prepared/panel.json', { ...panel, facts, moreFacts });
  } catch (error) { if (!hasErrorCode(error,'ENOENT')) throw error; }
  for (const path of ['prepared/authored-preparation.json']) {
    try {
      const receipt = await read(path);
      await publish(path, { ...receipt,
        sources: requireArray(receipt.sources).map(value => {const source=requireRecord(value);return source.id === 'content' && source.sha256 !== undefined ? { ...source, sha256: sha256(bytes) } : source;}) });
    } catch (error) { if (!hasErrorCode(error,'ENOENT')) throw error; }
  }
  // Nothing under prepared/ is tracked: a changed fact panel is recorded by the inventory and still has to be published.
  if (written) await refreshPreparedInventory(descriptor.id, resolve(objectDirectory, '../../..'));
  return { id: descriptor.id, count: ordered.length, preview: ordered.slice(0, 4).map(fact => fact.id) };
}

/** Re-publish the facts of the named registered objects, or of every one when `ids` is empty. */
export async function prepareFactsheets({ ids = [] as readonly string[], check = false } = {}) {
  assert.ok(ids.every(id => SCENE_OBJECTS.some(object => object.id === id)), 'Unregistered factsheet target');
  const results = [];
  for (const object of SCENE_OBJECTS) if (!ids.length || ids.includes(object.id)) {
    results.push(await prepareFactsheet(resolve(import.meta.dirname, '../../src/objects', object.id), { check }));
  }
  return results;
}

refuseDirectRun(import.meta);
