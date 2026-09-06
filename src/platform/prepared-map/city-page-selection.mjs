import { preparedReferenceKey } from "./prepared-block-transport.mjs";
export function projectCityPage(page, matrix, scale, viewport) {
  if(page.coverageParts){
    let visible=false,span=0,center=[0,0],distance=Infinity;
    for(const part of page.coverageParts){
      const projected=projectCityPage(part,matrix,scale,viewport);
      if(!projected.visible)continue;
      visible=true;span=Math.max(span,projected.span);
      const next=Math.hypot(...projected.center);
      if(next<distance){distance=next;center=projected.center;}
    }
    return {visible,span,center};
  }
  const [left,right,top,bottom]=projectBounds(page.corners,matrix,scale);
  const front = matrix[2] * page.normal[0] + matrix[6] * page.normal[1] + matrix[10] * page.normal[2] + (page.normalSlack??0)*Math.hypot(matrix[2],matrix[6],matrix[10]) > 0;
  const [coverLeft,coverRight,coverTop,coverBottom]=page.coverageCorners?projectBounds(page.coverageCorners,matrix,scale):[left,right,top,bottom];
  const originX=viewport.originX??viewport.width/2,originY=viewport.originY??viewport.height/2;
  return {
    visible: front && coverLeft < viewport.width-originX && coverRight > -originX &&
      coverTop < viewport.height-originY && coverBottom > -originY,
    span: Math.max(right - left, bottom - top),
    center: [(left+right)/2+originX-viewport.width/2,(top+bottom)/2+originY-viewport.height/2],
  };
}

// Project the prepared corners directly into bounds, without allocating point
// and coordinate arrays for each corner on every camera update.
function projectBounds(corners,matrix,scale){
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const [x,y,z] of corners){
    const px=matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12];
    const py=matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13];
    const pz=matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14];
    const perspective=1/(1-pz/1_000_000),sx=px*perspective*scale,sy=py*perspective*scale;
    left=Math.min(left,sx);right=Math.max(right,sx);top=Math.min(top,sy);bottom=Math.max(bottom,sy);
  }
  return [left,right,top,bottom];
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


function selectWmtsTree(plan,pages,matrix,scale,viewport,projected=new Map()){
  const directories=new Map(),capacity=Math.floor(plan.poolSize/2),byteCapacity=Math.floor(plan.maximumDecodedBytes/2);
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
  let constrained = false;
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
    const own=(entry.node.pages??[]).map(inspect).filter(p=>p.visible&&p.span>=1).map(p=>({...p,path:next,tile:entry.node}));
    const refine=!plan.coarsestCut && entry.span>entry.node.maximumCssSpan*(plan.selectionScale??1);
    if(entry.node.children.length && refine){
      const childGroups=entry.node.children.map(key=>visit(key,next));
      if(childGroups.every(g=>g!==null)){
        const deeper=childGroups.flat();
        if(deeper.length<=capacity&&deeper.reduce((s,p)=>s+p.node.width*p.node.height*4,0)<=byteCapacity)return deeper;
        constrained = true;
      }
    }
    if(own.length && entry.node.children.length && refine && fallbacks.length<12)fallbacks.push({key,span:entry.span,own:own.length,children:entry.node.children.map(key=>({key,stub:pages.get(key).stub,pages:pages.get(key).pages?.length}))});
    return own;
  };
  const roots=plan.roots.map(root=>inspect(root.key)).filter(p=>p.visible).sort((a,b)=>Math.hypot(...a.center)-Math.hypot(...b.center));
  for(const root of roots){const group=visit(root.node.key);if(group)selected.push(...group);}
  // Refinement can span adjacent root tiles. If their combined detail exceeds
  // the fixed pool, choose a coarser prepared cut for the entire viewport.
  if(constrained||selected.length>capacity||selected.reduce((s,p)=>s+p.node.width*p.node.height*4,0)>byteCapacity){
    // Near globe scale, even the complete coarsest cut can exceed the pool.
    // Reveal the retained base surface for that view, without publishing a
    // partial tile group or expanding the budget. Later views retry normally.
    if(plan.coarsestCut)return {keys:[],directories:[...directories.values()],baseSurfaceFallback:"retained-budget",selectionScale:plan.selectionScale};
    const relaxed={...plan,selectionScale:(plan.selectionScale??1)*2,coarsestCut:(plan.selectionScale??1)>=64};
    const result=selectWmtsTree(relaxed,pages,matrix,scale,viewport,projected);
    const faces={};for(const p of selected)faces[p.node.coarseKey]=(faces[p.node.coarseKey]??0)+1;
    // A coarser drawable cut must not cancel discovery of finer metadata.
    // In particular, polar source strips can need fewer visible leaves after
    // refinement. Dropping these references would trap the view at a coarse cut.
    const retained=new Map(result.directories.map(ref=>[preparedReferenceKey(ref),ref]));
    for(const [key,ref] of directories)if(!retained.has(key))retained.set(key,ref);
    return {...result,directories:[...retained.values()],cuts:[{scale:plan.selectionScale??1,count:selected.length,faces},...(result.cuts??[])]};
  }
  if ((plan.selectionScale ?? 1) > 1 && !plan.coarsestCut) {
    // A uniform coarser cut can leave capacity unused. Refine its largest
    // visible groups one prepared level at a time, keeping every replacement
    // group complete. This avoids falling several levels back when just one
    // extra child would exceed the small observation pool.
    const attempted = new Set();
    for (let pass = 0; pass < capacity * 20; pass++) {
      const groups = new Map();
      for (const entry of selected) {
        const group = groups.get(entry.tile.key) ?? { tile: entry.tile, entries: [], path: entry.path, projection: inspect(entry.tile.key) };
        group.entries.push(entry); groups.set(entry.tile.key, group);
      }
      const next = [...groups.values()].filter(group => !attempted.has(group.tile.key) && group.tile.children.length &&
        group.projection.span > group.tile.maximumCssSpan).sort((a,b) => b.projection.span - a.projection.span ||
          Math.hypot(...a.projection.center) - Math.hypot(...b.projection.center))[0];
      if (!next) break;
      attempted.add(next.tile.key);
      const children = next.tile.children.map(inspect).filter(entry => entry.visible && entry.span >= 1);
      const replacements = [];
      for (const child of children) {
        const path = request(child, next.path);
        for (const key of child.node.pages ?? []) {
          const piece = inspect(key);
          if (piece.visible && piece.span >= 1) replacements.push({...piece, path, tile: child.node});
        }
      }
      if (!replacements.length || children.some(child => child.node.stub || !child.node.pages?.length && child.node.children?.length)) continue;
      const rest = selected.filter(entry => entry.tile !== next.tile);
      if (rest.length + replacements.length > capacity || [...rest, ...replacements].reduce((sum,entry) => sum + entry.node.width * entry.node.height * 4, 0) > byteCapacity) continue;
      selected.splice(0, selected.length, ...rest, ...replacements);
    }
  }
  const ordered=new Map(selected.flatMap(entry=>entry.path.map(ref=>[preparedReferenceKey(ref),ref])));
  for(const [key,ref] of directories)if(!ordered.has(key))ordered.set(key,ref);
  return {keys:selected.map(p=>p.node.key),directories:[...ordered.values()],fallbacks,selectionScale:plan.selectionScale??1};
}
