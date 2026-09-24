import type { PreparedTree } from './prepared-presentation.js';
import { writePreparedStyle } from './style-access.js';
import { rewritePreparedStyleUrls, type PreparedAssetOrigin } from './prepared-asset-origin.js';

type Own = (cleanup: () => void) => unknown;
interface BuiltTree { nodes: HTMLElement[]; roots: HTMLElement[]; }

/** A detached transport of prepared DOM records. No scene, layout read,
 * animation, resource bank or camera exists until the mounted owner claims it. */
function createPreparedNode(tree: PreparedTree, index: number, document: Document, assetOrigin?: PreparedAssetOrigin | null) {
  const record = tree.nodes[index];
  const node = document.createElement(record.tag);
  if (record.className !== null) node.className = record.className;
  if (record.style) node.style.cssText = rewritePreparedStyleUrls(record.style, assetOrigin);
  // Preserve the prepared CSSOM assignment order and numeric precision.
  for (const propertyId of record.properties) {
    const property = tree.properties[propertyId];
    const value = rewritePreparedStyleUrls(property.value, assetOrigin);
    if (property.custom) node.style.setProperty(property.name, value);
    else writePreparedStyle(node.style, property.name, value);
  }
  for (const [name, value] of Object.entries(record.attributes)) node.setAttribute(name, value);
  return node;
}

function builder(tree: PreparedTree, document: Document, own: Own, assetOrigin?: PreparedAssetOrigin | null) {
  const nodes: HTMLElement[] = [], roots: HTMLElement[] = [];
  return {
    get complete() { return nodes.length === tree.nodes.length; },
    append() {
      const record = tree.nodes[nodes.length];
      const node = createPreparedNode(tree, nodes.length, document, assetOrigin);
      nodes.push(node);
      if (record.parent === -1) { roots.push(node); own(() => node.remove()); }
      if (record.parent !== -1) nodes[record.parent].appendChild(node);
    },
    result: { nodes, roots },
  };
}

/** The server can publish this exact tree before the interactive owner arrives.
 * Validate the entire topology before taking ownership of any existing node. The server may omit the descendants of a
 * subtree its selection hides (`hiddenSubtrees`); they are built here, whole, from their prepared records. */
export function adoptPreparedTree(tree: PreparedTree, stage: HTMLElement, own: Own, hiddenSubtrees: ReadonlySet<number> = new Set(),
  assetOrigin?: PreparedAssetOrigin | null): BuiltTree | null {
  if (!stage.dataset.preparedObject) return null;
  if (stage.dataset.preparedObject !== stage.dataset.objectId) throw new TypeError('Initial prepared tree belongs to another object.');
  const existing = [...stage.querySelectorAll<HTMLElement>('[data-prepared-node]')];
  // Prepared records are topological, but need not be in DOM preorder.
  const indexed = new Map(existing.map(node => [node.dataset.preparedNode, node]));
  const nodes = tree.nodes.map((_, index) => indexed.get(String(index)));
  // A hidden subtree arrives whole or not at all: its root is present with no server children.
  const emptyHidden = new Set([...hiddenSubtrees].filter(root => nodes[root] && !tree.nodes.some((child, at) => child.parent === root && nodes[at])));
  const built = new Set<number>();
  for (const [index, record] of tree.nodes.entries()) if (!nodes[index]) {
    if (!emptyHidden.has(record.parent) && !built.has(record.parent)) throw new TypeError('Initial prepared tree has invalid node identities.');
    nodes[index] = createPreparedNode(tree, index, stage.ownerDocument, assetOrigin);
    built.add(index);
  }
  if (indexed.size !== existing.length || existing.length + built.size !== tree.nodes.length) throw new TypeError('Initial prepared tree has a different node count.');
  for (const index of built) nodes[tree.nodes[index].parent]!.appendChild(nodes[index]!);
  const owned = nodes.filter((node): node is HTMLElement => node !== undefined);
  const children = tree.nodes.map(() => [] as HTMLElement[]);
  for (const [index, record] of tree.nodes.entries()) if (record.parent !== -1) children[record.parent].push(owned[index]);
  const roots: HTMLElement[] = [];
  for (const [index, node] of owned.entries()) {
    const record = tree.nodes[index];
    if ((!built.has(index) && node.dataset.preparedNode !== String(index)) || node.localName !== record.tag ||
        node.parentElement !== (record.parent === -1 ? stage : nodes[record.parent]) ||
        node.children.length !== children[index].length || [...node.children].some((child, indexInParent) => child !== children[index][indexInParent])) {
      throw new TypeError(`Initial prepared tree differs at node ${index}.`);
    }
    if (record.parent === -1) roots.push(node);
  }
  for (const root of roots) own(() => root.remove());
  delete stage.dataset.preparedObject;
  return { nodes: owned, roots };
}

export function buildPreparedTree(tree: PreparedTree, document: Document, own: Own, stage?: HTMLElement, assetOrigin?: PreparedAssetOrigin | null,
  hiddenSubtrees?: ReadonlySet<number>): BuiltTree {
  const existing = stage ? adoptPreparedTree(tree, stage, own, hiddenSubtrees, assetOrigin) : null;
  if (existing) return existing;
  const build = builder(tree, document, own, assetOrigin);
  while (!build.complete) build.append();
  return build.result;
}

export interface PreparedTreeLease {
  claim(tree: PreparedTree, document: Document, own: Own): BuiltTree;
  destroy(): void;
}

export async function preparePresentationTree(tree: PreparedTree, document: Document, signal: AbortSignal,
  yieldTask: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 0)),
  assetOrigin?: PreparedAssetOrigin | null): Promise<PreparedTreeLease> {
  const cleanups: (() => void)[] = [];
  const build = builder(tree, document, cleanup => cleanups.push(cleanup), assetOrigin);
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
