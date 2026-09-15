import { chooseLabObject } from './browser-object-picker.ts';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import sharp from 'sharp';

declare global { interface Window { __coherentNodes?: Element[]; } }

interface Subject { id: string; directory: string; comparisonGroup?: string; }
interface PoseReceipt {
  pose: string; path: string; distance: string | null; resources: string[];
  bankOpacities: { axis: 'x' | 'y' | 'z'; opacity: string; visibility: string }[]; nodeCount: number;
}
interface SubjectReceipt { id: string; referenceDepthToDistanceRatio: number; poses: PoseReceipt[]; }
interface Report {
  subjects: SubjectReceipt[]; paired: { from: string; to: string; pose: string; distance: string | null }[];
  errors: string[]; failedRequests: [number, string][]; passed: boolean; failure?: string;
}

const baseURL = process.argv[2] ?? 'http://127.0.0.1:4331';
const subjectsPath = process.argv[3] ?? 'labs/nebula/packages/lab/src/state/subjects.json';
const outputRoot = process.argv[4] ?? '.local/nebula-lab/coherent';
const screenshots = `${outputRoot}/screenshots`;
const expected = ['tarantula-broad', 'tarantula-localized', 'tarantula-coherent', 'orion-broad', 'orion-localized', 'orion-coherent'];
const poses = ['front', 'y-plus-30', 'y-plus-60', 'edge-y', 'x-plus-30', 'x-plus-60', 'edge-x'];
const subjects = JSON.parse(await readFile(subjectsPath, 'utf8')) as Subject[];
await mkdir(screenshots, { recursive: true });
assert.deepEqual(expected.filter(id => subjects.some(subject => subject.id === id)), expected, 'Expected coherent subjects are not ready.');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report: Report = { subjects: [], paired: [], errors: [], failedRequests: [], passed: false };
page.on('pageerror', error => report.errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) report.failedRequests.push([response.status(), response.url()]); });

async function waitReady() {
  await page.waitForFunction(() => document.querySelector<HTMLElement>('#viewer')?.dataset.ready === 'true', null, { timeout: 30000 });
}
async function runtimeReceipt() {
  return page.evaluate(() => {
    const axes = ['x', 'y', 'z'] as const;
    const forbiddenNodes = [...document.querySelectorAll('canvas,svg')].map(node => node.nodeName.toLowerCase());
    const forbiddenStyles = [...document.querySelectorAll('*')].flatMap(node => {
      const style = getComputedStyle(node), bad: string[] = [];
      if (style.clipPath !== 'none') bad.push('clip-path');
      if (style.maskImage !== 'none' || style.webkitMaskImage !== 'none') bad.push('mask');
      if (style.filter !== 'none') bad.push('filter');
      if (style.backgroundImage.includes('gradient')) bad.push('gradient');
      if (style.mixBlendMode !== 'normal') bad.push('blend-mode');
      return bad;
    });
    const banks = [...document.querySelectorAll<HTMLElement>('#viewer .css-volume-projection, #viewer [data-image-layer-axis]')];
    return {
      forbiddenNodes, forbiddenStyles,
      resources: performance.getEntriesByType('resource').map(entry => entry.name).filter(name => name.includes('/prepared/')),
      bankOpacities: banks.map((node, index) => ({ axis: axes[index]!, opacity: getComputedStyle(node).opacity, visibility: getComputedStyle(node).visibility })),
      nodeCount: document.querySelectorAll('#viewer .css-volume-mesh s').length,
    };
  });
}
async function poseScreenshot(subjectId: string, pose: string): Promise<PoseReceipt> {
  const before = await page.locator('#viewer').getAttribute('data-camera-revision');
  await page.selectOption('#camera-pose', pose);
  await page.waitForFunction(value => document.querySelector<HTMLSelectElement>('#camera-pose')?.value === value, pose);
  if (pose !== 'front') await page.waitForFunction(value => document.querySelector<HTMLElement>('#viewer')?.dataset.cameraRevision !== value, before);
  const receipt = await runtimeReceipt();
  assert.deepEqual(receipt.forbiddenNodes, [], `${subjectId}/${pose}: forbidden scene node`);
  assert.deepEqual(receipt.forbiddenStyles, [], `${subjectId}/${pose}: forbidden runtime style`);
  assert.equal(receipt.bankOpacities.length, 3, `${subjectId}/${pose}: expected x/y/z banks`);
  assert.ok(receipt.bankOpacities.some(bank => bank.visibility === 'visible' && bank.opacity !== '0'), `${subjectId}/${pose}: no visible bank`);
  assert.ok(receipt.nodeCount > 0, `${subjectId}/${pose}: prepared scene has no retained leaves`);
  if (pose !== 'front') assert.notEqual(await page.locator('#viewer').getAttribute('data-camera-revision'), before, `${subjectId}/${pose}: pose did not publish`);
  const stable = await page.evaluate(() => {
    const retained = window.__coherentNodes;
    const current = [...document.querySelectorAll('#viewer .css-volume-mesh s')];
    return Boolean(retained && retained.length > 0 && retained.length === current.length && retained.every((node, index) => node === current[index]));
  });
  assert.equal(stable, true, `${subjectId}/${pose}: 3D leaves were remounted`);
  const path = `${screenshots}/${subjectId}-${pose}.png`;
  await page.screenshot({ path });
  return { pose, path, distance: await page.locator('#viewer').getAttribute('data-distance'), ...receipt };
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}
async function writeContactSheet(files: string[]) {
  const thumbWidth = 360, thumbHeight = 250, columns = 3;
  const thumbs = await Promise.all(files.map(async (path, index) => ({ input: await sharp(path).resize(thumbWidth, thumbHeight, { fit: 'cover' }).png().toBuffer(), left: (index % columns) * thumbWidth, top: Math.floor(index / columns) * thumbHeight })));
  await sharp({ create: { width: columns * thumbWidth, height: Math.ceil(files.length / columns) * thumbHeight, channels: 3, background: '#000' } }).composite(thumbs).png().toFile(`${outputRoot}/contact-sheet.png`);
  const cards = files.map(path => {
    const relative = `screenshots/${basename(path)}`;
    return `<a class="card" href="${htmlEscape(relative)}"><img loading="lazy" src="${htmlEscape(relative)}" alt="${htmlEscape(basename(path, '.png'))}"><span>${htmlEscape(basename(path, '.png'))}</span></a>`;
  }).join('\n');
  await writeFile(`${outputRoot}/contact-sheet.html`, `<!doctype html><meta charset="utf-8"><title>Coherent camera poses</title><style>body{margin:24px;background:#000;color:#ddd;font:14px system-ui,sans-serif}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}.card{color:inherit;text-decoration:none}.card img{display:block;width:100%;aspect-ratio:1.44;object-fit:cover;background:#111}.card span{display:block;padding-top:6px}</style><h1>Coherent camera poses</h1><div class="grid">${cards}</div>\n`);
}

