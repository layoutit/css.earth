import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { wmtsAddress } from "../../../../tools/objects/geographic-pages/wmts-page-geometry.mjs";

const base = process.argv[2] ?? "http://127.0.0.1:4228";
const source = resolve(process.argv[3] ?? "src/planets/earth/source/land-cover");
const output = resolve(`output/playwright/worldcover-browser-admission-${Date.now()}`);
await mkdir(output, { recursive: true });
const xml = await readFile(resolve(source, "WMTSCapabilities.xml"), "utf8");
const qml = await readFile(resolve(source, "ESAWorldCover_ColorLegend.qml"), "utf8");
const report = { base, output, retrievedAt: new Date().toISOString(), requests: [], samples: [],
  capabilitySha256: createHash("sha256").update(xml).digest("hex"), legendSha256: createHash("sha256").update(qml).digest("hex") };
const browser = await chromium.launch({ channel: "chrome", headless: true });
report.browser = browser.version();
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 1040 }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    await context.route(`${base}/__earth-source-admission`, route => route.fulfill({ contentType: "text/html", body:
      '<!doctype html><meta charset="utf-8"><title>WorldCover source samples</title><style>body{background:#161616;color:#eee;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(4,256px);gap:22px}figure{margin:0}img{display:block;width:256px;height:256px;background:#333}figcaption{margin:6px 0;font-size:13px}</style><h1>WorldCover 2021 · provider tile samples</h1><main></main>' }));
    const cdp = await context.newCDPSession(page); await cdp.send("Network.enable");
    cdp.on("Network.responseReceived", ({ response }) => {
      if (!response.url.startsWith("https://mapproxy.terrascope.be/")) return;
      report.requests.push({ url: response.url, status: response.status, fromDiskCache: response.fromDiskCache,
        headers: Object.fromEntries(Object.entries(response.headers).filter(([key]) => /^(content-type|content-length|cache-control|etag|last-modified|expires|access-control-allow-origin|access-control-expose-headers|retry-after)$/iu.test(key))) });
    });
    await page.goto(`${base}/__earth-source-admission`);
    report.contract = await page.evaluate(({ xml, qml }) => {
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const text = (node, name) => node.getElementsByTagNameNS("*", name)[0]?.textContent.trim();
      const layer = [...doc.getElementsByTagNameNS("*", "Layer")].find(node => text(node, "Identifier") === "esa-worldcover-map-10m-2021-v2_map");
      if (!layer) throw Error("WorldCover 2021 map layer is absent");
      const matrixId = text(layer, "TileMatrixSet");
      const grid = [...doc.getElementsByTagNameNS("*", "TileMatrixSet")].find(node => text(node, "Identifier") === matrixId);
      const palette = new DOMParser().parseFromString(qml, "application/xml");
      return { id: text(layer, "Identifier"), title: text(layer, "Title"), matrixId, crs: text(grid, "SupportedCRS"),
        lower: text(layer, "LowerCorner").split(" ").map(Number), upper: text(layer, "UpperCorner").split(" ").map(Number),
        format: text(layer, "Format"), template: layer.getElementsByTagNameNS("*", "ResourceURL")[0].getAttribute("template"),
        matrices: [...grid.getElementsByTagNameNS("*", "TileMatrix")].map(node => Object.fromEntries(
          ["Identifier", "ScaleDenominator", "TopLeftCorner", "TileWidth", "TileHeight", "MatrixWidth", "MatrixHeight"].map(name => [name, text(node, name)]))),
        legend: [...palette.querySelectorAll("colorrampshader > item")].map(node => ({ value: Number(node.getAttribute("value")), label: node.getAttribute("label"), color: node.getAttribute("color"), alpha: Number(node.getAttribute("alpha")) })) };
    }, { xml, qml });
    const contract = report.contract;
    assert.equal(contract.matrixId, "webmercator"); assert.match(contract.crs, /3857$/u); assert.equal(contract.format, "image/png");
    assert.equal(contract.lower[0], -180); assert.equal(contract.upper[0], 180);
    assert.ok(Math.abs(contract.upper[1] - 85.0511287798066) < 1e-12);
    for (const matrix of contract.matrices) {
      const level = Number(matrix.Identifier);
      assert.equal(Number(matrix.TileWidth), 256); assert.equal(Number(matrix.TileHeight), 256);
      assert.equal(Number(matrix.MatrixWidth), 2 ** level); assert.equal(Number(matrix.MatrixHeight), 2 ** level);
      assert.equal(matrix.TopLeftCorner, "-20037508.342789244 20037508.342789244");
    }
    assert.equal(contract.legend.filter(row => row.value > 0).length, 11);
    const fetchFromBrowser = (url, maximumBytes) => page.evaluate(async ({ url, maximumBytes }) => {
      const started = performance.now();
      try {
        const response = await fetch(url, { credentials: "omit", signal: AbortSignal.timeout(30000) });
        const reader = response.body.getReader(), parts = []; let bytes = 0;
        while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length;
          if (bytes > maximumBytes) { await reader.cancel(); throw Error("Source response exceeds byte bound"); } parts.push(part.value); }
        let binary = ""; for (const part of parts) for (let i = 0; i < part.length; i += 32768) binary += String.fromCharCode(...part.subarray(i, i + 32768));
        return { status: response.status, type: response.type, milliseconds: performance.now() - started,
          headers: Object.fromEntries(response.headers), bytes, base64: btoa(binary) };
      } catch (error) { return { error: error.message, milliseconds: performance.now() - started }; }
    }, { url, maximumBytes });
    const capability = await fetchFromBrowser("https://mapproxy.terrascope.be/mapproxy/wmts/1.0.0/WMTSCapabilities.xml", 2 * 1024 ** 2);
    if (capability.base64) { capability.sha256 = createHash("sha256").update(Buffer.from(capability.base64, "base64")).digest("hex"); delete capability.base64; }
    report.browserCapabilities = capability;
    const palette = new Set(contract.legend.filter(row => row.alpha > 0).map(row => row.color.toLowerCase()));
    for (const [name, longitude, latitude, level] of [
      ["Buenos Aires", -58.38, -34.6, 14], ["Tokyo", 139.69, 35.69, 14], ["Lagos coast", 3.4, 6.44, 12],
      ["Argentina cropland", -61.0, -33.0, 10], ["Sahara", 13, 23, 8],
      ["Dateline west", 179.95, -16.5, 8], ["Dateline east", -179.95, -16.5, 8],
      ["High Arctic", 20, 80, 6], ["Antarctica", 0, -80, 6], ["Open ocean", 0, 0, 5],
    ]) {
      const address = wmtsAddress(longitude, latitude, level);
      const url = contract.template.replace("{TileMatrixSet}", contract.matrixId).replace("{TileMatrix}", String(level).padStart(2, "0"))
        .replace("{TileCol}", address.x).replace("{TileRow}", address.y);
      const result = { name, longitude, latitude, ...address, url, ...await fetchFromBrowser(url, 1024 ** 2) };
      const bytes = result.base64 ? Buffer.from(result.base64, "base64") : null; delete result.base64;
      report.samples.push(result);
      assert.equal(result.status, 200, `${name}: ${result.error ?? result.status}`); assert.equal(result.type, "cors");
      assert.match(result.headers["content-type"], /^image\/png/u);
      result.sha256 = createHash("sha256").update(bytes).digest("hex");
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      result.width = info.width; result.height = info.height;
      result.emptySentinel = info.width === 1 && info.height === 1 && data[3] === 0;
      assert.ok(result.emptySentinel || (info.width === 256 && info.height === 256), "Only standard tiles or a verified transparent single pixel are admitted");
      result.pixels = { transparent: 0, palette: 0, other: 0 }; const colors = new Map();
      for (let i = 0; i < data.length; i += 4) {
        if (!data[i + 3]) { result.pixels.transparent++; continue; }
        const color = `#${data.subarray(i, i + 3).toString("hex")}`;
        result.pixels[palette.has(color) && data[i + 3] === 255 ? "palette" : "other"]++;
        colors.set(color, (colors.get(color) ?? 0) + 1);
      }
      result.colors = [...colors].sort((a, b) => b[1] - a[1]).slice(0, 15);
      assert.equal(result.pixels.other, 0, `${name} source colors differ from the official categorical palette`);
      result.file = `${report.samples.length}-${name.toLowerCase().replaceAll(" ", "-")}.png`;
      await writeFile(resolve(output, result.file), bytes);
      await page.evaluate(async ({ name, url, data }) => {
        const figure = document.createElement("figure"), img = new Image(), caption = document.createElement("figcaption");
        img.src = `data:image/png;base64,${data}`; await img.decode(); caption.textContent = name;
        figure.title = url; figure.append(img, caption); document.querySelector("main").append(figure);
      }, { name, url, data: bytes.toString("base64") });
      console.log(`${name}: ${result.bytes} B, palette ${result.pixels.palette}, transparent ${result.pixels.transparent}, other ${result.pixels.other}`);
    }
    const repeated = await fetchFromBrowser(report.samples[0].url, 1024 ** 2);
    report.repeat = { status: repeated.status, bytes: repeated.bytes, milliseconds: repeated.milliseconds,
      sha256: repeated.base64 ? createHash("sha256").update(Buffer.from(repeated.base64, "base64")).digest("hex") : null };
    assert.equal(report.repeat.sha256, report.samples[0].sha256);
    await page.screenshot({ path: resolve(output, "source-samples.png"), fullPage: true });
    report.passed = true;
  } finally { await context.close(); }
} finally {
  await browser.close(); await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, passed: report.passed ?? false }));
}
