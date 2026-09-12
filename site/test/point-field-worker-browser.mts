import {createTestPage} from './browser-observations.mts';
import type {PreparedCssPointField,PointFieldVector} from '../../src/renderers/css/dist/index.js';
type PointApi=typeof import('../../src/renderers/css/dist/testing.js');
type FieldRotation=Parameters<PointApi['projectPreparedPoint']>[2];
interface FieldProbe {layer:ReturnType<PointApi['mountPreparedCssPointField']>;payload:PreparedCssPointField;api:PointApi;initialSlots:HTMLElement[];viewport:{widthPixels:number;heightPixels:number;focalPixels:number;principalOffsetPixels:readonly[number,number]};counters:()=>{created:number;retired:number;posted:number};publish(x:number,angle:number):void;aligned():{count:number;error:number};exactStyles():void;expected:string[];current?:{eye:PointFieldVector;rotation:FieldRotation};}
declare global {interface Window {__fieldTest:FieldProbe;}}

import {required} from '../../tools/test-values.mts';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = 'output/playwright/point-field-worker';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors:string[] = [];
try {
  for (const dpr of [1, 2]) {
    const page = await createTestPage(browser,{ viewport: { width: 1000, height: 800 }, deviceScaleFactor: dpr });
    page.on('pageerror', error => errors.push(error.message));
    // Load the same runtime modules in a minimal document, without a second application scene.
    await page.route('**/__point-field-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><style>body{margin:0;background:black}#field{position:absolute;inset:0}.prepared-point-field-block>s{position:absolute;left:50%;top:50%;width:var(--point-tile-size);height:var(--point-tile-size);transform-origin:0 0;background-image:var(--point-atlas);text-decoration:none}</style><div id="field"><span id="end"></span></div>' }));
    await page.goto(`${origin}/__point-field-test`);
    await page.evaluate(async () => {
      const api = await import('/src/renderers/css/dist/testing.js');
      const { worldRotationFromQuaternion } = await import('/src/renderers/css/dist/navigation.js');
      const {loadPreparedCssPointField}=await import('/src/renderers/css/dist/index.js');
      const base='/src/objects/stellar-neighbourhood/';
      const payload=await loadPreparedCssPointField(await (await fetch(`${base}object.json`)).json(),{async read(path){
        const response=await fetch(base+path);if(!response.ok)throw new Error(`Prepared stars request failed: ${response.status}.`);return response.arrayBuffer();}});
      const NativeWorker = window.Worker;
      let created = 0, retired = 0, posted = 0;
      window.Worker = class extends NativeWorker {
        constructor(scriptURL:string|URL,options?:WorkerOptions) { super(scriptURL,options); created++; }
        postMessage(data:unknown,options:Transferable[]|StructuredSerializeOptions=[]) { if (data && typeof data === "object" && "view" in data && data.view) posted++; return Array.isArray(options) ? super.postMessage(data,options) : super.postMessage(data,options); }
        terminate() { retired++; super.terminate(); }
      };
      const layer = api.mountPreparedCssPointField({ host: window.__cssearthTest.html('#field'), before: window.__cssearthTest.element('#end'),
        payload, showLabels: false, resolveResource: path => `/src/objects/stellar-neighbourhood/prepared/${path}` });
      const initialSlots = layer.inspect().points.map(point => point.element);
      const selector = api.createPointFieldSelection(payload);
      const viewport = { widthPixels: 1000, heightPixels: 800, focalPixels: 700, principalOffsetPixels: [29, -17] as const };
      const transpose = (m:readonly number[]):FieldRotation => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
      window.__fieldTest = { layer, payload, api, initialSlots, viewport,expected:[],
        counters: () => ({ created, retired, posted }),
        publish(x, angle) {
          const rotation = transpose(worldRotationFromQuaternion([0, Math.sin(angle / 2), 0, Math.cos(angle / 2)]));
          const eye = [x, 0, 0] as const;
          const world:import("../../src/renderers/css/dist/navigation.js").WorldCameraPose = { referenceFrame: payload.frame.referenceFrame, epochJdTt: payload.frame.epochJdTt,
            pose: { positionM: [eye[0] * payload.frame.metersPerUnit + payload.frame.originM[0],payload.frame.originM[1],payload.frame.originM[2]],
              orientationXyzw: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)] } };
          this.current = { eye, rotation };
          layer.publish(world, viewport, 1);
          this.expected = selector({ eyeUnits: eye, viewRotation: rotation, focalPx: viewport.focalPixels,
            viewportHalfWidthPx: 500 + 29, viewportHalfHeightPx: 400 + 17 }).representatives.map(p => `${p.kind}:${p.index}`).sort();
        },
        aligned() {
          let count = 0, error = 0;
          for (const { element, reference } of layer.inspect().points) {
            if (!reference || element.style.visibility === 'hidden') continue;
            const [kind, index] = reference.split(':');
            const point = window.__cssearthTest.required((kind === 'star' ? payload.stars : payload.nodes)[Number(index)],'prepared point');
            const p = api.projectPreparedPoint(point.positionUnits, window.__cssearthTest.required(this.current,"published point view").eye, window.__cssearthTest.required(this.current,"published point view").rotation, 700, 29, -17);
            const transform = new DOMMatrix(element.style.transform);
            error = Math.max(error, Math.hypot(transform.m41 + transform.m11 * payload.atlas.tileSize / 2 - p.x,
              transform.m42 + transform.m22 * payload.atlas.tileSize / 2 - p.y)); count++;
          }
          return { count, error };
        },
        exactStyles() {
          for (const { element, reference } of layer.inspect().points) {
            if (!reference || element.style.visibility === 'hidden') continue;
            const [kind, index] = reference.split(':'), point = window.__cssearthTest.required((kind === 'star' ? payload.stars : payload.nodes)[Number(index)],'prepared point');
            const p = api.projectPreparedPoint(point.positionUnits, window.__cssearthTest.required(this.current,"published point view").eye, window.__cssearthTest.required(this.current,"published point view").rotation, 700, 29, -17);
            const light = api.pointPhotometry(payload, point.absoluteMagnitude, p.distanceUnits, kind === 'star' && 'coverageAnchor' in point && point.coverageAnchor);
            const size = light.radiusPx * 2 * payload.atlas.haloRadii;
            element.style.transform = `translate(${p.x - size / 2}px,${p.y - size / 2}px) scale(${size / payload.atlas.tileSize})`;
            element.style.opacity = String(light.luminance);
          }
        },
      };
    });
    const views = [];
    for (const [x, angle] of [[0, 0], [0, 1.2], [1, 2.5], [10, -1], [-10, -2], [0, 0]]) {
      const immediate = await page.evaluate(([x, angle]) => { window.__fieldTest.publish(x, angle); return window.__fieldTest.aligned(); }, [x, angle]);
      assert.ok(immediate.error < .002, 'Even before the worker responds, surviving stars use the CURRENT camera');
      await page.waitForFunction(() => {
        const t = window.__fieldTest;
        const actual = t.layer.inspect().points.slice(t.payload.policy.transitionSlots).flatMap(p => p.reference ? [p.reference] : []).sort();
        return JSON.stringify(actual) === JSON.stringify(t.expected);
      });
      await page.waitForTimeout(400);
      const aligned = await page.evaluate(() => window.__fieldTest.aligned());
      assert.ok(aligned.count > 100); assert.ok(aligned.error < .002);
      views.push({ x, angle, ...aligned });
    }
    const optimized = await page.screenshot({ path: `${output}/optimized-dpr-${dpr}.png` });
    await page.evaluate(() => window.__fieldTest.exactStyles());
    const exact = await page.screenshot({ path: `${output}/exact-dpr-${dpr}.png` });
    const a = PNG.sync.read(exact), b = PNG.sync.read(optimized), diff = new PNG({ width: a.width, height: a.height });
    const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: .01, includeAA: true });
    await writeFile(`${output}/diff-dpr-${dpr}.png`, PNG.sync.write(diff));
    assert.ok(changed / (a.width * a.height) < .0001, 'Bounded publication precision preserves the exact projected star image');
    const lifetime = await page.evaluate(() => {
      const t = window.__fieldTest;
      const stable = t.layer.inspect().points.every((p, i) => p.element === t.initialSlots[i]);
      const before = t.counters(); t.layer.destroy(); t.layer.destroy();
      return { stable, before, after: t.counters(), remaining: document.querySelectorAll('.prepared-point-field').length };
    });
    assert.equal(lifetime.stable, true); assert.equal(lifetime.before.created, 1);
    assert.equal(lifetime.before.retired, 0); assert.equal(lifetime.after.retired, 1); assert.equal(lifetime.remaining, 0);
    results.push({ dpr, views, changedPixels: changed, totalPixels: a.width * a.height, lifetime });
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify({ results, errors }, null, 2));
}
console.log(JSON.stringify({ results, errors }));