try {
  for (const subject of expected) {
    await page.goto(`${baseURL}/?subject=${encodeURIComponent(subject)}&tab=reconstruction`, { waitUntil: 'domcontentloaded' });
    await waitReady();
    const descriptor = JSON.parse(await readFile(`${subjects.find(value => value.id === subject)!.directory}/object.json`, 'utf8'));
    const bounds = descriptor.properties.volume.boundsUnits;
    const referenceDepthToDistanceRatio = (bounds.max[2] - bounds.min[2]) /
      Number(await page.locator('#viewer').getAttribute('data-distance'));
    assert.ok(referenceDepthToDistanceRatio > 0 && referenceDepthToDistanceRatio < .005,
      `${subject}: close-camera projection no longer approximates the photograph columns`);
    await page.evaluate(() => { window.__coherentNodes = [...document.querySelectorAll('#viewer .css-volume-mesh s')]; });
    const posesReport: PoseReceipt[] = [];
    for (const pose of poses) posesReport.push(await poseScreenshot(subject, pose));
    report.subjects.push({ id: subject, referenceDepthToDistanceRatio, poses: posesReport });
  }
  const byGroup = new Map<string, string[]>();
  for (const subject of subjects.filter(value => expected.includes(value.id))) {
    if (!subject.comparisonGroup) throw new Error(`${subject.id}: missing comparisonGroup`);
    const group = byGroup.get(subject.comparisonGroup) ?? []; group.push(subject.id); byGroup.set(subject.comparisonGroup, group);
  }
  for (const group of byGroup.values()) {
    assert.equal(group.length, 3, `${group[0]}: expected three paired variants`);
    await page.goto(`${baseURL}/?subject=${encodeURIComponent(group[0])}&tab=reconstruction`, { waitUntil: 'domcontentloaded' }); await waitReady();
    await page.selectOption('#camera-pose', 'y-plus-60');
    const box = await page.locator('#viewer').boundingBox(); assert.ok(box, `${group[0]}: viewer has no bounds`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); const before = await page.locator('#viewer').getAttribute('data-distance');
    await page.mouse.wheel(0, -500); await page.waitForFunction(value => document.querySelector<HTMLElement>('#viewer')?.dataset.distance !== value, before); await page.waitForTimeout(350);
    const retained = { pose: await page.locator('#camera-pose').inputValue(), distance: await page.locator('#viewer').getAttribute('data-distance') };
    for (const id of group.slice(1)) {
      await chooseLabObject(page, id); await waitReady();
      assert.equal(await page.locator('#camera-pose').inputValue(), retained.pose, `${id}: paired pose changed`);
      assert.equal(await page.locator('#viewer').getAttribute('data-distance'), retained.distance, `${id}: paired distance changed`);
      report.paired.push({ from: group[0], to: id, ...retained });
    }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.failedRequests, []);
  const files = report.subjects.flatMap(item => item.poses.map(pose => pose.path));
  await writeContactSheet(files); report.passed = true;
} catch (error) {
  report.failure = error instanceof Error ? error.stack ?? error.message : String(error);
}
await writeFile(`${outputRoot}/report.json`, JSON.stringify(report, null, 2));
console.log('COHERENT_BROWSER_COMPLETE', JSON.stringify({ passed: report.passed, subjects: report.subjects.length, paired: report.paired.length, screenshots: report.subjects.reduce((sum, item) => sum + item.poses.length, 0) }));
await browser.close();
process.exit(report.passed ? 0 : 1);
