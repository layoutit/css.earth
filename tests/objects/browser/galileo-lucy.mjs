import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const origin=process.argv[2] ?? 'http://127.0.0.1:4259',output=process.env.CSSEARTH_REVIEW_OUTPUT ?? 'output/playwright/galileo-lucy/review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],reports=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
 const ready=async id=>{
  await page.locator(`.planet-stage[data-object-id="${id}"][aria-busy="false"]`).waitFor();
  assert.equal(await page.locator('html').getAttribute('data-ready'),'true');
  assert.equal(await page.locator('.planet-stage').count(),1);
 };
 const painted=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 for(const id of ['dactyl','dinkinesh','selam']) {
  await page.goto(`${origin}/${id}/`,{waitUntil:'networkidle'});await ready(id);
  const selector=await page.locator('button[name="lens"]').innerText();assert.match(selector,/Shape/);
  for(const shadows of [false,true]) {
   await page.locator('input[name="shadows"]').evaluate((input,checked)=>{if(input.checked!==checked)input.click();},shadows);
   await painted();await page.screenshot({path:`${output}/${id}-shadows-${shadows}.png`});
  }
  reports.push({id,selector,ready:true,scenes:1,shadows:[false,true]});
  if(id==='dinkinesh')continue;
  await page.mouse.move(1100,450);
  await page.mouse.wheel(0,id==='dactyl'?860:720);
  const group=page.locator(`[data-context-group="${id}"]`);
  await page.waitForFunction(id=>Number(getComputedStyle(document.querySelector(`[data-context-label="${id}"]`)).opacity)>0.1,id);
  const cue=await group.evaluate(group=>({placement:group.dataset.contextPlacement,label:group.querySelector('[data-context-label]').textContent,
   labelOpacity:getComputedStyle(group.querySelector('[data-context-label]')).opacity,
   indicatorRadius:getComputedStyle(group.querySelector('[data-context-indicator]')).borderRadius,
   circleStroke:getComputedStyle(group.querySelector('[data-context-indicator]')).boxShadow,
   standardCircleStroke:getComputedStyle(group.parentElement.querySelector('[data-context-group]:not([data-context-placement]):not([data-context-selected="true"]) > [data-context-indicator]')).boxShadow,
   orbitStroke:getComputedStyle(group.querySelector('.context-orbit s:nth-child(odd)')).height,
   gapColors:[...new Set([...group.querySelectorAll('.context-orbit s:nth-child(even)')].map(s=>getComputedStyle(s).backgroundColor))],
   dashColors:[...new Set([...group.querySelectorAll('.context-orbit s:nth-child(odd)')].map(s=>getComputedStyle(s).backgroundColor))]}));
  assert.equal(cue.placement,'approximate');assert.match(cue.label,/\(approx\)/);assert.equal(cue.indicatorRadius,'50%');
  assert.equal(cue.circleStroke,cue.standardCircleStroke);assert.equal(cue.orbitStroke,'1px');assert.match(cue.circleStroke,/ 0px 0px 0px 1px inset$/);
  assert.deepEqual(cue.gapColors,['rgba(0, 0, 0, 0)']);assert(cue.dashColors.length&&cue.dashColors.every(color=>color!=='rgba(0, 0, 0, 0)'));
  await page.screenshot({path:`${output}/${id}-approximate-orbit.png`});reports.push({id,orbitCue:cue,url:page.url()});
  const parent=id==='dactyl'?'ida':'dinkinesh';await page.locator(`.planet-breadcrumbs a[href="/${parent}/"]:visible`).first().click();await ready(parent);
  reports.push({navigation:`${id} → ${parent}`,ready:true,scenes:1});
 }
 assert.deepEqual(errors,[]);
 await writeFile(`${output}/report.json`,JSON.stringify({revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:browser.version(),origin,mode:process.env.CSSEARTH_REVIEW_MODE ?? 'browser review',reports,errors},null,2)+'\n');
 process.stdout.write('PASS production views, lighting, dashed orbits and parent navigation\n');
} finally {await browser.close();}
