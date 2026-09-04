import assert from "node:assert/strict";
import { chromium } from "playwright";

import { OBJECTS } from "../objects.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});
const reports = [];

try {
  for (const planet of OBJECTS) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      const response = await page.goto(new URL(planet.route, baseUrl).href, {
        waitUntil: "domcontentloaded",
      });
      assert.equal(response?.status(), 200, `${planet.id}: route must return 200`);
      const report = await page.locator(".planet-introduction").evaluate(
        (element) => {
          const style = getComputedStyle(element);
          const bounds = element.getBoundingClientRect();
          const lineHeight = Number.parseFloat(style.lineHeight);
          return {
            fontSize: Number.parseFloat(style.fontSize),
            height: bounds.height,
            lineHeight,
            lineRatio: bounds.height / lineHeight,
            width: bounds.width,
          };
        },
      );
      assert.equal(report.fontSize, 16,
        `${planet.id}: introduction must resolve 1rem to 16px`);
      assert.equal(report.lineHeight, 22.4,
        `${planet.id}: introduction must use a 1.4 line height`);
      assert.equal(report.width, 310,
        `${planet.id}: desktop introduction measure must remain stable`);
      assert.ok(Math.abs(report.lineRatio - 4) < 0.01,
        `${planet.id}: desktop introduction must occupy exactly four lines`);
      reports.push({
        id: planet.id,
        lines: Math.round(report.lineRatio),
        width: report.width,
      });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, reports }, null, 2));
