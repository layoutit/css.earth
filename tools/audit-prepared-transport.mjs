import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { readPreparedJsonExports } from "./check-prepared-presentation.mjs";
import { assertAuditResponse } from "./audit-source-identity.mjs";
import { isPreparedBlockReference, readPreparedWmtsBlock } from "../src/platform/prepared-map/prepared-block-transport.mjs";
import { isPreparedCityAssetUrl } from "../src/platform/prepared-map/city-asset-url.mjs";
import { isPreparedWmtsImage } from "../src/platform/prepared-map/wmts-image.mjs";
import { isPreparedWmsImage } from "../src/platform/prepared-map/wms-image.mjs";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const HASH = /^[a-f0-9]{64}$/u;
const MAX_RESPONSES = 65536;
export const AUDIT_PREPARED_TRANSPORT_SCHEMA = "cssearth-source-bound-prepared-transport@1";
// Pin all executable dependencies of this extension in both capture reports.
export const AUDIT_PREPARED_TRANSPORT_HARNESS_FILES = Object.freeze([
  "tools/audit-prepared-transport.mjs", "tools/check-prepared-presentation.mjs",
  "src/platform/prepared-map/prepared-block-transport.mjs", "src/platform/prepared-map/prepared-block.mjs",
  "src/platform/prepared-map/city-asset-url.mjs", "src/platform/prepared-map/wmts-image.mjs",
  "src/platform/prepared-map/wms-image.mjs",
]);
const planShape = value => value && typeof value === "object" && Array.isArray(value.roots) &&
  typeof value.dataset === "string" && value.index && typeof value.assetOrigin === "string";

// Read serialized data only. New sources expose their actual mounted page
// layers; older immutable sources can expose literal prepared page modules.
export async function loadAuditPreparedTransports({ root, objectId, sourceSnapshot }) {
  const directory = `src/planets/${objectId}/runtime`;
  const names = (await readdir(resolve(root, directory))).filter(name => /^prepared.*\.mjs$/u.test(name)).sort();
  const read = async name => {
    const path = `${directory}/${name}`, bytes = await readFile(resolve(root, path));
    assert.ok(bytes.length <= 32 * 1024 * 1024, `Prepared audit module is too large: ${path}`);
    const sha256 = sha(bytes);
    if (sourceSnapshot) assert.equal(sourceSnapshot.files[path], sha256, `Prepared transport source changed: ${path}`);
    return { path, sha256, exports: readPreparedJsonExports(bytes.toString("utf8")) };
  };
  const records = [];
  if (names.includes("preparedPresentation.mjs")) {
    const source = await read("preparedPresentation.mjs");
    const presentation = source.exports.find(record => record.name === "PREPARED_PRESENTATION")?.value;
    assert.ok(presentation, "The normalized source must expose its actual presentation data.");
    for (const [index, layer] of (presentation.pageLayers ?? []).entries()) {
      assert.ok(planShape(layer.plan), "A mounted prepared page layer must provide its source plan.");
      records.push({ source: { path: source.path, sha256: source.sha256, export: "PREPARED_PRESENTATION", selector: `pageLayers[${index}].plan` }, plan: layer.plan });
    }
  } else {
    for (const name of names) {
      let source;
      try { source = await read(name); } catch (error) {
        // Legacy prepared-prefixed executor modules are not metadata and are
        // never imported or executed by discovery. Their URLs gain no authority.
        if (error instanceof TypeError || error instanceof SyntaxError) continue;
        throw error;
      }
      for (const record of source.exports) if (planShape(record.value)) records.push({
        source: { path: source.path, sha256: source.sha256, export: record.name, selector: "" }, plan: record.value,
      });
    }
  }
  return records.map(record => ({ ...record, plan: { ...record.plan,
    // This is an offline compatibility binding to the source package path,
    // not object dispatch or a runtime fallback scene.
    assetPath: record.plan.assetPath ?? `/scenes/${objectId}/`,
  } }));
}

