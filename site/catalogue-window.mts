import { PREPARED_NAVIGATION_MARKERS } from './prepared-navigation-markers.mjs';
import type { BrowserWindow } from './browser-types.mts';
import type { CatalogueIndexEntry } from './catalogue-index.mts';
import { markerStyle } from '../src/navigation/marker-presentation.mts';

/** A search result row is 48 px (a 40 px preview beside a name and a subtitle) with an 8 px gap. */
const ROW_PITCH = 56;
const PREVIEW_PIXELS = 40;
const OVERSCAN_ROWS = 6;
const MAX_WINDOW_ROWS = 28;
const THUMBNAIL_SCALE = 14 / Math.max(...Object.values(PREPARED_NAVIGATION_MARKERS)
  .map(({ presentation }) => presentation.size));

interface RowView { readonly item: HTMLLIElement; readonly anchor: HTMLAnchorElement; index: number; }

/** The prepared search thumbnail of a scene object with a context sprite (`tools/prepare/prepare-search-thumbnails.mts`). */
export function searchPreviewUrl(objectId: string): string | null {
  return PREPARED_NAVIGATION_MARKERS[objectId]?.context ? `/navigation/search/${objectId}@2x.webp` : null;
}

function renderMarker(documentTarget: Document, entry: CatalogueIndexEntry) {
  const preview = entry.marker.kind === 'scene' ? searchPreviewUrl(entry.marker.id) : null;
  if (preview) {
    const image = documentTarget.createElement('img');
    image.className = 'object-search-preview';
    image.src = preview;
    image.width = PREVIEW_PIXELS;
    image.height = PREVIEW_PIXELS;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    return image;
  }
  const marker = documentTarget.createElement('span');
  if (entry.marker.kind === 'focus') {
    marker.className = `object-navigation-marker ${entry.marker.thumbnail ? 'context-navigation-thumbnail' : 'catalog-navigation-marker'}`;
    marker.ariaHidden = 'true';
    if (entry.marker.thumbnail) {
      const image = documentTarget.createElement('img');
      image.src = entry.marker.thumbnail;
      image.width = PREVIEW_PIXELS;
      image.height = PREVIEW_PIXELS;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      marker.append(image);
    }
    return marker;
  }
  const prepared = PREPARED_NAVIGATION_MARKERS[entry.marker.id];
  if (!prepared) throw new Error(`Prepared catalogue marker is missing: ${entry.marker.id}.`);
  const presentation = markerStyle(prepared, { color: entry.marker.color, scale: THUMBNAIL_SCALE });
  marker.className = `object-navigation-marker ${entry.marker.id}${presentation.ringed ? ' ringed' : ''}`;
  marker.style.cssText = presentation.style;
  marker.ariaHidden = 'true';
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

function createRow(documentTarget: Document): RowView {
  const item = documentTarget.createElement('li');
  item.className = 'object-item';
  item.role = 'listitem';
  const anchor = documentTarget.createElement('a');
  anchor.className = 'object-link object-observation-control object-thumbnail-leading';
  const icon = documentTarget.createElement('span');
  icon.className = 'object-lens-icon';
  const name = documentTarget.createElement('span');
  name.className = 'object-name object-lens-label';
  const detail = documentTarget.createElement('span');
  detail.className = 'object-distance object-lens-detail';
  anchor.append(icon, name, detail);
  item.append(anchor);
  return { item, anchor, index: -1 };
}

function bindRow(documentTarget: Document, view: RowView, entry: CatalogueIndexEntry, index: number, selectedObjectId: string,
  selectedFocusId: string) {
  const { item, anchor } = view;
  view.index = index;
  item.style.position = 'absolute';
  item.style.insetInline = '0';
  item.style.top = `${index * ROW_PITCH}px`;
  item.dataset.catalogueIndex = String(index);
  item.dataset.objectName = entry.name.toLocaleLowerCase('en');
  item.dataset.objectDistanceM = String(entry.distanceMeters);
  item.dataset.objectSystemName = entry.systemName;
  item.dataset.objectClassification = entry.classification;
  item.dataset.objectClassificationName = entry.classificationName;
  item.dataset.objectIllustration = String(entry.illustration);
  item.setAttribute('aria-setsize', '0');
  item.setAttribute('aria-posinset', String(index + 1));

  anchor.href = entry.route;
  anchor.dataset.sourceSubject = entry.source.subject;
  anchor.dataset.sourceDocument = entry.source.document;
  anchor.dataset.sourceLabel = entry.source.label;
  if (entry.kind === 'scene') {
    anchor.dataset.objectId = entry.id;
    delete anchor.dataset.preparedFocusId;
  } else {
    anchor.dataset.preparedFocusId = entry.id;
    delete anchor.dataset.objectId;
  }
  const selected = entry.kind === 'scene' ? entry.id === selectedObjectId : entry.id === selectedFocusId;
  anchor.classList.toggle('is-active', selected);
  if (selected) anchor.setAttribute('aria-current', 'page');
  else anchor.removeAttribute('aria-current');

  const icon = anchor.children[0] as HTMLElement;
  icon.replaceChildren(renderMarker(documentTarget, entry));
  (anchor.children[1] as HTMLElement).textContent = entry.name;
  const detail = anchor.children[2] as HTMLElement;
  detail.title = entry.detail.title;
  detail.ariaLabel = entry.detail.ariaLabel;
  // The subtitle: what the object is, then how far it is.
  const kind = documentTarget.createElement('span');
  kind.className = 'object-kind';
  kind.textContent = `${entry.classificationName.charAt(0).toLocaleUpperCase('en')}${entry.classificationName.slice(1)} · `;
  if (entry.detail.value && entry.detail.unit) {
    const value = documentTarget.createElement('span');
    value.className = 'object-distance-value';
    value.textContent = entry.detail.value;
    const unit = documentTarget.createElement('span');
    unit.className = 'object-distance-unit';
    unit.textContent = entry.detail.unit;
    detail.replaceChildren(kind, value, ' ', unit);
  } else {
    detail.replaceChildren(kind, entry.detail.text);
  }
}

/** A fixed-size live DOM window over the prepared catalogue data. */
export function createCatalogueWindow({ documentTarget, windowTarget, list, scrollTarget }: {
  documentTarget: Document; windowTarget: BrowserWindow; list: HTMLUListElement; scrollTarget: HTMLElement;
}) {
  let entries: readonly CatalogueIndexEntry[] = [];
  let selectedObjectId = '';
  let selectedFocusId = '';
  let frame: number | null = null;
  let active = new Map<number, RowView>();
  const spare: RowView[] = [];

  list.dataset.catalogueWindow = '';
  const render = () => {
    frame = null;
    const listTop = Number.isFinite(list.offsetTop) ? list.offsetTop : 0;
    const relativeTop = Math.max(0, (scrollTarget.scrollTop || 0) - listTop);
    const visibleRows = Math.max(1, Math.ceil((scrollTarget.clientHeight || 420) / ROW_PITCH));
    const start = Math.max(0, Math.floor(relativeTop / ROW_PITCH) - OVERSCAN_ROWS);
    const end = Math.min(entries.length, start + Math.min(MAX_WINDOW_ROWS, visibleRows + OVERSCAN_ROWS * 2));
    for (const [index, view] of active) {
      if (index >= start && index < end) continue;
      view.item.remove();
      active.delete(index);
      spare.push(view);
    }
    for (let index = start; index < end; index++) {
      if (active.has(index)) continue;
      const view = spare.pop() ?? createRow(documentTarget);
      bindRow(documentTarget, view, entries[index]!, index, selectedObjectId, selectedFocusId);
      active.set(index, view);
    }
    for (const view of active.values()) {
      view.item.setAttribute('aria-setsize', String(entries.length));
    }
    // Keep already ordered rows attached. Re-appending every active row makes
    // the browser drop keyboard focus whenever a scroll schedules a second
    // render after `focus()` has materialized the next window.
    let cursor = list.firstElementChild;
    for (const [, view] of [...active].sort(([left], [right]) => left - right)) {
      if (view.item !== cursor) list.insertBefore(view.item, cursor);
      cursor = view.item.nextElementSibling;
    }
  };
  const invalidate = () => {
    if (frame === null) frame = windowTarget.requestAnimationFrame(render);
  };
  scrollTarget.addEventListener('scroll', invalidate, { passive: true });

  const setEntries = (next: readonly CatalogueIndexEntry[]) => {
    entries = next;
    for (const [index, view] of active) {
      const entry = entries[index];
      if (entry) bindRow(documentTarget, view, entry, index, selectedObjectId, selectedFocusId);
      else {
        view.item.remove();
        active.delete(index);
        spare.push(view);
      }
    }
    list.style.height = next.length ? `${next.length * ROW_PITCH - 8}px` : '0px';
    render();
  };

  return Object.freeze({
    setEntries,
    focus(index: number) {
      if (!Number.isInteger(index) || index < 0 || index >= entries.length) return false;
      const listTop = Number.isFinite(list.offsetTop) ? list.offsetTop : 0;
      const rowTop = listTop + index * ROW_PITCH;
      const rowBottom = rowTop + ROW_PITCH;
      const viewportTop = scrollTarget.scrollTop || 0;
      const viewportBottom = viewportTop + (scrollTarget.clientHeight || 420);
      if (rowTop < viewportTop) scrollTarget.scrollTop = rowTop;
      else if (rowBottom > viewportBottom) scrollTarget.scrollTop = rowBottom - (scrollTarget.clientHeight || 420);
      render();
      active.get(index)?.anchor.focus();
      return true;
    },
    setSelection(objectId: string, focusId: string) {
      selectedObjectId = objectId;
      selectedFocusId = focusId;
      for (const [index, view] of active) bindRow(documentTarget, view, entries[index]!, index, selectedObjectId, selectedFocusId);
    },
    clear() { setEntries([]); },
    inspect() { return Object.freeze({ entries: entries.length, connectedRows: active.size, spareRows: spare.length }); },
    destroy() {
      scrollTarget.removeEventListener('scroll', invalidate);
      if (frame !== null) windowTarget.cancelAnimationFrame(frame);
      frame = null;
      entries = [];
      active.clear();
      spare.length = 0;
      list.replaceChildren();
      list.style.height = '';
      delete list.dataset.catalogueWindow;
    },
  });
}
