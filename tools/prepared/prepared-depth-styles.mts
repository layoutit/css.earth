import type { Page } from 'playwright';
import type { PreparedTree, PreparedWrite } from '../../src/renderers/css/rendering/prepared-presentation.ts';
import type { PresentationSource, DepthSurface } from './prepared-depth-partitions.mts';
type MinimalPresentation = {id: string; tree: PreparedTree; variants: {writes: readonly PreparedWrite[]}[]};

/** Prove that moving a source leaf to a projected carrier preserves its CSS
 * cascade, including every selected dataset and coarse visibility state.
 * Namespace or ancestor-sensitive styles that cannot survive keep native depth. */
export async function verifyDepthStyles(page: Page, source: PresentationSource, compiled: PresentationSource, surface: DepthSurface | null) {
  if (!compiled.depthPartitions) return true;
  if (!surface || !compiled.facing) throw new TypeError('Compiled depth requires surface and facing.');
  const pairs = surface.leaves.map((id, i) => [id, compiled.facing![i].target]);
  const chain = [];
  for (let id = surface.target; id !== source.tree.camera; id = source.tree.nodes[id].parent) chain.unshift(id);
  for (const group of compiled.depthPartitions.groups) {
    let parent = group.root;
    for (const id of chain) {
      const child = compiled.tree.nodes.findIndex(node => node.parent === parent);
      pairs.push([id, child]); parent = child;
    }
  }
  const minimal = (definition: PresentationSource): MinimalPresentation => ({ id: definition.id, tree: definition.tree, variants: definition.variants.map(variant => ({ writes: variant.writes })) });
  return page.evaluate(({ source, compiled, pairs }) => {
    document.querySelector('main')?.remove();
    function mountPresentation(definition: MinimalPresentation) {
      const stage = document.createElement('main'); stage.className = 'object-stage';
      stage.dataset.objectId = definition.id; stage.classList.add(...definition.tree.stageClasses);
      document.body.append(stage);
      const nodes = definition.tree.nodes.map(record => {
        const node = document.createElement(record.tag); node.className = record.className ?? ''; node.style.cssText = record.style;
        for (const id of record.properties) {
          const property = definition.tree.properties[id];
          if (property.custom) node.style.setProperty(property.name, property.value); else Reflect.set(node.style, property.name, property.value);
        }
        for (const [name, value] of Object.entries(record.attributes)) node.setAttribute(name, value);
        return node;
      });
      nodes.forEach((node, id) => (definition.tree.nodes[id].parent < 0 ? stage : nodes[definition.tree.nodes[id].parent]).append(node));
      return { stage, nodes };
    }
    function select(mount: ReturnType<typeof mountPresentation>, variant: MinimalPresentation['variants'][number], lod: string) {
      for (const binding of variant.writes) {
        const node = binding.target < 0 ? mount.stage : mount.nodes[binding.target];
        if (binding.kind === 'class') node.classList.toggle(binding.name, binding.value);
        else if (binding.kind === 'attribute') {
          if (binding.value === null) node.removeAttribute(binding.name); else node.setAttribute(binding.name, binding.value);
        } else {
          const value = binding.kind === 'texture' ? binding.resource === null ? 'none' : `url("https://prepared.invalid/${binding.resource}")` : binding.value;
          if (binding.name.startsWith('--')) node.style.setProperty(binding.name, value); else Reflect.set(node.style, binding.name, value);
        }
      }
      mount.stage.dataset.lod = lod;
    }
    const original = mountPresentation(source), candidate = mountPresentation(compiled);
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
