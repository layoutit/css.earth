#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { auditSourcePlugin, snapshotAuditSources } from "./audit-source-identity.mjs";

const [directory, portArgument, versionOption, versionRootArgument] = process.argv.slice(2);
const port = Number(portArgument);
assert.ok(directory && Number.isInteger(port) && port > 0 && port <= 65535,
  "Use SERVED_WORKTREE PORT (an unused local port)");
assert.ok(versionOption === undefined || versionOption === "--version-from" && versionRootArgument,
  "Optional --version-from REFERENCE_WORKTREE binds the rendered build label for a matched comparison");
const snapshot = await snapshotAuditSources(directory);
const versionReference = versionRootArgument ? await snapshotAuditSources(versionRootArgument) : null;
const version = versionReference ? `0.${execFileSync("git", ["rev-list", "--count", "HEAD"],
  { cwd: versionReference.sourceRoot, encoding: "utf8" }).trim()}` : null;
// Config helpers such as the Git-derived version must run in the served tree.
process.chdir(snapshot.sourceRoot);
const require = createRequire(resolve(snapshot.sourceRoot, "package.json"));
const { dev } = await import(pathToFileURL(require.resolve("astro")).href);
const cacheDir = await mkdtemp(join(tmpdir(), "cssearth-audit-vite-"));
let server;
try {
  server = await dev({
    root: snapshot.sourceRoot,
    server: { host: "127.0.0.1", port, open: false },
    vite: { cacheDir, server: { strictPort: true }, plugins: [auditSourcePlugin(snapshot)],
      ...(version ? { define: { __CSSEARTH_VERSION__: JSON.stringify(version) } } : {}) },
  });
  assert.equal(server.address.port, port, "Requested audit port is unavailable");
  assert.deepEqual(await snapshotAuditSources(snapshot.sourceRoot), snapshot,
    "Audit sources changed while the server was starting");
} catch (error) {
  await server?.stop();
  await rm(cacheDir, { recursive: true, force: true });
  throw error;
}
console.log(JSON.stringify({ sourceRoot: snapshot.sourceRoot, sha256: snapshot.sha256, port: server.address.port,
  ...(versionReference ? { versionReference: { sourceRoot: versionReference.sourceRoot,
    sha256: versionReference.sha256, gitHead: execFileSync("git", ["rev-parse", "HEAD"],
      { cwd: versionReference.sourceRoot, encoding: "utf8" }).trim(), version } } : {}) }));
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => {
  await server.stop();
  await rm(cacheDir, { recursive: true, force: true });
  process.exit(0);
});
