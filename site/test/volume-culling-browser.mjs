import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { cameraPoseToReferenceFrame } from '@cssearth/engine';

const origin=process.argv[2]??process.env.CSSEARTH_TEST_ORIGIN??'http://localhost:4210';
const saved='/sun/?v=MIJDwTb3-eIizz_FaIxzgM8VP-L9-KiW65M_uwcnPmtsNAABAAAAAAAAAAA';
const output=resolve('.local/milky-way-integration/volume-culling');
const volume=JSON.parse(await readFile('src/objects/milky-way/prepared/volume.json','utf8')).data;
const context=JSON.parse(await readFile('src/planets/sun/prepared/world-context.json','utf8'));
const clip={x:370,y:100,width:1040,height:760};
const report={url:new URL(saved,origin).href,clip,cases:[],errors:[]};
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL??'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
page.on('pageerror',error=>report.errors.push(error.message));
try {
  await page.goto(report.url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__sun?.ready && document.querySelectorAll('[data-volume-slice]').length===288,null,{timeout:30000});
  const motion=page.locator('input[name="motion"]');
  if(await motion.count() && await motion.isChecked())await motion.uncheck({force:true});
  // Resolve every actual CSS image before the first pixel measurement; no arbitrary asset-load delay.
  await page.evaluate(async()=>{
    const urls=new Set([...document.querySelectorAll('[data-volume-slice]')].map(node=>getComputedStyle(node).backgroundImage.slice(5,-2)));
    await Promise.all([...urls].map(url=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve();image.onerror=()=>reject(new Error(`Missing volume image ${url}`));image.src=url;})));
  });
  await page.evaluate(()=>{window.__cullingNodes=[...document.querySelectorAll('[data-volume-slice]')];});
  await checkCase('saved-view',null,10);
  const s=Math.SQRT1_2;
  const poses=[
    {name:'x-axis',eye:[30,0,0],orientation:[0,s,0,s],minimumRatio:3},
    {name:'y-axis',eye:[0,30,0],orientation:[-s,0,0,s],minimumRatio:3},
    {name:'z-axis',eye:[0,0,30],orientation:[0,0,0,1],minimumRatio:10},
    // At equal weights the broken opacity<1 branch implicitly flattens itself, so about half the image survives.
    {name:'xz-handoff',eye:[30*s,0,30*s],orientation:[0,Math.sin(Math.PI/8),0,Math.cos(Math.PI/8)],minimumRatio:1.25},
  ];
  for(const pose of poses){
    const physical=cameraPoseToReferenceFrame({positionM:pose.eye.map(value=>value*volume.frame.metersPerUnit),orientationXyzw:pose.orientation},volume.frame);
    const world={referenceFrame:volume.frame.referenceFrame,epochJdTt:volume.frame.epochJdTt,pose:physical};
    await page.evaluate(({world,frame})=>window.__sun.camera.applyWorldCamera(world,frame),{world,frame:context.frame});
    await checkCase(pose.name,world,pose.minimumRatio);
  }
  assert.deepEqual(report.errors,[],'browser must not throw while projecting the volume');
  assert.equal(await page.evaluate(()=>window.__cullingNodes.every(node=>node.isConnected)),true,'rotations and CSS mutation must retain the original leaves');
  report.result='PASS';
  console.log(`PASS volume culling: ${report.cases.length} rendered orientations; preserve-3d mutation rejected in each`);
} finally {
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();
}

async function settle(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function measure(name){
  await settle();const bytes=await page.screenshot({clip});await writeFile(resolve(output,`${name}.png`),bytes);
  const {data,info}=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
  let energy=0,litPixels=0;
  for(let offset=0;offset<data.length;offset+=info.channels){const light=.2126*data[offset]+.7152*data[offset+1]+.0722*data[offset+2];if(light>=8){energy+=light;litPixels++;}}
  return {energy,litPixels};
}
async function checkCase(name,world,minimumRatio){
  const baseline=await measure(`${name}-fixed`);
  assert(baseline.energy>50000 && baseline.litPixels>1000,`${name}: prepared galaxy must contain substantial rendered light`);
  const layers=await page.evaluate(()=>[...document.querySelectorAll('.css-volume-projection')].map(node=>({axis:node.dataset.volumeAxis,opacity:getComputedStyle(node).opacity,visibility:getComputedStyle(node).visibility})));
  await page.evaluate(()=>{for(const root of document.querySelectorAll('.css-volume-projection'))root.style.transformStyle='preserve-3d';});
  let mutant;
  try{mutant=await measure(`${name}-mutant`);}finally{await page.evaluate(()=>{for(const root of document.querySelectorAll('.css-volume-projection'))root.style.removeProperty('transform-style');});}
  const restored=await measure(`${name}-restored`),ratio=baseline.energy/Math.max(1,mutant.energy);
  report.cases.push({name,world,layers,baseline,mutant,restored,ratio,minimumRatio});
  assert(ratio>minimumRatio,`${name}: preserve-3d mutation should remove visible galaxy light (ratio ${ratio}, required ${minimumRatio})`);
  assert(Math.abs(restored.energy-baseline.energy)/baseline.energy<.03,`${name}: restoring projection isolation must restore the rendered galaxy`);
}
