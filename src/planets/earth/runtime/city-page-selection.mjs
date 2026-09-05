import { preparedReferenceKey } from "./prepared-block-transport.mjs";
export function projectCityPage(page, matrix, scale, viewport) {
  if(page.coverageParts){
    const parts=page.coverageParts.map(part=>projectCityPage(part,matrix,scale,viewport)).filter(part=>part.visible);
    return {visible:parts.length>0,span:Math.max(0,...parts.map(part=>part.span)),center:parts.sort((a,b)=>Math.hypot(...a.center)-Math.hypot(...b.center))[0]?.center??[0,0]};
  }
  const project = (corners) => corners.map(([x, y, z]) => {
    const p = [0, 1, 2].map((row) => matrix[row] * x + matrix[row + 4] * y +
      matrix[row + 8] * z + matrix[row + 12]);
    const perspective = 1 / (1 - p[2] / 1_000_000);
    return [p[0] * perspective * scale, p[1] * perspective * scale, p[2]];
  });
  const points = project(page.corners);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const left = Math.min(...xs), right = Math.max(...xs);
  const top = Math.min(...ys), bottom = Math.max(...ys);
  const front = matrix[2] * page.normal[0] + matrix[6] * page.normal[1] + matrix[10] * page.normal[2] + (page.normalSlack??0)*Math.hypot(matrix[2],matrix[6],matrix[10]) > 0;
  const coverage = page.coverageCorners ? project(page.coverageCorners) : points;
  const coverX = coverage.map(point=>point[0]), coverY = coverage.map(point=>point[1]);
  const originX=viewport.originX??viewport.width/2,originY=viewport.originY??viewport.height/2;
  return {
    visible: front && Math.min(...coverX) < viewport.width-originX && Math.max(...coverX) > -originX &&
      Math.min(...coverY) < viewport.height-originY && Math.max(...coverY) > -originY,
    span: Math.max(right - left, bottom - top),
    center: [(left+right)/2+originX-viewport.width/2,(top+bottom)/2+originY-viewport.height/2],
  };
}

export function selectCityPages(plan, pages, matrix, scale, viewport) {
  if(plan.topology === "wmts-quadtree@1")return selectWmtsTree(plan,pages,matrix,scale,viewport);
  const directories = new Map();
  const projected = new Map();
  const inspect = (key) => {
    const node = pages.get(key);
    if (!node) throw new Error(`Missing prepared city index node ${key}.`);
    if (!projected.has(key)) projected.set(key, projectCityPage(node, matrix, scale, viewport));
    return { node, ...projected.get(key) };
  };
  const request = (node) => {
    if (node.directory) directories.set(preparedReferenceKey(node.directory), node.directory);
  };
  const selected = [];
  const visit = (key, path = []) => {
    const entry = inspect(key);
    // Small metadata branches can wait for zoom. An available image must still
    // cover the view: small phones and face-edge crops can be below that cutoff.
    if (!entry.visible || entry.span < 1 || (!entry.node.url && entry.span < 96)) return;
    request(entry.node);
    if (entry.node.stub) return;
    entry.path = entry.node.directory ? [...path, entry.node.directory] : path;
    if (entry.node.url) selected.push(entry);
    else for (const child of entry.node.children) visit(child, entry.path);
  };
  for (const root of plan.roots) visit(typeof root === "string" ? root : root.key);
  selected.sort((a, b) => Math.hypot(...a.center) - Math.hypot(...b.center) || a.node.key.localeCompare(b.node.key));
  // Half of the fixed pool remains available for an atomic replacement view.
  const capacity = Math.floor(plan.poolSize / 2);
  const byteCapacity = Math.floor(plan.maximumDecodedBytes / 2);
  const pixelBytes = node => node.width && node.height ? node.width*node.height*4 : plan.decodedPageBytes;
  let selectedBytes = selected.reduce((sum,entry)=>sum+pixelBytes(entry.node),0);
  if(selected.length>capacity||selectedBytes>byteCapacity) {
    throw new Error('Prepared city root coverage exceeds its retained page budget.');
  }
  const finished = new Set();
  for (;;) {
    const parent = selected.filter(({ node, span }) => !finished.has(node.key) &&
      node.children.length && (node.children.length === 4 || node.childrenCoverImage === true) &&
      span > (node.maximumCssSpan??plan.targetCssPixels)).sort((a, b) => b.span - a.span)[0];
    if (!parent) break;
    finished.add(parent.node.key);
    const children = parent.node.children.map(inspect).filter(child => child.visible)
      .map(child => ({...child, path: child.node.directory ? [...parent.path, child.node.directory] : parent.path}));
    for (const child of children) request(child.node);
    const replacementBytes=selectedBytes-pixelBytes(parent.node)+children.reduce((sum,entry)=>sum+pixelBytes(entry.node),0);
    // Missing metadata or a full pool leaves the parent covering its children.
    if (!children.length || children.some(child => child.node.stub || !child.node.url) ||
        selected.length - 1 + children.length > capacity || replacementBytes > byteCapacity) continue;
    selected.splice(selected.indexOf(parent), 1, ...children);
    selectedBytes=replacementBytes;
  }
  // Preserve selected pages' directory paths before speculative discovery when
  // the metadata budget is tight. Never prioritize an off-centre branch first.
  const ordered = new Map(selected.flatMap(entry => entry.path.map(ref => [preparedReferenceKey(ref), ref])));
  for (const ref of directories.values()) if (!ordered.has(preparedReferenceKey(ref))) ordered.set(preparedReferenceKey(ref), ref);
  return { keys: selected.map(({ node }) => node.key), directories: [...ordered.values()] };
}


