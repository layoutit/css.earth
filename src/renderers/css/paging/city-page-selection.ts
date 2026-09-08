import { preparedReferenceKey } from './prepared-block-transport.js';
import { selectBackingReplacements } from './backing-replacements.js';
import { projectCityPage } from './city-page-projection.js';
export { projectCityPage } from './city-page-projection.js';
import type { PreparedPage, PreparedPagePlan, PreparedReference, PageViewport, PageProjection, ProjectedPage, PageSelection, PageGroup } from './types.js';
interface Entry extends ProjectedPage { lineage: string[]; }
interface WmtsEntry extends Entry { tile: PreparedPage; }
interface RefinementBudget { pages: number; bytes: number; cost(node: PreparedPage): {pages: number; bytes: number}; }
type FineRefinementBudget = (selection: PageSelection) => {pages: number; bytes: number};
const centreDistance = (entry: PageProjection) => Math.hypot(...entry.center);
const closestFirst = (a: PageProjection, b: PageProjection) => centreDistance(a) - centreDistance(b);
export function selectCityPages(plan: PreparedPagePlan, pages: ReadonlyMap<string, PreparedPage>, matrix: readonly number[], scale: number, viewport: PageViewport): PageSelection {
  if(plan.opaqueDiscs?.length)viewport={...viewport,opaqueDiscs:plan.opaqueDiscs};
  if(plan.backing){
    const backingPlan={...plan,roots:plan.backing.roots};
    let backing=selectFacePages(backingPlan,pages,matrix,scale,viewport,true);
    const pageBytes=(key: string)=>pages.get(key)!.width*pages.get(key)!.height*4;
    const capacity=Math.floor(plan.poolSize/2),byteCapacity=Math.floor(plan.maximumDecodedBytes/2);
    const visible=(node: PreparedPage)=>projectCityPage(node,matrix,scale,viewport).visible;
    const fineRefinementBudget: FineRefinementBudget=selection=>{
      const replaced=new Set(selectBackingReplacements(backing.groups!,selection,pages,visible).map(group=>group.key));
      const required=backing.groups!.filter(group=>!replaced.has(group.key)).flatMap(group=>group.pages);
      return {pages:capacity-required.length,bytes:byteCapacity-required.reduce((sum,key)=>sum+pageBytes(key),0)};
    };
    let fine: PageSelection=(viewport.zoom ?? 0)>plan.minimumZoom?selectWmtsTree(plan,pages,matrix,scale,viewport,new Map(),fineRefinementBudget):{keys:[],directories:[],groups:[]};
    const fit=()=>{
      let pieces=backing.keys.length+fine.keys.length;
      let bytes=[...backing.keys,...fine.keys].reduce((sum,key)=>sum+pageBytes(key),0);
      const retired=new Map<string, PageGroup & {replacements: string[]}>();
      for(const group of selectBackingReplacements(backing.groups!,fine,pages,visible)){
        if(group.replacements.length&&pieces<=capacity&&bytes<=byteCapacity)continue;
        retired.set(group.key,group);
        pieces-=group.pages.length;
        bytes-=group.pages.reduce((sum,key)=>sum+pageBytes(key),0);
      }
      return {retired,fits:pieces<=capacity&&bytes<=byteCapacity};
    };
    const refineBacking=()=>{
      // Keep the fine cut and refine backing only within its remaining budget.
      // Certified replacements cost no displayed slots; other regions retain
      // a covering prepared parent when their children would crowd out detail.
      const costs=new Map<string, {pages: number; bytes: number}>();
      return selectFacePages(backingPlan,pages,matrix,scale,viewport,true,{
        pages:capacity-fine.keys.length,
        bytes:byteCapacity-fine.keys.reduce((sum,key)=>sum+pageBytes(key),0),
        cost:node=>{
          if(!costs.has(node.key)){
            const group={key:node.key,pages:[node.key]};
            const covered=selectBackingReplacements([group],fine,pages,visible).length>0;
            costs.set(node.key,{pages:covered?0:1,bytes:covered?0:pageBytes(node.key)});
          }
          return costs.get(node.key)!;
        },
      });
    };
    let allocation=fit();
    if(!allocation.fits){
      backing=refineBacking();
      allocation=fit();
    }
    if(!allocation.fits){
      // An uncertified region still needs backing. Preserve the existing
      // bounded cut until preparation can prove a complete replacement there.
      const backingBytes=backing.keys.reduce((sum,key)=>sum+pageBytes(key),0);
      fine=(viewport.zoom ?? 0)>plan.minimumZoom?selectWmtsTree({...plan,
        poolSize:plan.poolSize-backing.keys.length*2,maximumDecodedBytes:plan.maximumDecodedBytes-backingBytes*2},pages,matrix,scale,viewport,new Map(),fineRefinementBudget):fine;
      // A complete fine fallback can release more capacity than backing needed.
      // Refine against that final cut, instead of leaving available polar detail
      // stranded at its root by the earlier, now obsolete fine reservation.
      backing=refineBacking();
      allocation=fit();
    }
    const backingBytes=backing.keys.reduce((sum,key)=>sum+pageBytes(key),0);
    const retired=allocation.retired;
    const directories=new Map([...backing.directories,...fine.directories].map(ref=>[preparedReferenceKey(ref),ref]));
    return {...fine,keys:[...backing.keys,...fine.keys],groups:[...backing.groups!.map(group=>({...group,backing:true,...retired.get(group.key)})),...(fine.groups??[])],directories:[...directories.values()],
      backing:{pieces:backing.keys.length,decodedBytes:backingBytes,retiring:retired.size}};
  }
  if(plan.topology === "wmts-quadtree@1")return selectWmtsTree(plan,pages,matrix,scale,viewport);
  return selectFacePages(plan,pages,matrix,scale,viewport);
}

