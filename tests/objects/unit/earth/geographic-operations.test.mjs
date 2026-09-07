import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {createOperationContext,operationArguments} from '../../../../tools/objects/geographic-pages/operations/context.mjs';
import {wmtsLocalMirror} from '../../../../tools/objects/geographic-pages/operations/wmts-local-server.mjs';
import {prepareWmtsBlocks} from '../../../../tools/objects/geographic-pages/operations/prepare-wmts-blocks.mjs';
import {publishPreparedCityAssets} from '../../../../tools/objects/geographic-pages/operations/r2-publish.mjs';
import {prepareCityIndex} from '../../../../tools/objects/geographic-pages/operations/prepare-index.mjs';
import {prepareWmtsPagePresentation} from '../../../../tools/objects/geographic-pages/pinned-hierarchy.mjs';
import {bindPinnedCoarseBacking} from '../../../../tools/objects/geographic-pages/operations/coarse-integration.mjs';
import {PREPARED_EARTH_SCENE as scene} from './prepared-fixture.mjs';

test('authored geographic page defaults exactly reproduce the accepted prepared presentation',async()=>{
  const context=createOperationContext({objectId:'earth'}),recipe=await context.readSource('preparation/paged-ellipsoid.json');
  const prepared=await context.readPrepared('pages'),presentation=prepareWmtsPagePresentation(scene,recipe.geographic.pages);
  assert.equal(recipe.geographic.pages.schema,prepared.schema);
  const pin=await context.readSource(recipe.geographic.pages.coarseReleasePath);
  const bound=bindPinnedCoarseBacking({...prepared,...presentation,backing:undefined},pin);
  assert.deepEqual(bound,prepared,'authored fine presentation plus pinned backing reproduce the published plan');
  const changed=structuredClone(recipe.geographic.pages);changed.initialAddress.longitude=139.69;
  assert.notDeepEqual(prepareWmtsPagePresentation(scene,changed).initialLayer,presentation.initialLayer);
  assert.throws(()=>prepareWmtsPagePresentation(scene));
  const malformed=structuredClone(recipe.geographic.pages);malformed.presentation.poolSize=0;
  assert.throws(()=>prepareWmtsPagePresentation(scene,malformed));
});

test('operational object selection is explicit and all prepared IO is scoped JSON',async()=>{
  for(const args of [[],['--object=earth','--object=mars'],['--object=../earth'],['--object=earth','--object=earth']])assert.throws(()=>operationArguments(args));
  assert.deepEqual(operationArguments(['--offline','--object=earth','--region=test']),{objectId:'earth',args:['--offline','--region=test']});
  assert.throws(()=>createOperationContext());
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
  assert.throws(()=>prepareWmtsBlocks([], 'fixture'),/explicit object assetPath/);
  assert.throws(()=>prepareWmtsBlocks([], 'fixture',{assetPath:'/scenes/earth/../mars/'}));
  assert.deepEqual(prepareWmtsBlocks([], 'fixture',{assetPath:'/scenes/test-one/'}),{roots:[],files:[]});
});

test('mirror routes are object selected and requests retain bounded byte-range validation',async()=>{
  let handler,calls=0;
  wmtsLocalMirror({objectId:'test-one',directory:pathToFileURL(tmpdir()+'/nonexistent-geographic-fixture/'),assetOrigin:'https://example.invalid',fetcher:async()=>{calls++;throw new Error('No network allowed');}})
    .configureServer({middlewares:{use:fn=>handler=fn}});
  const response=()=>Object.assign(new EventEmitter(),{setHeader(){},end(){this.ended=true;}});
  const wrong=response();let delegated=false;
  await handler({url:'/scenes/earth/wmts-1111111111111111/5-1-2.pack',method:'GET',headers:{range:'bytes=0-3'}},wrong,()=>delegated=true);
  assert.equal(delegated,true);assert.equal(calls,0);
  const invalid=response();
  await handler({url:'/scenes/test-one/wmts-1111111111111111/5-1-2.pack',method:'GET',headers:{}},invalid,()=>assert.fail('Selected route bypassed validation'));
  assert.equal(invalid.statusCode,416);assert.equal(calls,0);
});

test('city publisher consumes only the exact producer inventory and preserves immutable hash checks',async()=>{
  const context=createOperationContext({objectId:'earth'}),source=await context.readSource('city/manifest.json');
  const prepared=JSON.parse(await readFile(context.projectUrl(`output/earth-city/${source.dataset}/manifest.json`)));
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
  await assert.rejects(publishPreparedCityAssets({source,cors:{},assetUrls,assetPath:'/scenes/test-one/',dryRun:true}),/delivery target/);
});
