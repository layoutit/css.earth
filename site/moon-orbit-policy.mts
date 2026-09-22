import source from './source/major-moons.json' with { type: 'json' };
import { sourceArray, sourceId, sourceObject, sourceUnique } from '../src/platform/source-catalog.mts';

const majorByParent = new Map(sourceArray(source.systems, input => {
  const system = sourceObject(input), ids = sourceArray(system.moons, sourceId);
  sourceUnique(ids, 'major moons');
  return [sourceId(system.id), new Set(ids)] as const;
}));

/** Every planet's major moons, from the sourced groups. */
export function majorMoonIds(): string[] {
  return [...majorByParent.values()].flatMap(moons => [...moons]);
}

export function minorMoonOrbitIds(bodies: readonly { id: string; orbit?: { centerBodyId: string } }[]): string[] {
  return bodies.filter(body => {
    const major = body.orbit && majorByParent.get(body.orbit.centerBodyId);
    return major && !major.has(body.id);
  }).map(body => body.id);
}

/** Hidden orbits normally return on hover. Minor moons have no visible orbit,
 * including hover, under both existing stroke and bar presentation owners. */
export function suppressMinorMoonOrbitPaint(host: HTMLElement, ids: readonly string[]) {
  const style = host.ownerDocument.createElement('style');
  style.dataset.moonOrbitPolicy = '';
  if (ids.length) style.textContent = ids.map(id => `.prepared-world-context [data-context-orbit="${sourceId(id)}"]`).join(',') + '{display:none!important}';
  host.append(style);
  return () => style.remove();
}
