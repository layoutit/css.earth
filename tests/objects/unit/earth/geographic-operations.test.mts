import {requireRecord} from "../../../../tools/sources/source-values.mts";
import {parsePagedProfile} from "../../../../tools/objects/paged-ellipsoid/profile-source.mts";
import {parseCitySource} from "../../../../tools/objects/geographic-pages/source-records.mts";
import {parseCityFixtureManifest} from "./city-fixture-schema.mts";
import {createServer as createViteServer} from "vite";
import {createServer} from "node:http";
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createOperationContext,operationArguments} from '../../../../tools/objects/geographic-pages/operations/context.mts';
import {wmtsLocalMirror} from '../../../../tools/objects/geographic-pages/operations/wmts-local-server.mts';
import {prepareWmtsBlocks} from '../../../../tools/objects/geographic-pages/operations/prepare-wmts-blocks.mts';
import {publishPreparedCityAssets} from '../../../../tools/objects/geographic-pages/operations/r2-publish.mts';
import {prepareCityIndex} from '../../../../tools/objects/geographic-pages/operations/prepare-index.mts';
import {prepareWmtsPagePresentation} from '../../../../tools/objects/geographic-pages/pinned-hierarchy.mts';
import {PREPARED_EARTH_SCENE as scene} from './prepared-fixture.mts';

test('authored geographic page defaults exactly reproduce the accepted prepared presentation',async()=>{
  const context=createOperationContext({objectId:'earth'}),recipe=parsePagedProfile(await context.readSource('preparation/paged-ellipsoid.json'));
  const prepared=requireRecord(await context.readPrepared('pages')),presentation=prepareWmtsPagePresentation(scene,recipe.geographic.pages);
  assert.equal(recipe.geographic.pages.schema,prepared.schema);
  for(const [key,value] of Object.entries(presentation))assert.deepEqual(value,prepared[key],key);
  const changed=structuredClone(recipe.geographic.pages);changed.initialAddress.longitude=139.69;
  assert.notDeepEqual(prepareWmtsPagePresentation(scene,changed).initialLayer,presentation.initialLayer);
  assert.throws(()=>Reflect.apply(prepareWmtsPagePresentation,undefined,[scene]));
  const malformed=structuredClone(recipe.geographic.pages);malformed.presentation.poolSize=0;
  assert.throws(()=>prepareWmtsPagePresentation(scene,malformed));
});

test('operational object selection is explicit and all prepared IO is scoped JSON',async()=>{
  for(const args of [[],['--object=earth','--object=mars'],['--object=../earth'],['--object=earth','--object=earth']])assert.throws(()=>operationArguments(args));
  assert.deepEqual(operationArguments(['--offline','--object=earth','--region=test']),{objectId:'earth',args:['--offline','--region=test']});
  assert.throws(()=>Reflect.apply(createOperationContext,undefined,[]));
  const projectRoot=await mkdtemp(resolve(tmpdir(),'geographic-operations-'));
  try{
    const one=createOperationContext({objectId:'test-one',projectRoot}),two=createOperationContext({objectId:'test-two',projectRoot});
    for(const path of ['../other','/absolute','nested/../escape','nested\\escape']){
      assert.throws(()=>one.sourcePath(path));assert.throws(()=>one.projectUrl(path));assert.throws(()=>one.preparedPath(path));
    }
    assert.equal(one.assetPath,'/scenes/test-one/');assert.notEqual(one.sourceRoot,two.sourceRoot);
    const value={schema:'fixture@1',body:{bands:[]},assets:['immutable']};
    await one.writePrepared('scene',value);await two.writePrepared('scene',{other:true});
    assert.deepEqual(await one.readPrepared('scene'),value);assert.deepEqual(await two.readPrepared('scene'),{other:true});
    assert.deepEqual(await readdir(one.preparedRoot),['scene.json']);
    await writeFile(one.preparedPath('malicious.json'),'export default process.exit(77)');
    await assert.rejects(one.readPrepared('malicious'),SyntaxError);
  }finally{await rm(projectRoot,{recursive:true,force:true});}
});

test('prepared block delivery namespaces cannot be implicit or cross object boundaries',()=>{
  assert.throws(()=>Reflect.apply(prepareWmtsBlocks,undefined,[[],'fixture']),/explicit object assetPath/);
  assert.throws(()=>prepareWmtsBlocks([], 'fixture',{assetPath:'/scenes/earth/../mars/'}));
  assert.deepEqual(prepareWmtsBlocks([], 'fixture',{assetPath:'/scenes/test-one/'}),{roots:[],files:[]});
});

test('mirror routes are object selected and requests retain bounded byte-range validation',async()=>{
  let calls=0,delegated=false;
  const root=await mkdtemp(resolve(tmpdir(),'geographic-mirror-'));
  const plugin=wmtsLocalMirror({objectId:'test-one',directory:pathToFileURL(root+'/'),assetOrigin:'https://example.invalid',fetcher:async()=>{calls++;throw new Error('No network allowed');}});
  const vite=await createViteServer({root,configFile:false,plugins:[plugin],appType:'custom',server:{middlewareMode:true,watch:null}});
  vite.middlewares.use((_request,response)=>{delegated=true;response.statusCode=204;response.end();});
  const server=createServer(vite.middlewares);
  try {
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    const address=server.address();assert.ok(address&&typeof address!=='string');
    const base=`http://127.0.0.1:${address.port}`;
    const wrong=await fetch(base+'/scenes/earth/wmts-1111111111111111/5-1-2.pack',{headers:{range:'bytes=0-3'}});
    assert.equal(wrong.status,204);assert.equal(delegated,true);assert.equal(calls,0);
    delegated=false;
    const invalid=await fetch(base+'/scenes/test-one/wmts-1111111111111111/5-1-2.pack');
    assert.equal(invalid.status,416);assert.equal(delegated,false);assert.equal(calls,0);
    await invalid.body?.cancel();
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    await vite.close();await rm(root,{recursive:true,force:true});
  }
});

test('city publisher consumes only the exact producer inventory and preserves immutable hash checks',async()=>{
  const context=createOperationContext({objectId:'earth'}),source=parseCitySource(await context.readSource('city/manifest.json'));
  const prepared=parseCityFixtureManifest(JSON.parse((await readFile(context.projectUrl(`output/earth-city/${source.dataset}/manifest.json`))).toString('utf8')));
  const index=prepareCityIndex(prepared.pages,source.dataset,scene,source.delivery);
  const assetUrls=[...prepared.pages,...index.files].map(file=>file.url).sort();
  assert.equal(new Set(assetUrls).size,assetUrls.length);
  // Exact JSON array identity from the accepted base's prepared-assets.mjs;
  // filenames are immutable delivery identities, independent of the new compiler path.
  assert.equal(assetUrls.length,237);
  assert.equal(createHash('sha256').update(JSON.stringify(assetUrls)).digest('hex'),'2170397428c3ceb0b6872093c509fabf72884e9b9f0ae589730b9939ad008422');
  const result=await publishPreparedCityAssets({source,cors:{},assetUrls,assetPath:context.assetPath,
    staging:context.projectPath(`.local/earth-city-publish/${source.dataset}/${source.delivery.keyPrefix}`),root:context.projectRoot,dryRun:true});
  assert.equal(result.mode,'dry-run');assert.equal(result.objects,assetUrls.length);assert.equal(result.webp.objects,prepared.pages.length);
  await assert.rejects(Reflect.apply(publishPreparedCityAssets,undefined,[{source,cors:{},assetUrls,assetPath:'/scenes/test-one/',dryRun:true}]),/delivery target/);
});
