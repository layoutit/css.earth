import {test} from 'node:test';import assert from 'node:assert/strict';import {buildSync} from 'esbuild';import {chromium} from 'playwright';import {PNG} from 'pngjs';

test('a wanted faint nearby dot never blinks as a zoom crosses raster phases',async()=>{
 const source=`import {mountBatchedSpatialPoints} from './packages/renderer/src/universe/points/batched-spatial-points.ts';
 const frame={referenceFrame:'test',epochJdTt:1,originM:[0,0,0],localToReferenceXyzw:[0,0,0,1],metersPerUnit:1,boundsUnits:{min:[-20,-20,-20],max:[20,20,20]}};
 const field=mountBatchedSpatialPoints({host:document.body,frame,points:[{positionUnits:[.1,.1,-10]}],className:'test',coherent:true,stylePoint:()=>({colorCss:'#606060',opacity:1,radiusPx:.5}),paintPalette:['#606060ff@0.5']});
 Reflect.set(window,'paint',z=>field.publish({world:{referenceFrame:'test',epochJdTt:1,pose:{positionM:[0,0,z],orientationXyzw:[0,0,0,1]}},viewport:{focalPixels:400,widthPixels:100,heightPixels:100,principalOffsetPixels:[0,0]}}));`;
 const js=buildSync({stdin:{contents:source,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022'}).outputFiles[0]!.text;
 const browser=await chromium.launch();
 try{const page=await browser.newPage({viewport:{width:100,height:100},deviceScaleFactor:1});await page.setContent('<body style="margin:0;background:black"></body>');await page.addScriptTag({content:js});const peaks=[];
 for(let i=0;i<16;i++){await page.evaluate(z=>Reflect.get(window,'paint')(z),i*.35);const im=PNG.sync.read(await page.screenshot());let peak=0;for(let at=0;at<im.data.length;at+=4)peak=Math.max(peak,im.data[at]!+im.data[at+1]!+im.data[at+2]!);peaks.push(peak);}
 assert.ok(peaks.every(peak=>peak>=150),'the wanted faint dot remains above the original blink detector threshold at every raster phase: '+peaks.join(','));
 assert.equal(new Set(peaks).size,1,'a fixed opacity and size keep their peak brightness during the zoom');
 }finally{await browser.close();}
});
