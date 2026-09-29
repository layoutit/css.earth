import { orbitRoot } from '../../src/platform/orbit-root.mts';
import { APPLICATION_WORLD_CONTEXT as context } from '../world-context-plan.mts';
import { appNavigationDestination } from './navigation-destination.mts';
import { readNavigationPackages, type NavigationPackage } from './navigation-packages.mts';
import { datasetHref } from '../dataset-url.mts';
import { OVERVIEWS } from '../objects.mts';

/** The places' names: an overview's is its registry entry's, as the app's breadcrumb gives it (ObjectBreadcrumbs.astro). */
const PLACE_LABELS: Record<string, string> = {
  ...Object.fromEntries(OVERVIEWS.map(overview => [overview.id, overview.name])),
  'galaxy-clusters': 'Galaxy clusters', 'stellar-neighbourhood': 'Stellar neighbourhood',
};

/** A place or group with the application destination it opens; null destinations remain labels. */
export interface TreeNode { key: string; label: string; object: NavigationPackage | null; children: TreeNode[]; href: string | null; focusId: string | null }

/** Build the visible hierarchy directly from package labels and the application's prepared orbits. */
export function navigationTree(): TreeNode[] {
  const objects = readNavigationPackages();
  const node = (key: string, label: string, object: NavigationPackage | null, children: TreeNode[] = []): TreeNode => {
    const opens = object && !object.attachedTo ? appNavigationDestination(object.id, object.focusId) : null;
    return { key, label, object, children, href: opens?.href ?? null, focusId: opens?.focusId ?? null };
  };
  const byId = new Map(objects.map(object => [object.id, node(object.id, object.title, object)]));
  // A volume a body presents through its lens sits under that body and opens it on that lens.
  for (const object of objects) {
    if (!object.attachedTo) continue;
    const host = byId.get(object.attachedTo.hostId), entry = byId.get(object.id)!;
    const opens = appNavigationDestination(object.attachedTo.hostId, host?.object?.focusId ?? null);
    if (!host || !opens) throw new Error(`src/objects/${object.id} is a lens of ${object.attachedTo.hostId}, which navigation cannot open.`);
    entry.href = datasetHref(opens.href, object.attachedTo.lensId);
    host.children.push(entry);
  }
  const parents = new Map(context.bodies.flatMap(body => body.orbit ? [[body.id, body.orbit.centerBodyId] as const] : []));
  const roots = new Map(objects.map(object => [object.id, orbitRoot(object.id, parents)]));
  const hasMembers = new Set(objects.filter(object => roots.get(object.id) !== object.id).map(object => roots.get(object.id)!));
  const hosted = new Set<string>(objects.filter(object => object.attachedTo).map(object => object.id));
  for (const object of objects) {
    const parent = parents.get(object.id), host = parent ? byId.get(parent) : undefined;
    if (object.group !== 'satellite' || !host) continue;
    host.children.push(byId.get(object.id)!);
    hosted.add(object.id);
  }

  const systems = new Map<string, TreeNode>(), outside = new Map<string, TreeNode[]>(), homeGroups = new Map<string, TreeNode>();
  for (const object of objects) {
    if (hosted.has(object.id)) continue;
    const root = roots.get(object.id)!, star = byId.get(root), entry = byId.get(object.id)!;
    if (star?.object?.group !== 'star' || !hasMembers.has(root)) {
      const group = outside.get(object.group) ?? [];
      group.push(entry); outside.set(object.group, group);
      continue;
    }
    let system = systems.get(root);
    if (!system) {
      system = node(root === context.focus.id ? 'solar-system' : `system:${root}`, star.object.system ?? star.label, null);
      systems.set(root, system);
    }
    if (root === object.id) system.children.unshift(entry);
    else if (root !== context.focus.id) system.children.push(entry);
    else {
      let group = homeGroups.get(object.group);
      if (!group) {
        const label = object.group[0].toLocaleUpperCase('en') + object.group.slice(1).replaceAll('-', ' ');
        group = node(`sun:${label}`, label, null);
        homeGroups.set(object.group, group); system.children.push(group);
      }
      group.children.push(entry);
    }
  }
  // Orbit groups that name the same system are one system, such as Epsilon Indi A with Ab and Ba with Bb.
  // The group whose root star comes first in package order leads.
  const packageOrder = new Map(objects.map((object, index) => [object.id, index]));
  const byRootOrder = [...systems].filter(([root]) => root !== context.focus.id).sort(([a], [b]) => packageOrder.get(a)! - packageOrder.get(b)!);
  for (const [root, system] of byRootOrder) {
    const [leadRoot, lead] = byRootOrder.find(([, candidate]) => candidate.label === system.label)!;
    if (leadRoot === root) continue;
    lead.children.push(...system.children);
    systems.delete(root);
  }
  // Packages that name the same system belong to it even when their orbits meet at a barycentre, not at a star:
  // stars join after the system's root star, other bodies after its members. A lone star's system name can be
  // its constellation, so a name forms a new system only when a star and a body that is not a star share it.
  const named = new Map<string, TreeNode[]>();
  for (const entries of outside.values()) for (const entry of entries) {
    const name = entry.object?.system;
    if (entry.key !== 'stellar-neighbourhood' && name) named.set(name, [...named.get(name) ?? [], entry]);
  }
  const joined = new Set<string>();
  for (const [name, entries] of named) {
    let system = [...systems.values()].find(candidate => candidate.label === name);
    const stars = entries.filter(entry => entry.object?.group === 'star'), others = entries.filter(entry => entry.object?.group !== 'star');
    if (!system) {
      if (!stars.length || !others.length) continue;
      system = node(`system:${stars[0]!.key}`, name, null, [stars.shift()!]);
      systems.set(stars.length ? system.key : system.children[0]!.key, system);
      joined.add(system.children[0]!.key);
    }
    system.children.splice(1, 0, ...stars); system.children.push(...others);
    for (const entry of [...stars, ...others]) joined.add(entry.key);
  }
  const loneStars = (outside.get('star') ?? []).filter(entry => entry.key !== 'stellar-neighbourhood' && !joined.has(entry.key));
  const starSystems = [...systems].filter(([id]) => id !== context.focus.id).map(([, system]) => system);
  const placed = new Set<string>();
  const include = (nodes: TreeNode[]): TreeNode[] => {
    for (const entry of nodes) { if (entry.object) placed.add(entry.key); include(entry.children); }
    return nodes;
  };
  const place = (id: string): TreeNode[] => {
    const entry = byId.get(id);
    if (!entry) return [];
    entry.label = PLACE_LABELS[id] ?? entry.label;
    return include([entry]);
  };
  const group = (key: string, label: string, children: TreeNode[]): TreeNode[] => children.length ? [node(key, label, null, children)] : [];
  const home = systems.get(context.focus.id), solarSystem = include(home ? [home] : []);
  const stars = group('stars', 'Stars', [...include(starSystems), ...include(loneStars.filter(entry => !placed.has(entry.key)))]);
  // Each overview is a section, from the nearest level out (their object.json): its own row, the packages it draws, the
  // packages of the classifications it holds (nebulae, globular clusters and black holes in the Milky Way; stars keep
  // their own section), then the catalogued subjects its catalogue places in it (the Magellanic Clouds). A galaxy the Milky
  // Way's section takes is gone before the Local Group's holding looks.
  const inSection = (section: string) => include([...byId.values()].filter(entry => entry.object?.section === section && !placed.has(entry.key)));
  const unjoined = (group: string) => (outside.get(group) ?? []).filter(entry => !joined.has(entry.key) && !placed.has(entry.key));
  const sections = OVERVIEWS.flatMap(overview => group(`${overview.id}-section`, overview.name, [...place(overview.id),
    ...overview.packages.flatMap(place),
    ...overview.holds.flatMap(holding => holding.classifications).filter(classification => classification !== 'star')
      .flatMap(classification => include(unjoined(classification))), ...inSection(overview.id)]));
  // A package that opens nothing and belongs to no body, such as the heliosphere behind its shell setting, is not listed.
  const rest = [...byId.values()].filter(entry => !placed.has(entry.key) && !hosted.has(entry.key) && !joined.has(entry.key) && entry.href !== null);
  return [...solarSystem, ...stars, ...sections, ...group('other', 'Other', rest)];
}

/** The one classification a branch's members share, which is the pill that lists them; null when they differ.
 * A system counts as its leading member, the star it is named for. */
export function treeSearch(node: TreeNode): string | null {
  const leading = (entry: TreeNode): string | null => entry.object?.group ?? (entry.children[0] ? leading(entry.children[0]) : null);
  const groups = new Set(node.children.map(leading));
  return groups.size === 1 ? [...groups][0]! : null;
}

/** How many objects a node holds, itself included. */
export const treeCount = (node: TreeNode): number => (node.object ? 1 : 0) + node.children.reduce((total, child) => total + treeCount(child), 0);