function selectFacePages(plan: PreparedPagePlan, pages: ReadonlyMap<string, PreparedPage>, matrix: readonly number[], scale: number, viewport: PageViewport, grouped=false, refinementBudget?: RefinementBudget): PageSelection {
  const directories = new Map<string, PreparedReference>();
  const directoryPriority = new Map<string, number>();
  const projected = new Map<string, PageProjection>();
  const inspect = (key: string): Entry => {
    const node = pages.get(key);
    if (!node) throw new Error(`Missing prepared city index node ${key}.`);
    if (!projected.has(key)) projected.set(key, projectCityPage(node, matrix, scale, viewport));
    return { node, path: [], lineage: [], ...projected.get(key)! };
  };
  const request = (entry: Entry) => {
    if (!entry.node.directory) return;
    const ref=entry.node.directory, key=preparedReferenceKey(ref);
    directories.set(key,ref);
    directoryPriority.set(key,Math.min(directoryPriority.get(key)??Infinity,centreDistance(entry)));
  };
  const selected: Entry[] = [], pending: PageGroup[]=[];
  const visit = (key: string, path: PreparedReference[] = [], lineage: string[] = []) => {
    const entry = inspect(key);
    // Small metadata branches can wait for zoom. An available image must still
    // cover the view: small phones and face-edge crops can be below that cutoff.
    if (!entry.visible || entry.span < 1 || (!entry.node.url && entry.span < 96)) return;
    request(entry);
    entry.lineage=[...lineage,key];
    if (entry.node.stub) {if(grouped)pending.push({key,lineage:entry.lineage,pages:[],pending:true});return;}
    entry.path = entry.node.directory ? [...path, entry.node.directory] : path;
    if (entry.node.url) selected.push(entry);
    else for (const child of entry.node.children) visit(child, entry.path, entry.lineage);
  };
  for (const root of plan.roots) visit(typeof root === "string" ? root : root.key);
  selected.sort((a, b) => Math.hypot(...a.center) - Math.hypot(...b.center) || a.node.key.localeCompare(b.node.key));
  // Half of the fixed pool remains available for an atomic replacement view.
  const capacity = Math.floor(plan.poolSize / 2);
  const byteCapacity = Math.floor(plan.maximumDecodedBytes / 2);
  const pixelBytes = (node: PreparedPage) => node.width && node.height ? node.width*node.height*4 : plan.decodedPageBytes;
  let selectedBytes = selected.reduce((sum,entry)=>sum+pixelBytes(entry.node),0);
  if(selected.length>capacity||selectedBytes>byteCapacity) {
    throw new Error('Prepared city root coverage exceeds its retained page budget.');
  }
  const cost=(entry: Entry)=>refinementBudget?.cost(entry.node)??{pages:1,bytes:pixelBytes(entry.node)};
  let chargedPages=selected.reduce((sum,entry)=>sum+cost(entry).pages,0);
  let chargedBytes=selected.reduce((sum,entry)=>sum+cost(entry).bytes,0);
  const finished = new Set();
  for (;;) {
    const parent = selected.filter(({ node, span }) => !finished.has(node.key) &&
      node.children.length && (node.children.length === 4 || node.childrenCoverImage === true) &&
      span > (node.maximumCssSpan??plan.targetCssPixels)).sort((a, b) => b.span - a.span)[0];
    if (!parent) break;
    finished.add(parent.node.key);
    const children = parent.node.children.map(inspect).filter(child => child.visible)
      .map(child => ({...child, lineage:[...parent.lineage,child.node.key], path: child.node.directory ? [...parent.path, child.node.directory] : parent.path}));
    for (const child of children) request(child);
    const replacementBytes=selectedBytes-pixelBytes(parent.node)+children.reduce((sum,entry)=>sum+pixelBytes(entry.node),0);
    // Missing metadata or a full pool leaves the parent covering its children.
    if (!children.length || children.some(child => child.node.stub || !child.node.url) ||
        selected.length - 1 + children.length > capacity || replacementBytes > byteCapacity) continue;
    const nextPages=chargedPages-cost(parent).pages+children.reduce((sum,entry)=>sum+cost(entry).pages,0);
    const nextBytes=chargedBytes-cost(parent).bytes+children.reduce((sum,entry)=>sum+cost(entry).bytes,0);
    if(refinementBudget&&(nextPages>refinementBudget.pages||nextBytes>refinementBudget.bytes))continue;
    selected.splice(selected.indexOf(parent), 1, ...children);
    selectedBytes=replacementBytes;
    chargedPages=nextPages;chargedBytes=nextBytes;
  }
  // Preserve selected pages' directory paths before speculative discovery when
  // the metadata budget is tight. Never prioritize an off-centre branch first.
  selected.sort(closestFirst);
  const ordered = new Map(selected.flatMap(entry => entry.path.map(ref => [preparedReferenceKey(ref), ref])));
  for (const [key,ref] of [...directories].sort(([a],[b])=>directoryPriority.get(a)!-directoryPriority.get(b)!)) if (!ordered.has(key)) ordered.set(key, ref);
  return { keys: selected.map(({ node }) => node.key), directories: [...ordered.values()],
    ...(grouped?{groups:[...selected.map(entry=>({key:entry.node.key,lineage:entry.lineage,pages:[entry.node.key]})),...pending]}:{}) };
}


