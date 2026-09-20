import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { plotNumericPreview } from './plots.mts';

const root=resolve(import.meta.dirname,'../../..');

test('Astropy and Matplotlib render bounded previews from pinned family data',async()=>{
  const directory=await mkdtemp(resolve(tmpdir(),'family-preview-'));
  try {
    const mascs=JSON.parse(await readFile(resolve(root,'src/objects/mercury/source/spectrum/mascs-global-area-weighted-mean.json'),'utf8')) as {wavelengthNanometers:number[];reflectanceIOverF:number[]};
    const spectrum=await plotNumericPreview(resolve(directory,'spectrum'),{kind:'series',title:'Mercury MASCS',xLabel:'Wavelength (nm)',yLabel:'Reflectance I/F',series:[{label:'visible',x:mascs.wavelengthNanometers,y:mascs.reflectanceIOverF}]});
    assert.equal(spectrum.astropy,'8.0.1');assert.ok((await stat(resolve(directory,'spectrum','preview.png'))).size>1_000);
    const histogram=await plotNumericPreview(resolve(directory,'histogram'),{kind:'histogram',title:'Chandra energy counts',xLabel:'Energy (eV)',yLabel:'Counts',edges:[500,1_000,2_000,4_000,7_000],counts:[12,18,7,3]});
    assert.equal(histogram.kind,'histogram');assert.ok((await stat(resolve(directory,'histogram','preview.svg'))).size>1_000);
    const radar=await readFile(resolve(root,'tests/fixtures/telescope-families/geographos-radar/ge007.fit'));
    const values:number[]=[];for(let index=0;index<64*127;index++)values.push(radar.readDoubleBE(2880+index*8));
    const raster=await plotNumericPreview(resolve(directory,'radar'),{kind:'raster',title:'Geographos delay-Doppler',xLabel:'Native delay pixel',yLabel:'Native Doppler pixel',width:64,height:127,values,colorLabel:'Radar echo power'});
    assert.equal(raster.kind,'raster');assert.ok((await stat(resolve(directory,'radar','preview.png'))).size>1_000);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
