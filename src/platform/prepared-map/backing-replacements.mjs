// Follow the prepared source roots through the actual selected cut. A missing
// child is not coverage: source inventories can omit parts of an ocean tile.
// No geographic rectangles, image opacity, or new scene geometry are inferred.
export function selectBackingReplacements(backing, fine, nodes, visible) {
  const selected = new Map((fine.groups ?? []).map(group => [group.key, group]));
  const cache = new Map();
  const visibility = new Map();
  const outside = node => {
    if(visibility.has(node.key))return visibility.get(node.key);
    const result=!visible(node) || node.pages?.length > 0 && node.pages.every(key => {
      const piece=nodes.get(key);
      return piece&&!visible(piece);
    });
    visibility.set(node.key,result);
    return result;
  };
  function visit(key) {
    if (cache.has(key)) return cache.get(key);
    const node = nodes.get(key);
    let result = null;
    if (node && outside(node)) result = [];
    else if (node && !node.stub) {
      const group = selected.get(key);
      if (group && !group.pending && group.pages.length) result = [key];
      else if (node.children?.length === 4) {
        const children = node.children.map(visit);
        if (children.every(Boolean)) result = children.flat();
      }
    }
    cache.set(key, result);
    return result;
  }
  return backing.flatMap(group => {
    const page = nodes.get(group.key), certificate = page?.replacement;
    if (certificate?.empty) return [{...group,replacements:[]}];
    if (!certificate?.branches?.length) return [];
    const replacements = certificate.branches.map(branch => {
      for (const key of branch) {
        const node=nodes.get(key), group=selected.get(key);
        if(node&&outside(node))return [];
        if(!node||node.stub||group?.pending)return null;
        if(group?.pages.length)return [key];
      }
      return visit(branch.at(-1));
    });
    if (!replacements.every(Boolean)) return [];
    const keys = [...new Set(replacements.flat())];
    return keys.length ? [{ ...group, replacements: keys }] : [];
  });
}
