import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { chromium } from "playwright";
import { OBJECTS } from "../site/objects.mjs";
import { loadPlanetBrowserProfile } from "../site/test/load-browser-profile.mjs";
import { snapshotAuditSources, verifyAuditSource, assertAuditResponse } from "./audit-source-identity.mjs";

const [id, baselineUrl, baselineRoot, candidateUrl, candidateRoot, outputArgument] = process.argv.slice(2);
assert.ok(outputArgument, "Use OBJECT BASELINE_URL BASELINE_ROOT CANDIDATE_URL CANDIDATE_ROOT FRESH_OUTPUT");
const object = OBJECTS.find(object => object.id === id); assert.ok(object, "Use an existing registered object");
const output = resolve(outputArgument); await mkdir(output);
const report = { objectId: id, complete: false, sources: {}, snapshots: [], errors: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true });
report.browser = browser.version();
try {
  const profile = await loadPlanetBrowserProfile(object);
  for (const [version, url, root] of [["baseline", baselineUrl, baselineRoot], ["candidate", candidateUrl, candidateRoot]]) {
    const snapshot = await snapshotAuditSources(root), identity = await verifyAuditSource(url, snapshot);
    report.sources[version] = identity;
    for (const dpr of [1, 2]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr, reducedMotion: "reduce" });
      try {
        const page = await context.newPage(); page.on("pageerror", error => report.errors.push(error.message));
        const response = await page.goto(new URL(object.route, url).href, { waitUntil: "networkidle" });
        assertAuditResponse({ url: response.url(), status: response.status(), headers: await response.allHeaders() }, url, identity);
        await page.waitForFunction(() => window.__cssEarth?.ready);
        await profile.waitForRuntime(page); await profile.pause(page);
        await page.evaluate(async () => {
          await document.fonts.ready;
          for (const animation of document.getAnimations()) { animation.pause(); if (animation instanceof CSSAnimation) animation.currentTime = 0; }
          await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
        });
        const facts = await page.locator(".planet-stage").evaluate((stage, baseUrl) => {
          const nodes = [stage, ...stage.querySelectorAll("*")], indices = new Map(nodes.map((node, index) => [node, index]));
          const normalized = value => value.replaceAll(new URL(baseUrl).origin, "");
          return nodes.map(node => ({ parent: indices.get(node.parentNode) ?? -1, tag: node.tagName,
            attributes: Object.fromEntries([...node.attributes].filter(attribute => attribute.name !== "style")
              .map(attribute => [attribute.name, normalized(attribute.value)]).sort(([a], [b]) => a.localeCompare(b))),
            style: Object.fromEntries([...node.style].sort().map(name => [name, normalized(node.style.getPropertyValue(name))])),
          }));
        }, url);
        await writeFile(resolve(output, `${version}-dpr${dpr}.json`), JSON.stringify(facts));
        report.snapshots.push({ version, dpr, nodes: facts.length, facts });
        assert.equal(await profile.stable(page), true);
        await verifyAuditSource(url, snapshot, identity.session);
      } finally { await context.close(); }
    }
  }
  for (const dpr of [1, 2]) {
    const before = report.snapshots.find(record => record.version === "baseline" && record.dpr === dpr).facts;
    const after = report.snapshots.find(record => record.version === "candidate" && record.dpr === dpr).facts;
    assert.ok(isDeepStrictEqual(before, after), `Exact retained node/parent/style correspondence at DPR ${dpr}`);
  }
  assert.deepEqual(report.errors, []); report.complete = true;
} catch (error) { report.errors.push(error.stack); process.exitCode = 1; }
finally {
  await browser.close();
  report.snapshots = report.snapshots.map(({ facts, ...summary }) => summary);
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ objectId: id, complete: report.complete, snapshots: report.snapshots, errors: report.errors }));
