#!/usr/bin/env node
// Bounded source/transport readiness evidence; deliberately captures no pixels.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { OBJECTS } from '../site/objects.mjs';
import { loadPlanetBrowserProfile } from '../site/test/load-browser-profile.mjs';
import { runtimeAuditPoses } from './runtime-audit-poses.mjs';
import { snapshotAuditSources, verifyAuditSource, assertAuditResponse } from './audit-source-identity.mjs';
import { loadAuditPreparedTransports, verifyAuditPreparedTransportResponses } from './audit-prepared-transport.mjs';
import { waitForAuditPreparedReadiness } from './audit-prepared-readiness.mjs';
const [baseUrl, sourceRoot, outputArgument, objectId, ...poseIds] = process.argv.slice(2);
assert.ok(baseUrl && sourceRoot && outputArgument && objectId && poseIds.length,
  'Use BASE_URL SOURCE_ROOT FRESH_OUTPUT OBJECT_ID POSE_ID...');
const output = resolve(outputArgument); await mkdir(output);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { schema: 'cssearth-bounded-prepared-transport-browser@1', qualification: 'Transport and finite readiness only; no pixel qualification.',
  baseUrl, sourceRoot, objectId, poseIds, startedAt: new Date().toISOString(), complete: false, cases: [], errors: [] };
let browser;
try {
  const snapshot = await snapshotAuditSources(sourceRoot), identity = await verifyAuditSource(baseUrl, snapshot);
  report.sourceIdentity = identity;
  const object = OBJECTS.find(object => object.id === objectId); assert.ok(object, 'Use a registered object.');
  const profile = await loadPlanetBrowserProfile(object);
  const testPath = resolve(import.meta.dirname, `../src/planets/${objectId}/test`);
  const extra = (await readdir(testPath)).includes('visual-poses.mjs')
    ? (await import(new URL(`../src/planets/${objectId}/test/visual-poses.mjs`, import.meta.url))).visualPoses : [];
  const poses = [...extra, ...runtimeAuditPoses(profile)];
  const plans = await loadAuditPreparedTransports({ root: sourceRoot, objectId, sourceSnapshot: snapshot });
  const inventory = JSON.parse(await readFile(resolve(sourceRoot, `src/planets/${objectId}/runtime-assets.json`), 'utf8'));
  const expected = new Map(inventory.assets.map(asset => [asset.filename, asset]));
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--hide-scrollbars'] });
  report.browser = browser.version();
  for (const poseId of poseIds) {
    const pose = poses.find(pose => pose.id === poseId); assert.ok(pose, `Use an existing matrix pose: ${poseId}`);
    const entry = { id: poseId, complete: false, errors: [], responses: [] };
    report.cases.push(entry);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const checks = [], transportResponses = [], sourceAssetResponses = [];
    let page;
    try {
      page = await context.newPage();
      page.on('pageerror', error => entry.errors.push(error.message));
      page.on('response', response => checks.push((async () => {
        const url = new URL(response.url()), request = response.request();
        const observed = { url: response.url(), status: response.status(), headers: await response.allHeaders(),
          requestUrl: request.url(), redirectedFrom: request.redirectedFrom()?.url() ?? null,
          requestHeaders: await request.allHeaders(), resourceType: request.resourceType() };
        const packageAsset = url.pathname.startsWith(`/scenes/${objectId}/`), asset = packageAsset ? expected.get(url.pathname.split('/').at(-1)) : null;
        if (url.protocol === 'blob:' || url.origin !== new URL(baseUrl).origin || packageAsset && !asset) {
          const body = await response.body(); transportResponses.push({ ...observed, body });
          entry.responses.push({ ...observed, bytes: body.length, sha256: sha(body), category: 'prepared' }); return;
        }
        assertAuditResponse(observed, baseUrl, identity);
        if (packageAsset) {
          const body = await response.body(); assert.equal(body.length, asset.bytes, url.pathname); assert.equal(sha(body), asset.sha256, url.pathname);
          sourceAssetResponses.push({ ...observed, body });
          entry.responses.push({ ...observed, bytes: body.length, sha256: sha(body), category: 'inventory' });
        }
      })().catch(error => entry.errors.push(error.message))));
      await page.goto(new URL(object.route, baseUrl).href, { waitUntil: 'networkidle' });
      await profile.waitForRuntime(page); await profile.pause(page);
      await page.evaluate(() => { for (const animation of document.getAnimations()) { animation.pause(); if (animation instanceof CSSAnimation) animation.currentTime = 0; } });
      entry.poseState = await pose.apply(page);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => { for (const animation of document.getAnimations()) { animation.pause(); if (animation instanceof CSSAnimation) animation.currentTime = 0; } });
      entry.readiness = await waitForAuditPreparedReadiness(page, objectId);
      assert.equal(await profile.stable(page), true);
      await page.waitForLoadState('networkidle');
      let count;
      do { count = checks.length; await Promise.all(checks); } while (checks.length !== count);
      entry.transport = await verifyAuditPreparedTransportResponses({ plans, responses: transportResponses, sourceAssetResponses, baseUrl, identity });
      assert.deepEqual(entry.errors, [], 'Every observed source/transport response must qualify.');
      await verifyAuditSource(baseUrl, snapshot, identity.session);
      entry.complete = true;
    } catch (error) { entry.error = error.stack; throw error; }
    finally { await context.close(); await Promise.allSettled(checks); }
  }
  await verifyAuditSource(baseUrl, snapshot, identity.session);
  assert.deepEqual(await snapshotAuditSources(sourceRoot), snapshot);
  report.complete = true;
} catch (error) { report.errors.push(error.stack); process.exitCode = 1; }
finally { await browser?.close(); report.endedAt = new Date().toISOString(); await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify({ complete: report.complete, cases: report.cases.map(entry => ({ id: entry.id, complete: entry.complete, errors: entry.errors,
  responseCount: entry.responses.length, receipts: entry.transport?.receipts.length, blobs: entry.transport?.decodedImages.length,
  readinessMilliseconds: entry.readiness?.elapsedMilliseconds, error: entry.error?.slice(0,1600) })), errors: report.errors.map(error => error.slice(0,1600)) }, null, 2));
