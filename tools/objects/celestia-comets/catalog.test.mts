import { required, fixtureRecord } from '../../test-values.mts';
import { requireArray } from '../../source-values.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {candidates,readCatalog,preserved,sourceRoot,upstream} from './catalog.mts';


test('pinned upstream files and inventory retain their identities and license',()=>{
 for(const f of upstream.files){const b=readFileSync(new URL(f.path,sourceRoot));assert.equal(b.length,f.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256);}
 const records=readCatalog();assert.equal(records.length,23);assert.equal(candidates.length,20);
 assert.deepEqual(records.filter(r=>!candidates.some(c=>c.id===r.id)).map(r=>r.id).sort(),[...preserved].sort());
 assert.ok(candidates.every(c=>['asteroid.cms','roughsphere.cms'].includes(c.mesh)));
 assert.equal(required(records.find(r=>r.id==='comet-c2014-un271')).designation,'C/2014 UN271');
 assert.ok(readFileSync(new URL('comets.ssc',sourceRoot),'utf8').includes('SPDX-License-Identifier: GPL-2.0-or-later'));
});

test('packages use the native Celestia mesh, with only physical scaling',()=>{
 for(const c of candidates){
  const root=`src/planets/${c.id}/source/`,model=JSON.parse(readFileSync(root+'shape/model.json', 'utf8'));
  assert.equal(model.catalogRadiusKm,c.radiusKm);assert.equal(model.source,c.mesh);assert.equal(model.illustrative,true);
  const native=readFileSync(new URL(`meshes/${c.mesh.replace('.cms','')}.obj`,sourceRoot),'utf8');
  const expected=native.split('\n').map(line=>line.startsWith('v ')?'v '+line.slice(2).split(' ').map(Number).map(v=>v*(c.radiusKm*1000)).join(' '):line).join('\n');
  assert.equal(readFileSync(root+'shape/model.obj','utf8'),expected);
  assert.equal(readFileSync(root+'shape/'+c.mesh,'utf8'),readFileSync(new URL(c.mesh,sourceRoot),'utf8'));
  const content=JSON.parse(readFileSync(root+'content/object.json', 'utf8'));assert.equal(content.lenses.controls.length,1);
  assert.equal(content.lenses.controls[0].detail,'Celestia');assert.equal(content.panel.facts.length,2);
  for(const control of requireArray(content.settings.controls).map(value=>fixtureRecord(value)).filter(c=>['shadows','orbit'].includes(String(c.name))))assert.equal(control.checked,false);
  assert.equal(JSON.parse(readFileSync(root+'preparation/rotation.json', 'utf8')).phase,'arbitrary-display-phase');
 }
});

test('native source closure and shared model exports retain exact hashes',()=>{
 const code=JSON.parse(readFileSync(new URL('../native/upstream.json',sourceRoot), 'utf8'));
 for(const f of code.files){const b=readFileSync(new URL('../native/'+f.path,sourceRoot));assert.equal(b.length,f.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256);}
 for(const mesh of ['asteroid','roughsphere']){
  const report=JSON.parse(readFileSync(new URL(`meshes/${mesh}.json`,sourceRoot), 'utf8'));
  for(const [extension,key] of [['obj','objSha256'],['native.json','nativeSha256']])assert.equal(createHash('sha256').update(readFileSync(new URL(`meshes/${mesh}.${extension}`,sourceRoot))).digest('hex'),report[key]);
  assert.equal(report.vertices,4802);assert.equal(report.faces,9600);assert.equal(report.repeatNativeExportIdentical,true);assert.ok(report.maximumWeldError<1e-5);
 }
});
