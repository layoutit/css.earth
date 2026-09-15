/** Inspect CLI-prepared candidates through their public lab URLs without recompiling. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { readCompilerResult } from '../src/features/compiler/result.ts';
import { assertCompilerSceneRetained, blockProcessingWrites, compilerPresentation, delayNextBitmap, retainCompilerScene } from './browser-regression';

const base = process.argv[2] ?? 'http://127.0.0.1:4331';
const checkCancellation = process.argv.includes('--cancel');
const candidates = process.argv.slice(3).filter(value => value !== '--cancel'); if (!candidates.length) candidates.push('m42');
if (candidates.some(id => !/^[a-z0-9-]+$/.test(id))) throw new TypeError('Invalid candidate id.');
const output = '.local/nebula-lab/candidate-published-browser'; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1050 }, serviceWorkers: 'block' });
// Install before navigation: a failed display regression must not start real work.
const writeGuard = await blockProcessingWrites(context);
const page = await context.newPage(), errors: string[] = [], posts: string[] = [];
const failedRequests: { status: number; url: string }[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
page.on('response', response => { if (response.status() >= 400) failedRequests.push({ status: response.status(), url: response.url() }); });
async function ready() {
  await page.waitForFunction(() => Boolean(document.querySelector('.compiler-progress [role="alert"], .compiler-stage [role="alert"]')) ||
    document.querySelector('.compiler-controls')?.getAttribute('data-busy') === 'false' &&
    document.querySelector('.compiler-stage')?.getAttribute('data-compiler-ready') === 'true', null, { timeout: 60000 });
  assert.deepEqual(await page.locator('.compiler-progress [role="alert"], .compiler-stage [role="alert"]').allTextContents(), []);
}
async function material(id: string, mode = 'textured') {
  await page.waitForFunction(({ id, mode }) => {
    const root = document.querySelector('[data-compiler-root]');
    return root?.getAttribute('data-material') === mode && (mode === 'neutral' || root?.getAttribute('data-lens') === id);
  }, { id, mode }, { timeout: 60000 });
}
async function snapshot(name: string) { await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); await page.screenshot({ path: `${output}/${name}.png` }); }
async function starPresentation() {
  return page.locator('div[data-compiler-stars] s').evaluateAll(items => items.map(item => {
    const node = item as HTMLElement, rect = node.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width,
      color: node.style.backgroundColor, atlas: node.style.backgroundImage, tile: node.style.backgroundPosition,
      alpha: node.style.opacity, visible: getComputedStyle(node).visibility !== 'hidden' };
  }));
}
const receipts: { id: string; result: string; lenses: string[]; stars: number;
  retainedNodes: true; savedPresentation: Awaited<ReturnType<typeof compilerPresentation>>; lateDecode: string; sourceRace: string }[] = [];
try {
  for (const id of candidates) {
    console.log(`PREPARED_CANDIDATE_START ${id}`);
    await page.goto(`${base}/reconstruction?subject=${id}&inspection=compiler`); await ready();
    const result = await page.locator('.compiler-controls').getAttribute('data-result-id'); assert.ok(result);
    const prepared = readCompilerResult(JSON.parse(await readFile(`.local/nebula-lab/compiler/${result}/result.json`, 'utf8')));
    const lenses = await page.locator('#compiler-lens option').evaluateAll(items => items.map(item => (item as HTMLOptionElement).value));
    assert.ok(lenses.length > 0);
    const stars = await page.locator('div[data-compiler-stars] s').count(); assert.ok(stars > 0);
    await material(await page.locator('#compiler-lens').inputValue());
    const retained = await retainCompilerScene(page);
    let previousStars: Awaited<ReturnType<typeof starPresentation>> | undefined;
    for (const lens of lenses) {
      await page.locator('#compiler-lens').selectOption(lens); await material(lens); await snapshot(`${id}-${lens}-earth`);
      await assertCompilerSceneRetained(page, retained, `${id}/${lens}/Earth lens`);
      const currentStars = await starPresentation();
      assert.equal(currentStars.length, stars, 'Changing image recreated the stellar catalogue.');
      if (prepared.scene.starSprites) assert.ok(currentStars.every(star => star.atlas.startsWith('url("blob:') && star.color === 'transparent'),
        'Prepared core/halo atlas was replaced with flat stellar disks.');
      if (previousStars && id === 'm45') assert.deepEqual(currentStars, previousStars,
        'An image lens changed the shared optical reference catalogue.');
      if (previousStars && id === 'm42') {
        let compared = 0;
        currentStars.forEach((star, i) => {
          const previous = previousStars![i]!;
          if (!star.visible || !previous.visible || !star.width || !previous.width) return;
          compared++;
          assert.ok(Math.hypot(star.x - previous.x, star.y - previous.y) < .05, 'Photometry changed a star sky position.');
        });
        assert.ok(compared > 100, 'Not enough shared stars remained visible for the lens-switch check.');
        assert.ok(currentStars.some((star, i) => star.color !== previousStars![i]!.color || star.tile !== previousStars![i]!.tile || star.alpha !== previousStars![i]!.alpha),
          'The infrared lens retained optical star photometry.');
      }
      previousStars = currentStars;
    }
    await page.getByRole('button', { name: 'Orbit', exact: true }).click();
    const rect = await page.locator('.compiler-stage .shape-cloud-viewport').boundingBox(); assert.ok(rect);
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
    await page.mouse.move(rect.x + rect.width / 2 + 170, rect.y + rect.height / 2 - 100, { steps: 12 }); await page.mouse.up();
    const pose = await page.locator('.compiler-stage').getAttribute('data-compiler-pose'); assert.notEqual(pose, '0,0');
    for (const lens of lenses) {
      await page.locator('#compiler-lens').selectOption(lens); await material(lens); await snapshot(`${id}-${lens}-oblique`);
      assert.equal(await page.locator('.compiler-stage').getAttribute('data-compiler-pose'), pose);
      await assertCompilerSceneRetained(page, retained, `${id}/${lens}/orbit lens`);
    }
    await page.getByRole('button', { name: 'Neutral', exact: true }).click(); await material('', 'neutral'); await snapshot(`${id}-neutral-oblique`);
    await assertCompilerSceneRetained(page, retained, `${id}/neutral`);
    if (id === 'm42' || id === 'carina' || id === 'm8') {
      for (const axis of ['west', 'north'] as const) {
        await page.getByRole('button', { name: 'Earth view', exact: true }).click();
        await page.getByRole('button', { name: 'Orbit', exact: true }).click();
        const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
        await page.mouse.move(x, y); await page.mouse.down();
        await page.mouse.move(x + (axis === 'west' ? 90 / .35 : 0), y - (axis === 'north' ? 89 / .35 : 0), { steps: 12 }); await page.mouse.up();
        const angles = (await page.locator('.compiler-stage').getAttribute('data-compiler-pose'))!.split(',').map(Number);
        assert.ok(Math.abs(angles[axis === 'west' ? 0 : 1]! - (axis === 'west' ? 90 : 89)) < .5, 'Side inspection did not reach its intended camera.');
        await snapshot(`${id}-neutral-${axis}-side`);
        await page.getByRole('button', { name: 'Textured', exact: true }).click();
        for (const lens of lenses) {
          await page.locator('#compiler-lens').selectOption(lens); await material(lens); await snapshot(`${id}-${lens}-${axis}-side`);
        }
        await page.getByRole('button', { name: 'Neutral', exact: true }).click(); await material('', 'neutral');
      }
    }
    if (id === 'm42') {
      await page.getByRole('button', { name: 'Earth view', exact: true }).click();
      const beforeZoom = await starPresentation();
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await page.mouse.wheel(0, -220);
      await page.waitForFunction(() => new Promise<boolean>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))));
      const afterZoom = await starPresentation();
      const ratios = afterZoom.flatMap((star, i) => star.visible && beforeZoom[i]!.visible && beforeZoom[i]!.width > .1 ? [star.width / beforeZoom[i]!.width] : []).sort((a, b) => a - b);
      assert.ok(ratios.length > 100 && ratios[Math.floor(ratios.length / 2)]! > 1.05, 'Stars retained a fixed screen size while zooming.');
    }
    await page.getByRole('checkbox', { name: 'Stars', exact: true }).uncheck();
    assert.equal(await page.locator('div[data-compiler-stars]').evaluate(node => getComputedStyle(node).display), 'none');
    await page.getByRole('button', { name: 'Earth view', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Stars', exact: true }).check();
    assert.ok((await starPresentation()).filter(star => star.visible && Number(star.alpha) > 0).length > 100,
      'Re-enabling stars after a camera change left them hidden.');
    await page.getByRole('checkbox', { name: 'Stars', exact: true }).uncheck();
    await page.getByRole('checkbox', { name: 'Original', exact: true }).check();
    await page.waitForFunction(() => { const image = document.querySelector<HTMLImageElement>('[data-compiler-original-source]'); return image?.complete && image.naturalWidth > 0; });
    await assertCompilerSceneRetained(page, retained, `${id}/camera and toggles`);
    let lateDecode = 'not exercised: only one lens';
    if (lenses.length > 1) {
      const previousLens = await page.locator('#compiler-lens').inputValue();
      await page.getByRole('button', { name: 'Textured', exact: true }).click(); await material(previousLens);
      const nextLens = lenses.find(lens => lens !== previousLens)!;
      const beforeLoad = await compilerPresentation(page), delayed = await delayNextBitmap(page);
      try {
        await page.locator('#compiler-lens').selectOption(nextLens); await delayed.held();
        assert.equal(await page.locator('[data-compiler-root]').getAttribute('data-lens'), previousLens,
          'Pending material decode discarded the previous lens.');
        await assertCompilerSceneRetained(page, retained, `${id}/pending decode`);
        await page.getByRole('button', { name: 'Neutral', exact: true }).click(); await material('', 'neutral');
        await delayed.release(); await delayed.settled();
        const afterLoad = await compilerPresentation(page);
        assert.equal(afterLoad.material, 'neutral', 'A late material decode overwrote the newer Neutral choice.');
        assert.equal(await page.locator('[data-compiler-root]').getAttribute('data-lens'), '');
        assert.equal(afterLoad.pose, beforeLoad.pose); assert.equal(afterLoad.framing, beforeLoad.framing);
        await assertCompilerSceneRetained(page, retained, `${id}/late decode`);
        lateDecode = 'passed: prior lens retained while decoding; superseded bitmap cannot override Neutral';
      } finally { await delayed.restore(); }
    }
    // Persist deliberate non-default camera, lens, material and toggles through a real reload.
    await page.getByRole('button', { name: 'Earth view', exact: true }).click();
    await page.getByRole('button', { name: 'Orbit', exact: true }).click();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + 70, y - 35, { steps: 8 }); await page.mouse.up();
    await page.keyboard.down('Shift'); await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + 31, y + 19, { steps: 5 }); await page.mouse.up(); await page.keyboard.up('Shift');
    await page.mouse.wheel(0, -170);
    await page.getByRole('button', { name: 'Neutral', exact: true }).click(); await material('', 'neutral');
    await page.locator('#compiler-lens').selectOption(lenses.at(-1)!);
    await snapshot(`${id}-original`);
    const savedPresentation = await compilerPresentation(page);
    assert.notEqual(savedPresentation.pose, '0,0');
    assert.ok(savedPresentation.framing && !savedPresentation.framing.includes('"zoom":1,'));
    assert.ok(!savedPresentation.framing.includes('"panX":0') && !savedPresentation.framing.includes('"panY":0'));
    assert.equal(savedPresentation.stars, false); assert.equal(savedPresentation.original, true);
    assert.equal(savedPresentation.orbit, 'true'); assert.equal(savedPresentation.material, 'neutral');
    if (lenses.length > 1) assert.notEqual(savedPresentation.lens, lenses[0], 'Refresh must exercise a non-default lens.');
    await assertCompilerSceneRetained(page, retained, `${id}/saved controls`); await retained.dispose();
    await page.reload(); await ready(); await material('', 'neutral');
    assert.equal(await page.locator('.compiler-controls').getAttribute('data-result-id'), result);
    assert.deepEqual(await compilerPresentation(page), savedPresentation, 'Reload changed the saved compiler presentation.');
    let sourceRace = 'not exercised: requires two candidates and two lenses';
    const nextSubject = candidates[candidates.indexOf(id) + 1];
    if (nextSubject && lenses.length > 1) {
      await page.getByRole('button', { name: 'Textured', exact: true }).click(); await material(savedPresentation.lens);
      const delayed = await delayNextBitmap(page);
      try {
        await page.locator('#compiler-lens').selectOption(lenses.find(lens => lens !== savedPresentation.lens)!); await delayed.held();
        await page.locator('#subject').selectOption(nextSubject);
        await page.waitForFunction(previous => {
          const stage = document.querySelector('.compiler-stage');
          return stage?.getAttribute('data-compiler-ready') === 'true' && stage.getAttribute('data-compiler-result') !== previous;
        }, result, { timeout: 60000 });
        await ready();
        const nextScene = await retainCompilerScene(page), nextResult = await page.locator('.compiler-controls').getAttribute('data-result-id');
        const nextPresentation = await compilerPresentation(page);
        await delayed.release(); await delayed.settled();
        assert.equal(await page.locator('#subject').inputValue(), nextSubject);
        assert.equal(await page.locator('.compiler-controls').getAttribute('data-result-id'), nextResult);
        assert.deepEqual(await compilerPresentation(page), nextPresentation, 'Old-source bitmap completion overwrote the new source presentation.');
        await assertCompilerSceneRetained(page, nextScene, `${id} to ${nextSubject}/late decode`); await nextScene.dispose();
        sourceRace = `passed: late ${id} bitmap cannot overwrite ${nextSubject}`;
      } finally { await delayed.restore(); }
    }
    receipts.push({ id, result, lenses, stars, retainedNodes: true, savedPresentation, lateDecode, sourceRace });
    console.log(`PREPARED_CANDIDATE_CHECKED ${id} retained nodes, delayed decode and saved presentation`);
  }
  assert.deepEqual(errors, []); assert.deepEqual(posts, [], 'Inspecting a CLI-prepared cloud started processing.');
  assert.deepEqual(writeGuard.blocked, [], 'Display controls attempted forbidden processing writes.');
  if (checkCancellation) {
    // This explicit opt-in is the only part of this harness authorized to start real processing.
    await writeGuard.dispose();
    const originalResult = await page.locator('.compiler-controls').getAttribute('data-result-id');
    const accepted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/__nebula/compiler-jobs'));
    await page.locator('#compiler-depth').press('ArrowRight'); assert.ok((await accepted).ok());
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.compiler-controls')?.getAttribute('data-job-status') === 'cancelled');
    const cancelledPosts = posts.length; await page.reload(); await ready();
    assert.equal(await page.locator('.compiler-controls').getAttribute('data-result-id'), originalResult);
    assert.equal(posts.length, cancelledPosts, 'Cancelled publication refit restarted on refresh.');
  }
  await writeFile(`${output}/result.json`, JSON.stringify({ status: 'passed', candidates: receipts, browser: browser.version(),
    directLoad: true, sourceSwitch: true, orbit: true, stars: true, originalOverlay: true, refresh: true,
    visualComparison: 'Screenshots recorded; appearance requires manual inspection.',
    blockedWrites: writeGuard.blocked, cancelledRefitRefresh: checkCancellation, errors, posts, failedRequests }, null, 2));
  console.log(`PASS prepared candidate inspection: ${receipts.map(item => `${item.id} (${item.lenses.length} lenses, ${item.stars} stars)`).join(', ')}.`);
} catch (error) {
  await writeFile(`${output}/result.json`, JSON.stringify({ status: 'failed', candidates: receipts,
    error: error instanceof Error ? error.stack : String(error), errors, posts, failedRequests, blockedWrites: writeGuard.blocked }, null, 2));
  console.error('PREPARED_CANDIDATE_FAILED', JSON.stringify({ errors, posts, failedRequests, blockedWrites: writeGuard.blocked }));
  await snapshot('failure'); throw error;
} finally { await browser.close(); }
