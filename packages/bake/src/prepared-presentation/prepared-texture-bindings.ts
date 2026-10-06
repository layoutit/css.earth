import { type PreparedPresentationDefinition, type PreparedTree } from '@cssearth/objects';

import type { Page } from 'playwright';
import type { TextureContainer } from '../presentation/index.ts';

/** Resolve image consumers against the actual scene CSS, after depth partitioning: the childless elements that draw each
 * texture write (its slot), and the containers that draw one themselves. Both ship as records that name no custom
 * property (presentation/records/texture-image-records.ts). Sentinels are CSS values only: the preparation page blocks every request. */
export async function prepareTextureBindings(page: Page, definition: PreparedPresentationDefinition & { id: string }): Promise<{ slots: NonNullable<PreparedTree['textureBindings']>; containers: TextureContainer[] }> {
  return page.evaluate(definition => {
    document.querySelectorAll('main').forEach(node => node.remove());
    const stage = document.createElement('main'); stage.className = 'object-stage';
    stage.dataset.objectId = definition.id; stage.classList.add(...definition.tree.stageClasses); document.body.append(stage);
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
    const bindings = new Map<string, { target: number; name: string; leaves: Set<number>; image: string }>();
    for (const variant of definition.variants) for (const write of variant.writes) if (write.kind === 'texture') {
      const key = `${write.target}:${write.name}`;
      if (!bindings.has(key)) bindings.set(key, { target: write.target, name: write.name, leaves: new Set(), image: `url("https://prepared.invalid/texture-${bindings.size}")` });
    }
    const byImage = new Map([...bindings.values()].map(binding => [binding.image, binding]));
    const containers = new Map<string, { target: number; name: string; node: number }>();
    for (const variant of definition.variants) {
      for (const write of variant.writes) {
        const node = write.target < 0 ? stage : nodes[write.target];
        if (write.kind === 'class') node.classList.toggle(write.name, write.value);
        else if (write.kind === 'attribute') {
          if (write.value === null) node.removeAttribute(write.name); else node.setAttribute(write.name, write.value);
        } else {
          const value = write.kind === 'texture' ? bindings.get(`${write.target}:${write.name}`)!.image : write.value;
          if (write.name.startsWith('--')) node.style.setProperty(write.name, value); else Reflect.set(node.style, write.name, value);
        }
      }
      nodes.forEach((node, id) => {
        const image = getComputedStyle(node).backgroundImage, binding = byImage.get(image);
        if (!binding) return;
        if (node.children.length) containers.set(`${binding.target}:${binding.name}:${id}`, { target: binding.target, name: binding.name, node: id }); else binding.leaves.add(id);
      });
    }
    const owners = new Set<number>();
    const slots = [...bindings.values()].filter(binding => binding.leaves.size).map(({ target, name, leaves }) => {
      for (const leaf of leaves) {
        if (owners.has(leaf)) throw new TypeError('Selection-dependent texture consumer requires an explicit binding.');
        owners.add(leaf);
      }
      return { target, name, leaves: [...leaves].sort((a, b) => a - b) };
    });
    return { slots, containers: [...containers.values()] };
  }, definition);
}
