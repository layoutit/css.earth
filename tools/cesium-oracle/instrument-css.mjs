// Only the oracle's Vite server applies these observation hooks. Each anchor
// must occur exactly once; source drift fails instead of silently losing data.
export function instrumentCss(source, id) {
  const replace = (before, after) => {
    if (source.split(before).length !== 2) throw new Error(`Oracle hook drift: ${id}: ${before}`);
    source = source.replace(before, after);
  };
  if (id.endsWith('/prepared-map/city-pages.mjs')) {
    replace('  function clearDesired() {', `  if(plan.topology==='wmts-quadtree@1') globalThis.__cssOracleView=()=>{
      const c=camera.getBoundingClientRect(),s=stage.getBoundingClientRect();
      return {projection:Array.from(new DOMMatrix(getComputedStyle(scene).transform).multiply(new DOMMatrix(getComputedStyle(system).transform)).multiply(new DOMMatrix(getComputedStyle(carrier).transform)).toFloat64Array()),
        scale:Number.parseFloat(getComputedStyle(camera).scale),viewport:{width:stage.clientWidth,height:stage.clientHeight,originX:c.left+c.width/2-s.left,originY:c.top+c.height/2-s.top}};
    };
  function clearDesired() {`);
    replace('  function release(slot) {', `  function release(slot) {
    if(slot.key) globalThis.__loadingOracle?.event('page-release',{key:slot.key,published:slot.published,pending:!!slot.controller});`);
    replace('      slot.published = true;', `      slot.published = true;
      globalThis.__loadingOracle?.event('page-publish',{key:slot.key,empty:slot.empty});`);
    replace('    slot.key = page.key;', `    slot.key = page.key;
    globalThis.__loadingOracle?.event('page-load',{key:page.key,url:page.url});`);
    replace('    stats() {', `    stats() {
      const cameraRect=camera.getBoundingClientRect(), stageRect=stage.getBoundingClientRect();
      const projection=new DOMMatrix(getComputedStyle(scene).transform).multiply(new DOMMatrix(getComputedStyle(system).transform)).multiply(new DOMMatrix(getComputedStyle(carrier).transform));
      const observedFallbacks=typeof fallbackGroups==='undefined'?[]:fallbackGroups;
      const oracle = {
        groups:desiredGroups, fallbackGroups:observedFallbacks,
        pages:[...new Set([...desired,...slots.filter(s=>s.key).map(s=>s.key),...observedFallbacks.flatMap(g=>g.pages)])].map(key=>{
          const p=index.nodes().get(key); const s=slots.find(s=>s.key===key);
          return {key,url:p?.url,level:p?.level,x:p?.x,y:p?.y,bounds:p?.bounds,coarseKey:p?.coarseKey,sourceCrop:p?.sourceCrop,
            ready:s?.ready??false,published:s?.published??false,empty:s?.empty??false,loading:!!s?.controller,
            boundVisible:s?.leaf.style.visibility==='visible',background:s?.apiTexture?.style.backgroundImage??s?.leaf.style.backgroundImage};
        }),
        projection:Array.from(projection.toFloat64Array()),scale:Number.parseFloat(getComputedStyle(camera).scale),
        viewport:{width:stage.clientWidth,height:stage.clientHeight,originX:cameraRect.left+cameraRect.width/2-stageRect.left,originY:cameraRect.top+cameraRect.height/2-stageRect.top},
      };`);
    replace('return { dataset: plan.dataset,', 'return { oracle, dataset: plan.dataset,');
  } else if (id.endsWith('/prepared-map/api-image-transport.mjs')) {
    replace('    if (!owned.delete(entry)) return;', `    if (!owned.delete(entry)) return;
    globalThis.__loadingOracle?.event('image-evict',{url:entry.key,confirmed:entry.confirmed,bytes:entry.bytes});`);
    replace('          entry.bytes = blob.size;', `          globalThis.__loadingOracle?.event('image-body',{url:entry.key,bytes:blob.size});
          entry.bytes = blob.size;`);
    replace('          await untilAborted(entry.image.decode(), signal);', `          globalThis.__loadingOracle?.event('image-decode-start',{url:entry.key});
          await untilAborted(entry.image.decode(), signal);
          globalThis.__loadingOracle?.event('image-decode-end',{url:entry.key,width:entry.image.naturalWidth,height:entry.image.naturalHeight});`);
    replace('            member.refs--;', `            member.refs--;
            globalThis.__loadingOracle?.event('image-release',{url:resource.key,refs:member.refs});`);
    replace('          const resource = entry;', `          globalThis.__loadingOracle?.event('image-acquire',{url:entry.key,confirmed:entry.confirmed,refs:member.refs});
          const resource = entry;`);
  } else if (id.endsWith('/prepared-map/city-index.mjs')) {
    replace('    entries.delete(url);', `    globalThis.__loadingOracle?.event('metadata-release',{key:url,pending:!!entry.controller});
    entries.delete(url);`);
    // Include the actual directory queue, not only aggregate active counts.
    replace('stats: () => ({', `stats: () => ({ oracleEntries:[...entries].map(([key,e])=>({key,url:e.ref.url,offset:e.ref.offset,bytes:e.ref.bytes,started:!!e.started,loading:!!e.controller,ready:!!e.data})),`);
  }
  return source;
}
