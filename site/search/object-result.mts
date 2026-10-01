import { PREPARED_NAVIGATION_MARKERS } from '../prepared-navigation-markers.mjs';
import type { CatalogueRow } from './catalogue-index.mts';
import { markerStyle } from '@cssearth/renderer/navigation/marker-presentation.ts';

const PREVIEW_PIXELS = 40;
const THUMBNAIL_SCALE = 14 / Math.max(...Object.values(PREPARED_NAVIGATION_MARKERS)
  .map(({ presentation }) => presentation.size));

/** Inline overview rows have no observer distance; every row uses the same retained view. */
export type ObjectResultEntry = Omit<CatalogueRow, 'kind' | 'detail'> & {
  readonly kind: CatalogueRow['kind'] | 'overview'; readonly detail?: CatalogueRow['detail'];
};
export type ObjectResultSelection = Readonly<{ kind: ObjectResultEntry['kind']; id: string }> | null;

/** One retained row component for search results and server-rendered system members. */
export interface ObjectResultView {
  readonly item: HTMLLIElement; readonly anchor: HTMLAnchorElement; index: number; entry: ObjectResultEntry | null;
  readonly icon: HTMLSpanElement; readonly name: HTMLSpanElement; readonly detail: HTMLSpanElement;
  readonly kind: HTMLSpanElement; readonly value: HTMLSpanElement; readonly unit: HTMLSpanElement;
}

/** The prepared search thumbnail of a scene object with a context sprite. */
export function searchPreviewUrl(objectId: string): string | null {
  return PREPARED_NAVIGATION_MARKERS[objectId]?.context ? `/navigation/search/${objectId}@2x.webp` : null;
}

function renderMarker(documentTarget: Document, entry: ObjectResultEntry) {
  const preview = entry.marker.kind === 'scene' ? searchPreviewUrl(entry.marker.id) : null;
  if (preview) {
    const image = documentTarget.createElement('img');
    image.className = 'object-search-preview';
    image.src = preview;
    image.width = PREVIEW_PIXELS;
    image.height = PREVIEW_PIXELS;
    image.alt = '';
    image.setAttribute('loading', 'lazy');
    image.setAttribute('decoding', 'async');
    return image;
  }
  const marker = documentTarget.createElement('span');
  if (entry.marker.kind === 'thumbnail') {
    marker.className = `object-navigation-marker ${entry.marker.thumbnail ? 'context-navigation-thumbnail' : 'catalog-navigation-marker'}`;
    marker.setAttribute('aria-hidden', 'true');
    if (entry.marker.thumbnail) {
      const image = documentTarget.createElement('img');
      image.src = entry.marker.thumbnail;
      image.width = PREVIEW_PIXELS;
      image.height = PREVIEW_PIXELS;
      image.alt = '';
      image.setAttribute('loading', 'lazy');
      image.setAttribute('decoding', 'async');
      marker.append(image);
    }
    return marker;
  }
  const prepared = PREPARED_NAVIGATION_MARKERS[entry.marker.id];
  if (!prepared) throw new Error(`Prepared catalogue marker is missing: ${entry.marker.id}.`);
  const presentation = markerStyle(prepared, { color: entry.marker.color, scale: THUMBNAIL_SCALE });
  marker.className = `object-navigation-marker ${entry.marker.id}${presentation.ringed ? ' ringed' : ''}`;
  marker.style.cssText = presentation.style;
  marker.setAttribute('aria-hidden', 'true');
  const disk = documentTarget.createElement('i');
  disk.style.cssText = presentation.innerStyle;
  marker.append(disk);
  if (presentation.ringed) {
    const ring = documentTarget.createElement('b');
    ring.className = 'object-navigation-ring';
    ring.style.cssText = presentation.ringStyle;
    marker.append(ring);
  }
  return marker;
}

export function createObjectResultView(documentTarget: Document): ObjectResultView {
  const item = documentTarget.createElement('li');
  item.className = 'object-item';
  item.role = 'listitem';
  const anchor = documentTarget.createElement('a');
  anchor.className = 'object-link object-observation-control object-thumbnail-leading object-result-row';
  const icon = documentTarget.createElement('span');
  icon.className = 'object-dataset-icon';
  const name = documentTarget.createElement('span');
  name.className = 'object-name object-dataset-label';
  const detail = documentTarget.createElement('span');
  detail.className = 'object-distance object-dataset-detail';
  anchor.append(icon, name, detail);
  item.append(anchor);
  const kind = documentTarget.createElement('span');
  kind.className = 'object-kind';
  const value = documentTarget.createElement('span');
  value.className = 'object-distance-value';
  const unit = documentTarget.createElement('span');
  unit.className = 'object-distance-unit';
  return { item, anchor, index: -1, entry: null, icon, name, detail, kind, value, unit };
}

export function bindObjectResultView(documentTarget: Document, view: ObjectResultView, entry: ObjectResultEntry, selection: ObjectResultSelection) {
  const { anchor, icon, name, detail } = view;
  anchor.href = entry.route;
  anchor.dataset.sourceSubject = entry.source.subject;
  anchor.dataset.sourceDocument = entry.source.document;
  anchor.dataset.sourceLabel = entry.source.label;
  // A system row is a plain link to the system's overview, as the object list's overview rows are.
  if (entry.kind === 'scene') anchor.dataset.objectId = entry.id; else delete anchor.dataset.objectId;
  const selected = selection?.kind === entry.kind && selection.id === entry.id;
  anchor.classList.toggle('is-active', selected);
  if (selected) anchor.setAttribute('aria-current', 'page');
  else anchor.removeAttribute('aria-current');

  if (view.entry === entry) return;
  view.entry = entry;
  icon.replaceChildren(renderMarker(documentTarget, entry));
  name.textContent = entry.name;
  if (entry.detail) {
    detail.title = entry.detail.title;
    detail.setAttribute('aria-label', entry.detail.ariaLabel);
  } else {
    detail.removeAttribute('title');
    detail.removeAttribute('aria-label');
  }
  // The subtitle: what the object is, then how far it is.
  const { kind, value, unit } = view;
  kind.textContent = `${entry.classificationName.charAt(0).toLocaleUpperCase('en')}${entry.classificationName.slice(1)}${entry.detail ? ' · ' : ''}`;
  if (entry.detail?.value && entry.detail.unit) {
    value.textContent = entry.detail.value;
    unit.textContent = entry.detail.unit;
    detail.replaceChildren(kind, value, ' ', unit);
  } else {
    detail.replaceChildren(kind, entry.detail?.text ?? '');
  }
}
