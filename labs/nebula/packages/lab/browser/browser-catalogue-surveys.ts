/** Actual survey JPEGs must load; a metadata table is not a successful preview. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:4331';
const directory = '.local/nebula-lab/catalogue-browser'; await mkdir(directory, {recursive:true});
const browser = await chromium.launch({headless:true}), page = await browser.newPage({viewport:{width:1500,height:1050}});
const errors: string[] = [], downloads: string[] = [], posts: string[] = [], evidence: unknown[] = [];
page.on('pageerror',error => errors.push(error.message));
page.on('download',download => downloads.push(download.suggestedFilename()));
page.on('request',request => { if(request.method() === 'POST') posts.push(request.url()); });
async function imagesReady(selector: string, count: number, width: number) {
  await page.waitForFunction(({selector,count,width}) => {
    const images = [...document.querySelectorAll<HTMLImageElement>(selector)];
    return images.length === count && images.every(image => image.complete && image.naturalWidth === width);
  }, {selector,count,width}, {timeout:60000});
}
try {
  for (const id of ['m31','m24','m42']) {
    await page.goto(`${base}/catalogue?object=${id}`);
    await imagesReady('.catalogue-survey-card img',3,512);
    assert.equal(await page.locator('.catalogue-product-table').count(),0);
    await page.screenshot({path:`${directory}/surveys-${id}.png`});
    for (const name of ['DSS2','WISE','2MASS']) {
      await page.locator('.catalogue-survey-card').filter({has:page.getByRole('heading',{name:new RegExp(`^${name}`)})}).getByRole('button',{name:'View image',exact:true}).click();
      await imagesReady('dialog[open] img',1,2048);
      evidence.push({object:id,survey:name,url:await page.locator('dialog[open] img').getAttribute('src')});
      await page.screenshot({path:`${directory}/survey-${id}-${name}.png`});
      await page.getByRole('button',{name:'Close image'}).click();
    }
    console.log(`SURVEY_IMAGES_VISIBLE ${id} previews=3 enlarged=3`);
  }
  // A failed service must show an explicit failure, not an empty successful-looking card.
  await page.route('**/hips2fits?**',route => route.abort());
  await page.reload();
  await page.getByText('Preview unavailable from CDS. Retry or open the survey source.',{exact:true}).first().waitFor();
  assert.equal(await page.getByRole('button',{name:'Retry preview'}).count(),3);
  await page.unroute('**/hips2fits?**');
  await page.getByRole('button',{name:'Retry preview'}).first().click();
  await imagesReady('.catalogue-survey-card:first-child img',1,512);
  assert.deepEqual(errors,[]); assert.deepEqual(downloads,[]); assert.deepEqual(posts,[]);
  await writeFile(`${directory}/surveys.json`,JSON.stringify({status:'passed',evidence,errors,downloads,posts},null,2));
  console.log('PASS actual M31/M24/M42 survey previews and enlarged images; error/retry; no downloads or processing.');
} finally { await browser.close(); }
