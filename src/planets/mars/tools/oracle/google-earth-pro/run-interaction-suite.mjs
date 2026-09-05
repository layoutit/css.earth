// One local command for the existing native recorder, Chrome replay and report.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile, open } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { interactionSuiteCases, repeatabilityCases } from "./interaction-suite-cases.mjs";

const root = resolve(import.meta.dirname, "../../../../../..");
const args = process.argv.slice(2);
const configIndex = args.indexOf("--config");
assert.ok(configIndex >= 0 && args[configIndex + 1],
  "Usage: pnpm oracle:interactions -- --config <local-config.json> [--resume] [--only <scenario-id>]");
const configPath = resolve(args[configIndex + 1]);
const config = JSON.parse(await readFile(configPath));
const out = resolve(config.outputRoot);
assert.ok(out.startsWith(resolve(root, "output/playwright") + "/"));
const resume = args.includes("--resume");
const nativeOnly = args.includes("--native-only");
const replay = args.includes("--replay");
const evidenceRoot = resolve(config.evidenceRoot ?? root);
assert.ok(!replay || resume, "--replay requires --resume and preserves prior browser captures");
const onlyIndex = args.indexOf("--only");
const allCases = await interactionSuiteCases();
const cases = onlyIndex < 0 ? allCases : allCases.filter(c => c.id === args[onlyIndex + 1]);
assert.ok(cases.length);
assert.ok([2, 3].includes(config.repeatCount ?? 3));
for (const path of [config.appRoot, config.renderHook, config.seedAudit]) await access(resolve(path));
await mkdir(out, { recursive: true });
const manifestPath = resolve(out, "suite.json");
const configuration = { ...config, cases };
const configurationSha256 = hash(Buffer.from(JSON.stringify(configuration)));
let manifest = { schema: "cssearth-oracle-interaction-suite@1", startedAt: new Date().toISOString(),
  configuration, configurationSha256, configPath, cases: [] };
