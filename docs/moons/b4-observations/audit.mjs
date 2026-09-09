// Read-only cohort closure audit. Compile operations.ts/prepare.ts to output/b4-tests first.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {collectRuntimeAssetUrls,parseSourceManifest,verifySources} from '../../../output/b4-tests/operations.mjs';
import {validateObjectProvenance,productSourceIds} from '../../../src/platform/object-provenance.mjs';
import {prepareObjectContent} from '../../../output/b4-tests/prepare-content.mjs';
const ids='himalia epimetheus telesto pandora ymir albiorix siarnaq methone pallene'.split(' ');
const json=async p=>JSON.parse(await readFile(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const bodies=[];
for(const id of ids){
 const root=`src/planets/${id}`,sourceRoot=`${root}/source`;
 const descriptor=await json(`${root}/object.json`),manifest=parseSourceManifest(await json(`${sourceRoot}/manifest.json`),id);
 const source=await json(`${sourceRoot}/content/object.json`),config=await json(`${sourceRoot}/content/charts.json`),content=await json(`${root}/prepared/content.json`);
 for(const pin of descriptor.properties.recipe.sources)assert.equal(sha(await readFile(`${root}/${pin.path}`)),pin.sha256,`${id} recipe ${pin.id}`);
 for(const pin of manifest.documents){const path=`${sourceRoot}/${pin.path}`;try{const b=await readFile(path);assert.equal(b.length,pin.expectedBytes);assert.equal(sha(b),pin.expectedSha256);}catch(e){if(e.code!=='ENOENT')throw e;}}
 const inputCheck=await verifySources({sourceRoot,manifest,consumer:'observation-charts'});
 const {schema:_schema,...title}=await json(resolve(sourceRoot,'content',source.provenance.title.path));
 assert.deepEqual(content.charts,prepareObjectContent({...source,title}).charts);
 assert.equal(sha(await readFile(`${root}/prepared/object.json`)),descriptor.prepared.sha256,'Unchanged scene transport pin');
 const runtime=await json(`${root}/prepared/runtime.json`),controls=await json(`${root}/prepared/controls.json`),assets=await json(`${root}/runtime-assets.json`);
 assert.deepEqual(assets,await json(`${root}/prepared/runtime-assets.json`));
 assert.deepEqual(collectRuntimeAssetUrls(id,runtime,controls,content).map(url=>url.split('/').at(-1)).sort(),assets.assets.map(a=>a.filename).sort());
 assert.deepEqual((await readdir(`public/scenes/${id}`)).sort(),assets.assets.map(a=>a.filename).sort());
 for(const asset of assets.assets){const b=await readFile(`public/scenes/${id}/${asset.filename}`);assert.equal(b.length,asset.bytes);assert.equal(sha(b),asset.sha256);}
 const provenance=validateObjectProvenance(await json(`${root}/prepared/provenance.json`),id);
 for(const [i,chart]of config.charts.entries()){
  const product=provenance.products.find(p=>p.id===`chart:${i}`);assert.ok(product);
  assert.deepEqual(product.outputs.map(o=>o.url).sort(),[chart.output,chart.dataOutput].map(name=>`/scenes/${id}/${name}`).sort());
  assert.ok(productSourceIds(provenance,product.id).length>0);
  for(const output of product.outputs)assert.equal(sha(await readFile(`public${output.url}`)),output.sha256);
  assert.equal(product.interpretation.uncertainty,chart.uncertainty);
  assert.deepEqual(product.interpretation.excludedRanges,chart.exclude??[]);
 }
 bodies.push({id,charts:content.charts.length,measuredInputsVerified:inputCheck.verifiedCount,assetsVerified:assets.assets.length,provenanceProducts:provenance.products.length,sceneTransportMatchesPin:true});
}
const report={status:'PASS',scope:'All new measurement inputs, recipe/document pins present locally, generated content, complete local runtime asset closure, bound PNG/CSV provenance and unchanged scene transports.',unproven:'Full historical scientific source acquisition and full scene browser conformance were not rerun.',bodies,maxRssKiB:process.resourceUsage().maxRSS};
await writeFile('docs/moons/b4-observations/closure.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
