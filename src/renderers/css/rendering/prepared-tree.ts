import type { PreparedTree } from './prepared-presentation.js';
import { writePreparedStyle } from './style-access.js';

type Own = (cleanup: () => void) => unknown;
interface BuiltTree { nodes: HTMLElement[]; roots: HTMLElement[]; }

/** A detached transport of prepared DOM records. No scene, layout read,
 * animation, resource bank or camera exists until the mounted owner claims it. */
function builder(tree: PreparedTree, document: Document, own: Own) {
  const nodes: HTMLElement[] = [], roots: HTMLElement[] = [];
  return {
    get complete() { return nodes.length === tree.nodes.length; },
    append() {
      const record = tree.nodes[nodes.length];
      const node = document.createElement(record.tag);
      nodes.push(node);
      if (record.parent === -1) { roots.push(node); own(() => node.remove()); }
      if (record.className !== null) node.className = record.className;
      if (record.style) node.style.cssText = record.style;
      // Preserve the prepared CSSOM assignment order and numeric precision.
      for (const propertyId of record.properties) {
        const property = tree.properties[propertyId];
        if (property.custom) node.style.setProperty(property.name, property.value);
        else writePreparedStyle(node.style, property.name, property.value);
      }
      for (const [name, value] of Object.entries(record.attributes)) node.setAttribute(name, value);
      if (record.parent !== -1) nodes[record.parent].appendChild(node);
    },
    result: { nodes, roots },
  };
}

export function buildPreparedTree(tree: PreparedTree, document: Document, own: Own): BuiltTree {
  const build = builder(tree, document, own);
  while (!build.complete) build.append();
  return build.result;
}

export interface PreparedTreeLease {
  claim(tree: PreparedTree, document: Document, own: Own): BuiltTree;
  destroy(): void;
}

export async function preparePresentationTree(tree: PreparedTree, document: Document, signal: AbortSignal,
  yieldTask: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 0))): Promise<PreparedTreeLease> {
  const cleanups: (() => void)[] = [];
  const build = builder(tree, document, cleanup => cleanups.push(cleanup));
  let destroyed = false, claimed = false;
  const destroy = () => {
    if (destroyed || claimed) return;
    destroyed = true;
    signal.removeEventListener('abort', destroy);
    for (const cleanup of cleanups) cleanup();
    cleanups.length = 0; build.result.nodes.length = 0; build.result.roots.length = 0;
  };
  const check = () => { if (destroyed || signal.aborted) throw new DOMException('Presentation preparation was cancelled.', 'AbortError'); };
  signal.addEventListener('abort', destroy, { once: true });
  try {
    check();
    while (!build.complete) {
      const deadline = performance.now() + 2;
      do { build.append(); } while (!build.complete && performance.now() < deadline);
      if (!build.complete) { await yieldTask(); check(); }
    }
    return Object.freeze({ destroy,
      claim(expected: PreparedTree, ownerDocument: Document, own: Own) {
        check();
        if (claimed || expected !== tree || ownerDocument !== document) throw new TypeError('Prepared tree belongs to another mount.');
        for (const cleanup of cleanups) own(cleanup);
        cleanups.length = 0; claimed = true;
        signal.removeEventListener('abort', destroy);
        return build.result;
      },
    });
  } catch (error) { destroy(); throw error; }
}
