import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, lstat, mkdir } from 'node:fs/promises';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OBJECTS } from '../../../site/objects.mts';
import { runtimeAssets } from '../../../tools/runtime-assets.mts';
import { verifyRuntimeAssetClosure } from '../../../src/platform/runtime-asset-closure.mts';
import { collectRuntimeAssetUrls } from '../../../tools/objects/dist/operations.js';
import { readDescriptorDefinition } from '../../../tools/prepared-object-source.mts';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../../..');
const output=resolve(root,'output/playwright/moons-b1-qualification');
await mkdir(output,{recursive:true});
const digest=b=>createHash('sha256').update(b).digest('hex');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const pin=async p=>{const b=await readFile(p);return {path:relative(root,p),bytes:b.length,sha256:digest(b)}};
const write=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const batchFile=resolve(root,'docs/moons/PR-BATCHES.json');
const batch=(await json(batchFile)).batches.find(b=>b.id==='B1');
assert.equal(batch.names.length,26);
const key=s=>s.normalize('NFKD').replace(/[^a-z0-9]/gi,'').toLowerCase();
const newIds=batch.names.map(name=>{
 const found=OBJECTS.filter(o=>key(o.name)===key(name)||key(o.displayName??'')===key(name)||key(o.id)===key(name));
 assert.equal(found.length,1,`Exactly one registry match for ${name}`);return found[0].id;
});
assert.equal(new Set(newIds).size,26);
const affectedExistingIds=process.argv.slice(2).map(arg=>{assert.match(arg,/^--include-parent=(haumea|sylvia)$/);return arg.slice('--include-parent='.length);});
assert.equal(new Set(affectedExistingIds).size,affectedExistingIds.length);
const ids=[...newIds,...affectedExistingIds];
const bodies=[];
for(const id of ids){
 const directory=resolve(root,'src/planets',id), manifestFile=resolve(directory,'runtime-assets.json');
 const manifest=await json(manifestFile);
 await verifyRuntimeAssetClosure({planetId:id,manifest,root:resolve(root,'public/scenes',id)});
 for(const asset of manifest.assets)assert.equal((await lstat(resolve(root,'public/scenes',id,asset.filename))).isFile(),true);
 const descriptorFile=`src/planets/${id}/object.json`;
 const checked=await readDescriptorDefinition({objectId:id,descriptorFile,root,source:path=>readFile(path,'utf8')});
 const content=await json(resolve(directory,'prepared/content.json'));
 const consumerUrls=collectRuntimeAssetUrls(id,checked.definition,content);
 assert.deepEqual(consumerUrls.map(url=>url.split('/').at(-1)).sort(),manifest.assets.map(a=>a.filename).sort(),`${id} actual consumer/manifest closure`);
 const sourceFiles=[];
 for(const p of [...checked.closure].sort())sourceFiles.push(await pin(p));
 bodies.push({id,assetCount:manifest.assets.length,assetBytes:manifest.assets.reduce((n,a)=>n+a.bytes,0),manifest:await pin(manifestFile),consumerUrlCount:consumerUrls.length,exactPublicDirectoryClosure:true,everyByteCountAndSha256Verified:true,preparedDescriptorAndRuntimeIdentityVerified:true,consumerClosureMatchesInventory:true,descriptorClosurePins:sourceFiles});
 console.log(`${id}: ${manifest.assets.length} assets, bytes/hash/directory/consumer/descriptor closure PASS`);
}
const all=await runtimeAssets(root,ids), byKey=new Map(),byContent=new Map();
for(const asset of all){
 const existing=byKey.get(asset.key);if(existing)assert.equal(existing.bytes,asset.bytes);else byKey.set(asset.key,{...asset,owners:[]});
 byKey.get(asset.key).owners.push({id:asset.id,filename:asset.filename});
 const content=byContent.get(asset.sha256);if(content)assert.equal(content.bytes,asset.bytes);else byContent.set(asset.sha256,{sha256:asset.sha256,bytes:asset.bytes,publicationKeys:[]});
 byContent.get(asset.sha256).publicationKeys.push(asset.key);
}
// Fail if concurrent preparation changed any just-verified inventory.
for(const b of bodies)assert.equal((await pin(resolve(root,b.manifest.path))).sha256,b.manifest.sha256,`${b.id} manifest changed during audit`);
const freshRoot=await mkdtemp('/tmp/cssearth-b1-runtime-install-');
const assets=[...byKey.values()].sort((a,b)=>a.key.localeCompare(b.key));
const report={schema:'cssearth-b1-runtime-publication-audit@1',generatedAt:new Date().toISOString(),state:'local-verified-awaiting-publication',project:'cssEarth',batch:'B1',batchSource:await pin(batchFile),frozenAfter:affectedExistingIds.length ? 'Root confirmed final global-primary closure and affected parent rebakes; Saturn final Fornjot copy was already stable.' : 'Saturn owner confirmed final Fornjot visible-copy rebake and all 18 Saturn package outputs stable.',ids,newSceneCount:newIds.length,affectedExistingIds,bodyCount:ids.length,localValidation:{passed:true,bodies:bodies.length,inventoryEntries:all.length,totalInventoryBytes:all.reduce((n,a)=>n+a.bytes,0),checks:['Each declared asset is a regular file with its exact byte count and SHA-256.','Each public/scenes/<id> directory contains exactly its runtime manifest.','Actual prepared runtime/content asset URLs exactly match the declared manifest.','Existing readDescriptorDefinition validates descriptor digest, prepared/runtime identity, authored input hashes and world-frame closure.']},publication:{origin:'https://earth-assets.lowpoly.cc',deduplicationKey:'runtime-assets/<sha256>/<filename>',uniqueKeyCount:assets.length,uniqueKeyBytes:assets.reduce((n,a)=>n+a.bytes,0),uniqueContentHashCount:byContent.size,uniqueContentBytes:[...byContent.values()].reduce((n,a)=>n+a.bytes,0),distinction:'Publication deduplication uses the real hash/filename URL key. Identical content under different filenames still needs each declared URL; content-hash-only totals are diagnostic, not the upload or install total.',assets:assets.map(a=>({...a,file:relative(root,a.file)}))},bodies,apiPins:await Promise.all(['tools/setup.mts','tools/runtime-assets.mts','src/platform/runtime-asset-closure.mts','tools/prepared-object-source.mts','tools/objects/dist/operations.js'].map(p=>pin(resolve(root,p)))),freshInstall:{state:'staged-no-network-requested',stagingReport:'output/playwright/moons-b1-qualification/runtime-install-staging.json',entryPoint:'output/playwright/moons-b1-qualification/runtime-fresh-install.mjs',method:'Existing installRuntimeAssets API, remapping only destination files into a new empty /tmp directory. No checkout, source geometry, node_modules or bulk caches copied.',requiresRootPublicationSignal:true,expectedInstalledFiles:all.length,expectedDownloadedBytes:all.reduce((n,a)=>n+a.bytes,0)},limitations:['This is local inventory/closure proof. Remote availability has not been tested and no files have been published by this audit.','Aggregate build/browser/PR gates are owned by the root integration lane.'],contentGroups:[...byContent.values()].filter(g=>g.publicationKeys.length>1)};
await write(resolve(here,'runtime-publication-manifest.json'),report);
await write(resolve(output,'runtime-publication-bulk.json'),assets.map(({key,file})=>({key,file})));
await write(resolve(output,'runtime-install-staging.json'),{schema:'cssearth-b1-runtime-install-staging@1',root:freshRoot,audit:resolve(here,'runtime-publication-manifest.json'),state:'staged-no-network-requested'});
await write(resolve(freshRoot,'install-plan.json'),{schema:'cssearth-b1-fresh-install-plan@1',audit:resolve(here,'runtime-publication-manifest.json'),ids,assets:all.map(a=>({...a,file:join(freshRoot,'public/scenes',a.id,a.filename)}))});
const fmt=n=>`${n.toLocaleString('en-US')} bytes (${(n/1e6).toFixed(2)} MB)`;
await writeFile(resolve(here,'runtime-publication-report.md'),`# B1 runtime publication inventory\n\nAll ${ids.length} affected packages (${newIds.length} new B1 scenes${affectedExistingIds.length ? ` plus ${affectedExistingIds.length} existing parent packages` : ''}) pass local byte-count, SHA-256, exact-directory, actual-consumer and prepared-descriptor closure checks. Fornjot was frozen after its final visible-copy rebake.\n\n- Runtime inventory entries: **${all.length}**.\n- Deduplicated publication keys: **${assets.length}**, totaling **${fmt(report.publication.uniqueKeyBytes)}**.\n- Distinct content hashes: **${byContent.size}**, totaling ${fmt(report.publication.uniqueContentBytes)}. This smaller diagnostic total cannot replace the required hash/filename URL set.\n- Full pinned inventory: [runtime-publication-manifest.json](runtime-publication-manifest.json).\n- Concrete upload input: \`output/playwright/moons-b1-qualification/runtime-publication-bulk.json\`. This audit does not upload it.\n- Fresh installer staged under \`output/playwright/moons-b1-qualification\`; its destination is a new empty \`/tmp\` directory recorded in the local staging plan; no remote requests made. The test uses the existing \`installRuntimeAssets\` API and starts only after the root publication signal.\n\n|Body|Files|Bytes|Local closure|\n|---|---:|---:|---|\n${bodies.map(b=>`|${b.id}|${b.assetCount}|${b.assetBytes}|PASS|`).join('\n')}\n\nRemote availability remains unverified. Full build, browser and PR qualification remains with the integration owner.\n`);
console.log(JSON.stringify({bodyCount:ids.length,newSceneCount:newIds.length,affectedExistingIds,entries:all.length,publicationKeys:assets.length,publicationBytes:report.publication.uniqueKeyBytes,uniqueContentHashes:byContent.size,uniqueContentBytes:report.publication.uniqueContentBytes,freshRoot}));
