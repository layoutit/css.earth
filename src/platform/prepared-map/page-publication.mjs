// Publish independent prepared tile groups without waiting for the viewport.
// A previous parent connects its replacement children into one transaction;
// a replacement parent likewise retires all of its previous child groups.
// Lineage comes from the prepared tree, never from runtime geographic math.
export function selectPagePublication(groups, slots, limits, fallbacks = []) {
  const requested = new Map(groups.map(group=>[group.key,group]));
  const loaded = new Map(slots.filter(slot=>slot.key).map(slot=>[slot.key,slot]));
  const replaced = new Set(groups.filter(group=>group.replacements?.every(key=>{
    const replacement=requested.get(key);
    return replacement&&readyGroup(replacement,loaded);
  })).map(group=>group.key));
  const original=groups;
  groups=groups.filter(group=>!replaced.has(group.key));
  // A cold view can decode one cheap ancestor before its desired detail. It
  // publishes through the same local transaction as every other covering cut.
  // Never put that ancestor over detail that is already being displayed.
  groups = [...groups];
  for (const fallback of usefulFallbacks(groups, slots, fallbacks)) {
    if (!fallback.pages.every(key => slots.some(slot => slot.key === key && slot.ready))) continue;
    groups = groups.filter(group => !group.lineage.includes(fallback.key) ||
      !group.pending && group.pages.every(key => slots.some(slot => slot.key === key && slot.ready)));
    groups.push(fallback);
  }
  const byKey = new Map(slots.filter(slot => slot.key).map(slot => [slot.key, slot]));
  const previous = new Map();
  for (const slot of slots) if (slot.published) {
    const group = previous.get(slot.group.key) ?? { ...slot.group, pages: [] };
    group.pages.push(slot.key);
    previous.set(group.key, group);
  }
  // Re-evaluate a retained backing ancestor against this view's selected
  // regions. Its old frame's fine keys must not authorize a new replacement.
  for(const old of previous.values())if(old.backing){
    old.replacements=[...new Set(original.filter(next=>related(old,next)).flatMap(next=>
      replaced.has(next.key)?next.replacements:[next.key]))];
  }
  const components = groups.map(group => ({ groups: [group], previous: [] }));
  const release = [];
  for (const old of previous.values()) {
    const related = components.filter(component => component.groups.some(next =>
      next.lineage.includes(old.key) || old.lineage.includes(next.key) || old.replacements?.includes(next.key)));
    if (!related.length) { release.push(...old.pages); continue; }
    const target = related[0];
    target.previous.push(old);
    for (const other of related.slice(1)) {
      target.groups.push(...other.groups);
      target.previous.push(...other.previous);
      components.splice(components.indexOf(other), 1);
    }
  }
  const publish = [];
  const visible = new Set([...previous.values()].flatMap(group => group.pages).filter(key => !release.includes(key)));
  // Keep the displayed cut within half the pool, leaving the other half for
  // a subsequent camera view even when several local swaps have completed.
  const reduction = component => component.previous.reduce((sum, group) => sum + group.pages.length, 0) -
    component.groups.reduce((sum, group) => sum + group.pages.length, 0);
  components.sort((a, b) => reduction(b) - reduction(a));
  const apply = (keys, previous) => {
    const next = new Set(visible);
    for (const old of previous) for (const key of old.pages) next.delete(key);
    for (const key of keys) next.add(key);
    const bytes = [...next].reduce((sum, key) => sum + byKey.get(key).decodedBytes, 0);
    if (next.size > limits.pages || bytes > limits.bytes) return false;
    visible.clear();
    for (const key of next) visible.add(key);
    publish.push(...keys);
    const retained = new Set(keys);
    for (const old of previous) for (const key of old.pages) if (!retained.has(key)) release.push(key);
    return true;
  };
  for (const component of components) {
    const ready = component.groups.filter(group => readyGroup(group, byKey));
    if (ready.length === component.groups.length && apply(ready.flatMap(group => group.pages), component.previous)) continue;
    // Several backing regions can overlap one fine group. Retire all covered
    // regions in the same admission transaction, even if a different region
    // in this component is still waiting. No viewport-wide readiness barrier.
    const readyKeys=new Set(ready.map(group=>group.key));
    const covered=component.previous.filter(old=>old.backing&&old.replacements?.length&&old.replacements.every(key=>readyKeys.has(key)));
    if(covered.length)apply(ready.filter(group=>covered.some(old=>old.replacements.includes(group.key))).flatMap(group=>group.pages),covered);
    // Complete children may appear while their ancestor still covers pending
    // siblings. The ancestor is retired only by the complete replacement above.
    // Zoom-out and same-tile swaps can still retire their own old descendants.
    for (const group of ready) apply(group.pages,
      component.previous.filter(old => old.lineage.includes(group.key)));
  }
  return { publish:[...new Set(publish)], release:[...new Set(release)] };
}

