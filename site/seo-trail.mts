import { OBJECTS } from './objects.mts';
import { APPLICATION_WORLD_CONTEXT as context } from './world-context-plan.mts';

// What each prepared body orbits or is bound to; a named centre (a binary's barycentre) leads on to its own host.
const parents = new Map<string, string>([
  ...Object.entries(context.orbitCenters ?? {}).map(([id, center]) => [id, center.centerBodyId] as const),
  ...context.bodies.flatMap(body => body.orbit ? [[body.id, body.orbit.centerBodyId] as const]
    : body.boundTo ? [[body.id, body.boundTo.hostId] as const] : []),
]);
const pages = new Map(OBJECTS.filter(object => object.kind === 'scene').map(object => [object.id, object]));

/** The pages from the root of a body's orbit chain down to the page itself: Sun, Mars, Phobos. Centres without a page
 * (a barycentre) are passed through; a page outside every chain is its own one-step trail. */
export function pageTrail(page: { readonly id: string; readonly name: string; readonly route: string }) {
  const trail = [{ name: page.name, route: page.route }], seen = new Set([page.id]);
  for (let id = parents.get(page.id); id !== undefined && !seen.has(id); id = parents.get(id)) {
    seen.add(id);
    const host = pages.get(id);
    if (host) trail.unshift({ name: host.name, route: host.route });
  }
  return trail;
}
