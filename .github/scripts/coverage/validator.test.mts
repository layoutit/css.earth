/** Third-party harness conformance requires complete navigation and worker evidence with existing maps. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validateRawDirectory } from './validate.mts';
import { writeRaw } from './raw.mts';

test('browser contract refuses missing navigations, expected workers and referenced maps', () => {
  const tmp=fileURLToPath(new URL('../../../output/coverage/',import.meta.url));mkdirSync(tmp,{recursive:true});
  const root=mkdtempSync(resolve(tmp,'validator-'));
  try {
    const script={url:'http://127.0.0.1/a.js',source:'a.js',context:'page:navigation-1',functions:[{functionName:'',isBlockCoverage:true,ranges:[{startOffset:0,endOffset:4,count:1}]}]};
    writeFileSync(resolve(root,'a.js'),'a();');
    writeRaw(root,{version:1,kind:'browser',root,costMs:1,issues:[],scripts:[script]});
    const audit=(workersExpected:boolean,step=1)=>writeFileSync(resolve(root,'collection.json'),JSON.stringify({navigation:['http://127.0.0.1/'],navigationSteps:[{url:'http://127.0.0.1/',step,workersExpected}]}));
    assert.throws(()=>validateRawDirectory(root), /collection.json/);
    audit(false,2);assert.throws(()=>validateRawDirectory(root), /navigation/);
    audit(true);assert.throws(()=>validateRawDirectory(root), /worker/);
    audit(false);assert.equal(validateRawDirectory(root),1);
    writeFileSync(resolve(root,'collection.json'),JSON.stringify({navigation:['http://127.0.0.1/','http://127.0.0.1/second/'],navigationSteps:[{url:'http://127.0.0.1/',step:1,workersExpected:false},{url:'http://127.0.0.1/second/',step:2,workersExpected:false}]}));
    assert.throws(()=>validateRawDirectory(root), /Missing snapshot/);
    audit(false);
    writeRaw(root,{version:1,kind:'browser',root,costMs:1,issues:[],scripts:[{...script,map:'missing.map',mapBase:resolve(root,'a.js')}]});
    assert.throws(()=>validateRawDirectory(root), /ENOENT/);
    audit(true);writeRaw(root,{version:1,kind:'browser',root,costMs:1,issues:[],scripts:[script,{...script,context:'worker:navigation-1'}]});
    assert.equal(validateRawDirectory(root),2);
  } finally {rmSync(root,{recursive:true,force:true});}
});