// Reserve the complete required cut before admitting optional backing. This
// prevents old + incoming + bridge images from filling the pool with resources
// that cannot release the old view. The same reservation includes ancestors.
export function selectPageDemand(groups, slots, nodes, limits, fallbacks=[]) {
  const byKey=new Map(slots.filter(slot=>slot.key).map(slot=>[slot.key,slot]));
  const byGroup=new Map(groups.map(group=>[group.key,group]));
  const required=groups.filter(group=>group.replacements===undefined).flatMap(group=>group.pages);
  const occupied=new Set([...slots.filter(slot=>slot.published).map(slot=>slot.key),...required]);
  const bytes=key=>byKey.get(key)?.decodedBytes??nodes.get(key).width*nodes.get(key).height*4;
  let reserved=[...occupied].reduce((sum,key)=>sum+bytes(key),0);
  const optional=[];
  for(const group of [...groups.filter(group=>group.replacements!==undefined),...fallbacks]){
    if(group.replacements?.every(key=>byGroup.has(key)&&readyGroup(byGroup.get(key),byKey)))continue;
    const extra=group.pages.filter(key=>!occupied.has(key));
    const size=extra.reduce((sum,key)=>sum+bytes(key),0);
    if(occupied.size+extra.length>limits.pages||reserved+size>limits.bytes)continue;
    optional.push(...group.pages);
    for(const key of extra)occupied.add(key);
    reserved+=size;
  }
  return [...new Set([...optional,...required])];
}

const related = (a, b) => a.lineage.includes(b.key) || b.lineage.includes(a.key);
const readyGroup = (group, byKey) => !group.pending && group.pages.every(key => byKey.get(key)?.ready);

export function usefulFallbacks(groups, slots, fallbacks) {
  const byKey = new Map(slots.filter(slot => slot.key).map(slot => [slot.key, slot]));
  return fallbacks.filter(fallback => groups.some(group => group.lineage.includes(fallback.key) && !readyGroup(group, byKey)) &&
    !slots.some(slot => slot.published && slot.group.key !== fallback.key && related(slot.group, fallback)));
}

// Prepared lineage identifies useful ancestors; projection only culls their
// already prepared pieces. Select a cheap covering image, not an all-level
// loading ladder, and reserve it together with old and desired resources.
export function selectPageFallbacks(groups, nodes, slots, limits, visible) {
  const byKey = new Map(slots.filter(slot => slot.key).map(slot => [slot.key, slot]));
  const selected = new Set(groups.map(group => group.key)), candidates = new Map();
  for (const group of groups) {
    if (readyGroup(group, byKey) || slots.some(slot => slot.published && related(slot.group, group))) continue;
    for (let i = 0; i < group.lineage.length - 1; i++) {
      const key = group.lineage[i], node = nodes.get(key);
      if (selected.has(key) || candidates.has(key) || !node || node.stub || node.replacement?.empty) continue;
      const pages = (node.url ? [key] : node.pages ?? []).filter(key => {
        const page = nodes.get(key); return page && visible(page);
      });
      if (pages.length) candidates.set(key, {key, lineage:group.lineage.slice(0, i + 1), pages});
    }
  }
  const bytes = key => byKey.get(key)?.decodedBytes ?? nodes.get(key).width * nodes.get(key).height * 4;
  const cost = group => group.pages.reduce((sum, key) => sum + bytes(key), 0);
  const occupied = new Set([...slots.filter(slot => slot.published).map(slot => slot.key), ...groups.flatMap(group => group.pages)]);
  let reserved = [...occupied].reduce((sum, key) => sum + bytes(key), 0);
  const fallbacks = [];
  const ordered = usefulFallbacks(groups, slots, [...candidates.values()]).sort((a,b) =>
    Number(b.pages.some(key => byKey.has(key))) - Number(a.pages.some(key => byKey.has(key))) ||
    cost(a) - cost(b) || a.lineage.length - b.lineage.length || a.key.localeCompare(b.key));
  for (const candidate of ordered) {
    if (fallbacks.some(fallback => related(fallback, candidate))) continue;
    const descendants = groups.filter(group => group.lineage.includes(candidate.key));
    const missing = descendants.flatMap(group => group.pages).filter(key => !byKey.get(key)?.ready);
    // If the desired images are cheaper, load them directly. Unknown metadata
    // can still use a known ancestor while directory discovery continues.
    if (!descendants.some(group => group.pending) && cost(candidate) >= missing.reduce((sum,key) => sum + bytes(key), 0)) continue;
    const incoming = candidate.pages.filter(key => !occupied.has(key)), extra = incoming.reduce((sum,key) => sum + bytes(key), 0);
    if (candidate.pages.length > Math.floor(limits.pages / 2) || cost(candidate) > Math.floor(limits.bytes / 2) ||
        occupied.size + incoming.length > limits.pages || reserved + extra > limits.bytes) continue;
    for (const key of incoming) occupied.add(key);
    reserved += extra;
    fallbacks.push(candidate);
  }
  return fallbacks;
}
