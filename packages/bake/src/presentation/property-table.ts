/** JSON identity intentionally includes field order, just as the node builder's tables do. */
function propertyInterner<P>(properties: P[]) {
  // Append keeps every existing entry; the last duplicate is the one subsequent lookups use.
  const ids = new Map(properties.map((property, id) => [JSON.stringify(property), id]));
  const intern = (property: P) => {
    const key = JSON.stringify(property);
    if (!ids.has(key)) { ids.set(key, properties.length); properties.push(property); }
    return ids.get(key)!;
  };
  return { properties, intern };
}

/** Preserve existing indices and unused entries while interning additional properties. */
export function appendPropertyTable<P>(existing: readonly P[]) {
  return propertyInterner([...existing]);
}

/** Rebuild in node/reference order, dropping unused entries and remapping duplicate references. */
export function rebuildPropertyTable<T extends { nodes: readonly { properties: readonly number[] }[]; properties: readonly unknown[] }>(
  tree: T, nodes: readonly T['nodes'][number][] = tree.nodes, table: T['properties'] = tree.properties,
): T {
  const { properties, intern } = propertyInterner<T['properties'][number]>([]);
  return { ...tree, nodes: nodes.map(node => ({ ...node, properties: node.properties.map(id => intern(table[id]!)) })), properties };
}
