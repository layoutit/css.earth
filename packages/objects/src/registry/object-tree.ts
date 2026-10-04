/**
 * The one structure of the registry: every object sits inside exactly one other object, its `parent`, and the Observable
 * Universe is the root, the only object with none. Earth is inside the Earth system, which is inside the Solar System, the
 * Milky Way, the Local Group, the Nearby Universe and the Observable Universe. What a page loads, what a card lists, what a
 * breadcrumb shows and what the camera hands over to as it backs out all read this tree.
 *
 * A dataset bank is not in the tree: it is attached to the one object it draws for (`properties.host`), which
 * `checkBankHosts` requires of every bank. A star measured to be bound to another is inside what that star is inside
 * (`checkBoundStars`).
 */
import { systemObjectId } from './system-address.js';

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

/** A package outside the tree: a dataset bank, as its descriptor names its host. */
export interface BankNode { readonly id: string; readonly host?: unknown }

/** Checks that every bank names the one object it draws for (`properties.host`), an object of the tree, naming the bank and
 * its file on refusal. */
export function checkBankHosts(banks: readonly BankNode[], objects: ReadonlySet<string>): void {
  for (const bank of banks) {
    const where = `src/objects/${bank.id}/object.json`;
    if (typeof bank.host !== 'string') throw new TypeError(`${where}: a dataset bank names the one object it draws for (properties.host); ${bank.id} names ${bank.host === undefined ? 'none' : JSON.stringify(bank.host)}.`);
    if (!objects.has(bank.host)) throw new TypeError(`${where}: properties.host "${bank.host}" is no object of the registry.`);
  }
}

/** Checks that each star measured to be bound to another (`bonds`: the star, then the star it is bound to, from the
 * astronomy records' `boundTo`) is inside the same object as that star: the system the pair makes. A bound star with
 * bodies of its own hosts a system inside that one (Epsilon Indi B, the pair Ba and Bb, inside Epsilon Indi A's system),
 * so it is its system that is inside it. The tree's own shape cannot tell a wrong parent from a right one; a measured
 * bond can. */
export function checkBoundStars(objects: readonly TreeNode[], bonds: Iterable<readonly [star: string, host: string]>): void {
  const byId = new Map(objects.map(object => [object.id, object] as const));
  for (const [star, host] of bonds) {
    const where = `src/objects/${star}/object.json`, own = byId.get(star), other = byId.get(host);
    if (!own) continue;
    if (!other) throw new TypeError(`${where}: ${star} is bound to ${host}, which is no object of the registry.`);
    // The object the star, with any system it hosts, is inside.
    const inside = own.parent === systemObjectId(star) ? byId.get(own.parent)?.parent : own.parent;
    if (inside !== other.parent) {
      throw new TypeError(`${where}: ${star} is bound to ${host}, so it is inside what ${host} is inside ("${other.parent ?? 'nothing'}"); its parent is "${own.parent ?? 'none'}".`);
    }
  }
}
