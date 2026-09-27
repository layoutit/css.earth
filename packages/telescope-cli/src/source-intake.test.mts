import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sha256 } from '@cssearth/core/node';
import { intakeSources, type SourceIntakeIssue } from './source-intake.mts';
const label=(pointer:string)=>`PDS_VERSION_ID = PDS3\nPRODUCT_ID = "TEST"\nDATA_SET_ID = "DATA"\nTARGET_NAME = "TEST"\nINSTRUMENT_HOST_NAME = "TEST OBSERVATORY"\nINSTRUMENT_ID = "CAM"\n${pointer}\nEND\n`;
test('source discovery reports missing headers without fetching every manifest URL', async () => {
 const root=await mkdtemp(resolve(tmpdir(),'source-intake-local-')),source=resolve(root,'src/objects/test/source');
 const originalFetch=globalThis.fetch;let fetches=0;
 try {
  await mkdir(source,{recursive:true});
  await writeFile(resolve(source,'local.img'),label('^IMAGE = 32'));
  await writeFile(resolve(source,'manifest.json'),JSON.stringify({inputs:[
   {path:'local.img',origin:'https://example.org/local.img',sourceProcessing:[{name:'SQUEEZE',version:'3.0',evidence:'https://example.org/recipe'}]},
   ...Array.from({length:12},(_,index)=>({path:`missing-${index}.img`,origin:`https://example.org/missing-${index}.img`}))
  ]}));
  globalThis.fetch=(async()=>{fetches++;throw new Error('Unexpected remote header fetch.');}) as typeof fetch;
  const issues:SourceIntakeIssue[]=[],products=await intakeSources(root,'test',[],issues,{fetchRemote:false});
  assert.equal(fetches,0);
  assert.equal(products.length,1);
  assert.deepEqual(products[0]!.files[0]!.sourceProcessing,[{name:'SQUEEZE',version:'3.0',evidence:'https://example.org/recipe'}]);
  assert.equal(issues.length,12);
  assert.ok(issues.every(issue=>issue.state==='unavailable'&&/local source file or a previously cached header/u.test(issue.reason)));
 } finally {globalThis.fetch=originalFetch;await rm(root,{recursive:true,force:true});}
});
test('attached labels and detached tables become complete pinned products; unpinned dependencies remain explicit',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'source-intake-')),source=resolve(root,'src/objects/test/source');await mkdir(source,{recursive:true});
 try{
  const files=[['image.img',label('^IMAGE = 32\n^SIGMA_MAP_IMAGE = 64\n^QUALITY_MAP_IMAGE = 96')],['table.lbl',label('^TABLE = "data.tab"')],['data.tab','1,2\n'],['bad.lbl',label('^TABLE = "missing.tab"')],['extract.lbl',label('RECORD_BYTES = 512\n^IMAGE = 54')]];
  const inputs=[];for(const [path,bytes] of files){await writeFile(resolve(source,path!),bytes!);inputs.push({id:path!.replace('.','-'),path,origin:`https://example.org/${path}`});}
  await writeFile(resolve(source,'manifest.json'),JSON.stringify({inputs}));const issues:SourceIntakeIssue[]=[],products=await intakeSources(root,'test',[],issues);
  assert.equal(products.length,2);assert.equal(products.find(p=>p.kind==='image')!.labelPath,'src/objects/test/source/image.img');assert.equal(products.find(p=>p.kind==='image')!.files.length,1);
  assert.equal(products.find(p=>p.kind==='table')!.kind,'table');assert.equal(products.find(p=>p.kind==='table')!.files.length,2);assert.ok(issues.some(i=>/outside the local file/.test(i.reason)));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('document labels and acquisition headers belong to the same pinned input set',async()=>{
 const {sourceHeaders}=await import('./source-transfer.mts');
 const root=await mkdtemp(resolve(tmpdir(),'source-documents-')),source=resolve(root,'src/objects/test/source');await mkdir(resolve(source,'preparation'),{recursive:true});
 try{
  const text=label('^IMAGE = "data.img"');await writeFile(resolve(source,'data.lbl'),text);
  await writeFile(resolve(source,'manifest.json'),JSON.stringify({inputs:[{id:'data',path:'data.img',origin:'https://example.org/data.img'}],documents:[{path:'data.lbl',origin:'https://example.org/data.lbl'}]}));
  await writeFile(resolve(source,'preparation/acquisition.json'),JSON.stringify({schema:'cssearth-acquisition-plan@1',operations:[{kind:'download',path:'data.img',url:'https://example.org/data.img',headers:{Accept:'application/vnd.github.raw+json'}}]}));
  const products=await intakeSources(root,'test',[]);assert.equal(products.length,1);assert.equal(products[0]!.files.length,2);
  const science=products[0]!.files.find(f=>f.role==='science')!;
  assert.deepEqual(await sourceHeaders(root,science),{Accept:'application/vnd.github.raw+json'});
  assert.deepEqual(await sourceHeaders(root,{...science,origin:'https://different.example/data.img'}),{});
 }finally{await rm(root,{recursive:true,force:true});}
});

test('PDS4 identity is scoped to the product and all native files remain pinned',async()=>{
 const {pds4ProductIdentity}=await import('@cssearth/telescope');
 const xml='<Identification_Area><logical_identifier>urn:nasa:pds:test:product</logical_identifier><version_id>2.0</version_id><Modification_History><Modification_Detail><version_id>1.0</version_id></Modification_Detail></Modification_History></Identification_Area>';
 assert.deepEqual(pds4ProductIdentity(xml),{logical_identifier:'urn:nasa:pds:test:product',version_id:'2.0'});
 assert.throws(()=>pds4ProductIdentity(xml.replace('<version_id>2.0</version_id>','<version_id>2.0</version_id><version_id>3.0</version_id>')),/Expected one/);
});
