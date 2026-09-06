import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  snapshotAuditSources, auditSourcePlugin, verifyAuditSource,
  assertAuditResponse,
} from "./audit-source-identity.mjs";

test("audit binds served application responses to one checkout and server session", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "cssearth-audit-source-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q", directory]);
  await mkdir(join(directory, "site"));
  await writeFile(join(directory, "astro.config.mjs"), "export default {};\n");
  await writeFile(join(directory, "site/scene-router.mjs"), "export const marker = 'candidate';\n");
  const expected = await snapshotAuditSources(directory);
  const watcher = new EventEmitter();
  let middleware;
  await auditSourcePlugin(expected).configureServer({
    config: { root: directory }, watcher,
    middlewares: { use(value) { middleware = value; } },
  });
  const server = createServer((request, response) => middleware(request, response, () => {
    response.setHeader("Content-Type", "text/javascript");
    response.end("export const marker = 'candidate';\n");
  }));
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  t.after(() => new Promise((done) => server.close(done)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const identity = await verifyAuditSource(baseUrl, expected);
  const response = await fetch(`${baseUrl}/site/scene-router.mjs`);
  const observed = { url: response.url, status: response.status, headers: Object.fromEntries(response.headers) };
  assertAuditResponse(observed, baseUrl, identity);
  assert.throws(() => assertAuditResponse({ ...observed, headers: {} }, baseUrl, identity), /not bound/u);
  assert.throws(() => assertAuditResponse({ ...observed, url: "https://example.com/runtime.js" }, baseUrl, identity), /External response/u);
  assert.throws(() => assertAuditResponse({ ...observed, redirectedFrom: `${baseUrl}/redirect` }, baseUrl, identity), /Redirected response/u);
  assert.throws(() => assertAuditResponse({ ...observed, requestUrl: `${baseUrl}/other.js` }, baseUrl, identity), /changed its request URL/u);
  await assert.rejects(verifyAuditSource(baseUrl, { ...expected, sourceRoot: `${expected.sourceRoot}-other` }), /different checkout/u);
  await assert.rejects(verifyAuditSource(baseUrl, expected, "another-session"), /restarted/u);
  await writeFile(join(directory, "site/scene-router.mjs"), "export const marker = 'changed';\n");
  await assert.rejects(verifyAuditSource(baseUrl, await snapshotAuditSources(directory)), /differs from the recorded checkout/u);
  watcher.emit("all", "change", join(directory, "site/scene-router.mjs"));
  await assert.rejects(verifyAuditSource(baseUrl, expected), /source unavailable/u);
  assert.equal((await fetch(`${baseUrl}/site/scene-router.mjs`)).status, 503,
    "source changes must retire all application responses, not only the identity endpoint");
});
