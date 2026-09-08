import { createPreparedProjectiveTextureLeaf } from "../prepared-projective-texture-leaf.mjs";
import { selectCityPages, projectCityPage } from "./city-page-selection.mjs";
import { createCityIndex } from "./city-index.mjs";
import { normalizeCityAssetOrigin, isPreparedAssetPath } from "./city-asset-url.mjs";
import { createApiImageTransport } from "./api-image-transport.mjs";
import { selectPagePublication, selectPageFallbacks, usefulFallbacks, selectPageDemand } from "./page-publication.mjs";

export function mountPreparedMapPages({ plan, carrier, system, scene, camera, stage, className, textureClassName, lensIds, own, images = null, onStatus = () => {}, onError = error => { throw error; } }) {
  let validAssetOrigin = false;
  try { validAssetOrigin = normalizeCityAssetOrigin(plan.assetOrigin) === plan.assetOrigin; } catch {}
  if (plan.schema !== "cssearth-prepared-map-pages@1" || !validAssetOrigin || !isPreparedAssetPath(plan.assetPath) ||
      (plan.pageTemplate !== undefined && plan.pageTemplate !== "clipped-projective") ||
      !Number.isSafeInteger(plan.poolSize) || plan.poolSize < 1 || plan.poolSize > 512 ||
      !Number.isSafeInteger(plan.maximumDecodedBytes) || plan.maximumDecodedBytes < plan.decodedPageBytes*2) {
    throw new Error("Invalid prepared map-page plan.");
  }
  if(plan.backing && (plan.topology!=="wmts-quadtree@1" || !Array.isArray(plan.backing.roots) || plan.backing.roots.length>plan.poolSize ||
      !Number.isFinite(plan.backing.minimumZoom) || plan.backing.minimumZoom<0 || plan.backing.minimumZoom>plan.minimumZoom ||
      !Number.isSafeInteger(plan.backing.rootDecodedBytes) || plan.backing.rootDecodedBytes<1 || plan.backing.rootDecodedBytes>=plan.index.maximumBytes ||
      new Set([...plan.roots,...plan.backing.roots].map(node=>node.key)).size!==plan.roots.length+plan.backing.roots.length)) {
    throw new Error("Invalid prepared map backing.");
  }
  const capacity = plan;
  const slots = [];
  let desired = [];
  let desiredGroups = [];
  let fallbackGroups = [];
  let pageGroups = new Map();
  let progressiveInitialView = false;
  let desiredPages = new Map();
  let destroyed = false;
  let enabled = true;
  let suspended = false;
  let playing = false;
  let pendingFrame = null;
  let view = null;
  let activeLoads = 0;
  const idleWaiters = new Set();
  const publishIdle = () => { if (activeLoads === 0 || destroyed) { for (const resolve of idleWaiters) resolve(); idleWaiters.clear(); } };
  let requests = 0;
  let aborts = 0;
  let evictions = 0;
  let publications = 0;
  let selectionRuns = 0, selectionDiagnostics = null;
  const errors = new Map();
  let index = null, apiImages = null, imageTransport = null, observer = null, shellObserver = null;
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
      leaf.firstElementChild.appendChild(apiTexture);
    }
    slots.push({ leaf, texture: leaf.firstElementChild, apiTexture,
      key: null, group: null, apiHandle: null, controller: null, generation: 0, ready: false, published: false, empty: false, decodedBytes: 0 });
    carrier.appendChild(leaf);
  }
    index = createCityIndex(plan, schedule);
    if (images) apiImages = images;
    else {
      imageTransport = createApiImageTransport();
      apiImages = imageTransport.createScope({ maximumEntries: capacity.poolSize, maximumDecodedBytes: capacity.maximumDecodedBytes });
    }
    observer = new ResizeObserver(schedule);
    observer.observe(stage);
    shellObserver = new MutationObserver(schedule);
    shellObserver.observe(stage.ownerDocument.body, { attributes: true, attributeFilter: ["data-sidebar-collapsed"] });
  } catch (error) {
    try { destroy(); } catch (cleanup) { throw new AggregateError([error, cleanup], error.message, { cause: error }); }
    throw error;
  }

  function release(slot) {
    if (slot.key) errors.delete(slot.key);
    slot.generation += 1;
    if (slot.controller) { slot.controller.abort(); aborts += 1; }
    if (slot.key) evictions += 1;
    slot.leaf.style.visibility = "hidden";
    slot.leaf.style.backgroundImage = "none";
    if(slot.apiTexture){
      slot.apiTexture.style.backgroundImage = "none";
      slot.apiTexture.style.visibility = "hidden";
    }
    slot.apiHandle?.release();
    delete slot.leaf.dataset.cityPage;
    Object.assign(slot, { key: null, group: null, apiHandle: null, controller: null, ready: false, published: false, empty: false, decodedBytes: 0 });
  }

  function clearDesired() {
    desired = [];
    desiredGroups = [];
    fallbackGroups = [];
    pageGroups.clear();
    desiredPages.clear();
  }

  function refresh() {
    pendingFrame = null;
    if (destroyed || !view) return;
    if (!enabled || suspended || view.zoom <= (plan.backing?.minimumZoom??plan.minimumZoom)) {
      clearDesired();
      index.update([]);
      for (const slot of slots) if (slot.key) release(slot);
      onStatus();
      return;
    }
    // Dynamic view selection only. Geometry, UVs and page pixels are prepared.
    const matrix = new DOMMatrix(getComputedStyle(scene).transform)
      .multiply(new DOMMatrix(getComputedStyle(system).transform))
      .multiply(new DOMMatrix(getComputedStyle(carrier).transform));
    const scale = Number.parseFloat(getComputedStyle(camera).scale);
    const cameraRect=camera.getBoundingClientRect(),stageRect=stage.getBoundingClientRect();
    const projection = Array.from(matrix.toFloat64Array());
    const viewport = { width: stage.clientWidth, height: stage.clientHeight, zoom:view.zoom,
        originX:cameraRect.left+cameraRect.width/2-stageRect.left,
        originY:cameraRect.top+cameraRect.height/2-stageRect.top };
    const selection = selectCityPages(plan, index.nodes(), projection, scale, viewport);
    if(desired.join(",")!==selection.keys.join(",")){
      progressiveInitialView=!slots.some(slot=>slot.published)&&selection.keys.every(key=>
        ["terrascope-wms@1","terrascope-wmts@1","prepared-wmts-raster@1"].includes(index.nodes().get(key)?.rasterSource));
    }
    selectionDiagnostics={fallbacks:selection.fallbacks,scale:selection.selectionScale,cuts:selection.cuts,baseSurfaceFallback:selection.baseSurfaceFallback,backing:selection.backing};
    desired = selection.keys;
    desiredGroups = selection.groups ?? [];
    fallbackGroups = plan.topology === "wmts-quadtree@1" ? selectPageFallbacks(desiredGroups, index.nodes(), slots,
      {pages:plan.poolSize, bytes:plan.maximumDecodedBytes}, page => projectCityPage(page, projection, scale, viewport).visible) : [];
    pageGroups = new Map([...desiredGroups,...fallbackGroups].flatMap(group=>group.pages.map(key=>[key,group])));
    // Pin admitted records before metadata eviction. Auxiliary ancestor images
    // share the same old-plus-incoming reservation and retained page pool.
    desiredPages = new Map([...fallbackGroups.flatMap(group=>group.pages),...desired].map(key => [key, index.nodes().get(key)]));
    const admitted = new Set(pageDemand());
    index.update(selection.directories);
    selectionRuns += 1;
    // Retain covering groups while their own replacements decode.
    for (const slot of slots) if (slot.key && !slot.published && !admitted.has(slot.key)) release(slot);
    publishReadyView();
    pump();
    onStatus();
    if (playing) schedule();
  }

  function pump() {
    if (destroyed || !enabled || suspended) return;
    const demand = pageDemand();
    for (const key of demand) {
      if (activeLoads >= plan.maximumConcurrentLoads) break;
      if (slots.some((slot) => slot.key === key)) continue;
      const slot = slots.find((candidate) => candidate.key === null);
      if (!slot) break;
      const page=desiredPages.get(key);
      if(slots.reduce((sum,slot)=>sum+slot.decodedBytes,0)+page.width*page.height*4>plan.maximumDecodedBytes)break;
      load(slot,page);
    }
  }

  function pageDemand(){
    return plan.topology==="wmts-quadtree@1"?selectPageDemand(desiredGroups,slots,desiredPages,
      {pages:plan.poolSize,bytes:plan.maximumDecodedBytes},usefulFallbacks(desiredGroups,slots,fallbackGroups)):desired;
  }

  function publishReadyView() {
    if(plan.topology === "wmts-quadtree@1"){
      const publication=selectPagePublication(desiredGroups,slots,{pages:Math.floor(plan.poolSize/2),bytes:Math.floor(plan.maximumDecodedBytes/2)},fallbackGroups);
      for(const slot of slots)if(publication.release.includes(slot.key))release(slot);
      for(const slot of slots)if(publication.publish.includes(slot.key))publishSlot(slot);
      const useful = new Set(pageDemand());
      for(const slot of slots)if(slot.key && !slot.published && !useful.has(slot.key))release(slot);
      return;
    }
    const complete=desired.every(key => slots.some(slot => slot.key === key && slot.ready));
    if (!complete&&!progressiveInitialView) return;
    for (const slot of slots) {
      if (slot.key && !desired.includes(slot.key)) {if(complete)release(slot);}
      else publishSlot(slot);
    }
  }

  function publishSlot(slot) {
    if (slot.key && slot.ready && !slot.published) {
      slot.leaf.style.visibility = slot.empty ? "hidden" : "visible";
      if(slot.apiTexture&&slot.apiTexture.style.backgroundImage!=="none")slot.apiTexture.style.visibility="visible";
      slot.published = true;
      publications += 1;
    }
  }

  async function load(slot, page) {
    const loadPlan = plan;
    const generation = ++slot.generation;
    const controller = new AbortController();
    slot.key = page.key;
    slot.group = pageGroups.get(page.key) ?? null;
    slot.controller = controller;
    slot.decodedBytes = page.width*page.height*4;
    activeLoads += 1;
    requests += 1;
    try {
      if(page.imageMatrix&&!slot.apiTexture)throw new Error("The prepared page requires a clipping template.");
      slot.apiHandle = apiImages.acquire(page, { plan: loadPlan, signal: controller.signal });
      const blobUrl = await slot.apiHandle.ready;
      if (destroyed || controller.signal.aborted || generation !== slot.generation) return;
      if (slot.apiHandle.empty) {
        slot.empty = true; slot.ready = true; slot.decodedBytes = 0; slot.controller = null;
        slot.leaf.dataset.cityPage = page.key;
        publishReadyView(); return;
      }
      slot.leaf.style.transform = `matrix3d(${page.frameMatrix})`;
      slot.texture.style.transform = `matrix3d(${page.textureMatrix})`;
      slot.texture.style.overflow=page.imageMatrix?"hidden":"visible";
      slot.texture.style.backgroundImage=page.imageMatrix?"none":"inherit";
      const imageTexture=page.imageMatrix?slot.apiTexture:slot.texture;
      imageTexture.style.backgroundSize = page.textureBackgroundSize ?? `${32*loadPlan.rasterScale}px ${32*loadPlan.rasterScale}px`;
      imageTexture.style.backgroundPosition = page.textureBackgroundPosition ?? "0px 0px";
      if(page.imageMatrix){
        slot.apiTexture.style.transform=`matrix3d(${page.imageMatrix})`;
        slot.apiTexture.style.backgroundImage=`url("${blobUrl}")`;
      }
      slot.leaf.style.backgroundImage = `url("${blobUrl}")`;
      slot.leaf.dataset.cityPage = page.key;
      slot.ready = true;
      slot.controller = null;
      publishReadyView();
    } catch (error) {
      if (!controller.signal.aborted && !destroyed && generation === slot.generation) {
        slot.apiHandle?.invalidate();
        errors.set(page.key, error.message);
        // Keep the failed key until explicit retry or eviction; never retry every frame.
        slot.controller = null;
      }
    } finally {
      activeLoads -= 1;
      pump();
      publishIdle();
      onStatus();
    }
  }

  return Object.freeze({
    retry() {
      if (destroyed || !enabled || suspended) return;
      // Explicit intent alone resets failed work. Ready and pending images keep
      // their leases, reservations and visible backing at the current camera.
      errors.clear();
      for (const slot of slots) if (slot.key && !slot.ready && !slot.controller) release(slot);
      index.retry();
      schedule();
    },
    whenIdle: () => activeLoads === 0 || destroyed ? Promise.resolve() : new Promise(resolve => idleWaiters.add(resolve)),
    replacePlan(next) {
      if (destroyed) return;
      if (next && (next.schema !== capacity.schema || next.assetPath !== capacity.assetPath ||
          next.assetOrigin !== capacity.assetOrigin || !(capacity.rasterScales ?? [capacity.rasterScale]).includes(next.rasterScale) ||
          next.poolSize !== slots.length || next.maximumDecodedBytes > capacity.maximumDecodedBytes ||
          next.maximumConcurrentLoads > capacity.maximumConcurrentLoads)) throw new Error("Map package exceeds mounted capacity.");
      clearDesired(); errors.clear(); progressiveInitialView = false;
      for (const slot of slots) if (slot.key) release(slot);
      index.destroy();
      plan = next ?? capacity;
      // Restore the prepared dataset's pixel box on the same retained leaves.
      // Both admitted scales are fixed dataset facts, independent of device DPR.
      for (const slot of slots) slot.leaf.style.width = slot.leaf.style.height = `${32 * plan.rasterScale}px`;
      index = createCityIndex(plan, schedule);
      enabled = Boolean(next);
      schedule();
    },
    publish(nextView) { view = nextView; schedule(); },
    setSuspended(value) {
      if (suspended === Boolean(value)) return;
      suspended = Boolean(value);
      if (suspended) {
        clearDesired(); index.update([]);
        for (const slot of slots) if (slot.key) release(slot);
      }
      schedule();
    },
    setLens(lens) {
      enabled = (plan.lensIds ?? lensIds).includes(lens.id);
      if (!enabled) {
        clearDesired();
        index.update([]);
        for (const slot of slots) if (slot.key) release(slot);
      }
      schedule();
    },
    setPlaying(value) { playing = Boolean(value); schedule(); },
    stats() {
      return { dataset: plan.dataset, qualification: plan.qualification, suspended,
        poolSize: slots.length, desired: pageDemand().filter(key=>desired.includes(key)), fallback:usefulFallbacks(desiredGroups,slots,fallbackGroups).flatMap(group=>group.pages), activeLoads, pendingSelection: pendingFrame !== null,
        retained: slots.filter((slot) => slot.key).map(({ key, ready, published, empty }) => ({ key, ready, published, ...(empty ? {empty} : {}) })),
        index: index.stats(), apiImages: apiImages.stats(),
        decodedPageByteBound: plan.maximumDecodedBytes,
        reservedDecodedBytes: slots.reduce((sum,slot)=>sum+slot.decodedBytes,0),
        requests, aborts, evictions, publications, selectionRuns, selectionDiagnostics, errors: [...errors.values()].slice(-8) };
    },
    destroy,
  });
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    publishIdle();
    const failures = [];
    const cleanup = callback => { try { callback(); } catch (error) { failures.push(error); } };
    cleanup(() => observer?.disconnect());
    cleanup(() => shellObserver?.disconnect());
    cleanup(() => index?.destroy());
    clearDesired();
    if (pendingFrame !== null) cleanup(() => cancelAnimationFrame(pendingFrame));
    for (const slot of slots) { cleanup(() => release(slot)); cleanup(() => slot.leaf.remove()); }
    cleanup(() => imageTransport?.destroy());
    if (failures.length) throw new AggregateError(failures, "Prepared page cleanup failed.");
  }
}
