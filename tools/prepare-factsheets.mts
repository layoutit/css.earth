import { sha256 } from '../src/platform/sha256.mts';
import {requireRecord,requireArray,hasErrorCode} from './source-values.mts';
import {shape,text,number,array} from './objects/terrestrial-layers/source-records.mts';
const parseSourceRef=shape({id:text,path:text});
const parseDescriptor=shape({id:text,properties:shape({recipe:shape({sources:array(parseSourceRef)})})});
const parseManifest=shape({inputs:array(shape({path:text,expectedBytes:number,expectedSha256:text})),documents:array(shape({path:text,expectedBytes:number,expectedSha256:text})),generatedIntermediates:array(shape({path:text,expectedBytes:number,expectedSha256:text}))});
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCENE_OBJECTS } from '../site/objects.mts';
import { orderFacts } from '../site/fact-order.mts';
import { writePreparedText } from './write-prepared-text.mts';
import { verifyFactsheetSources } from './factsheet-sources.mts';


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
  assert.equal(sha256(bytes), entry.expectedSha256, `${descriptor.id}: content source pin differs`);
  assert.equal(entry.expectedBytes, bytes.length);
  const source = requireRecord(JSON.parse(bytes.toString('utf8')));
  const panel = requireRecord(source.panel);
  const { facts, moreFacts } = await verifyFactsheetSources(panel, { objectDirectory, manifest });
  const ordered = orderFacts(facts, moreFacts);
  const content = await read('prepared/content.json');
  assert.equal(content.objectId, descriptor.id);
  const publish = async (path:string, value:unknown) => {
    if (check) assert.deepEqual(await read(path), value, `${descriptor.id}: stale ${path}`);
    else {
      const original = await readFile(resolve(objectDirectory, path), 'utf8');
      await writePreparedText(resolve(objectDirectory, path), `${JSON.stringify(value, null, original.startsWith('{\n') ? 2 : 0)}\n`);
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
        sources: requireArray(receipt.sources).map(value => {const source=requireRecord(value);return source.id === 'content' ? { id: reference.id, path: reference.path, sha256: entry.expectedSha256 } : source;}) });
    } catch (error) { if (!hasErrorCode(error,'ENOENT')) throw error; }
  }
  return { id: descriptor.id, count: ordered.length, preview: ordered.slice(0, 4).map(fact => fact.id) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const check = process.argv.includes('--check');
  const ids = process.argv.slice(2).filter(id => !['--', '--check'].includes(id));
  assert.ok(ids.every(id => SCENE_OBJECTS.some(object => object.id === id)), 'Unregistered factsheet target');
  const results = [];
  for (const object of SCENE_OBJECTS) if (!ids.length || ids.includes(object.id)) {
    results.push(await prepareFactsheet(resolve(import.meta.dirname, '../src/objects', object.id), { check }));
  }
  console.log(JSON.stringify({ check, objects: results.length, facts: results.reduce((sum, body) => sum + body.count, 0), results }));
}
