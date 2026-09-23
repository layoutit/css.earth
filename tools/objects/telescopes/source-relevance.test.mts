import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { deliverSource } from './archive-source.mts';
import { listArtifactOutputs } from './artifact-outputs.mts';
import { formatArtifact, main } from './cli.mts';
import { assessSourceRelevance } from './source-relevance.mts';
import { SIMBAD_TAP } from './sky/target.mts';

const fits=resolve(import.meta.dirname,'../../../tests/fixtures/telescope-vo/eso-circle.fits');
const position={raDegrees:88.79293875,decDegrees:7.40706389};

async function fetched(root:string,raDegrees:number){
  const bytes=await readFile(fits), target='betelgeuse';
  const exploration=Buffer.from(`${JSON.stringify({schema:'cssearth-telescope-exploration@1',target,answer:{target,
    request:{target,kind:'image',wavelengthMicrometres:[1,2],skyTarget:{id:'simbad-betelgeuse',mainId:'Betelgeuse',
      identifiers:['Betelgeuse'],...position,raDegrees,positionErrorMas:null,positionBibcode:null,objectType:null,
      resolver:{service:SIMBAD_TAP,queries:[]}}},services:[]}},null,2)}\n`);
  const path=resolve(root,'explore.json');await writeFile(path,exploration);
  const source=await deliverSource(path,resolve(root,'source'),{bytes:exploration,target,maximum:bytes.length+1024,
    selected:{targetName:'Betelgeuse'},evidence:Buffer.from('{}')},{archive:'fixture',telescope:'Fixture',identity:'one',target,
    discovery:{targetName:'Betelgeuse'},current:{revision:'1'},limitations:['No calibration claim.'],
    primaryFits:'image.fits',files:[{url:'https://example.org/image.fits',name:'image.fits',bytes:bytes.length}]},
    async()=>new Response(new Uint8Array(bytes),{headers:{'content-type':'application/fits'}}));
  return source.receipt;
}

test('fetched FITS reports archive name, native content, WCS field and request fit separately',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'source-relevance-'));
  try{
    const receipt=await fetched(root,position.raDegrees),result=await listArtifactOutputs(receipt),relevance=result.relevance!;
    assert.equal(relevance.archiveTarget.name,'Betelgeuse');
    assert.equal(relevance.field.status,'in-field');
    assert.equal(relevance.fit.kind.status,'supported');
    assert.equal(relevance.fit.wavelength.status,'unknown');
    assert.equal(relevance.detection.status,'unassessed');
    assert.ok(relevance.contents.some(item=>item.shape?.join(',')==='166,166'&&item.usableSamples!==undefined));
    assert.ok(result.outputs.some(output=>output.kind==='image'&&output.available));
    const human=formatArtifact({...result,source:String(result.source)});
    assert.match(human,/Recorded field: in-field/u);assert.match(human,/Detection: unassessed/u);
    assert.equal(JSON.parse(JSON.stringify(result)).relevance.field.status,'in-field');
    const text:string[]=[],io={stdinIsTTY:false,stdoutIsTTY:false,write:(value:string)=>text.push(value),error:(value:string)=>text.push(value),question:async()=>undefined,close:()=>{}};
    assert.equal(await main(['outputs',receipt,'--json'],root,value=>text.push(value),io),0);
    assert.equal(JSON.parse(text.join('')).relevance.field.status,'in-field');
    text.length=0;
    assert.equal(await main(['outputs',receipt],root,value=>text.push(value),io),0);
    assert.match(text.join(''),/Software citations: telescope ascl --product/u);
    await writeFile(resolve(root,'source','image.fits'),'changed');
    await assert.rejects(listArtifactOutputs(receipt),/pins changed/u);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('a nearby position outside native WCS is not described as an in-field target',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'source-relevance-outside-'));
  try{
    const result=await listArtifactOutputs(await fetched(root,88.9));
    assert.equal(result.relevance?.field.status,'outside-field');
    assert.match(result.relevance?.next??'',/Choose another source/u);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('kind, wavelength and missing native routes stay independent',()=>{
  const blank=assessSourceRelevance({target:'target',kind:'cube',wavelengthMicrometres:[1,2]},[],[]);
  assert.equal(blank.fit.kind.status,'unknown');assert.equal(blank.fit.wavelength.status,'unknown');
  assert.equal(blank.field.status,'unknown');assert.equal(blank.archiveTarget.status,'unknown');
  const metadata=[{structure:'SCI',fitsHdu:1,shape:[2,2,2],quality:{policy:'fixture',samples:8,finite:8,usable:8,flagged:0,invalidUncertainty:0,mask:null},
    spectral:{axis:0,centersMicrometres:[1.1,1.9],binEdgesMicrometres:[1,1.5,2],source:'fixture',usableBands:[true,true]},calibration:[],limitations:[]}];
  const supported=assessSourceRelevance({target:'target',kind:'cube',wavelengthMicrometres:[1,2]},metadata,[]);
  assert.equal(supported.fit.kind.status,'supported');assert.equal(supported.fit.wavelength.status,'supported');
  const outside=assessSourceRelevance({target:'target',kind:'image',wavelengthMicrometres:[3,4]},metadata,[]);
  assert.equal(outside.fit.wavelength.status,'unsupported');
  const unqualified=assessSourceRelevance({target:'target',kind:'cube'},[{...metadata[0]!,spectral:undefined}],[]);
  assert.equal(unqualified.fit.kind.status,'unknown');
  const split=assessSourceRelevance({target:'target',wavelengthMicrometres:[1,2]},[
    {...metadata[0]!,spectral:{...metadata[0]!.spectral,centersMicrometres:[1.1],binEdgesMicrometres:[1,1.5],usableBands:[true]}},
    {...metadata[0]!,spectral:{...metadata[0]!.spectral,centersMicrometres:[1.9],binEdgesMicrometres:[1.5,2],usableBands:[true]}},
  ],[]);
  assert.equal(split.fit.wavelength.status,'unknown','separate HDUs cannot jointly claim one continuous product');
});