function selectWmtsTree(plan,pages,matrix,scale,viewport){
  const projected=new Map(),directories=new Map(),capacity=Math.floor(plan.poolSize/2),byteCapacity=Math.floor(plan.maximumDecodedBytes/2);
  const inspect=key=>{
    const node=pages.get(key);if(!node)throw new Error(`Missing prepared WMTS tree node ${key}.`);
    if(!projected.has(key)){
      let projection=projectCityPage(node,matrix,scale,viewport);
      if(node.level>=10 && node.pages?.length){
        // A source tile can touch both the cap apron and a regular face. The
        // space between those prepared pieces is not coverage. Cull each real
        // piece instead of treating their combined bounding box as a surface.
        const pieces=node.pages.map(key=>pages.get(key));
        if(pieces.some(p=>!p))throw new Error("Missing prepared WMTS image piece.");
        const visible=pieces.map(p=>{
          const projection=projectCityPage(p,matrix,scale,viewport),crop=p.sourceCrop;
          // Detail is judged against the provider tile's pixel density. A
          // subdivided polar patch contains only a fraction of its 256 pixels.
          const fraction=crop?Math.max(crop.u1-crop.u0,crop.v1-crop.v0):1;
          return {...projection,span:projection.span/fraction};
        }).filter(p=>p.visible);
        projection={visible:visible.length>0,span:Math.max(0,...visible.map(p=>p.span)),center:visible.sort((a,b)=>Math.hypot(...a.center)-Math.hypot(...b.center))[0]?.center??projection.center};
      }
      projected.set(key,{node,...projection});
    }
    return projected.get(key);
  };
  const request=(entry,path)=>{
    const next=entry.node.directory?[...path,entry.node.directory]:path;
    for(const ref of next)directories.set(preparedReferenceKey(ref),ref);
    return next;
  };
  const selected=[],fallbacks=[];
  // Follow only prepared child references. Each tile's image pieces form one
  // replacement group, so an apron or Mercator strip cannot disappear alone.
  const visit=(key,path=[])=>{
    const entry=inspect(key);
    if(!entry.visible||entry.span<1){
      // A loaded section can prove that its conservative stub bounds contain
      // no visible image pieces. Keep that proof while those stub bounds are
      // visible; evicting it would restore the stub and request it forever.
      if(entry.node.coverageParts && !entry.node.stub && projectCityPage(entry.node,matrix,scale,viewport).visible)request(entry,path);
      return [];
    }
    const next=request(entry,path);
    if(entry.node.stub)return null;
    const own=(entry.node.pages??[]).map(inspect).filter(p=>p.visible&&p.span>=1).map(p=>({...p,path:next}));
    if(entry.node.children.length && (entry.span>entry.node.maximumCssSpan)){
      const childGroups=entry.node.children.map(key=>visit(key,next));
      if(childGroups.every(g=>g!==null)){
        const deeper=childGroups.flat();
        if(deeper.length<=capacity&&deeper.reduce((s,p)=>s+p.node.width*p.node.height*4,0)<=byteCapacity)return deeper;
      }
    }
    if(own.length && entry.node.children.length && entry.span>entry.node.maximumCssSpan && fallbacks.length<12)fallbacks.push({key,span:entry.span,own:own.length,children:entry.node.children.map(key=>({key,stub:pages.get(key).stub,pages:pages.get(key).pages?.length}))});
    return own;
  };
  const roots=plan.roots.map(root=>inspect(root.key)).filter(p=>p.visible).sort((a,b)=>Math.hypot(...a.center)-Math.hypot(...b.center));
  for(const root of roots){const group=visit(root.node.key);if(group)selected.push(...group);}
  // Refinement can span adjacent root tiles. If their combined detail exceeds
  // the fixed pool, choose a coarser prepared cut for the entire viewport.
  if(selected.length>capacity||selected.reduce((s,p)=>s+p.node.width*p.node.height*4,0)>byteCapacity){
    if((plan.selectionScale??1)>64)throw new Error("Prepared WMTS coverage exceeds the retained budget.");
    const relaxed={...plan,selectionScale:(plan.selectionScale??1)*2};
    const nodes=new Map([...pages].map(([key,node])=>[key,node.pages?{...node,maximumCssSpan:node.maximumCssSpan*2}:node]));
    const result=selectWmtsTree(relaxed,nodes,matrix,scale,viewport);
    const faces={};for(const p of selected)faces[p.node.coarseKey]=(faces[p.node.coarseKey]??0)+1;
    // A coarser drawable cut must not cancel discovery of finer metadata.
    // In particular, polar source strips can need fewer visible leaves after
    // refinement. Dropping these references would trap the view at a coarse cut.
    const retained=new Map(result.directories.map(ref=>[preparedReferenceKey(ref),ref]));
    for(const [key,ref] of directories)if(!retained.has(key))retained.set(key,ref);
    return {...result,directories:[...retained.values()],cuts:[{scale:plan.selectionScale??1,count:selected.length,faces},...(result.cuts??[])]};
  }
  const ordered=new Map(selected.flatMap(entry=>entry.path.map(ref=>[preparedReferenceKey(ref),ref])));
  for(const [key,ref] of directories)if(!ordered.has(key))ordered.set(key,ref);
  return {keys:selected.map(p=>p.node.key),directories:[...ordered.values()],fallbacks,selectionScale:plan.selectionScale??1};
}
