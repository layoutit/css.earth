import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,writeFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {executeAcquisition,parseAcquisitionPlan} from '../../tools/objects/operations-acquisition.js';
import {prepareSatelliteCatalog} from '../../tools/objects/acquisition/satellite-catalog.mts';
import type {SourceManifest,SourceEntry} from '../../tools/objects/operations.js';
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

test('satellite acquisition and derived JSON publication use only mocked requests and exact pins',()=>temporary(async root=>{
 const expected=Buffer.from(JSON.stringify(prepareSatelliteCatalog({config:catalogConfig,documents}),null,2)+'\n');
 const jsonValue={schema:'synthetic-derived@1',source:'checked'},jsonBytes=Buffer.from(JSON.stringify(jsonValue,null,2)+'\n');
 const manifest:SourceManifest={schema:'cssearth-authoritative-sources@1',inputs:[entry('catalog.json',expected)],generatedIntermediates:[entry('derived.json',jsonBytes)],documents:[]};
 await writeFile(join(root,'recipe.json'),JSON.stringify(catalogConfig));
 const plan=parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[{kind:'satellite-catalog',groups:['refresh'],path:'catalog.json',recipePath:'recipe.json'},{kind:'json-document',groups:['refresh'],path:'derived.json',value:jsonValue}]});
 const requests:string[]=[];
 await executeAcquisition({sourceRoot:root,manifest,plan,transport:{fetch:async url=>{requests.push(url);return new Response(documentFor(url));}}});
 assert.equal(requests.length,3);assert.deepEqual(await readFile(join(root,'catalog.json')),expected);assert.deepEqual(await readFile(join(root,'derived.json')),jsonBytes);
 await assert.rejects(executeAcquisition({sourceRoot:root,manifest,plan,transport:{fetch:async url=>new Response(documentFor(url)+' ')} }),/hash drifted/);
 assert.deepEqual(await readFile(join(root,'catalog.json')),expected);assert.ok((await readdir(root)).every(name=>!name.includes('.partial')));
}));

test('request transforms are ordered, source-authored and hash gated',()=>temporary(async root=>{
 const result=Buffer.from('<DATE>fixed\n<GENERATOR>pinned\n'),manifest:SourceManifest={schema:'cssearth-authoritative-sources@1',inputs:[entry('response.txt',result)],generatedIntermediates:[],documents:[]};
 const plan=parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[{kind:'request-download',groups:['refresh'],path:'response.txt',url:'https://example.test/model',form:{type:'cfg'},replacements:[{pattern:'^WARNING[^\\n]*\\n',replacement:''},{pattern:'<DATE>[^\\n]*',replacement:'<DATE>fixed'}],trimEnd:true,appendText:'\n<GENERATOR>pinned\n'}]});
 await executeAcquisition({sourceRoot:root,manifest,plan,transport:{fetch:async(_url,init)=>{assert.equal(init?.method,'POST');return new Response('WARNING source note\n<DATE>dynamic\n\n');}}});
 assert.deepEqual(await readFile(join(root,'response.txt')),result);
 assert.throws(()=>parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[{...plan.operations[0],replacements:[{pattern:'[',replacement:''}]}]}));
}));

test('all pinned satellite records survive source-table normalization without changing their facts',async()=>{
 const sourceRoot='src/objects/saturn/source';
 const config=JSON.parse(await readFile(sourceRoot+'/preparation/satellite-catalog.json','utf8'));
 const pinned=JSON.parse(await readFile(sourceRoot+'/moons/saturn-moons.json','utf8'));
 // These are reconstructed parser fixtures, not claimed raw upstream HTML.
 const normal=pinned.moons.filter((moon:Record<string,unknown>)=>moon.parameterQualification==='JPL-mean-elements');
 const approximate=config.discoveryOnly.map((item:Record<string,unknown>)=>pinned.moons.find((moon:Record<string,unknown>)=>moon.name===item.identity));
 const discoveries=[...normal,...approximate].map(moon=>row([moon.romanNumeral??'',moon.provisionalDesignation===moon.name?'':moon.name,moon.provisionalDesignation??'',String(moon.discoveryYear),moon.discoverers,moon.discoveryReference]));
 const elements=normal.map((moon:Record<string,unknown>)=>row([String(moon.sourceRecord).replace('JPL element ',''),config.elementPrimary,String(moon.name),String(moon.code),String(moon.ephemeris),String(moon.frame),String(moon.epoch),...['semiMajorAxisKm','eccentricity','argumentOfPeriapsisDeg','meanAnomalyDeg','inclinationDeg','ascendingNodeDeg','periodDays'].map(key=>String(moon[key])),'','','','','',String(moon.elementReference)]));
 const documents={discovery:config.discoverySection.start+discoveries.join('')+config.discoverySection.end,elements:'<table id="sat_elem"><tbody>'+elements.join('')+'</tbody></table>',s2009s2:'distance of approximately '+approximate[1].semiMajorAxisKm+' km'};
 const result=prepareSatelliteCatalog({config,documents});assert.deepEqual(result.moons,pinned.moons);
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
