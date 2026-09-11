import assert from 'node:assert/strict';
import test from 'node:test';
import {pagePlanFixture} from './page-plan-fixture.mts';
import {PREPARED_EARTH_SCENE} from './prepared-fixture.mts';
import {prepareWmtsTile,wmtsAddress} from '../../../../tools/objects/geographic-pages/wmts-page-geometry.mts';

test('transport fixtures validate real prepared geometry and preserve explicit topology only',()=>{
  const roots=prepareWmtsTile(wmtsAddress(-58,-34,12),PREPARED_EARTH_SCENE);
  const plan=pagePlanFixture({roots});
  assert.deepEqual(plan.roots,roots);
  assert.equal(plan.topology,undefined);
  assert.equal(plan.geometryOrigin,undefined);
  const grouped=pagePlanFixture({roots,topology:'wmts-quadtree@1',geometryVersion:'1111111111111111'});
  assert.equal(grouped.topology,'wmts-quadtree@1');
  assert.equal(grouped.geometryVersion,'1111111111111111');
  assert.throws(()=>pagePlanFixture({roots,poolSize:0}),/Invalid prepared/);
  assert.throws(()=>pagePlanFixture({roots:[{...roots[0],corners:[[1,2]]}]}),/Invalid prepared page root/);
});
