import { sourceId } from '../src/platform/source-catalog.mts';

/** Hidden orbits normally return on hover. Minor moons have no visible orbit,
 * including hover, under both existing stroke and bar presentation owners. */
export function suppressMinorMoonOrbitPaint(host: HTMLElement, ids: readonly string[]) {
  const style = host.ownerDocument.createElement('style');
  style.dataset.moonOrbitPolicy = '';
  if (ids.length) style.textContent = ids.map(id => `.prepared-world-context [data-context-orbit="${sourceId(id)}"]`).join(',') + '{display:none!important}';
  host.append(style);
  return () => style.remove();
}
