/** Prove that moving a source leaf to a projected carrier preserves its CSS
 * cascade, including every selected dataset and coarse visibility state.
 * Namespace or ancestor-sensitive styles that cannot survive keep native depth. */
export async function verifyDepthStyles(page, source, compiled, surface) {
  if (!compiled.depthPartitions) return true;
  const pairs = surface.leaves.map((id, i) => [id, compiled.facing[i].target]);
  const chain = [];
  for (let id = surface.target; id !== source.tree.camera; id = source.tree.nodes[id].parent) chain.unshift(id);
  for (const group of compiled.depthPartitions.groups) {
    let parent = group.root;
    for (const id of chain) {
      const child = compiled.tree.nodes.findIndex(node => node.parent === parent);
      pairs.push([id, child]); parent = child;
    }
  }
  const minimal = definition => ({ id: definition.id, tree: definition.tree, variants: definition.variants.map(variant => ({ writes: variant.writes })) });
  return page.evaluate(({ source, compiled, pairs }) => {
    document.querySelector('main').remove();
    function mount(definition) {
      const stage = document.createElement('main'); stage.className = 'planet-stage example-stage';
      stage.dataset.objectId = definition.id; stage.classList.add(...definition.tree.stageClasses);
      document.body.append(stage);
      const nodes = definition.tree.nodes.map(record => {
        const node = document.createElement(record.tag); node.className = record.className ?? ''; node.style.cssText = record.style;
        for (const id of record.properties) {
          const property = definition.tree.properties[id];
          if (property.custom) node.style.setProperty(property.name, property.value); else node.style[property.name] = property.value;
        }
        for (const [name, value] of Object.entries(record.attributes)) node.setAttribute(name, value);
        return node;
      });
      nodes.forEach((node, id) => (definition.tree.nodes[id].parent < 0 ? stage : nodes[definition.tree.nodes[id].parent]).append(node));
      return { stage, nodes };
    }
    function select(mount, variant, lod) {
      for (const binding of variant.writes) {
        const node = binding.target < 0 ? mount.stage : mount.nodes[binding.target];
        if (binding.kind === 'class') node.classList.toggle(binding.name, binding.value);
        else if (binding.kind === 'attribute') {
          if (binding.value === null) node.removeAttribute(binding.name); else node.setAttribute(binding.name, binding.value);
        } else {
          const value = binding.kind === 'texture' ? binding.resource === null ? 'none' : `url("https://prepared.invalid/${binding.resource}")` : binding.value;
          if (binding.name.startsWith('--')) node.style.setProperty(binding.name, value); else node.style[binding.name] = value;
        }
      }
      mount.stage.dataset.lod = lod;
    }
    const original = mount(source), candidate = mount(compiled);
    for (let variant = 0; variant < source.variants.length; variant++) for (const lod of ['geometry', 'billboard', 'marker']) {
      select(original, source.variants[variant], lod); select(candidate, compiled.variants[variant], lod);
      for (const [from, to] of pairs) {
        const expected = getComputedStyle(original.nodes[from]), actual = getComputedStyle(candidate.nodes[to]);
        for (const property of expected) if (expected.getPropertyValue(property) !== actual.getPropertyValue(property)) return false;
      }
    }
    return true;
  }, { source: minimal(source), compiled: minimal(compiled), pairs });
}
