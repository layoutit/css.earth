import { createTestPage } from './browser-observations.mts';
import { required } from '../../tools/test-values.mts';
import { requireRecord } from '../../tools/source-values.mts';
import { shape, array, text, optional } from '../../tools/objects/terrestrial-layers/source-records.mts';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = 'output/playwright/diagnostic-recorder';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary', headless: true });
const errors:string[] = [];
try {
  const page = await createTestPage(browser,{ viewport: { width: 1995, height: 1236 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/sun/?overview=solar-system&v=QIbBkSLwnW4k1MGFkmedQymlwhnOcujO7eZBQsczQAAAAD-gLB5wu8pjv-K4lOO5D4K_x4IgKqGAwAABAAAAAAAAAAA');
  await page.waitForFunction(() => window.__cssEarth?.ready);
  await page.getByRole('button', { name: 'Record diagnostic data' }).click();
  const id = required(await page.evaluate(() => window.__cssearthTest.required(window.__cssEarthRecorder,'diagnostic recorder').id));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Tracing.start', { categories: 'blink.user_timing,devtools.timeline,cc,benchmark', transferMode: 'ReturnAsStream' });
  await page.locator('[data-context-label][data-object-navigate="makemake"]').evaluate(node => window.__cssearthTest.htmlElement(node).click());
  await page.waitForFunction(() => performance.getEntriesByName('cssEarth:navigation:finished').length > 0);
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Stop and save diagnostic recording' }).click();
  const download = await pendingDownload;
  await download.saveAs(`${output}/recording.json`);
  const complete = new Promise<string>((resolve,reject) => cdp.once('Tracing.tracingComplete', event => {
    if(typeof event.stream==='string')resolve(event.stream);else reject(new Error('Chrome trace stream missing'));
  }));
  await cdp.send('Tracing.end');
  const stream = await complete; let trace = '';
  while (true) { const part = await cdp.send('IO.read', { handle: stream }); trace += Buffer.from(part.data,part.base64Encoded?'base64':'utf8').toString('utf8'); if (part.eof) break; }
  await cdp.send('IO.close', { handle: stream });
  await writeFile(`${output}/trace.json`, trace);
  const recording = shape({id:text,metadata:shape({userAgent:text}),samples:array(shape({state:requireRecord})),events:array(shape({type:text,name:optional(text),detail:optional(requireRecord)})),summary:optional(requireRecord)})(JSON.parse(await readFile(`${output}/recording.json`, 'utf8')));
  assert.equal(recording.id, id);
  assert.ok(recording.metadata.userAgent.includes(`Chrome/${browser.version().split('.')[0]}.`));
  assert.ok(recording.samples.length > 10);
  assert.ok(recording.samples.every(sample => !sample.state.captureError));
  assert.ok(recording.samples.some(sample => sample.state.active === 'sun' && sample.state.camera));
  assert.ok(recording.samples.some(sample => sample.state.active === 'makemake' && sample.state.resources));
  assert.ok(recording.samples.some(sample => Number(requireRecord(sample.state.geometry).retainedLeaves) > 1000));
  const phases = recording.events.filter(event => event.type === 'mark').map(event=>({...event,name:required(event.name)})).filter(event=>event.name.startsWith('cssEarth:navigation:'));
  assert.ok(phases.some(event => event.name.endsWith(':finished')));
  assert.ok(phases.every(event => required(event.detail).recordingId === id));
  const traceEvents = shape({traceEvents:array(requireRecord)})(JSON.parse(trace)).traceEvents;
  assert.ok(traceEvents.some(event => event.name === 'cssEarth:navigation:requested' && JSON.stringify(event.args).includes(id)));
  assert.equal(await page.evaluate(() => window.__cssearthTest.required(window.__cssEarthRecorder,'diagnostic recorder').id), null);
  await page.getByRole('button', { name: 'Record diagnostic data' }).click();
  assert.notEqual(await page.evaluate(() => window.__cssearthTest.required(window.__cssEarthRecorder,'diagnostic recorder').id), id);
  await page.evaluate(() => window.__cssearthTest.required(window.__cssEarthRecorder,'diagnostic recorder').stop('dispose'));
  await page.screenshot({ path: `${output}/header.png` });
  assert.deepEqual(errors, []);
  const report = { browser: browser.version(), id, samples: recording.samples.length, summary: recording.summary,
    downloadedBytes: (await readFile(`${output}/recording.json`)).length, phases: phases.map(event => event.name), errors };
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
