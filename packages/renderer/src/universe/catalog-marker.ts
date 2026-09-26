import { isPreparedCluster, isPreparedNebula } from '@cssearth/catalog';
import type { PreparedCatalogObject } from '@cssearth/catalog';

export type CatalogMarkerKind = 'galaxy' | 'nebula' | 'planetary-nebula' | 'open-cluster' | 'globular-cluster' | 'galaxy-group' | 'galaxy-cluster';

/** Presentation follows the catalogue classification, never a list of object IDs. */
export function catalogMarkerKind(object: PreparedCatalogObject): CatalogMarkerKind {
  if (isPreparedCluster(object)) return 'galaxy-cluster';
  if (!isPreparedNebula(object)) return 'galaxy';
  if (object.kind === 'globular-cluster') return 'globular-cluster';
  if (/open cluster/iu.test(object.classification.name)) return 'open-cluster';
  if (/planetary nebula/iu.test(object.classification.name)) return 'planetary-nebula';
  return 'nebula';
}

const cloud = '<path d="M5 17a4 4 0 0 1-1-7.87A5.5 5.5 0 0 1 14.5 7a4 4 0 0 1 4.9 4.1A3 3 0 0 1 19 17Z"/>';
const shapes: Record<CatalogMarkerKind, string> = {
  galaxy: '<ellipse cx="12" cy="12" rx="9" ry="4.5"/>',
  nebula: cloud,
  'planetary-nebula': cloud + '<circle cx="11" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  'open-cluster': '<circle cx="12" cy="12" r="8" stroke-dasharray="0.1 4.09" stroke-linecap="round"/>',
  'globular-cluster': '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4v16"/>',
  'galaxy-group': '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9Z"/>',
  'galaxy-cluster': '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9Z" fill="currentColor"/>',
};

/** Fixed decorative vector icons, not generated scene imagery. */
export function mountCatalogMarker(marker: HTMLElement, object: PreparedCatalogObject): void {
  const kind = catalogMarkerKind(object);
  mountCatalogMarkerKind(marker, kind);
}

export function mountCatalogMarkerKind(marker: HTMLElement, kind: CatalogMarkerKind): void {
  marker.dataset.catalogMarkerKind = kind;
  marker.className = 'prepared-context-marker';
  marker.style.cssText = 'position:absolute;left:50%;top:50%;width:16px;height:16px;opacity:0;visibility:hidden;pointer-events:none';
  marker.setAttribute('aria-hidden', 'true');
  marker.innerHTML = '';
}

export function catalogMarkerSvg(kind: CatalogMarkerKind): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' + shapes[kind] + '</svg>';
}
