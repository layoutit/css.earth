import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { OBJECTS } from '../objects.mjs';

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const ids = process.argv[3] ? process.argv[3].split(',') : undefined;
const output = process.argv[4] ?? 'output/playwright/prepared-bindings';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { browser: browser.version(), cases: [], errors: [] };
try {
  for (const object of OBJECTS.filter(object => !ids || ids.includes(object.id))) {
    const definition = JSON.parse(await readFile(`src/planets/${object.id}/prepared/object.json`, 'utf8')).data;
    for (const dpr of [1, 2]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dpr });
      // Keep the sampled document stable when another local task triggers Vite
      // HMR. Application transport uses HTTP and workers, not WebSockets.
      await page.routeWebSocket('**', () => {});
      page.on('pageerror', error => report.errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
      await page.goto(origin + object.route);
      await page.waitForFunction(id => window.__cssEarth?.ready && window[`__${id}`]?.ready, object.id);
      await page.evaluate(definition => {
        const stage = document.querySelector('.planet-stage');
        const roots = [...stage.children].filter(node => node.classList.contains('planet-render-root'));
        const nodes = [], cursors = new Map();
        for (const record of definition.tree.nodes) {
          const siblings = record.parent < 0 ? roots : [...nodes[record.parent].children];
          const cursor = cursors.get(record.parent) ?? 0;
          const node = siblings[cursor];
          if (!node || node.tagName.toLowerCase() !== record.tag || (record.className ?? '').split(' ').filter(Boolean).some(name => !node.classList.contains(name))) throw Error(`Prepared node ${nodes.length} identity differs: ${node?.outerHTML.slice(0, 160)}`);
          nodes.push(node); cursors.set(record.parent, cursor + 1);
        }
        window.__preparedBindingTest = { nodes, definition };
      }, definition);
      const record = { id: object.id, dpr, motion: definition.motion.length, facing: definition.facing.length, views: [] };
      report.cases.push(record);
      // Original nodes and native animation handles must survive every camera change.
      const initial = await page.evaluate(() => {
        const { nodes } = window.__preparedBindingTest;
        const handles = document.querySelector('.planet-stage').getAnimations({ subtree: true }).filter(animation => nodes.includes(animation.effect.target));
        window.__preparedBindingTest.handles = handles;
        return handles.map(animation => ({ id: animation.id, css: animation instanceof CSSAnimation, state: animation.playState,
          target: animation.effect.target.className, name: animation.animationName }));
      });
      record.initial = initial;
      assert.ok(initial.every(animation => !animation.css && animation.state === 'paused'));
      assert.equal(initial.length, definition.motion.length + definition.animations.length);
      for (const [pitch, yaw] of [[0, 0], [31, 87], [-49, -132], [83, 178]]) {
        await page.evaluate(({ id, pitch, yaw }) => window[`__${id}`].camera.setState({ controlPitch: pitch, controlYaw: yaw }), { id: object.id, pitch, yaw });
        await page.waitForTimeout(220);
        const hidden = await page.evaluate(() => {
          const { nodes, definition, handles } = window.__preparedBindingTest;
          if (!nodes.every(node => node.isConnected)) throw Error('Camera replaced prepared nodes');
          const current = document.querySelector('.planet-stage').getAnimations({ subtree: true }).filter(animation => nodes.includes(animation.effect.target));
          if (current.length !== handles.length || !handles.every(handle => current.includes(handle))) throw Error('Camera replaced animation handles');
          return definition.facing.filter(plan => nodes[plan.target].style.visibility === 'hidden').length;
        });
        if (!definition.facing.length) continue;
        assert.ok(hidden > 0 && hidden < definition.facing.length);
        const optimized = await page.screenshot();
        // Independent visual oracle: same nodes/camera/textures, Chrome's native
        // backface-visibility only. Never changes display, geometry or clocks.
        await page.evaluate(() => {
          const state = window.__preparedBindingTest;
          state.visibility = state.definition.facing.map(({ target }) => state.nodes[target].style.visibility);
          state.definition.facing.forEach(({ target }) => { state.nodes[target].style.visibility = ''; });
        });
        const native = await page.screenshot();
        await page.evaluate(() => {
          const state = window.__preparedBindingTest;
          state.definition.facing.forEach(({ target }, index) => { state.nodes[target].style.visibility = state.visibility[index]; });
        });
        const a = PNG.sync.read(optimized), b = PNG.sync.read(native), diff = new PNG({ width: a.width, height: a.height });
        const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
        record.views.push({ pitch, yaw, hidden, changed });
        if (changed || (pitch === 0 && object.id === 'haumea')) {
          const name = `${output}/${object.id}-${dpr}-${pitch}-${yaw}`;
          await writeFile(`${name}-optimized.png`, optimized); await writeFile(`${name}-native.png`, native);
          await writeFile(`${name}-diff.png`, PNG.sync.write(diff));
        }
        if (changed) {
          const pixels = [];
          const mask = new PNG({ width: a.width, height: a.height });
          pixelmatch(a.data, b.data, mask.data, a.width, a.height, { threshold: 0.1, diffMask: true });
          for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) if (mask.data[(y * a.width + x) * 4 + 3]) pixels.push([x / dpr, y / dpr]);
          const witness = await page.evaluate(pixels => {
            const { definition, nodes } = window.__preparedBindingTest;
            return definition.facing.filter(({ target }) => nodes[target].style.visibility === 'hidden').flatMap(plan => {
              const node = nodes[plan.target], rect = node.getBoundingClientRect();
              if (!pixels.some(([x,y]) => x >= rect.left-2 && x <= rect.right+2 && y >= rect.top-2 && y <= rect.bottom+2)) return [];
              return [{ ...plan, rect: rect.toJSON(), css: node.style.cssText }];
            });
          }, pixels);
          await writeFile(`${output}/${object.id}-${dpr}-${pitch}-${yaw}-witness.json`, JSON.stringify({pixels,witness},null,2));
        }
        // The prepared tolerance must preserve Chrome's native backface pixels.
        assert.ok(changed === 0,
          `${object.id} DPR ${dpr} ${pitch}/${yaw}: ${changed} pixels differ from native backface rendering`);
      }
      if (definition.motion.length) {
        const handles = await page.evaluate(() => {
          const { definition, handles } = window.__preparedBindingTest;
          window.__preparedBindingTest.motion = handles.filter(animation => definition.motion.some(plan => plan.id === animation.id));
          return window.__preparedBindingTest.motion.map(animation => animation.currentTime);
        });
        await page.locator('.planet-motion-setting').evaluate(input => input.click());
        await page.waitForFunction(before => window.__preparedBindingTest.motion.some((animation, i) => animation.currentTime > before[i] + 20), handles);
        await page.locator('.planet-motion-setting').evaluate(input => input.click());
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const times = await page.evaluate(() => window.__preparedBindingTest.motion.map(animation => animation.currentTime));
        await page.waitForTimeout(100);
        assert.deepEqual(await page.evaluate(() => window.__preparedBindingTest.motion.map(animation => animation.currentTime)), times);
      }
      await page.close();
      console.log(`PASS ${object.id} DPR ${dpr}: ${record.motion} owned motion handles; ${record.facing} prepared facing planes`);
    }
  }
  assert.deepEqual(report.errors, []);
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally { await browser.close(); await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ cases: report.cases.length, error: report.error ?? null }));
