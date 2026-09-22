import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createSurfaceInterpreter } from './interpret.mts';

const bytes = Buffer.from('pinned');
const pin = (path: string) => ({path});
const input = (path: string, consumers: string[]) => ({...pin(path), id: path, origin: 'https://example.test/'+path,
  credit: 'Fixture', license: 'Fixture', acquisition: 'Fixture', redistribution: 'Fixture',
  sourceBinding: {kind: 'local', reason: 'Authored test fixture'}, consumers});

test('selected surface verification skips unrelated sources but rejects changed selected bytes', async t => {
  const sourceDirectory = await mkdtemp(join(tmpdir(), 'cssearth-selected-source-'));
  t.after(() => rm(sourceDirectory, {recursive:true, force:true}));
  await writeFile(join(sourceDirectory, 'map'), bytes);
  await writeFile(join(sourceDirectory, 'manifest.json'), JSON.stringify({schema:'cssfixture-authoritative-sources@2',
    inputs:[input('map',['selected']),input('unrelated',['other'])],generatedIntermediates:[],documents:[]}));
  const options = {objectId:'fixture',displayName:'Fixture',sourceDirectory,recipe:{surfaces:[{id:'selected',source:'map'}]}};
  await createSurfaceInterpreter({...options,sourceVerification:'selected-surfaces'});
  await assert.rejects(createSurfaceInterpreter(options), /Missing: unrelated/);
  await writeFile(join(sourceDirectory, 'map'), Buffer.from('broken'));
  await assert.rejects(createSurfaceInterpreter({...options,sourceVerification:'selected-surfaces'}), /hash drifted/);
});

test('selected scientific labels remain pinned and photographic refresh stays restricted', async t => {
  const sourceDirectory = await mkdtemp(join(tmpdir(), 'cssearth-selected-label-'));
  t.after(() => rm(sourceDirectory, {recursive:true, force:true}));
  await writeFile(join(sourceDirectory, 'map'), bytes);
  await writeFile(join(sourceDirectory, 'manifest.json'), JSON.stringify({schema:'cssfixture-authoritative-sources@2',
    inputs:[input('map',['selected'])],generatedIntermediates:[],documents:[pin('label')]}));
  const options = {objectId:'fixture',displayName:'Fixture',sourceDirectory,recipe:{surfaces:[{id:'selected',source:'map',science:{scientific:{labelPath:'label'}}}]}};
  await assert.rejects(createSurfaceInterpreter({...options,sourceVerification:'selected-surfaces'}), /ENOENT/);
  await writeFile(join(sourceDirectory, 'label'), bytes);
  await createSurfaceInterpreter({...options,sourceVerification:'selected-surfaces'});
  await assert.rejects(createSurfaceInterpreter({...options,sourceVerification:'photographs'}), /cannot reprepare scientific/);
});

test('selected mosaic decoding still verifies every declared group member', async t => {
  const sourceDirectory = await mkdtemp(join(tmpdir(), 'cssearth-selected-group-'));
  t.after(() => rm(sourceDirectory, {recursive:true, force:true}));
  await writeFile(join(sourceDirectory, 'map'), bytes);
  await writeFile(join(sourceDirectory, 'manifest.json'), JSON.stringify({schema:'cssfixture-authoritative-sources@2',
    inputs:[input('map',['frames']),input('second-frame',['frames'])],generatedIntermediates:[],documents:[]}));
  const surface = {id:'selected',source:'map',science:{kind:'terrestrial-mosaic',format:'pds3-byte-equirectangular',consumer:'frames'}};
  const interpret = await createSurfaceInterpreter({objectId:'fixture',displayName:'Fixture',sourceDirectory,recipe:{surfaces:[surface]},sourceVerification:'selected-surfaces'});
  await assert.rejects(interpret(surface, 4, 2, 1), /ENOENT/);
});
