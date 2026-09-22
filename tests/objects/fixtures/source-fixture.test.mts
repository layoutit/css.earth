import { sourceTest } from '../source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSourceFixtureReader,requireClosedTerrain} from './source-fixture.mts';

test('source fixtures reject malformed external quantities and retain owner recipe metadata',async()=>{
  const root=await mkdtemp(join(tmpdir(),'typed-source-fixture-'));
  try {
    await mkdir(join(root,'preparation'));
    const path=join(root,'preparation/rotation.json'),read=createSourceFixtureReader(root);
    await writeFile(path,JSON.stringify({periodHours:5,phase:'arbitrary-display-phase',source:'published'}));
    const rotation=await read('preparation/rotation.json');
    assert.equal(rotation.periodHours,5);assert.equal(Reflect.get(rotation,'source'),'published');
    await writeFile(path,JSON.stringify({periodHours:'5',phase:'arbitrary-display-phase'}));
    await assert.rejects(read('preparation/rotation.json'),/periodHours/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('closed terrain fixture requires the actual topology and numerical reduction evidence',()=>{
  const report={sourceFaces:20,removedOppositeFaces:0,estimatedErrorMeters:.5,topology:{eulerCharacteristic:2}};
  assert.equal(requireClosedTerrain({simplification:report}).simplification.topology.eulerCharacteristic,2);
  assert.throws(()=>requireClosedTerrain(null),/radial terrain/);
  assert.throws(()=>requireClosedTerrain({simplification:{...report,topology:null}}),/topology/);
  assert.throws(()=>requireClosedTerrain({simplification:{...report,estimatedErrorMeters:'0.5'}}),/estimatedErrorMeters/);
});
