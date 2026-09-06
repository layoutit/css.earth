// Publish independent prepared tile groups without waiting for the viewport.
// A previous parent connects its replacement children into one transaction;
// a replacement parent likewise retires all of its previous child groups.
// Lineage comes from the prepared tree, never from runtime geographic math.
export function selectPagePublication(groups, slots, limits) {
  const byKey = new Map(slots.filter(slot => slot.key).map(slot => [slot.key, slot]));
  const previous = new Map();
  for (const slot of slots) if (slot.published) {
    const group = previous.get(slot.group.key) ?? { ...slot.group, pages: [] };
    group.pages.push(slot.key);
    previous.set(group.key, group);
  }
  const components = groups.map(group => ({ groups: [group], previous: [] }));
  const release = [];
  for (const old of previous.values()) {
    const related = components.filter(component => component.groups.some(next =>
      next.lineage.includes(old.key) || old.lineage.includes(next.key)));
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
  for (const component of components) {
    if (component.groups.some(group => group.pending)) continue;
    const keys = component.groups.flatMap(group => group.pages);
    if (!keys.every(key => byKey.get(key)?.ready)) continue;
    const next = new Set(visible);
    for (const old of component.previous) for (const key of old.pages) next.delete(key);
    for (const key of keys) next.add(key);
    const bytes = [...next].reduce((sum, key) => sum + byKey.get(key).decodedBytes, 0);
    if (next.size > limits.pages || bytes > limits.bytes) continue;
    visible.clear();
    for (const key of next) visible.add(key);
    publish.push(...keys);
    const retained = new Set(keys);
    for (const old of component.previous) for (const key of old.pages) if (!retained.has(key)) release.push(key);
  }
  return { publish, release };
}