if (await exists(manifestPath)) {
  assert.ok(resume, "Output already has a suite; use --resume to continue it");
  manifest = JSON.parse(await readFile(manifestPath));
  assert.equal(manifest.configurationSha256, configurationSha256, "Resume configuration changed");
}
let server;
let browserUrl = config.browserUrl;
try {
  if (!nativeOnly && !browserUrl) {
    const serverConfig = resolve(out, "astro.config.mjs");
    await writeFile(serverConfig, `import base from ${JSON.stringify(pathToFileURL(resolve(root, "astro.config.mjs")).href)};\nexport default {...base,server:{host:'127.0.0.1',port:${config.port ?? 4238}},vite:{...base.vite,cacheDir:${JSON.stringify(resolve(out, "vite-cache"))},server:{watch:null,hmr:false}}};\n`);
    const { dev } = await import("astro");
    server = await dev({ configFile: relative(root, serverConfig) });
    browserUrl = `http://127.0.0.1:${server.address.port}/mars/`;
  }
  if (!nativeOnly) {
    const response = await fetch(browserUrl);
    assert.ok(response.ok, `Browser route failed: ${response.status}`);
  }
  for (const entry of cases) {
    let result = manifest.cases.find(c => c.id === entry.id);
    if (!result) { result = { id: entry.id, set: entry.set, tags: entry.tags, runs: [] }; manifest.cases.push(result); }
    const count = repeatabilityCases.includes(entry.id) ? (config.repeatCount ?? 3) : 1;
    for (let repeat = 0; repeat < count; repeat++) {
      let run = result.runs[repeat];
      if (!run) { run = { repeat, status: "pending" }; result.runs[repeat] = run; }
      let runRoot = resolve(out, entry.id, `repeat-${repeat + 1}`);
      let existingNative = run.native ?? resolve(runRoot, "native/report.json");
      let reusableNative = false;
      if (resume && await exists(existingNative)) {
        const existing = JSON.parse(await readFile(existingNative));
        let heldButtons = 0;
        reusableNative = existing.gesture.every(e => {
          if (e.kind === "down") heldButtons = 1;
          if (e.kind === "up") heldButtons = 0;
          return e.kind === "wheel"
            ? e.qtWheelTarget === "RenderWidget" && (e.qtButtons ?? 0) === heldButtons
            : config.pointerTransport !== "qt" || e.qtMouseTarget === "RenderWidget";
        });
      }
      if (!reusableNative && await exists(resolve(runRoot, "native"))) {
        run.previousAttempts ??= [];
        run.previousAttempts.push({ ...run, previousAttempts: undefined });
        let attempt = 2;
        while (await exists(resolve(runRoot, `attempt-${attempt}`))) attempt++;
        runRoot = resolve(runRoot, `attempt-${attempt}`);
      }
      await mkdir(runRoot, { recursive: true });
      const scenarioPath = resolve(runRoot, "scenario.json");
      const scenario = { ...entry, normalizeStart: true, singleWarmup: true,
        captureSize: 600, synchronousReadback: true, captureMilliseconds: 24000,
        untilNativeStops: true, presentHz: 30, pointerTransport: config.pointerTransport,
        renderHook: resolve(config.renderHook), seedAudit: resolve(config.seedAudit) };
      await writeFile(scenarioPath, JSON.stringify(scenario, null, 2));
      try {
        const nativePath = reusableNative ? existingNative : resolve(runRoot, "native/report.json");
        if (!reusableNative) {
          await command("capture-rendered-motion.mjs", [resolve(config.appRoot), resolve(runRoot, "native"), "1", scenarioPath], resolve(runRoot, "native.log"), { CSS_EARTH_EVIDENCE_ROOT:evidenceRoot });
        }
        run.native = nativePath;
        if (repeat === 0 && !nativeOnly) {
          let browserRoot = runRoot;
          if (replay) {
            run.previousBrowserCaptures ??= [];
            if (run.browser) run.previousBrowserCaptures.push({ browser: run.browser, comparison: run.comparison, frameBound:run.frameBound });
            browserRoot = resolve(out, entry.id, `replay-${run.previousBrowserCaptures.length}`);
            await mkdir(browserRoot, { recursive: true });
          }
          const browserPath = !replay && reusableNative && run.browser ? run.browser : resolve(browserRoot, "browser/report.json");
          if (!(resume && await exists(browserPath))) {
            await command(resolve(root, "site/test/capture-rendered-motion.mjs"), [nativePath, dirname(browserPath), "normal"], resolve(browserRoot, "browser.log"), { CSS_EARTH_CAPTURE_URL: browserUrl, CSS_EARTH_EVIDENCE_ROOT: evidenceRoot });
          }
          run.browser = browserPath;
          const comparisonPath = !replay && reusableNative && run.comparison ? run.comparison : resolve(browserRoot, "comparison/report.json");
          if (!(resume && await exists(comparisonPath))) {
            await command("compare-rendered-motion.mjs", [nativePath, browserPath, dirname(comparisonPath)], resolve(browserRoot, "comparison.log"));
          }
          run.comparison = comparisonPath;
          const frameRoot = !replay && run.frameBound?.browser
            ? dirname(dirname(run.frameBound.browser)) : resolve(browserRoot, "controlled");
          await mkdir(frameRoot, { recursive:true });
          const pairedPath = resolve(frameRoot, "paired-inputs.json");
          if (!(resume && await exists(pairedPath))) await command("pair-rendered-motion-inputs.mjs",
            [dirname(nativePath), pairedPath], resolve(frameRoot, "pair.log"));
          const frameBrowser = resolve(frameRoot, "browser/report.json");
          if (!(resume && await exists(frameBrowser))) await command(resolve(root, "site/test/capture-rendered-motion.mjs"),
            [pairedPath, dirname(frameBrowser), "frame-locked"], resolve(frameRoot, "browser.log"),
            { CSS_EARTH_CAPTURE_URL:browserUrl, CSS_EARTH_EVIDENCE_ROOT:evidenceRoot });
          const frameComparison = resolve(frameRoot, "comparison/report.json");
          if (!(resume && await exists(frameComparison))) await command("compare-rendered-motion.mjs",
            [nativePath, frameBrowser, dirname(frameComparison)], resolve(frameRoot, "comparison.log"));
          run.frameBound = { inputs:pairedPath, browser:frameBrowser, comparison:frameComparison };

        }
        run.status = "captured";
        delete run.error;
      } catch (error) {
        run.status = "invalid"; run.error = error.message;
      }
      await save();
      console.log(JSON.stringify({ scenario: entry.id, repeat: repeat + 1, status: run.status, error: run.error }));
    }
  }
  manifest.completedAt = new Date().toISOString();
  await save();
  if (!nativeOnly) await command("publish-interaction-suite.mjs", [manifestPath], resolve(out, "publish.log"));
  console.log(JSON.stringify({ output: out, report: resolve(out, "index.html") }));
  if (manifest.cases.some(c => c.runs.some(r => r.status === "invalid"))) process.exitCode = 1;
} finally { await server?.stop(); }

async function command(script, argv, log, env = {}) {
  const descriptor = await open(log, "w");
  try {
    const child = spawn(process.execPath, [resolve(import.meta.dirname, script), ...argv], {
      cwd: root, env: { ...process.env, ...env }, stdio: ["ignore", descriptor.fd, descriptor.fd],
    });
    const code = await new Promise((accept, reject) => { child.once("error", reject); child.once("exit", accept); });
    assert.equal(code, 0, `${script} exited ${code}; see ${log}`);
  } finally { await descriptor.close(); }
}
async function save() { await writeFile(manifestPath, JSON.stringify(manifest, null, 2)); }
async function exists(path) { try { await access(path); return true; } catch { return false; } }
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
