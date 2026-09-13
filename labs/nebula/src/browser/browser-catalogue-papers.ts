/** Inspect real imported bibliography, not fabricated paper cards. */
import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { paperRoot,readPaperIndex } from '../catalogue/papers/types';

const base=process.argv[2]??'http://127.0.0.1:4331',directory='.local/nebula-lab/catalogue-browser';await mkdir(directory,{recursive:true});
const index=readPaperIndex(JSON.parse(await readFile(`${paperRoot}/index.json`,'utf8')));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1500,height:1050}});
const errors:string[]=[],posts:string[]=[],downloads:string[]=[],objects=new Set(['m42','m31','m40']);
page.on('pageerror',e=>errors.push(e.message));page.on('download',d=>downloads.push(d.suggestedFilename()));
page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());const match=r.url().match(/\/papers\/(m\d+)-[a-f0-9]+\.json\.gzip$/);if(match)assert.ok(objects.has(match[1]!),'Unselected bibliography loaded');});
async function ready(){await page.waitForSelector('.catalogue-papers[aria-busy="false"]');}
try{
  await page.addInitScript(()=>localStorage.setItem('papers-preserve','unchanged'));
  await page.goto(`${base}/catalogue?object=m42&view=papers`);await ready();
  assert.equal(await page.getByRole('button',{name:'Papers',exact:true}).getAttribute('aria-pressed'),'true');
  assert.ok(await page.locator('.catalogue-paper').count()>0);
  await page.getByRole('button',{name:'Abstract',exact:true}).first().click();
  assert.ok((await page.locator('.catalogue-paper-abstract').first().innerText()).length>50);
  await page.screenshot({path:`${directory}/papers-m42.png`});
  await page.getByRole('combobox',{name:'Topic',exact:true}).selectOption('Kinematics');
  assert.ok(await page.locator('.catalogue-paper').count()>0);
  await page.getByRole('searchbox',{name:'Find paper',exact:true}).fill('no-such-paper-sentinel');
  await page.getByText('No papers match these filters.',{exact:true}).waitFor();
  await page.getByRole('searchbox',{name:'Find paper',exact:true}).fill('');
  await page.getByRole('combobox',{name:'Topic',exact:true}).selectOption('all');
  for(const id of ['m31','m40']){
    assert.equal(index.objects.find(o=>o.objectId===id)!.status,'complete');
    await page.locator(`[data-object-id="${id}"]`).click();await ready();
    assert.ok(await page.locator('.catalogue-paper').count()>0);
    assert.equal(new URL(page.url()).searchParams.get('view'),'papers');
  }
  await page.reload();await ready();assert.equal(new URL(page.url()).searchParams.get('object'),'m40');
  await page.setViewportSize({width:700,height:900});await page.screenshot({path:`${directory}/papers-compact.png`});
  const m40=index.objects.find(o=>o.objectId==='m40')!;assert.ok(m40.path);
  await page.route(`**/${m40.path}`,r=>r.fulfill({body:'tampered'}));
  await page.getByRole('button',{name:'Reload papers'}).click();await ready();
  await page.locator('.catalogue-paper-status').filter({hasText:/integrity/}).waitFor();assert.equal(await page.locator('.catalogue-paper').count(),0);
  await page.unroute(`**/${m40.path}`);
  await page.route(`**/${paperRoot}/index.json`,r=>r.fulfill({status:404,body:'missing'}));
  await page.getByRole('button',{name:'Reload papers'}).click();await ready();
  await page.getByText('Paper index not prepared.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);assert.deepEqual(downloads,[]);
  assert.equal(await page.evaluate(()=>localStorage.getItem('papers-preserve')),'unchanged');
  await writeFile(`${directory}/papers.json`,JSON.stringify({status:'passed',objects:[...objects],abstract:true,filters:true,urlPersistence:true,hashGuard:true,missingIndex:true,errors,posts,downloads},null,2));
  console.log('PASS real M42/M31/M40 bibliography, abstracts, topic/search, URL persistence, integrity guard, missing index; no PDF downloads or processing.');
}catch(error){console.log((await page.locator('.catalogue-papers').innerText()).slice(-5000));await page.screenshot({path:`${directory}/papers-failure.png`});throw error;}finally{await browser.close();}
