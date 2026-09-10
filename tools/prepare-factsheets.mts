import {requireRecord,requireArray,hasErrorCode} from './source-values.mts';
import {shape,text,number,optional,array,dictionary} from './objects/terrestrial-layers/source-records.mts';
const parseSourceRef=shape({id:text,path:text,sha256:text});
const parseDescriptor=shape({id:text,properties:shape({recipe:shape({sources:array(parseSourceRef)})})});
const parseManifest=shape({inputs:array(shape({path:text,expectedBytes:number,expectedSha256:text})),documents:array(shape({path:text,expectedBytes:number,expectedSha256:text})),generatedIntermediates:array(shape({path:text,expectedBytes:number,expectedSha256:text}))});
const parseLens=(value:unknown)=>Object.assign({},requireRecord(value),shape({id:text,label:text})(value));
const parseLenses=(value:unknown)=>Object.assign({},requireRecord(value),shape({labels:optional(dictionary(text)),controls:array(parseLens)})(value));
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { OBJECTS } from '../site/objects.mts';
import { orderFacts } from '../site/fact-order.mts';
import { prepareLensLabels } from '../site/prepare-lens-labels.mts';
import { writePreparedText } from './write-prepared-text.mts';
import { verifyFactsheetSources } from './factsheet-sources.mts';

const hash = (bytes:Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Re-publish authored facts without rebaking imagery or changing scene state. */
export async function prepareFactsheet(objectDirectory:string, { check = false, editorial = false } = {}) {
  const read = async (file:string) => requireRecord(JSON.parse(await readFile(resolve(objectDirectory, file), 'utf8')));
  const descriptor = parseDescriptor(await read('object.json'));
  const reference = descriptor.properties.recipe.sources.find(source => source.id === 'content');
  assert.ok(reference, `${descriptor.id}: missing authored content`);
  const bytes = await readFile(resolve(objectDirectory, reference.path));
  assert.equal(hash(bytes), reference.sha256, `${descriptor.id}: content source pin differs`);
  const manifest = parseManifest(await read('source/manifest.json'));
  const entry = [...manifest.inputs, ...manifest.documents, ...manifest.generatedIntermediates]
    .find(source => `source/${source.path}` === reference.path);
  assert.ok(entry, `${descriptor.id}: content source missing from manifest`);
  assert.equal(entry.expectedSha256, reference.sha256);
  assert.equal(entry.expectedBytes, bytes.length);
  const source = requireRecord(JSON.parse(bytes.toString('utf8')));
  const panel = requireRecord(source.panel);
  const { facts, moreFacts } = await verifyFactsheetSources(panel, { objectDirectory, manifest });
  const ordered = orderFacts(facts, moreFacts);
  const content = await read('prepared/content.json');
  assert.equal(content.objectId, descriptor.id);
  if (!editorial) assert.equal(content.introduction, panel.introduction,
    `${descriptor.id}: introduction changed; use --editorial or full content preparation`);
  const publish = async (path:string, value:unknown) => {
    if (check) assert.deepEqual(await read(path), value, `${descriptor.id}: stale ${path}`);
    else {
      const original = await readFile(resolve(objectDirectory, path), 'utf8');
      await writePreparedText(resolve(objectDirectory, path), `${JSON.stringify(value, null, original.startsWith('{\n') ? 2 : 0)}\n`);
    }
  };
  const introduction = editorial ? text(panel.introduction) : content.introduction;
  await publish('prepared/content.json', { ...content, introduction, facts, moreFacts,
    ...(source.provenance ? { provenance: source.provenance } : {}) });
  try {
    const panel = await read('prepared/panel.json');
    await publish('prepared/panel.json', { ...panel, ...(editorial ? { introduction } : {}), facts, moreFacts });
  } catch (error) { if (!hasErrorCode(error,'ENOENT')) throw error; }
  if (editorial) {
    // Only prose/labels: imagery, legends, numeric data and runtime geometry still
    // belong to full preparation. Use the same label formatter as that owner.
    const isStatic = source.schema === 'cssearth-static-surface-content@1';
    const authored = parseLenses(isStatic ? requireRecord(source.controls).lenses : source.lenses);
    const labeled = authored.labels ? prepareLensLabels(authored, authored.labels) : authored;
    const updateControls = (values:unknown) => {
      const controls=requireArray(values).map(parseLens);
      assert.deepEqual(controls.map(l => l.id), labeled.controls.map(l => l.id),
        `${descriptor.id}: changed lens inventory requires full preparation`);
      return controls.map(lens => {
        const text = labeled.controls.find(l => l.id === lens.id);
        assert.ok(text, `${descriptor.id}: missing authored lens ${lens.id}`);
        const next = { ...lens };
        for (const key of ['label', 'description', 'summary', 'title', 'detail']) {
          if (text[key] !== undefined) next[key] = text[key]; else delete next[key];
        }
        if ('qualification' in lens) next.qualification = text.qualification;
        return next;
      });
    };
    const controls = await read('prepared/controls.json');
    await publish('prepared/controls.json', { ...controls,
      lenses: { ...requireRecord(controls.lenses), controls: updateControls(requireRecord(controls.lenses).controls) } });
    const runtime = await read('prepared/runtime.json');
    await publish('prepared/runtime.json', { ...runtime, controls: { ...requireRecord(runtime.controls),
      lenses: { ...requireRecord(requireRecord(runtime.controls).lenses), controls: updateControls(requireRecord(requireRecord(runtime.controls).lenses).controls) } } });
    if (!isStatic) {
      const lenses = await read('prepared/lenses.json');
      await publish('prepared/lenses.json', { ...lenses, controls: updateControls(lenses.controls) });
    }
  }
  for (const path of ['prepared/authored-preparation.json', 'prepared/world-navigation.json']) {
    try {
      const receipt = await read(path);
      await publish(path, { ...receipt,
        sources: requireArray(receipt.sources).map(value => {const source=requireRecord(value);return source.id === 'content' ? { ...reference } : source;}) });
    } catch (error) { if (!hasErrorCode(error,'ENOENT')) throw error; }
  }
  return { id: descriptor.id, count: ordered.length, preview: ordered.slice(0, 4).map(fact => fact.id) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const check = process.argv.includes('--check');
  const editorial = process.argv.includes('--editorial');
  const ids = process.argv.slice(2).filter(id => !['--', '--check', '--editorial'].includes(id));
  assert.ok(ids.every(id => OBJECTS.some(object => object.id === id)), 'Unregistered factsheet target');
  const results = [];
  for (const object of OBJECTS) if (!ids.length || ids.includes(object.id)) {
    results.push(await prepareFactsheet(resolve(import.meta.dirname, '../src/planets', object.id), { check, editorial }));
  }
  console.log(JSON.stringify({ check, objects: results.length, facts: results.reduce((sum, body) => sum + body.count, 0), results }));
}
