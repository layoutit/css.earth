import { isPreparedCityAssetUrl } from "./city-asset-url.js";
import { isPreparedBlockReference, readPreparedWmtsBlock, preparedReferenceKey } from "./prepared-block-transport.js";

// Only metadata residency and prepared-tree transport. No geographic geometry,
// source pixels or image processing is derived in the browser.
import type { PreparedPagePlan, PreparedPage, PreparedReference, PreparedDirectory } from "./types.js";
interface DirectoryEntry { ref: PreparedReference; controller?: AbortController | null; data?: PreparedDirectory; started?: boolean; }
export function createCityIndex(plan: PreparedPagePlan, changed: () => void, fetchIndex: typeof fetch = fetch) {
  const entries = new Map<string, DirectoryEntry>();
  let nodes = new Map(plan.roots.map(node => [node.key, node]));
  let activeLoads = 0, requests = 0, aborts = 0, destroyed = false, budgetBlocked = 0;
  let errors: string[] = [];
  const limits = plan.index;
  const resolved = new WeakMap<PreparedPage, { coverageParts: PreparedPage["coverageParts"]; value: PreparedPage }>();
  const rebuild = () => {
    nodes = new Map(plan.roots.map(node => [node.key, node]));
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
  };
  function update(references: readonly PreparedReference[]) {
    if (destroyed) return;
    const accepted = new Map<string, PreparedReference>();
    let bytes = 0;
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
    for (const [url, ref] of accepted) if (!entries.has(url)) entries.set(url, { ref });
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
    requests++;
    try {
      const { ref } = entry;
      const packed = isPreparedBlockReference(ref, plan.assetPath);
      if (!Number.isSafeInteger(ref.bytes) || ref.bytes < 1 || ref.bytes > limits.maximumDirectoryBytes ||
          (!packed && !isPreparedCityAssetUrl(plan, ref.url, "index", ref.sha256))) {
        throw new Error("Invalid prepared city directory reference.");
      }
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]);
      if (ref.offset !== undefined && !ref.url.startsWith(`${plan.assetPath}wmts-${plan.geometryVersion}/`)) throw new Error("Unexpected prepared geometry version.");
      const localMirror=["localhost","127.0.0.1","[::1]"].includes(globalThis.location?.hostname);
      const url=plan.geometryOrigin && packed && !localMirror ? new URL(ref.url,plan.geometryOrigin).href : ref.url;
      const response = await fetchIndex(url, { signal, ...(ref.offset===undefined?{}:{headers:{Range:`bytes=${ref.offset}-${ref.offset+ref.bytes-1}`}}) });
      if (!response.ok) throw new Error(`City directory: HTTP ${response.status}`);
      let data: PreparedDirectory;
      if (packed) data = await readPreparedWmtsBlock(response, ref, signal);
      else {
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength !== ref.bytes) throw new Error("City directory byte size mismatch.");
        const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
          .map(byte => byte.toString(16).padStart(2, "0")).join("");
        if (hash !== ref.sha256) throw new Error("City directory hash mismatch.");
        data = JSON.parse(new TextDecoder().decode(bytes));
      }
      if (data.schema !== "cssearth-city-index@1" || data.dataset !== plan.dataset ||
          !Array.isArray(data.nodes) || data.nodes.length > (packed ? 2133 : 21) ||
          !Array.isArray(data.external) || data.external.length > 64) {
        throw new Error("Invalid prepared city directory.");
      }
      if (destroyed || controller.signal.aborted || entries.get(preparedReferenceKey(ref)) !== entry) return;
      entry.data = data;
      rebuild();
      changed();
    } catch (error) {
      if (!destroyed && !controller.signal.aborted) errors = [...errors.slice(-7), error instanceof Error ? error.message : String(error)];
    } finally {
      entry.controller = null;
      activeLoads--;
      pump();
    }
  }
  return {
    nodes: () => nodes,
    update,
    stats: () => ({ activeLoads, requests, aborts, budgetBlocked,
      residentDirectories: entries.size, residentNodes: nodes.size,
      reservedEncodedBytes: [...entries.values()].reduce((sum, entry) => sum + entry.ref.bytes, 0),
      reservedDecodedBytes: [...entries.values()].reduce((sum, entry) => sum + (entry.ref.decodedBytes ?? entry.ref.bytes), 0),
      maximumBytes: limits.maximumBytes, maximumDirectories: limits.maximumDirectories,
      errors: [...errors] }),
    destroy() {
      destroyed = true;
      for (const [url, entry] of entries) remove(url, entry);
      nodes.clear();
    },
  };
}
