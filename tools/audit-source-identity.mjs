import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";

export const AUDIT_SOURCE_PATH = "/__cssearth_audit__/source.json";
const SOURCE_HEADER = "x-cssearth-audit-source";
const SESSION_HEADER = "x-cssearth-audit-session";
const sourcePaths = ["site", "src", "public", "astro.config.mjs", "package.json", "pnpm-lock.yaml", "tsconfig.json"];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function snapshotAuditSources(directory) {
  const sourceRoot = await realpath(directory);
  const paths = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", ...sourcePaths],
    { cwd: sourceRoot, encoding: "utf8" }).split("\0").filter(Boolean);
  const files = {};
  for (const file of [...new Set(paths)].sort()) files[file] = sha(await readFile(resolve(sourceRoot, file)));
  assert.ok(files["astro.config.mjs"] && files["site/scene-router.mjs"], "Audit source must be a cssEarth checkout");
  return { schema: "cssearth-audit-source@1", sourceRoot, files, sha256: sha(JSON.stringify(files)) };
}

// Only the dedicated audit server installs this plugin. Each instance binds
// its responses to one source snapshot and retires when those inputs change.
export function auditSourcePlugin(snapshot) {
  const identity = { ...snapshot, session: randomUUID() };
  let changed = null;
  return {
    name: "cssearth-audit-source",
    enforce: "pre",
    async configureServer(server) {
      assert.equal(await realpath(server.config.root), snapshot.sourceRoot, "Audit server root differs from its source snapshot");
      server.watcher.on("all", (event, path) => {
        // Watchers may report the configured symlink spelling of the root.
        let file = relative(snapshot.sourceRoot, path).replaceAll("\\", "/");
        if (file.startsWith("../")) file = relative(server.config.root, path).replaceAll("\\", "/");
        if (Object.hasOwn(snapshot.files, file) ||
            ((event === "add" || event === "unlink") && sourcePaths.some((root) => file === root || file.startsWith(`${root}/`)))) {
          changed ??= file;
        }
      });
      server.middlewares.use((request, response, next) => {
        response.setHeader("Cache-Control", "no-store");
        if (changed) {
          response.statusCode = 503;
          response.end(`Audit source changed; restart the audit server: ${changed}`);
          return;
        }
        response.setHeader(SOURCE_HEADER, snapshot.sha256);
        response.setHeader(SESSION_HEADER, identity.session);
        if (new URL(request.url, "http://localhost").pathname === AUDIT_SOURCE_PATH) {
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify(identity));
          return;
        }
        next();
      });
    },
  };
}

export function assertAuditSourceIdentity(expected, actual, session) {
  assert.equal(actual.schema, expected.schema, "Start the server with tools/serve-shared-runtime-audit.mjs");
  assert.equal(actual.sourceRoot, expected.sourceRoot, "Audit server is serving a different checkout");
  assert.deepEqual(actual.files, expected.files, "Audit server source differs from the recorded checkout");
  assert.equal(actual.sha256, expected.sha256, "Audit source fingerprint differs");
  assert.equal(typeof actual.session, "string", "Audit server session is missing");
  assert.ok(actual.session.length > 0, "Audit server session is missing");
  if (session !== undefined) assert.equal(actual.session, session, "Audit server restarted during capture");
}

export async function verifyAuditSource(baseUrl, expected, session) {
  const response = await fetch(new URL(AUDIT_SOURCE_PATH, baseUrl), { cache: "no-store", redirect: "error" });
  assert.equal(response.status, 200, "Audit source unavailable; start tools/serve-shared-runtime-audit.mjs for this checkout");
  assert.match(response.headers.get("content-type") ?? "", /application\/json/, "Audit source identity endpoint is missing");
  const identity = await response.json();
  assertAuditSourceIdentity(expected, identity, session);
  assertAuditResponse({ url: response.url, status: response.status, headers: Object.fromEntries(response.headers) }, baseUrl, identity);
  return identity;
}

export function assertAuditResponse({ url, status, headers }, baseUrl, identity) {
  assert.equal(new URL(url).origin, new URL(baseUrl).origin, `External response cannot establish audit source identity: ${url}`);
  assert.ok(status >= 200 && status < 300, `Audit response failed (${status}): ${url}`);
  assert.equal(headers[SOURCE_HEADER], identity.sha256, `Response is not bound to the recorded audit source: ${url}`);
  assert.equal(headers[SESSION_HEADER], identity.session, `Response belongs to another audit server session: ${url}`);
}
