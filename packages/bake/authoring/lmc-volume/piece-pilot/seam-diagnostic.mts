/** Read-only real-site diagnostic: three ordinary CSS compositing states, never an installed fix. */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { readVolumeDatasetBank } from '@cssearth/objects/node';
import { axisWeights } from '@cssearth/renderer/volume/prepared-volume-runtime.ts';
import { worldQuaternionFromRotation } from '@cssearth/engine';
import { pilotCamera, cameraUrl } from './cameras.mts';
import { PILOT_DIR } from './source.mts';
import { need } from '../inputs.mts';
const origin=process.argv[2]??'http://127.0.0.1:4312',directory=PILOT_DIR+'seam-128/';await mkdir(directory,{recursive:true});
const bank=await readVolumeDatasetBank('src/objects/lmc-volume/prepared'),volume=bank.datasets[0]!.volume;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),rows=[];
try { const page=await browser.newPage({viewport:{width:128,height:128},deviceScaleFactor:1});
 for(const az of [30,45,60]){
  const c=pilotCamera('seam-'+az,128,[0,0,0],10,90,az),q=worldQuaternionFromRotation([c.right[0],c.up[0],c.back[0],c.right[1],c.up[1],c.back[1],c.right[2],c.up[2],c.back[2]]),weights=axisWeights({positionUnits:c.eye,orientationXyzw:q},volume.stacks,volume.frame.boundsUnits).map(w=>w.weight),sum=weights.reduce((a,b)=>a+b,0);
  await page.goto(await cameraUrl(origin,c),{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',{},{timeout:120000});
  await page.waitForFunction(()=>{const d=document.querySelector<HTMLElement>('[data-volume-dataset-object="lmc-volume"] .css-volume-detail');return d&&getComputedStyle(d).display!=='none'&&Number(getComputedStyle(d).opacity)>.9;},{},{timeout:120000});
  await page.evaluate(async()=>{const detail=document.querySelector<HTMLElement>('[data-volume-dataset-object="lmc-volume"] .css-volume-detail')!;detail.style.background='#000';const urls=[...detail.querySelectorAll<HTMLElement>('s')].flatMap(n=>[...getComputedStyle(n).backgroundImage.matchAll(/url\("?([^"\)]+)"?\)/gu)].map(m=>m[1]!));await Promise.all([...new Set(urls)].map(async url=>{const im=new Image();im.src=url;await im.decode();}));});
  const saved=await page.evaluate(()=>[...document.querySelectorAll<HTMLElement>('[data-volume-dataset-object="lmc-volume"] .css-volume-projection')].map(n=>({background:n.style.background,opacity:n.style.opacity})));
  for(const mode of ['installed-transparent','milky-way-matte','normalized-transparent']){
   const state=await page.evaluate(({mode,saved,weights,sum})=>{const roots=[...document.querySelectorAll<HTMLElement>('[data-volume-dataset-object="lmc-volume"] .css-volume-projection')];for(const[n,i]of roots.map((n,i)=>[n,i]as const)){n.style.background=mode==='milky-way-matte'?'#000':'transparent';n.style.opacity=mode==='normalized-transparent'?String(.999*weights[i]!/sum):saved[i]!.opacity;}return roots.map(n=>({opacity:getComputedStyle(n).opacity,background:getComputedStyle(n).backgroundColor}));},{mode,saved,weights,sum});
   await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));const png=await page.screenshot({path:directory+az+'-'+mode+'.png'}),{data}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});let light=0;for(let p=0;p<data.length;p+=3)for(let a=0;a<3;a++){const v=data[p+a]!/255;light+=(v<=.04045?v/12.92:((v+.055)/1.055)**2.4)*[.2126,.7152,.0722][a]!;}
   need(light>0,'The site diagnostic drew no galaxy');rows.push({azimuth:az,mode,linearLight:light,weights,state});console.log('SEAM_DIAGNOSTIC '+az+' '+mode+' '+light);
  }
 }
}finally{await browser.close();}
await writeFile(directory+'result.json',JSON.stringify({complete:true,diagnosticOnly:true,physicalModelChanged:false,method:'Actual real-site geometry and materials, measured over one common black background. Group matte/opacity changes are temporary browser diagnostics, not a source or runtime patch.',rows},null,2)+'\n');console.log('SEAM_DIAGNOSTIC_COMPLETE');
