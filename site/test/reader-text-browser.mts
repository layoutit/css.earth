import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { globSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { parsePreparedNebulaCatalog } from '@cssearth/catalog';
import { SCENE_OBJECTS } from '../objects.mts';
import { TEXT_BUDGETS, parsePreparedText } from '../object-text.mts';
import { requireArray, requireRecord, requireString } from '../../tools/source-values.mts';

// Preparation limits reader text by characters. This suite measures the lines each
// block takes in the rendered shell, where the loaded fonts and column widths decide,
// for every registered body at a desktop and a phone width. One mounted page per width
// typesets each block in a hidden copy of the element that shows it.
const base = (process.argv.slice(2).find(argument => /^https?:\/\//u.test(argument)) ?? 'http://127.0.0.1:4210').replace(/\/$/u, '');
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

const bodies = await Promise.all(SCENE_OBJECTS.map(async ({ id }) => {
  const text = parsePreparedText(await read(`../../src/objects/${id}/prepared/text.json`), id);
  const lenses = requireRecord(await read(`../../src/objects/${id}/prepared/controls.json`)).lenses;
  const labels = new Map(lenses === null || lenses === undefined ? [] : requireArray(requireRecord(lenses).controls).map(value => {
    const control = requireRecord(value);
    return [requireString(control.id), requireString(control.label)] as const;
  }));
  return {
    id, card: text.card.text, introduction: text.introduction.text,
    datasets: Object.entries(text.datasets).map(([lensId, dataset]) => ({
      lensId, label: labels.get(lensId) ?? lensId, title: dataset.title, detail: dataset.detail ?? '', summary: dataset.summary,
    })),
  };
}));
const nebulae = globSync('*/source/nebula.json', { cwd: new URL('../../src/objects/', import.meta.url) }).flatMap(path =>
  parsePreparedNebulaCatalog(JSON.parse(readFileSync(new URL(`../../src/objects/${path}`, import.meta.url), 'utf8'))).objects
    .map(object => ({ id: object.id, introduction: object.introduction.text })));
const limits = { card: TEXT_BUDGETS.card.lines, introduction: TEXT_BUDGETS.introduction.lines, title: TEXT_BUDGETS.title.lines,
  summary: TEXT_BUDGETS.summary.lines, chooser: TEXT_BUDGETS.detail.lines };

const overflows: string[] = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const viewport of [{ name: 'desktop', width: 1280, height: 800, deviceScaleFactor: 1 }, { name: 'phone', width: 375, height: 812, deviceScaleFactor: 2 }]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.deviceScaleFactor });
    await page.goto(`${base}/saturn/`, { waitUntil: 'load' });
    await page.waitForSelector('[data-lens-details]:not([hidden]) .planet-lens-details-copy', { state: 'visible', timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const measured = await page.evaluate(({ bodies, nebulae, limits }) => {
      const shown = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].find(element => element.getBoundingClientRect().width > 0);
      const templates = {
        introduction: shown('.planet-information-panel .planet-introduction'),
        title: shown('[data-lens-details]:not([hidden]) .planet-lens-details-title'),
        summary: shown('[data-lens-details]:not([hidden]) .planet-lens-details-copy'),
        chooser: shown('.planet-layers-menu button:has(.planet-lens-label)'),
      };
      for (const [name, element] of Object.entries(templates)) if (!element) throw new Error(`No rendered ${name} to measure against.`);
      // The card preview uses the introduction's class in the same column.
      const lines = (template: HTMLElement, fill: (probe: HTMLElement) => void) => {
        const probe = template.cloneNode(true) as HTMLElement;
        probe.removeAttribute('id');
        Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', left: '0', top: '0', width: `${template.getBoundingClientRect().width}px` });
        fill(probe);
        template.parentElement!.append(probe);
        const count = Math.round(probe.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(probe).lineHeight));
        probe.remove();
        return count;
      };
      const text = (value: string) => (probe: HTMLElement) => { probe.textContent = value; };
      // A block well past its budget must measure as overflowing, or the probes are not typesetting.
      const control = 'A summary that keeps going well past three lines on the narrowest card, repeating itself. '.repeat(4);
      if (lines(templates.summary!, text(control)) <= limits.summary) throw new Error('The line probe did not detect an overlong summary.');
      const found: { id: string; slot: string; lines: number; limit: number; text: string }[] = [];
      const check = (id: string, slot: keyof typeof limits, template: HTMLElement, value: string, fill = text(value)) => {
        const count = lines(template, fill);
        if (count > limits[slot]) found.push({ id, slot, lines: count, limit: limits[slot], text: value });
      };
      for (const body of bodies) {
        check(body.id, 'card', templates.introduction!, body.card);
        check(body.id, 'introduction', templates.introduction!, body.introduction);
        for (const dataset of body.datasets) {
          check(body.id, 'title', templates.title!, dataset.title);
          check(body.id, 'summary', templates.summary!, dataset.summary);
          check(body.id, 'chooser', templates.chooser!, `${dataset.label} · ${dataset.detail}`, probe => {
            probe.querySelector('.planet-lens-label')!.textContent = dataset.label;
            probe.querySelector('.planet-lens-detail')?.remove();
            if (!dataset.detail) return;
            const detail = document.createElement('span');
            detail.className = 'planet-lens-detail';
            detail.textContent = dataset.detail;
            probe.append(detail);
          });
        }
      }
      for (const nebula of nebulae) check(nebula.id, 'introduction', templates.introduction!, nebula.introduction);
      return found;
    }, { bodies, nebulae, limits });
    overflows.push(...measured.map(({ id, slot, lines, limit, text }) => `${viewport.name} ${id} ${slot}: ${lines} lines, limit ${limit} — ${text}`));
    await page.close();
  }
} finally {
  await browser.close();
}
assert.deepEqual(overflows, [], `Reader text exceeds its rendered line budget:\n${overflows.join('\n')}`);
console.log(`Reader text for ${bodies.length} bodies fits its line budgets at desktop and phone widths.`);