function plainUrl(value, base) {
  assert.equal(typeof value, "string", "A declared transport URL is required.");
  const url = new URL(value, base);
  assert.ok(["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.hash,
    `Invalid prepared transport URL: ${value}`);
  return url;
}
function rangeKey(headers = {}) { return headers.range ?? headers.Range ?? ""; }
function requestKey(url, range) { return `${url}\n${range}`; }
function referenceRange(ref) { return ref.offset === undefined ? "" : `bytes=${ref.offset}-${ref.offset + ref.bytes - 1}`; }
function safeSource(source) {
  assert.equal(typeof source?.path, "string", "Prepared metadata must identify its source module.");
  assert.ok(HASH.test(source.sha256 ?? ""), "Prepared metadata must pin its source module bytes.");
}
function expectedImage(plan, page) {
  assert.ok(Number.isSafeInteger(page.width) && page.width > 0 && page.width <= 1040 &&
    Number.isSafeInteger(page.height) && page.height > 0 && page.height <= 1040, "Prepared image dimensions are invalid.");
  if (isPreparedWmtsImage(page) || isPreparedWmsImage(page)) return { pinned: false, format: "png" };
  assert.ok(HASH.test(page.sha256 ?? "") && Number.isSafeInteger(page.bytes) && page.bytes > 0,
    `A prepared image must pin its bytes or declare a supported dataset request: ${page.url}`);
  if (page.url.startsWith("/")) {
    const url = new URL(page.url, "https://prepared.invalid");
    assert.ok(url.pathname.startsWith(plan.assetPath) && !url.search && url.pathname === page.url,
      "A relative prepared image must stay within its prepared package.");
  } else assert.ok(isPreparedCityAssetUrl(plan, page.url, "page", page.sha256), "Undeclared prepared image origin or path.");
  return { pinned: true, format: null };
}

// Responses are untrusted until this graph walk finishes. Parent and child
// responses may arrive in either order; only a verified parent adds child URLs.
export async function verifyAuditPreparedTransportResponses({ plans, responses, sourceAssetResponses = [], baseUrl, identity }) {
  assert.ok(Array.isArray(responses) && Array.isArray(sourceAssetResponses) &&
    responses.length + sourceAssetResponses.length <= MAX_RESPONSES, "Too many prepared transport responses.");
  const origin = plainUrl(baseUrl).origin, declarations = new Map(), receipts = new Map();
  const references = [], sources = new Map();
  const add = descriptor => {
    for (const url of descriptor.urls) {
      const key = requestKey(url, descriptor.range), previous = declarations.get(key);
      if (previous) {
        assert.deepEqual(previous.identity, descriptor.identity, `Conflicting prepared transport declarations: ${url}`);
        continue;
      }
      declarations.set(key, descriptor);
    }
  };
  function addDirectory(plan, ref, ownerKey, proof) {
    const packed = isPreparedBlockReference(ref, plan.assetPath);
    assert.ok(packed || isPreparedCityAssetUrl(plan, ref?.url, "index", ref?.sha256), "Invalid prepared directory declaration.");
    assert.ok(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= plan.index.maximumDirectoryBytes,
      "Prepared directory exceeds its source bound.");
    if (ref.offset !== undefined) assert.ok(typeof plan.geometryVersion === "string" &&
      ref.url.startsWith(`${plan.assetPath}wmts-${plan.geometryVersion}/`), "Prepared geometry version mismatch.");
    const urls = [plainUrl(ref.url, baseUrl).href];
    if (packed && ref.url.startsWith("/") && plan.geometryOrigin) {
      const geometryOrigin = plainUrl(plan.geometryOrigin);
      assert.ok(geometryOrigin.protocol === "https:" && geometryOrigin.origin === plan.geometryOrigin,
        "Invalid prepared geometry origin.");
      urls.push(plainUrl(ref.url, plan.geometryOrigin).href);
    }
    add({ kind: "directory", plan, ref, ownerKey, proof, urls, packed, range: referenceRange(ref),
      identity: { kind: "directory", dataset: plan.dataset, ownerKey, ...ref },
      canonical: `${ref.url}${ref.offset === undefined ? "" : `#${referenceRange(ref)}`}` });
  }
  function addImage(plan, page, proof) {
    const format = expectedImage(plan, page), url = plainUrl(page.url, baseUrl).href;
    add({ kind: "image", plan, page, proof, urls: [url], range: "", format,
      identity: { kind: "image", dataset: plan.dataset, url: page.url, width: page.width, height: page.height,
        sha256: page.sha256 ?? null, bytes: page.bytes ?? null }, canonical: page.url });
  }
  function addNode(plan, node, proof) {
    assert.ok(node && typeof node.key === "string", "Prepared transport node identity is missing.");
    if (node.directory) addDirectory(plan, node.directory, node.key, proof);
    if (node.url) addImage(plan, node, proof);
  }
  for (const { source, plan } of plans) {
    safeSource(source);
    assert.ok(planShape(plan) && /^\/scenes\/[a-z][a-z0-9-]*\/$/u.test(plan.assetPath) &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(plan.dataset) && plan.roots.length <= 4096,
      "Invalid prepared transport source plan.");
    assert.ok(Number.isSafeInteger(plan.index.maximumDirectoryBytes) && plan.index.maximumDirectoryBytes > 0 &&
      plan.index.maximumDirectoryBytes <= 2 * 1024 * 1024, "Invalid prepared directory byte bound.");
    sources.set(`${source.path}#${source.export}:${source.selector}`, source.sha256);
    for (const node of [...plan.roots, ...(plan.initialLayer ? [plan.initialLayer] : [])]) addNode(plan, node, source);
  }
  const indexed = responses.map((response, index) => ({ response, index }));
  const blobs = indexed.filter(({ response }) => new URL(response.url).protocol === "blob:");
  const indexResponse = ({ response, index, sourceAsset = false }) => {
    const url = plainUrl(response.url), requestUrl = plainUrl(response.requestUrl ?? response.url);
    assert.equal(url.href, requestUrl.href, `Prepared response changed request URL: ${response.url}`);
    assert.ok(!response.redirectedFrom, `Redirected prepared transport cannot qualify: ${response.url}`);
    assert.ok(response.status >= 200 && response.status < 300, `Prepared transport failed (${response.status}): ${response.url}`);
    if (url.origin === origin) assertAuditResponse(response, baseUrl, identity);
    if (sourceAsset) assert.equal(url.origin, origin, "An inventoried asset must retain its audit source origin.");
    assert.ok(Buffer.isBuffer(response.body) || response.body instanceof Uint8Array, "Prepared response bytes were not recorded.");
    return { response, index, key: requestKey(url.href, rangeKey(response.requestHeaders)), url, sourceAsset };
  };
  const pending = indexed.filter(({ response }) => new URL(response.url).protocol !== "blob:").map(indexResponse);
  // These responses already pass the ordinary inventory check. They only gain
  // prepared-image authority if the same metadata graph reaches their exact URL.
  // An unrelated scene raster cannot authorize a blob or a dataset request.
  const inventory = sourceAssetResponses.map((response, index) => indexResponse({ response,
    index: responses.length + index, sourceAsset: true }));
  while (pending.length || inventory.some(item => declarations.has(item.key))) {
    for (let index = 0; index < inventory.length;) {
      if (declarations.has(inventory[index].key)) pending.push(...inventory.splice(index, 1));
      else index++;
    }
    let progress = false;
    for (let index = 0; index < pending.length;) {
      const item = pending[index], descriptor = declarations.get(item.key);
      if (!descriptor) { index++; continue; }
      pending.splice(index, 1); progress = true;
      const { response } = item, bytes = Buffer.from(response.body), hash = sha(bytes);
      const { canonical } = descriptor;
      let receipt;
      if (descriptor.kind === "directory") {
        const { ref, plan } = descriptor;
        assert.equal(bytes.length, ref.bytes, `Prepared directory byte length mismatch: ${canonical}`);
        assert.equal(hash, ref.sha256, `Prepared directory hash mismatch: ${canonical}`);
        assert.equal(response.status, ref.offset === undefined ? 200 : 206, `Prepared directory status mismatch: ${canonical}`);
        if (ref.offset !== undefined) {
          const match = /^bytes (\d+)-(\d+)\/(\d+)$/u.exec(response.headers["content-range"] ?? "");
          assert.ok(match && Number(match[1]) === ref.offset && Number(match[2]) === ref.offset + ref.bytes - 1 &&
            Number(match[3]) >= ref.offset + ref.bytes && Number(match[3]) <= 32 * 1024 * 1024,
            `Prepared pack response did not honor its exact range: ${canonical}`);
        } else assert.ok(!response.headers["content-range"], "A complete prepared directory cannot return a range.");
        const data = descriptor.packed
          ? await readPreparedWmtsBlock(new Response(bytes, { status: response.status, headers: response.headers }), ref)
          : JSON.parse(bytes.toString("utf8"));
        assert.ok(data.schema === "cssearth-city-index@1" && data.dataset === plan.dataset && Array.isArray(data.nodes) &&
          data.nodes.length > 0 && data.nodes.length <= (descriptor.packed ? 2133 : 21) && Array.isArray(data.external) && data.external.length <= 64,
          `Prepared directory dataset or topology mismatch: ${canonical}`);
        const nodes = new Map();
        for (const node of [...data.nodes, ...data.external]) {
          assert.ok(typeof node.key === "string" && !nodes.has(node.key), "Duplicate or invalid prepared subtree key.");
          nodes.set(node.key, node);
        }
        const visited = new Set(), queue = [descriptor.ownerKey];
        while (queue.length) {
          const key = queue.shift();
          if (visited.has(key)) continue;
          const node = nodes.get(key);
          assert.ok(node, `Prepared subtree is missing reachable node ${key}`); visited.add(key);
          addNode(plan, node, { directory: canonical, sha256: hash, key });
          for (const field of ["children", "pages"]) {
            assert.ok(node[field] === undefined || Array.isArray(node[field]), "Invalid prepared child references.");
            if (node[field]) queue.push(...node[field]);
          }
        }
        assert.equal(visited.size, nodes.size, "Prepared directory includes unreachable nodes.");
        receipt = { kind: "directory", dataset: plan.dataset, url: canonical, bytes: bytes.length, sha256: hash,
          ...(descriptor.packed ? { decodedBytes: ref.decodedBytes, decodedSha256: ref.decodedSha256 } : {}),
          ...(ref.offset === undefined ? {} : { offset: ref.offset, range: descriptor.range }), proof: descriptor.proof };
      } else {
        const { page, format } = descriptor;
        assert.equal(response.status, 200, `Prepared image must be a complete response: ${canonical}`);
        assert.ok(!response.headers["content-range"], "Prepared image cannot return a partial response.");
        assert.ok(bytes.length > 0 && bytes.length <= page.width * page.height * 4 + 65536, "Prepared image exceeds its decoded transfer bound.");
        if (format.pinned) {
          assert.equal(bytes.length, page.bytes, "Prepared image byte length mismatch.");
          assert.equal(hash, page.sha256, "Prepared image hash mismatch.");
        } else assert.equal(response.headers["content-type"]?.split(";")[0].trim(), "image/png", "Dataset response is not a PNG image.");
        const metadata = await sharp(bytes, { limitInputPixels: 1040 * 1040 }).metadata();
        assert.equal(metadata.width, page.width, "Prepared image width mismatch.");
        assert.equal(metadata.height, page.height, "Prepared image height mismatch.");
        assert.ok(["png", "webp", "jpeg"].includes(metadata.format) && !metadata.pages, "Prepared response is not a single raster image.");
        if (format.format) assert.equal(metadata.format, format.format, "Dataset raster format mismatch.");
        receipt = { kind: "image", dataset: descriptor.plan.dataset, url: canonical, bytes: bytes.length, sha256: hash,
          width: page.width, height: page.height, sourceByteIdentity: format.pinned ? "prepared-sha256" : "observed-response-sha256", proof: descriptor.proof };
      }
      if (receipts.has(canonical)) {
        const previous = receipts.get(canonical);
        assert.equal(previous.sha256, receipt.sha256, `Prepared transport changed during capture: ${canonical}`);
        assert.equal(previous.bytes, receipt.bytes, `Prepared transport length changed during capture: ${canonical}`);
      } else receipts.set(canonical, receipt);
      references.push({ response: item.index, url: response.url, key: canonical,
        ...(item.sourceAsset ? { sourceInventory: true } : {}) });
    }
    assert.ok(progress, `Undeclared or unreachable prepared transport responses: ${pending.slice(0, 5).map(item => `${item.response.url} ${rangeKey(item.response.requestHeaders)}`).join(", ")}`);
  }
  const decodedImages = [];
  for (const { response, index } of blobs) {
    const url = new URL(response.url);
    assert.equal(url.origin, origin, "Decoded image blob belongs to another origin.");
    assert.equal(response.requestUrl ?? response.url, response.url, "Decoded image blob changed request URL.");
    assert.ok(!response.redirectedFrom && response.status === 200 && response.resourceType === "image",
      "A decoded image blob must be a direct, complete image response.");
    assert.ok(Buffer.isBuffer(response.body) || response.body instanceof Uint8Array, "Decoded blob bytes were not recorded.");
    const bytes = Buffer.from(response.body), hash = sha(bytes);
    const upstream = [...receipts.values()].filter(receipt => receipt.kind === "image" && receipt.sha256 === hash && receipt.bytes === bytes.length);
    assert.ok(upstream.length > 0, `Decoded image blob has no verified source response: ${response.url}`);
    // Blob identities are process-local. Retain them as a byte-linked receipt;
    // comparisons use the already recorded stable metadata URL and SHA.
    decodedImages.push({ response: index, url: response.url, bytes: bytes.length, sha256: hash,
      sources: upstream.map(receipt => receipt.url).sort() });
  }
  const ordered = [...receipts].sort(([a], [b]) => a.localeCompare(b));
  return { schema: AUDIT_PREPARED_TRANSPORT_SCHEMA, sources: Object.fromEntries([...sources].sort()),
    responses: references.sort((a, b) => a.response - b.response), decodedImages, receipts: ordered.map(([, receipt]) => receipt),
    loadedAssets: Object.fromEntries(ordered.map(([key, receipt]) => [key, receipt.sha256])) };
}
