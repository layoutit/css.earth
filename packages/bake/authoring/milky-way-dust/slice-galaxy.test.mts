import assert from 'node:assert/strict';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { mock, test } from 'node:test';

mock.module('./galaxy-python.mts', { namedExports: { runGalaxyPython: () => {} } });
const { main } = await import('./slice-galaxy.mts');

test('a Python exit without new slab output cannot install the previous bake as fresh output', async () => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'galaxy-slices-no-op-'));
  const original = new URL('../../../../src/objects/milky-way-volume/', import.meta.url);
  const prepared = resolve(fixture, 'prepared');
  mkdirSync(resolve(prepared, 'b30-slices'), { recursive: true });
  copyFileSync(new URL('object.json', original), resolve(fixture, 'object.json'));
  copyFileSync(new URL('prepared/volume.json', original), resolve(prepared, 'volume.json'));
  copyFileSync(new URL('./fixtures/galaxy-slice-replay/prototype.json',import.meta.url), resolve(prepared, 'b30-slices/prototype.json'));
  const before = readFileSync(resolve(prepared, 'volume.json'));
  writeFileSync(resolve(fixture, 'fit.json'), '{}');
  try {
    await assert.rejects(main([fixture, `--field=${fixture}`, `--fit=${resolve(fixture, 'fit.json')}`]),
      error => error instanceof Error && /b30-slices-bake-[^/]+\/prototype\.json/u.test(error.message),
      'the missing fresh prototype, rather than any later missing input, must stop the installation');
    assert.ok(readFileSync(resolve(prepared, 'volume.json')).equals(before));
    assert.deepEqual(readdirSync(prepared).sort(), ['b30-slices', 'volume.json']);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('requesting outside installation cannot reuse a NASA-exposed bank', async () => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'galaxy-outside-reuse-'));
  const original = new URL('../../../../src/objects/milky-way-volume/', import.meta.url);
  mkdirSync(resolve(fixture, 'prepared'), { recursive: true });
  copyFileSync(new URL('object.json', original), resolve(fixture, 'object.json'));
  copyFileSync(new URL('prepared/volume.json', original), resolve(fixture, 'prepared/volume.json'));
  writeFileSync(resolve(fixture, 'prototype.json'), JSON.stringify({
    bakeControls: { mode: 'nasa-display', displayScale: 1 }, completedImageOpacity: .12,
  }));
  const before = readFileSync(resolve(fixture, 'prepared/volume.json'));
  try {
    await assert.rejects(main([fixture, `--reuse=${fixture}`, '--mode=outside-display', '--local-only']), /fixed face-exposed bank/u);
    assert.ok(readFileSync(resolve(fixture, 'prepared/volume.json')).equals(before));
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('outside installation refuses a historical column-attributed bank at the same exposure', async () => {
  const { GALAXY_OUTSIDE_DISPLAY_SCALE } = await import('./galaxy-outside-display.mts');
  const fixture = mkdtempSync(resolve(tmpdir(), 'galaxy-column-reuse-'));
  const original = new URL('../../../../src/objects/milky-way-volume/', import.meta.url);
  mkdirSync(resolve(fixture, 'prepared'), { recursive: true });
  copyFileSync(new URL('object.json', original), resolve(fixture, 'object.json'));
  copyFileSync(new URL('prepared/volume.json', original), resolve(fixture, 'prepared/volume.json'));
  writeFileSync(resolve(fixture, 'prototype.json'), JSON.stringify({
    bakeControls: { mode: 'outside-display', displayScale: GALAXY_OUTSIDE_DISPLAY_SCALE }, completedImageOpacity: 1,
  }));
  const before = readFileSync(resolve(fixture, 'prepared/volume.json'));
  try {
    await assert.rejects(main([fixture, `--reuse=${fixture}`, '--mode=outside-display', '--local-only']), /slab-local transfer/u);
    assert.ok(readFileSync(resolve(fixture, 'prepared/volume.json')).equals(before));
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('installing an unchanged completed-image opacity preserves every tuner byte',async()=>{
 const dir=mkdtempSync(resolve(tmpdir(),'galaxy-tuner-preserve-')),original=resolve('src/objects/milky-way-volume');
 try{
  mkdirSync(dir+'/prepared/galaxy-stations',{recursive:true});
  copyFileSync(original+'/object.json',dir+'/object.json');
  copyFileSync(original+'/prepared/volume.json',dir+'/prepared/volume.json');
  const tuner=readFileSync(original+'/prepared/galaxy-stations/tuner.json','utf8').trimEnd();
  writeFileSync(dir+'/prepared/galaxy-stations/tuner.json',tuner);
  writeFileSync(dir+'/frame.json',JSON.stringify({frame:JSON.parse(readFileSync(original+'/source/preparation/b30/frame.json','utf8'))}));
  cpSync(new URL('./fixtures/galaxy-slice-replay/',import.meta.url),dir+'/slabs',{recursive:true});
  const prototype=JSON.parse(readFileSync(dir+'/slabs/prototype.json','utf8'));prototype.field.record='runs/b30-native-scatterFaceSide/fit-crisp.json';
  writeFileSync(dir+'/slabs/prototype.json',JSON.stringify(prototype));
  await main([dir,'--reuse='+dir+'/slabs','--frame='+dir+'/frame.json','--mode=outside-display','--counts=26,26,26','--local-only']);
  assert.equal(readFileSync(dir+'/prepared/galaxy-stations/tuner.json','utf8'),tuner);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
