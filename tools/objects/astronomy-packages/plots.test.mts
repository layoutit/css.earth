import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
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

test('scatter-ellipses draws k-sigma covariance contours that match the closed-form 2×2 eigen solution',async()=>{
  const directory=await mkdtemp(resolve(tmpdir(),'family-ellipses-'));
  try {
    // Oracle: closed-form eigenvalues and principal angle of [[a,b],[b,c]], independent of NumPy's eigh.
    const covariance=[4,1.5,1] as const,[a,b,c]=covariance,mean=(a+c)/2,radius=Math.hypot((a-c)/2,b),major=Math.sqrt(mean+radius),minor=Math.sqrt(mean-radius),angle=Math.atan2(2*b,a-c)/2*180/Math.PI;
    const drawn=await plotNumericPreview(resolve(directory,'ellipses'),{kind:'scatter-ellipses',title:'Offsets',xLabel:'East (mas)',yLabel:'North (mas)',invertX:true,origin:{label:'star'},points:[{x:10,y:-5,label:'b',covariance},{x:-3,y:2,label:'no error'}]});
    assert.equal(drawn.kind,'scatter-ellipses');assert.equal(drawn.ellipses?.length,3);assert.ok((await stat(resolve(directory,'ellipses','preview.svg'))).size>1_000);
    for(const [index,ellipse] of drawn.ellipses!.entries()){const k=index+1;assert.equal(ellipse.sigma,k);assert.equal(ellipse.label,'b');assert.deepEqual([ellipse.x,ellipse.y],[10,-5]);
      assert.ok(Math.abs(ellipse.width-2*k*major)<1e-9&&Math.abs(ellipse.height-2*k*minor)<1e-9,`axes at ${k}σ`);assert.ok(Math.abs(((ellipse.angleDeg-angle)%180+180)%180)<1e-9||Math.abs(((ellipse.angleDeg-angle)%180+180)%180-180)<1e-9,`angle ${ellipse.angleDeg} vs ${angle}`);}
    await assert.rejects(plotNumericPreview(resolve(directory,'singular'),{kind:'scatter-ellipses',title:'Singular',xLabel:'x',yLabel:'y',points:[{x:0,y:0,label:'s',covariance:[1,1,1]}]}),/positive-definite/u);
    await assert.rejects(plotNumericPreview(resolve(directory,'levels'),{kind:'scatter-ellipses',title:'Levels',xLabel:'x',yLabel:'y',sigmaLevels:[2,1],points:[{x:0,y:0}]}),/increasing/u);
  } finally { await rm(directory,{recursive:true,force:true}); }
});

/** The top-left pixel of a PNG and the fill of the SVG figure patch: the two places a figure background shows. */
export async function figureBackgroundPixels(png:string,svg:string){const image=PNG.sync.read(await readFile(png)),svgText=await readFile(svg,'utf8'),patch=/<g id="patch_1">\s*<path[^>]*style="fill: ?([^;"]+)/u.exec(svgText);return{rgba:[...image.data.subarray(0,4)],svgFill:patch?.[1]??'absent'};}
test('numeric previews are transparent by default and opaque on request, in both PNG and SVG',async()=>{
  const directory=await mkdtemp(resolve(tmpdir(),'family-background-'));
  try {
    const preview={kind:'histogram' as const,title:'Counts',xLabel:'x',yLabel:'n',edges:[0,1,2],counts:[3,4]};
    const clear=await plotNumericPreview(resolve(directory,'clear'),preview),solid=await plotNumericPreview(resolve(directory,'solid'),preview,{figureBackground:'opaque'});
    assert.equal(clear.figureBackground,'transparent');assert.equal(solid.figureBackground,'opaque');
    const a=await figureBackgroundPixels(resolve(directory,'clear','preview.png'),resolve(directory,'clear','preview.svg')),b=await figureBackgroundPixels(resolve(directory,'solid','preview.png'),resolve(directory,'solid','preview.svg'));
    assert.equal(a.rgba[3],0);assert.notEqual(a.svgFill,'#ffffff');assert.deepEqual(b.rgba,[255,255,255,255]);assert.equal(b.svgFill,'#ffffff');
    await assert.rejects(plotNumericPreview(resolve(directory,'bad'),preview,{figureBackground:'white' as never}),/transparent or opaque/u);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