function selectWmtsTree(plan: PreparedPagePlan,pages: ReadonlyMap<string, PreparedPage>,matrix: readonly number[],scale: number,viewport: PageViewport,projected=new Map<string, Entry>(),refinementBudget?: FineRefinementBudget): PageSelection{
  const directories=new Map<string, PreparedReference>(),capacity=Math.floor(plan.poolSize/2),byteCapacity=Math.floor(plan.maximumDecodedBytes/2);
  const directoryPriority=new Map<string, number>();
  const inspect=(key: string): Entry=>{
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
          const projection=projectCityPage(p!,matrix,scale,viewport),crop=p!.sourceCrop;
          // Detail is judged against the provider tile's pixel density. A
          // subdivided polar patch contains only a fraction of its 256 pixels.
          const fraction=crop?Math.max(crop.u1-crop.u0,crop.v1-crop.v0):1;
          return {...projection,span:projection.span/fraction};
        }).filter(p=>p.visible);
        projection={visible:visible.length>0,span:Math.max(0,...visible.map(p=>p.span)),center:visible.sort((a,b)=>Math.hypot(...a.center)-Math.hypot(...b.center))[0]?.center??projection.center};
      }
      projected.set(key,{node,path:[],lineage:[],...projection});
    }
    return projected.get(key)!;
  };
  const request=(entry: Entry,path: PreparedReference[])=>{
    const next=entry.node.directory?[...path,entry.node.directory]:path;
    for(const ref of next){
      const key=preparedReferenceKey(ref);
      directories.set(key,ref);
      directoryPriority.set(key,Math.min(directoryPriority.get(key)??Infinity,centreDistance(entry)));
    }
    return next;
  };
  const selected: WmtsEntry[]=[],fallbacks: unknown[]=[],pending: PageGroup[]=[];
  let constrained = false;
  // Follow only prepared child references. Each tile's image pieces form one
  // replacement group, so an apron or Mercator strip cannot disappear alone.
  const visit=(key: string,path: PreparedReference[]=[],ancestors: string[]=[]): WmtsEntry[]=>{
    const entry=inspect(key);
    if(!entry.visible||entry.span<1){
      // A loaded section can prove that its conservative stub bounds contain
      // no visible image pieces. Keep that proof while those stub bounds are
      // visible; evicting it would restore the stub and request it forever.
      if(entry.node.directory && !entry.node.stub && projectCityPage(entry.node,matrix,scale,viewport).visible)request(entry,path);
      return [];
    }
    const next=request(entry,path);
    const lineage=[...ancestors,key];
    if(entry.node.stub){
      // Missing metadata is a coverage blocker, not an empty tile. Publication
      // can retain its old ancestor/descendants while other branches progress.
      pending.push({key,lineage,pages:[],pending:true});
      return [];
    }
    const own=(entry.node.pages??[]).map(inspect).filter(p=>p.visible&&p.span>=1).map(p=>({...p,path:next,tile:entry.node,lineage}));
    const refine=!plan.coarsestCut && entry.span>entry.node.maximumCssSpan*(plan.selectionScale??1);
    if(entry.node.children.length && refine){
      const pendingStart=pending.length;
      const childGroups=entry.node.children.map(key=>visit(key,next,lineage));
      const deeper=childGroups.flat();
      if(deeper.length<=capacity&&deeper.reduce((s,p)=>s+p.node.width*p.node.height*4,0)<=byteCapacity){
        // Known children can load while siblings await metadata. Pending groups
        // retain their lineage, so the existing fallback/publication policy
        // keeps covering ancestors until those branches are ready too.
        return deeper;
      }else{
        constrained = true;
      }
      // An available parent supplies complete fallback. Unknown descendants
      // must not prevent that parent itself from publishing.
      if(own.length)pending.length=pendingStart;
    }
    if(own.length && entry.node.children.length && refine && fallbacks.length<12)fallbacks.push({key,span:entry.span,own:own.length,children:entry.node.children.map(key=>({key,stub:pages.get(key)!.stub,pages:pages.get(key)!.pages?.length}))});
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
    const result=selectWmtsTree(relaxed,pages,matrix,scale,viewport,projected,refinementBudget);
    const faces: Record<string, number>={};for(const p of selected)faces[p.node.coarseKey]=(faces[p.node.coarseKey]??0)+1;
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
    // Spend spare capacity only after accounting for backing that this complete
    // cut cannot replace. Certified covered regions cost nothing. Refining the
    // fine cut preserves those certificates; it cannot uncover a covered region.
    const allowance=refinementBudget?.({keys:selected.map(p=>p.node.key),groups:wmtsGroups(selected),directories:[]});
    const refinementPages=Math.min(capacity,allowance?.pages??capacity);
    const refinementBytes=Math.min(byteCapacity,allowance?.bytes??byteCapacity);
    const attempted = new Set();
    for (let pass = 0; pass < capacity * 20; pass++) {
      const groups = new Map<string, {tile: PreparedPage; entries: WmtsEntry[]; path: PreparedReference[]; lineage: string[]; projection: Entry}>();
      for (const entry of selected) {
        const group = groups.get(entry.tile.key) ?? { tile: entry.tile, entries: [], path: entry.path, lineage: entry.lineage, projection: inspect(entry.tile.key) };
        group.entries.push(entry); groups.set(entry.tile.key, group);
      }
      const next = [...groups.values()].filter(group => !attempted.has(group.tile.key) && group.tile.children.length &&
        group.projection.span > group.tile.maximumCssSpan).sort((a,b) => b.projection.span - a.projection.span ||
          Math.hypot(...a.projection.center) - Math.hypot(...b.projection.center))[0];
      if (!next) break;
      attempted.add(next.tile.key);
      const children = next.tile.children.map(inspect).filter(entry => entry.visible && entry.span >= 1);
      const replacements: WmtsEntry[] = [];
      for (const child of children) {
        const path = request(child, next.path);
        for (const key of child.node.pages ?? []) {
          const piece = inspect(key);
          if (piece.visible && piece.span >= 1) replacements.push({...piece, path, tile: child.node, lineage:[...next.lineage,child.node.key]});
        }
      }
      if (!replacements.length || children.some(child => child.node.stub || !child.node.pages?.length && child.node.children?.length)) continue;
      const rest = selected.filter(entry => entry.tile !== next.tile);
      if (rest.length + replacements.length > refinementPages || [...rest, ...replacements].reduce((sum,entry) => sum + entry.node.width * entry.node.height * 4, 0) > refinementBytes) continue;
      selected.splice(0, selected.length, ...rest, ...replacements);
    }
  }
  // Tree order is geographic, not visual priority. Rank the final bounded cut
  // after refinement, then keep every image's prepared pieces together.
  selected.sort(closestFirst);
  const ordered=new Map(selected.flatMap(entry=>entry.path.map(ref=>[preparedReferenceKey(ref),ref])));
  for(const [key,ref] of [...directories].sort(([a],[b])=>directoryPriority.get(a)!-directoryPriority.get(b)!))if(!ordered.has(key))ordered.set(key,ref);
  const groups=wmtsGroups(selected);
  return {keys:groups.flatMap(group=>group.pages),groups:[...groups,...pending],directories:[...ordered.values()],fallbacks,selectionScale:plan.selectionScale??1};
}

function wmtsGroups(selected: WmtsEntry[]): PageGroup[]{
  const groups=new Map<string, PageGroup>();
  for(const entry of selected){
    const group=groups.get(entry.tile.key)??{key:entry.tile.key,lineage:entry.lineage,pages:[]};
    group.pages.push(entry.node.key);groups.set(group.key,group);
  }
  return [...groups.values()];
}
