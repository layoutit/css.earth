import assert from 'node:assert/strict';
import { sourceTest } from './source-test.mts';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { executeAcquisition, parseAcquisitionPlan } from '#preparation/operations-acquisition';
import { prepareSatelliteCatalog } from '../../tools/objects/acquisition/satellite-catalog.mts';
import type { SourceEntry } from '#preparation/source-files';
const test = sourceTest();
const digest=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const entry=(path:string,_bytes:Uint8Array):SourceEntry=>({path});
const temporary=async(work:(root:string)=>Promise<void>)=>{const root=await mkdtemp(join(tmpdir(),'catalog-acquisition-'));try{await work(root);}finally{await rm(root,{recursive:true,force:true});}};
const row=(cells:string[])=>'<tr>'+cells.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>';
const documents={
 discovery:'BEGIN'+row(['I','Demo One','','2000','A &amp; B','R1'])+row(['','','S/20 X 1','2001','C','R2'])+'END',
 elements:'<table id="sat_elem"><tbody>'+row(['1','Demo','Demo One','code','eph','equatorial','epoch','100','0.1','1','2','3','4','5','','','','','','E1'])+'</tbody></table>',
 approximate:'Published distance of approximately 120 km.',
};
const catalogConfig={schema:'cssearth-satellite-catalog-acquisition@1',outputSchema:'synthetic-catalog@1',retrievedAt:'2000-01-01',sources:{discovery:'https://example.test/discovery',elements:'https://example.test/elements',approximate:'https://example.test/approximate'},expectedDiscoveryCount:2,expectedElementCount:1,gravitationalParameterKm3PerS2:1000,authority:{source:'synthetic test'},discoverySection:{start:'BEGIN',end:'END'},elementPrimary:'Demo',ringFrame:'test plane',discoveryOnly:[{identity:'S/20 X 1',document:'approximate',radiusPattern:'distance of approximately\\s+(\\d+)\\s+km',sourceRecord:'test reference',parameterQualification:'approximate test'}]};

test('satellite catalog joins authorities and derives only declared approximate orbits',()=>{
 const output=prepareSatelliteCatalog({config:catalogConfig,documents});
 assert.deepEqual(output.counts,{confirmed:2,withJplMeanElements:1,discoveryOnly:1});
 assert.deepEqual(output.moons.map(moon=>moon.name),['Demo One','S/20 X 1']);
 assert.equal(output.moons[0].discoverers,'A & B');assert.equal(output.moons[1].semiMajorAxisKm,120);
 assert.equal(output.moons[1].periodDays,Math.round(2*Math.PI*Math.sqrt(120**3/1000)/86400*1e9)/1e9);
 assert.equal(output.sources.elements.sha256,digest(documents.elements));
 assert.throws(()=>prepareSatelliteCatalog({config:catalogConfig,documents:{...documents,approximate:'missing radius'}}),/radius/);
 assert.throws(()=>prepareSatelliteCatalog({config:{...catalogConfig,expectedDiscoveryCount:3},documents}),/count drifted/);
});

test('Earth refresh preserves normalized PSG, gzip, editorial and pinned derived records',()=>temporary(async root=>{
 const sourceRoot='src/objects/earth/source',manifest=JSON.parse(await readFile(sourceRoot+'/manifest.json','utf8'));
 const authored=JSON.parse(await readFile(sourceRoot+'/preparation/acquisition.json','utf8'));
 const plan=parseAcquisitionPlan({...authored,operations:authored.operations.filter((step:{kind:string;encoding?:string})=>step.kind==='request-download'||step.kind==='json-document'||step.encoding)});
 const config=await readFile(sourceRoot+'/atmosphere/psg-earth-20260830.cfg','utf8'),spectrum=await readFile(sourceRoot+'/atmosphere/psg-earth-r120-rif.txt','utf8'),noise=await readFile(sourceRoot+'/noise/buenos-aires-day-2025.geojson.gz'),editorial=await readFile(sourceRoot+'/editorial/nasa-earth-record.json','utf8');
 const calls:string[]=[];
 await executeAcquisition({sourceRoot:root,manifest,plan,transport:{fetch:async(url,init)=>{
  calls.push(url);
  if(url==='https://psg.gsfc.nasa.gov/api.php'){
   assert.equal(init?.method,'POST');const form=new URLSearchParams(String(init?.body));
   if(form.get('type')==='cfg')return new Response('# WARNING | ATMOSPHERE | fixture\n'+config.split('<GENERATOR-RANGE1>')[0]);
   assert.equal(form.get('file'),config);return new Response(spectrum.replace('# Synthesized for pinned Earth configuration 2026-08-30','# Synthesized on fixture time').replace('# Radiative transfer timing omitted from deterministic snapshot','# Radiative transfer took fixture time'));
  }
  if(url.includes('medicion_de_ruido_diurno.geojson'))return new Response(gunzipSync(noise));
  if(url.includes('/topic/48583'))return new Response(JSON.stringify(JSON.parse(editorial)));
  const compressed = plan.operations.find(step => step.kind === 'download' && step.encoding === 'gzip' && step.url === url);
  if (compressed && 'path' in compressed) return new Response(gunzipSync(await readFile(sourceRoot + '/' + compressed.path)));
  throw new Error('Unexpected mock request '+url);
 }}});
 assert.equal(calls.length, plan.operations.filter(step => step.kind !== 'json-document').length);
 for(const operation of plan.operations){assert.ok('path'in operation);const path=(operation as {path:string}).path;assert.deepEqual(await readFile(join(root,path)),await readFile(sourceRoot+'/'+path),path);}
}));

function documentFor(url:string):string {const key=url.split('/').at(-1);if(key==='discovery'||key==='elements'||key==='approximate')return documents[key];throw new Error(`Unexpected test URL: ${url}`);}
