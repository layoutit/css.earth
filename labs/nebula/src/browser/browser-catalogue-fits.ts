/** Explicit live verification: one public FITS is rendered by IRSA, never saved by the browser. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

const directory = '.local/nebula-lab/catalogue-browser'; await mkdir(directory, {recursive:true});
const base = process.argv[2] ?? 'http://127.0.0.1:4331';
const browser = await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const context = await browser.newContext({viewport:{width:1280,height:900}}), downloads: string[] = [];
context.on('page', page => page.on('download', download => downloads.push(download.suggestedFilename())));
const page = await context.newPage();
try {
  await page.goto(`${base}/catalogue?object=m42`);
  await page.getByRole('group', {name:'Filter archive'}).getByRole('button', {name:'MAST',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('.catalogue-product-links a'));
  const source = page.locator('.catalogue-product-links a').filter({hasText:'Source'}).first();
  const href = await source.getAttribute('href'); assert.ok(href);
  const url = new URL(href); assert.equal(url.hostname,'irsa.ipac.caltech.edu'); assert.equal(url.searchParams.get('api'),'image');
  const next = context.waitForEvent('page'); await source.click(); const viewer = await next;
  await viewer.waitForLoadState('domcontentloaded');
  await viewer.waitForFunction(() => /FOV:/.test(document.body.innerText), undefined, {timeout:45000});
  // IRSA polls continuously, so network-idle is not completion. Verify actual rendered pixels.
  const deadline = Date.now() + 45000; let visible = false, screenshot: Buffer | undefined;
  while (Date.now() < deadline) {
    screenshot = await viewer.screenshot();
    const stats = await sharp(screenshot).extract({left:400,top:300,width:180,height:180}).stats();
    if (stats.channels[0]!.stdev > 8 && stats.channels[0]!.mean < 230) {visible=true;break;}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(visible, 'FITS metadata loaded but its pixels never appeared.');
  assert.deepEqual(downloads, []); await writeFile(`${directory}/fits-viewer.png`, screenshot!);
  await writeFile(`${directory}/fits-viewer.json`,JSON.stringify({status:'passed',viewer:viewer.url(),fits:url.searchParams.get('url'),visiblePixels:true,downloads},null,2));
  console.log('PASS Source click: exact public FITS rendered in IRSA with visible pixels and zero browser downloads.');
  await page.getByRole('group', {name:'Filter archive'}).getByRole('button', {name:'IRSA',exact:true}).click();
  const tableSource = page.locator('.catalogue-product-links a').filter({hasText:'Source'}).first();
  const tableHref = await tableSource.getAttribute('href'); assert.ok(tableHref);
  const tableUrl = new URL(tableHref); assert.equal(tableUrl.searchParams.get('api'), 'table');
  assert.ok(tableUrl.searchParams.get('source')?.includes('/datalink/'));
  const nextTable = context.waitForEvent('page'); await tableSource.click(); const table = await nextTable;
  await table.waitForLoadState('domcontentloaded');
  await table.waitForFunction(() => /access_url/.test(document.body.innerText), undefined, {timeout:45000});
  assert.deepEqual(downloads, []); await table.screenshot({path:`${directory}/datalink-viewer.png`});
  console.log('PASS Source click: DataLink records render as a browser table with zero downloads.');
} finally {await browser.close();}
