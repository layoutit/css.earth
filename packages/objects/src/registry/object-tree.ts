/**
 * The one structure of the registry: every object sits inside exactly one other object, its `parent`, and the Observable
 * Universe is the root, the only object with none. Earth is inside the Earth system, which is inside the Solar System, the
 * Milky Way, the Local Group, the Nearby Universe and the Observable Universe. What a page loads, what a card lists, what a
 * breadcrumb shows and what the camera hands over to as it backs out all read this tree.
 *
 * A dataset bank is not in the tree: it is attached to the object it draws for (`properties.host`).
 */
export const OBJECT_TREE_ROOT = 'observable-universe';

export interface TreeNode { readonly id: string; readonly parent?: string }

/** Checks that `objects` form one tree under the root, naming the object, its file and the parent it read on refusal. */
export function checkObjectTree(objects: readonly TreeNode[]): void {
  const byId = new Map(objects.map(object => [object.id, object] as const));
  const where = (id: string) => `src/objects/${id}/object.json`;
  if (!byId.has(OBJECT_TREE_ROOT)) throw new TypeError(`The object tree has no root: ${where(OBJECT_TREE_ROOT)} is missing.`);
  for (const object of objects) {
    if (object.id === OBJECT_TREE_ROOT) {
      if (object.parent !== undefined) throw new TypeError(`${where(object.id)}: the root of the object tree has no parent; got "${object.parent}".`);
      continue;
    }
    if (object.parent === undefined) throw new TypeError(`${where(object.id)}: every object names the one object it is inside (a top-level "parent"); ${object.id} names none.`);
    if (!byId.has(object.parent)) throw new TypeError(`${where(object.id)}: parent "${object.parent}" is no object of the registry.`);
  }
  // Every chain ends at the root: walking up from any object never returns to an object it passed.
  const reaches = new Set<string>([OBJECT_TREE_ROOT]);
  for (const object of objects) {
    const path: string[] = [];
    for (let id: string | undefined = object.id; id !== undefined && !reaches.has(id); id = byId.get(id)?.parent) {
      if (path.includes(id)) throw new TypeError(`${where(object.id)}: its parents loop (${[...path, id].join(' > ')}).`);
      path.push(id);
    }
    for (const id of path) reaches.add(id);
  }
}

/** The objects `id` is inside, from the root down to its parent. */
export function objectAncestors(objects: ReadonlyMap<string, TreeNode>, id: string): readonly string[] {
  const chain: string[] = [];
  for (let parent = objects.get(id)?.parent; parent !== undefined; parent = objects.get(parent)?.parent) chain.unshift(parent);
  return chain;
}

/** The objects directly inside each object. */
export function objectChildren(objects: readonly TreeNode[]): ReadonlyMap<string, readonly string[]> {
  const children = new Map<string, string[]>();
  for (const object of objects) if (object.parent !== undefined) (children.get(object.parent) ?? children.set(object.parent, []).get(object.parent)!).push(object.id);
  return children;
}
