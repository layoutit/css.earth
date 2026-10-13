import '../test-support/index.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { requireRecord } from '@cssearth/core';
import { astroqueryToolchain, telescopePythonEnvironment, writeProductRecord, fileSize, plotProduct, sciencePackage } from '@cssearth/telescope-core/node';
import { parseHTML } from 'linkedom';
import { exportHtml } from './html-outputs.mts';
import { deliveryDisplaySources, viewerMetadata } from './viewer-metadata.mts';

const expected={Instrument:'HAWKI',Date:'2008-09-09T08:45:08.341Z – 2008-09-09T08:51:29.196Z','Filter / band':'J',Scale:'0.1066 arcsec/pixel',Credit:'ESO-PARANAL'};
test('real HAWK-I owner shapes select the exact discovery row and render readable metadata',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'hawki-viewer-'));
  try {
    const fixture=requireRecord(JSON.parse(await readFile(new URL('./fixtures/hawki-viewer.json',import.meta.url),'utf8')));
    const files=[{path:'acquisition.json'},{path:'discovery.snapshot.json'}];
    await writeFile(resolve(root,files[0]!.path),JSON.stringify(fixture.acquisition));
    await writeFile(resolve(root,files[1]!.path),JSON.stringify(fixture.snapshot));
    const displaySources=await deliveryDisplaySources(root,files,fixture.header);
    assert.deepEqual(viewerMetadata({telescope:'https://archive.eso.org/tap_obs',parameters:{displaySources,sourceContext:{request:{instrument:'requested camera',date:'requested date'}},software:{presentation:{normalization:{minimum:1896,maximum:59772}}}}}),expected);
    assert.equal(viewerMetadata({telescope:'https://archive.eso.org/tap_obs',instrument:'https://archive.eso.org/tap_obs',normalization:{minimum:1896,maximum:59772}}).Instrument,'Not recorded; see receipt');
    assert.equal(viewerMetadata({scale:{minimum:1896,maximum:59772}}).Scale,'Not recorded; see receipt');

    const tc=await astroqueryToolchain(),science=resolve(root,'science.fits');
    execFileSync(tc.python,['-c',String.raw`
import sys,json,numpy as np
from astropy.io import fits
h=fits.PrimaryHDU(np.arange(400,dtype=float).reshape(20,20)+1000);h.data[-1,-1]=60000
for k,v in json.loads(sys.argv[2]).items():h.header[k]=v
h.writeto(sys.argv[1])`,science,JSON.stringify(fixture.header)],{env:telescopePythonEnvironment(tc.env)});
    const producer=resolve(root,'qualified.product.json');
    await writeProductRecord(producer,{telescope:'https://archive.eso.org/tap_obs',stage:'native-product-qualification',inputs:[],parameters:{},software:[]},[{path:'science.fits',file:science},...files.map(file=>({...file,file:resolve(root,file.path)}))]);
    const paths=['science.fits','qualified.product.json',...files.map(file=>file.path)];
    await writeFile(resolve(root,'result.json'),JSON.stringify({schema:'cssearth-telescope-delivery@3',product:'science.fits',record:'qualified.product.json',receipt:'qualified.product.json',facts:{target:'eris',verified:true},context:{kind:'exploration',target:'eris',discovery:{schema:'cssearth-telescope-exploration@1',observation:'fixture'},assessment:{status:'not-requested'}},files:await Promise.all(paths.map(async path=>({path,...await fileSize(resolve(root,path))})))}));
    const output=await exportHtml(resolve(root,'result.json'),resolve(root,'viewer'));
    const {document}=parseHTML(await readFile(output.html,'utf8'));
    assert.deepEqual(Object.fromEntries([...document.querySelectorAll('dt')].filter(node=>Object.hasOwn(expected,node.textContent!)).map(node=>[node.textContent,node.nextElementSibling?.textContent])),expected);
    const record=requireRecord(JSON.parse(await readFile(resolve(root,'viewer/output.product.json'),'utf8')));
    const normalization=requireRecord(requireRecord(requireRecord(requireRecord(record.parameters).software).presentation).normalization);
    assert.equal(normalization.limits,'percentile');assert.deepEqual(normalization.percentiles,[.5,99.5]);
    assert.equal(normalization.minimum,1001.995);assert.equal(normalization.maximum,1397.005);
    assert.equal(normalization.clip,true);
    // An existing export without carried display sources still reads its pinned delivery owners.
    const parameters=requireRecord(record.parameters);delete parameters.displaySources;
    await writeFile(resolve(root,'viewer/output.product.json'),JSON.stringify(record));
    const old=await exportHtml(resolve(root,'viewer/output.product.json'),resolve(root,'legacy-viewer'));
    const oldDocument=parseHTML(await readFile(old.html,'utf8')).document;
    assert.deepEqual(Object.fromEntries([...oldDocument.querySelectorAll('dt')].filter(node=>Object.hasOwn(expected,node.textContent!)).map(node=>[node.textContent,node.nextElementSibling?.textContent])),expected);
    execFileSync(tc.python,['-c',String.raw`
import sys,numpy as np
from astropy.io import fits
with fits.open(sys.argv[1]) as original,fits.open(sys.argv[2]) as output:np.testing.assert_array_equal(original[0].data,output[0].data)
`,science,resolve(root,'viewer/image.fits')],{env:telescopePythonEnvironment(tc.env)});
  }finally{await rm(root,{recursive:true,force:true});}
});

test('percentile display is opt-in to the shared plotter and leaves numeric products unchanged',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'display-stretch-')),tc=await astroqueryToolchain();
  try {
    const file=resolve(root,'source.fits');
    execFileSync(tc.python,['-c',String.raw`
import sys,numpy as np
from astropy.io import fits
h=fits.PrimaryHDU(np.arange(400,dtype=float).reshape(20,20));h.data[-1,-1]=60000;h.data[0,0]=np.nan;h.header['BUNIT']='K';h.writeto(sys.argv[1])`,file],{env:telescopePythonEnvironment(tc.env)});
    const extracted=await sciencePackage({operation:'extract',path:file,kind:'image',hdu:0});
    const structures=extracted.structures;assert.ok(Array.isArray(structures));
    const data=requireRecord(requireRecord(structures[0]).extraction),results:Record<string,unknown>={};
    for(const kind of ['default','minmax','percentile']) {
      const directory=resolve(root,kind);await mkdir(directory);
      results[kind]=await plotProduct(directory,'fixture',data,file,{kind:'image',hdu:0,...(kind==='default'?{}:{figureStretch:kind})});
    }
    const normalization=(kind:string)=>requireRecord(requireRecord(requireRecord(results[kind]).presentation).normalization);
    assert.equal(normalization('default').minimum,1);assert.equal(normalization('default').maximum,60000);
    assert.equal(normalization('percentile').minimum,2.99);assert.equal(normalization('percentile').maximum,397.01);
    assert.deepEqual(normalization('percentile').percentiles,[.5,99.5]);
    for(const name of ['figure.png','figure.svg','image.fits','values.csv'])assert.ok((await readFile(resolve(root,'default',name))).equals(await readFile(resolve(root,'minmax',name))),`Default changed: ${name}`);
    for(const name of ['image.fits','values.csv'])assert.ok((await readFile(resolve(root,'default',name))).equals(await readFile(resolve(root,'percentile',name))),`Display changed numeric output: ${name}`);
  }finally{await rm(root,{recursive:true,force:true});}
});
