import { readPreparedJson } from "./prepared-json-transport.js";
import type { PreparedPagePlan, PreparedPage, PreparedReference, PreparedDirectory } from './types.js';
interface DirectoryEntry { ref: PreparedReference; controller?: AbortController | null; data?: PreparedDirectory; started?: boolean; }
import { isPreparedCityAssetUrl } from "./city-asset-url.js";
import { isPreparedBlockReference, readPreparedWmtsBlock, preparedReferenceKey, PreparedBlockTransferError } from "./prepared-block-transport.js";
import { requireGeographicDirectory, requireGeographicDirectoryReference } from "./geographic-index-contract.js";
import { bindPreparedWmtsRaster } from "./wmts-raster-source.js";

// Only metadata residency and prepared-tree transport. No geographic geometry,
// source pixels or image processing is derived in the browser.
export function createCityIndex(plan: PreparedPagePlan, changed: () => void, fetchIndex: typeof fetch = fetch) {
  let entries = new Map<string, DirectoryEntry>();
  const roots=[...plan.roots,...(plan.backing?.roots??[])];
  let nodes = new Map(roots.map(node => [node.key, node]));
  let activeLoads = 0, requests = 0, aborts = 0, destroyed = false, budgetBlocked = 0;
  const errors = new Map<string, string>();
  const limits = plan.index;
  const backingRootBytes=plan.backing?.rootDecodedBytes??0;
  const resolved = new WeakMap<PreparedPage, {coverageParts: PreparedPage["coverageParts"]; value: PreparedPage}>();
  const rebuild = () => {
    nodes = new Map(roots.map(node => [node.key, node]));
    for (const entry of entries.values()) {
      for (const node of entry.data?.external ?? []) nodes.set(node.key, node);
    }
    for (const entry of entries.values()) {
      for (const node of entry.data?.nodes ?? []) {
        const coverageParts=nodes.get(node.key)?.coverageParts;
        let cached=resolved.get(node);
        if(!cached || cached.coverageParts!==coverageParts){
          cached={coverageParts,value:{...(coverageParts?{coverageParts}:{}),...node,directory:entry.ref}};
          resolved.set(node,cached);
        }
        nodes.set(node.key,cached.value);
      }
    }
  };
  const remove = (url: string, entry: DirectoryEntry) => {
    if (entry.controller) { entry.controller.abort(); aborts++; }
    entries.delete(url);
    errors.delete(url);
  };
  function update(references: readonly PreparedReference[]) {
    if (destroyed) return;
    const accepted = new Map<string, PreparedReference>();
    let bytes = backingRootBytes;
    budgetBlocked = 0;
    for (const ref of references) {
      if (accepted.has(preparedReferenceKey(ref))) continue;
      if (accepted.size >= limits.maximumDirectories || bytes + (ref.decodedBytes ?? ref.bytes) > limits.maximumBytes) {
        budgetBlocked++;
        continue;
      }
      accepted.set(preparedReferenceKey(ref), ref);
      bytes += ref.decodedBytes ?? ref.bytes;
    }
    let mutated = false;
    for (const [url, entry] of entries) if (!accepted.has(url)) { remove(url, entry); mutated ||= !!entry.data; }
    // The current view owns queue order. Keep each live/loaded entry intact;
    // only requests that have not started move when the view changes.
    entries = new Map([...accepted].map(([url, ref]) => [url, entries.get(url) ?? { ref }]));
    if (mutated) rebuild();
    pump();
  }
  function pump() {
    if (destroyed) return;
    for (const entry of entries.values()) {
      if (activeLoads >= limits.maximumConcurrentLoads) break;
      if (entry.started) continue;
      load(entry);
    }
  }
  async function load(entry: DirectoryEntry) {
    entry.started = true;
    const controller = new AbortController();
    entry.controller = controller;
    activeLoads++;
    try {
      const { ref } = entry;
      const expectedKeys = plan.imageSource ? new Set([...nodes.values()].filter(node => node.stub &&
        preparedReferenceKey(node.directory!) === preparedReferenceKey(ref)).map(node => node.key)) : null;
      if (plan.imageSource) requireGeographicDirectoryReference(ref, plan);
      const packed = isPreparedBlockReference(ref, plan.assetPath);
      if (!Number.isSafeInteger(ref.bytes) || ref.bytes < 1 || ref.bytes > limits.maximumDirectoryBytes ||
          (!packed && !isPreparedCityAssetUrl(plan, ref.url, "index", ref.sha256))) {
        throw new Error("Invalid prepared city directory reference.");
      }
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]);
      if (ref.offset !== undefined && !ref.url.startsWith(`${plan.assetPath}wmts-${plan.geometryVersion}/`)) throw new Error("Unexpected prepared geometry version.");
      const localMirror=["localhost","127.0.0.1","[::1]"].includes(globalThis.location?.hostname);
      const url=plan.geometryOrigin && packed && !localMirror ? new URL(ref.url,plan.geometryOrigin).href : ref.url;
      let data: PreparedDirectory;
      for (let attempt = 0; ; attempt++) {
        requests++;
        try {
          const response = await fetchIndex(url, { signal, ...(attempt ? { cache: "reload" } : {}),
            ...(ref.offset===undefined?{}:{headers:{Range:`bytes=${ref.offset}-${ref.offset+ref.bytes-1}`}}) });
          if (!response.ok) throw new Error(`City directory: HTTP ${response.status}`);
          if (packed) data = await readPreparedWmtsBlock(response, ref, signal);
          else data = await readPreparedJson(response, ref) as PreparedDirectory;
          break;
        } catch (error) {
          signal.throwIfAborted();
          // A response can end early despite valid range headers. Retry that
          // transfer once under the same reservation and deadline; integrity
          // failures and invalid expanded data still require explicit retry.
          if (attempt || !(error instanceof PreparedBlockTransferError)) throw error;
        }
      }
      if (data.schema !== "cssearth-city-index@1" || data.dataset !== (plan.geometryDataset ?? plan.dataset) ||
          !Array.isArray(data.nodes) || data.nodes.length > (packed ? 2133 : 21) ||
          !Array.isArray(data.external) || data.external.length > 64) {
        throw new Error("Invalid prepared city directory.");
      }
      if (plan.imageSource) {
        requireGeographicDirectory(data, ref, plan, expectedKeys);
        data = { ...data, nodes: data.nodes.map(node => node.rasterSource ? bindPreparedWmtsRaster(node, plan.imageSource!) : node) };
      }
      if (destroyed || controller.signal.aborted || entries.get(preparedReferenceKey(ref)) !== entry) return;
      entry.data = data;
      rebuild();
    } catch (error) {
      if (!destroyed && !controller.signal.aborted) errors.set(preparedReferenceKey(entry.ref), error instanceof Error ? error.message : String(error));
    } finally {
      entry.controller = null;
      activeLoads--;
      pump();
      // Cancellation and failure settle loading too. Notify after accounting
      // for the finished request so the card cannot retain a loading status.
      if (!destroyed) changed();
    }
  }
  return {
    nodes: () => nodes,
    update,
    retry() {
      if (destroyed) return;
      errors.clear();
      for (const entry of entries.values()) if (!entry.data && !entry.controller) entry.started = false;
      pump();
    },
    stats: () => ({ activeLoads, requests, aborts, budgetBlocked,
      residentDirectories: entries.size, residentNodes: nodes.size,
      reservedEncodedBytes: [...entries.values()].reduce((sum, entry) => sum + entry.ref.bytes, 0),
      reservedDecodedBytes: [...entries.values()].reduce((sum, entry) => sum + (entry.ref.decodedBytes ?? entry.ref.bytes), backingRootBytes),
      rootEncodedBytes: plan.rootDirectory?.bytes ?? 0, rootDecodedBytes: (plan.rootDirectory?.decodedBytes ?? 0)+backingRootBytes,
      maximumBytes: limits.maximumBytes, maximumDirectories: limits.maximumDirectories,
      errors: [...errors.values()].slice(-8) }),
    destroy() {
      destroyed = true;
      for (const [url, entry] of entries) remove(url, entry);
      nodes.clear();
    },
  };
}
