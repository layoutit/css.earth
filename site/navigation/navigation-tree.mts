import { orbitRoot } from '../../src/platform/orbit-root.mts';
import { APPLICATION_WORLD_CONTEXT as context } from '../world-context-plan.mts';
import { appNavigationDestination } from './navigation-destination.mts';
import { readNavigationPackages, type NavigationPackage } from './navigation-packages.mts';

// Prepared helper surfaces can have their own documentation without becoming
// destinations in application navigation. Each one is a prepared
// volume or surface that belongs to a body already in the tree: the Sun's
// heliopause and coronal density, Betelgeuse's circumstellar shells, the
// HD 181327 debris ring and the PDS 70 dust ring.
const NAVIGATION_HIDDEN = new Set(['heliosphere', 'sun-cor1-density', 'betelgeuse-shell', 'hd-181327-disc', 'pds-70-disc']);

/** The places' names as the app's breadcrumb gives them (site/components/ObjectBreadcrumbs.astro). */
const PLACE_LABELS: Record<string, string> = {
  'nearby-universe': 'Nearby Universe', 'local-group': 'Local Group', 'milky-way': 'Milky Way',
  'galaxy-clusters': 'Galaxy clusters', 'stellar-neighbourhood': 'Stellar neighbourhood',
};

/** A place or group with the application destination it opens; null destinations remain labels. */
export interface TreeNode { key: string; label: string; object: NavigationPackage | null; children: TreeNode[]; href: string | null; focusId: string | null }

/** Build the visible hierarchy directly from package labels and the application's prepared orbits. */
export function navigationTree(): TreeNode[] {
  const objects = readNavigationPackages().filter(object => !NAVIGATION_HIDDEN.has(object.id));
  const node = (key: string, label: string, object: NavigationPackage | null, children: TreeNode[] = []): TreeNode => {
    const opens = object ? appNavigationDestination(object.id, object.focusId) : null;
    return { key, label, object, children, href: opens?.href ?? null, focusId: opens?.focusId ?? null };
  };
  const byId = new Map(objects.map(object => [object.id, node(object.id, object.title, object)]));
  const parents = new Map(context.bodies.flatMap(body => body.orbit ? [[body.id, body.orbit.centerBodyId] as const] : []));
  const roots = new Map(objects.map(object => [object.id, orbitRoot(object.id, parents)]));
  const hasMembers = new Set(objects.filter(object => roots.get(object.id) !== object.id).map(object => roots.get(object.id)!));
  const hosted = new Set<string>();
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
  const loneStars = (outside.get('star') ?? []).filter(entry => entry.key !== 'stellar-neighbourhood');
  const starSystems = [...systems].filter(([id]) => id !== context.focus.id).map(([, system]) => {
    system.children.splice(1, 0, ...loneStars.filter(entry => entry.object?.system === system.label));
    return system;
  });
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
  const milkyWay = group('milky-way-section', 'Milky Way', [...place('milky-way'), ...place('stellar-neighbourhood'), ...include(outside.get('nebula') ?? []), ...place('lmc'), ...place('smc')]);
  const localGroup = group('local-group-section', 'Local Group', [...place('local-group'), ...place('m31'), ...place('m33')]);
  const beyond = group('beyond', 'Beyond', [...place('nearby-universe'), ...place('galaxy-clusters')]);
  const rest = [...byId.values()].filter(entry => !placed.has(entry.key));
  return [...solarSystem, ...stars, ...milkyWay, ...localGroup, ...beyond, ...group('other', 'Other', rest)];
}

/** How many objects a node holds, itself included. */
export const treeCount = (node: TreeNode): number => (node.object ? 1 : 0) + node.children.reduce((total, child) => total + treeCount(child), 0);
