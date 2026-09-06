import { createPreparedProjectiveTextureLeaf } from "../rendering/prepared-projective-texture-leaf.js";
import { selectCityPages } from "./city-page-selection.js";
import { createCityIndex } from "./city-index.js";
import { normalizeCityAssetOrigin, isPreparedCityAssetUrl, isPreparedAssetPath } from "./city-asset-url.js";
import { createApiImageTransport } from "./api-image-transport.js";
import { requirePhysicalProjection } from '../rendering/physical-projection.js';
import { publishPreparedPageTexture } from './page-texture.js';

import type { PreparedPage, PageMountOptions, PageSelection } from "./types.js";
import type { ObjectRuntimeView } from "../runtime/object-runtime-types.js";
interface PageSlot { leaf: HTMLElement; apiTexture: HTMLElement | null; image: HTMLImageElement; key: string | null; blobUrl: string | null; apiHandle: ReturnType<ReturnType<typeof createApiImageTransport>["acquire"]> | null; controller: AbortController | null; generation: number; ready: boolean; published: boolean; decodedBytes: number; }
export function mountPreparedMapPages({ plan, carrier, system, scene, camera, stage, className, textureClassName, lensIds, own, onError = error => { throw error; } }: PageMountOptions) {
  let validAssetOrigin = false;
  try { validAssetOrigin = normalizeCityAssetOrigin(plan.assetOrigin) === plan.assetOrigin; } catch {}
  if (plan.schema !== "cssearth-prepared-map-pages@1" || !validAssetOrigin || !isPreparedAssetPath(plan.assetPath) ||
      (plan.pageTemplate !== undefined && plan.pageTemplate !== "clipped-projective") ||
      !Number.isSafeInteger(plan.poolSize) || plan.poolSize < 1 || plan.poolSize > 512 ||
      !Number.isSafeInteger(plan.maximumDecodedBytes) || plan.maximumDecodedBytes < plan.decodedPageBytes*2) {
    throw new Error("Invalid prepared map-page plan.");
  }
  const slots: PageSlot[] = [];
  let desired: string[] = [];
  let progressiveInitialView = false;
  let desiredPages = new Map<string, PreparedPage>();
  let destroyed = false;
  let enabled = true;
  let playing = false;
  let pendingFrame: number | null = null;
  let view: ObjectRuntimeView | null = null;
  let activeLoads = 0;
  let requests = 0;
  let aborts = 0;
  let evictions = 0;
  let publications = 0;
  let selectionRuns = 0, selectionDiagnostics: (Omit<PageSelection, "keys" | "directories"> & { scale?: number }) | null = null;
  let errors: string[] = [];
  let index: ReturnType<typeof createCityIndex>, apiImages: ReturnType<typeof createApiImageTransport>, observer: ResizeObserver | null = null, shellObserver: MutationObserver | null = null;
  const schedule = () => {
    if (!destroyed && pendingFrame === null) pendingFrame = requestAnimationFrame(() => { try { refresh(); } catch (error) { onError(error); } });
  };
  if (typeof own !== "function") throw new TypeError("Prepared pages require shared lifetime ownership.");
  own(destroy);
  try {
  const initial = plan.initialLayer;
  for (let index = 0; index < plan.poolSize; index++) {
    const leaf = createPreparedProjectiveTextureLeaf({
      tag: "s", className,
      style: "width:32px;height:32px;background-size:32px 32px;background-position:0px 0px",
      projectiveTextureLayer: { schema: "polycss-prepared-projective-texture-layer@1",
        rasterScale: plan.rasterScale, frameMatrix: initial.frameMatrix, textureMatrix: initial.textureMatrix },
    });
    leaf.style.visibility = "hidden";
    let apiTexture=null;
    if(plan.pageTemplate === "clipped-projective"){
      apiTexture=document.createElement("span");
      apiTexture.className=textureClassName;
      apiTexture.style.cssText="position:absolute;inset:0 auto auto 0;width:100%;height:100%;display:block;transform-origin:0 0;transform-style:flat;backface-visibility:visible;background-repeat:no-repeat;visibility:hidden;pointer-events:none";
      leaf.appendChild(apiTexture);
    }
    slots.push({ leaf, apiTexture, image: new Image(),
      key: null, blobUrl: null, apiHandle: null, controller: null, generation: 0, ready: false, published: false, decodedBytes: 0 });
    carrier.appendChild(leaf);
  }
    index = createCityIndex(plan, schedule);
    apiImages = createApiImageTransport();
    observer = new ResizeObserver(schedule);
    observer.observe(stage);
    shellObserver = new MutationObserver(schedule);
    shellObserver.observe(stage.ownerDocument.body, { attributes: true, attributeFilter: ["data-sidebar-collapsed"] });
  } catch (error) {
    try { destroy(); } catch (cleanup) { throw new AggregateError([error, cleanup], error instanceof Error ? error.message : String(error), { cause: error }); }
    throw error;
  }

  function release(slot: PageSlot) {
    slot.generation += 1;
    if (slot.controller) { slot.controller.abort(); aborts += 1; }
    if (slot.key) evictions += 1;
    slot.leaf.style.visibility = "hidden";
    slot.leaf.style.backgroundImage = "none";
    if(slot.apiTexture){
      slot.apiTexture.style.backgroundImage = "none";
      slot.apiTexture.style.visibility = "hidden";
    }
    slot.image.src = "";
    if (slot.blobUrl) URL.revokeObjectURL(slot.blobUrl);
    slot.apiHandle?.release();
    delete slot.leaf.dataset.cityPage;
    Object.assign(slot, { key: null, blobUrl: null, apiHandle: null, controller: null, ready: false, published: false, decodedBytes: 0 });
  }

  function refresh() {
    pendingFrame = null;
    if (destroyed || !view) return;
    if (!enabled || view.zoom <= plan.minimumZoom) {
      desired = [];
      desiredPages.clear();
      index.update([]);
      for (const slot of slots) if (slot.key) release(slot);
      return;
    }
    // Dynamic view selection only. Geometry, UVs and page pixels are prepared.
    const projection = view.projection && requirePhysicalProjection(view.projection);
    const matrix = (projection ? new DOMMatrix(Array.from(projection.eyeFromScene)) : new DOMMatrix(getComputedStyle(scene).transform))
      .multiply(new DOMMatrix(getComputedStyle(system).transform))
      .multiply(new DOMMatrix(getComputedStyle(carrier).transform));
    const scale = projection ? 1 : Number.parseFloat(getComputedStyle(camera).scale);
    const cameraRect=camera.getBoundingClientRect(),stageRect=stage.getBoundingClientRect();
    const selection = selectCityPages(plan, index.nodes(), Array.from(matrix.toFloat64Array()), scale,
      { width: stage.clientWidth, height: stage.clientHeight,
        originX:cameraRect.left+cameraRect.width/2-stageRect.left,
        originY:cameraRect.top+cameraRect.height/2-stageRect.top,
        ...(projection ? { projection } : {}) });
    if(desired.join(",")!==selection.keys.join(",")){
      progressiveInitialView=!slots.some(slot=>slot.published)&&selection.keys.every(key=>
        ["terrascope-wms@1","terrascope-wmts@1"].includes(index.nodes().get(key)?.rasterSource ?? ""));
    }
    selectionDiagnostics={fallbacks:selection.fallbacks,scale:selection.selectionScale,cuts:selection.cuts,baseSurfaceFallback:selection.baseSurfaceFallback};
    desired = selection.keys;
    // Transport at most half a pool of selected prepared records. Directory
    // eviction must not invalidate a page that is already queued for loading.
    desiredPages = new Map(desired.map(key => [key, index.nodes().get(key)!]));
    index.update(selection.directories);
    selectionRuns += 1;
    // Keep the last complete view until every replacement page has decoded.
    for (const slot of slots) if (slot.key && !slot.published && !desired.includes(slot.key)) release(slot);
    publishReadyView();
    pump();
    if (playing) schedule();
  }

  function pump() {
    if (destroyed || !enabled || plan.topology === "wmts-quadtree@1" && index.stats().activeLoads) return;
    for (const key of desired) {
      if (activeLoads >= plan.maximumConcurrentLoads) break;
      if (slots.some((slot) => slot.key === key)) continue;
      const slot = slots.find((candidate) => candidate.key === null);
      if (!slot) break;
      const page=desiredPages.get(key)!;
      if(slots.reduce((sum,slot)=>sum+slot.decodedBytes,0)+page.width*page.height*4>plan.maximumDecodedBytes)break;
      load(slot,page);
    }
  }

  function publishReadyView() {
    const complete=desired.every(key => slots.some(slot => slot.key === key && slot.ready));
    if (!complete&&!progressiveInitialView) return;
    for (const slot of slots) {
      if (slot.key && !desired.includes(slot.key)) {if(complete)release(slot);}
      else if (slot.key && slot.ready && !slot.published) {
        slot.leaf.style.visibility = "visible";
        if(slot.apiTexture&&slot.apiTexture.style.backgroundImage!=="none")slot.apiTexture.style.visibility="visible";
        slot.published = true;
        publications += 1;
      }
    }
  }

  async function load(slot: PageSlot, page: PreparedPage) {
    const generation = ++slot.generation;
    const controller = new AbortController();
    slot.key = page.key;
    slot.controller = controller;
    slot.decodedBytes = page.width*page.height*4;
    activeLoads += 1;
    requests += 1;
    let blobUrl = null;
    const api = page.rasterSource === "terrascope-wms@1" || page.rasterSource === "terrascope-wmts@1";
    try {
      if(page.imageMatrix&&!slot.apiTexture)throw new Error("The prepared page requires a clipping template.");
      if(api){
        slot.apiHandle=apiImages.acquire(page);
        blobUrl=await slot.apiHandle.ready;
      }else{
        const localPrepared=page.rasterSource === "prepared-noise@1" &&
          /^[a-f0-9]{64}$/u.test(page.sha256??"") && /^\/scenes\/[a-z][a-z0-9-]*\/[a-z0-9-]+-[a-f0-9]{16}\.webp$/u.test(page.url) && page.url.endsWith(`-${page.sha256.slice(0,16)}.webp`);
        if (!localPrepared && !isPreparedCityAssetUrl(plan, page.url, "page", page.sha256)) {
          throw new Error(`City page ${page.key}: invalid prepared URL`);
        }
        const response = await fetch(page.url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
        if (!response.ok) throw new Error(`City page ${page.key}: HTTP ${response.status}`);
        const blob = await response.blob();
        if (blob.size !== page.bytes) throw new Error(`City page ${page.key}: byte size mismatch`);
        if(localPrepared){
          const digest=[...new Uint8Array(await crypto.subtle.digest("SHA-256",await blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,"0")).join("");
          if(digest!==page.sha256)throw new Error("Prepared image hash mismatch.");
        }
        if (destroyed || controller.signal.aborted || generation !== slot.generation) return;
        blobUrl = URL.createObjectURL(blob);
        slot.blobUrl = blobUrl;
      }
      if (destroyed || controller.signal.aborted || generation !== slot.generation) return;
      slot.image.src = blobUrl!;
      await slot.image.decode();
      if (destroyed || controller.signal.aborted || generation !== slot.generation) return;
      if (slot.image.naturalWidth !== page.width || slot.image.naturalHeight !== page.height) {
        throw new Error(`City page ${page.key}: dimension mismatch`);
      }
      publishPreparedPageTexture(slot.leaf, slot.apiTexture, page, blobUrl, plan.rasterScale);
      slot.leaf.dataset.cityPage = page.key;
      slot.ready = true;
      slot.controller = null;
      publishReadyView();
    } catch (error) {
      if (!controller.signal.aborted && !destroyed && generation === slot.generation) {
        errors = [...errors.slice(-7), error instanceof Error ? error.message : String(error)];
        // Keep the failed key until the view changes; do not retry every frame.
        slot.controller = null;
      }
    } finally {
      activeLoads -= 1;
      if (!api && blobUrl && (destroyed || generation !== slot.generation)) URL.revokeObjectURL(blobUrl);
      pump();
    }
  }

  return Object.freeze({
    publish(nextView: ObjectRuntimeView) { view = nextView; schedule(); },
    setLens(lens: { id: string | null }) {
      enabled = (plan.lensIds ?? lensIds).includes(lens.id ?? "");
      if (!enabled) {
        desired = [];
        desiredPages.clear();
        index.update([]);
        for (const slot of slots) if (slot.key) release(slot);
      }
      schedule();
    },
    setPlaying(value: boolean) { playing = Boolean(value); schedule(); },
    stats() {
      return { dataset: plan.dataset, qualification: plan.qualification,
        poolSize: slots.length, desired: [...desired], activeLoads, pendingSelection: pendingFrame !== null,
        retained: slots.filter((slot) => slot.key).map(({ key, ready, published }) => ({ key, ready, published })),
        index: index.stats(), apiImages: apiImages.stats(),
        decodedPageByteBound: plan.maximumDecodedBytes,
        reservedDecodedBytes: slots.reduce((sum,slot)=>sum+slot.decodedBytes,0),
        requests, aborts, evictions, publications, selectionRuns, selectionDiagnostics, errors: [...errors] };
    },
    destroy,
  });
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    const failures: unknown[] = [];
    const cleanup = (callback: () => void) => { try { callback(); } catch (error) { failures.push(error); } };
    cleanup(() => observer?.disconnect());
    cleanup(() => shellObserver?.disconnect());
    cleanup(() => index?.destroy());
    desiredPages.clear();
    if (pendingFrame !== null) cleanup(() => cancelAnimationFrame(pendingFrame!));
    for (const slot of slots) { cleanup(() => release(slot)); cleanup(() => slot.leaf.remove()); }
    cleanup(() => apiImages?.destroy());
    if (failures.length) throw new AggregateError(failures, "Prepared page cleanup failed.");
  }
}
