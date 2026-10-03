import { OBJECTS } from './objects.mts';
import { systemHostId } from './navigation/system-address.mts';
import { APPLICATION_WORLD_CONTEXT as context } from './world-context-plan.mts';

// What each prepared body orbits or is bound to; a named centre (a binary's barycentre) leads on to its own host.
const parents = new Map<string, string>([
  ...Object.entries(context.orbitCenters ?? {}).map(([id, center]) => [id, center.centerBodyId] as const),
  ...context.bodies.flatMap(body => body.orbit ? [[body.id, body.orbit.centerBodyId] as const]
    : body.boundTo ? [[body.id, body.boundTo.hostId] as const] : []),
]);
const pages = new Map(OBJECTS.map(object => [object.id, object]));

/** The pages from the root of a body's orbit chain down to the page itself: Sun, Mars, Phobos. Centres without a page
 * (a barycentre) are passed through; a page outside every chain is its own one-step trail. */
export function pageTrail(page: { readonly id: string; readonly name: string; readonly route: string }) {
  const trail = [{ name: page.name, route: page.route }], seen = new Set([page.id]);
  // A system's trail runs through its host's: Sun › Jupiter › Jupiter system.
  const host = systemHostId(page.id);
  if (host !== null && pages.has(host)) { const hostPage = pages.get(host)!; trail.unshift({ name: hostPage.name, route: hostPage.route }); seen.add(host); }
  for (let id = parents.get(host ?? page.id); id !== undefined && !seen.has(id); id = parents.get(id)) {
    seen.add(id);
    const host = pages.get(id);
    if (host) trail.unshift({ name: host.name, route: host.route });
  }
  return trail;
}
