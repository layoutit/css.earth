import { PREPARED_NAVIGATION_MARKERS } from '../prepared-navigation-markers.mjs';
import type { BrowserWindow } from '../browser/browser-types.mts';
import type { CatalogueRow } from './catalogue-index.mts';
import { markerStyle } from '@cssearth/renderer/navigation/marker-presentation.ts';

/** A search result row is 48 px (a 40 px preview beside a name and a subtitle) with an 8 px gap. */
const ROW_PITCH = 56;
const PREVIEW_PIXELS = 40;
const OVERSCAN_ROWS = 6;
const MAX_WINDOW_ROWS = 28;
const THUMBNAIL_SCALE = 14 / Math.max(...Object.values(PREPARED_NAVIGATION_MARKERS)
  .map(({ presentation }) => presentation.size));

/** A pooled row. Its subtitle spans are retained; `entry` is what they show, so a row keeps its nodes until it shows another entry. */
interface RowView {
  readonly item: HTMLLIElement; readonly anchor: HTMLAnchorElement; index: number; entry: CatalogueRow | null;
  readonly kind: HTMLSpanElement; readonly value: HTMLSpanElement; readonly unit: HTMLSpanElement;
}
export type CatalogueSelection = Readonly<{ kind: CatalogueRow['kind']; id: string }> | null;

/** The prepared search thumbnail of a scene object with a context sprite (`packages/bake/src/site-assets/prepare-search-thumbnails.ts`). */
export function searchPreviewUrl(objectId: string): string | null {
  return PREPARED_NAVIGATION_MARKERS[objectId]?.context ? `/navigation/search/${objectId}@2x.webp` : null;
}

function renderMarker(documentTarget: Document, entry: CatalogueRow) {
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
  const kind = documentTarget.createElement('span');
  kind.className = 'object-kind';
  const value = documentTarget.createElement('span');
  value.className = 'object-distance-value';
  const unit = documentTarget.createElement('span');
  unit.className = 'object-distance-unit';
  return { item, anchor, index: -1, entry: null, kind, value, unit };
}

function bindRow(documentTarget: Document, view: RowView, entry: CatalogueRow, index: number, selection: CatalogueSelection) {
  const { item, anchor } = view;
  view.index = index;
  item.style.position = 'absolute';
  item.style.insetInline = '0';
  item.style.top = `${index * ROW_PITCH}px`;
  item.dataset.catalogueIndex = String(index);
  item.setAttribute('aria-posinset', String(index + 1));

  anchor.href = entry.route;
  anchor.dataset.sourceSubject = entry.source.subject;
  anchor.dataset.sourceDocument = entry.source.document;
  anchor.dataset.sourceLabel = entry.source.label;
  // A system row is a plain link to the system's overview, as the object list's overview rows are.
  if (entry.kind === 'scene') anchor.dataset.objectId = entry.id; else delete anchor.dataset.objectId;
  if (entry.kind === 'prepared-focus') anchor.dataset.preparedFocusId = entry.id; else delete anchor.dataset.preparedFocusId;
  const selected = selection?.kind === entry.kind && selection.id === entry.id;
  anchor.classList.toggle('is-active', selected);
  if (selected) anchor.setAttribute('aria-current', 'page');
  else anchor.removeAttribute('aria-current');

  if (view.entry === entry) return;
  view.entry = entry;
  const icon = anchor.children[0] as HTMLElement;
  icon.replaceChildren(renderMarker(documentTarget, entry));
  (anchor.children[1] as HTMLElement).textContent = entry.name;
  const detail = anchor.children[2] as HTMLElement;
  detail.title = entry.detail.title;
  detail.ariaLabel = entry.detail.ariaLabel;
  // The subtitle: what the object is, then how far it is.
  const { kind, value, unit } = view;
  kind.textContent = `${entry.classificationName.charAt(0).toLocaleUpperCase('en')}${entry.classificationName.slice(1)} · `;
  if (entry.detail.value && entry.detail.unit) {
    value.textContent = entry.detail.value;
    unit.textContent = entry.detail.unit;
    detail.replaceChildren(kind, value, ' ', unit);
  } else {
    detail.replaceChildren(kind, entry.detail.text);
  }
}

/** A search's rows rendered once, with no window: the no-JavaScript search page lists every match. */
export function renderCatalogueRows(documentTarget: Document, list: HTMLUListElement, rows: readonly CatalogueRow[]) {
  list.replaceChildren(...rows.map((row, index) => {
    const view = createRow(documentTarget);
    bindRow(documentTarget, view, row, index, null);
    view.item.setAttribute('aria-setsize', String(rows.length));
    return view.item;
  }));
  list.style.height = `${Math.max(0, rows.length * ROW_PITCH - 8)}px`;
}

/** A fixed-size live DOM window over one search's rows. The find function sends them a page at a time: the list is sized
 * for every match, and scrolling to rows not received yet asks `onMissing` for the page that holds them. */
export function createCatalogueWindow({ documentTarget, windowTarget, list, scrollTarget, onMissing = () => {} }: {
  documentTarget: Document; windowTarget: BrowserWindow; list: HTMLUListElement; scrollTarget: HTMLElement; onMissing?(index: number): void;
}) {
  let entries: (CatalogueRow | undefined)[] = [];
  let selection: CatalogueSelection = null;
  let frame: number | null = null;
  let active = new Map<number, RowView>();
  const spare: RowView[] = [];
  // A no-JavaScript search response arrives with its rows already listed; they stay until the first live result replaces them.
  let adopted = false;

  list.dataset.catalogueWindow = '';
  /** Layout reads happen before any row is written, so a render never forces a second layout. */
  const measure = () => {
    const listTop = list.offsetTop;
    return { listTop: Number.isFinite(listTop) ? listTop : 0, scrollTop: scrollTarget.scrollTop || 0, height: scrollTarget.clientHeight || 420 };
  };
  const release = (index: number, view: RowView) => {
    view.item.remove();
    active.delete(index);
    spare.push(view);
  };
  const render = (measured?: ReturnType<typeof measure>) => {
    frame = null;
    if (!entries.length) return;
    const viewport = measured ?? measure();
    const relativeTop = Math.max(0, viewport.scrollTop - viewport.listTop);
    const visibleRows = Math.max(1, Math.ceil(viewport.height / ROW_PITCH));
    const start = Math.max(0, Math.floor(relativeTop / ROW_PITCH) - OVERSCAN_ROWS);
    const end = Math.min(entries.length, start + Math.min(MAX_WINDOW_ROWS, visibleRows + OVERSCAN_ROWS * 2));
    for (const [index, view] of active) {
      if (index < start || index >= end || !entries[index]) release(index, view);
    }
    let missing = -1;
    for (let index = start; index < end; index++) {
      const entry = entries[index];
      if (!entry) { if (missing < 0) missing = index; continue; }
      if (active.has(index)) continue;
      const view = spare.pop() ?? createRow(documentTarget);
      bindRow(documentTarget, view, entry, index, selection);
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
    if (missing >= 0) onMissing(missing);
  };
  const invalidate = () => {
    if (entries.length && frame === null) frame = windowTarget.requestAnimationFrame(() => render());
  };
  scrollTarget.addEventListener('scroll', invalidate, { passive: true });

  const cancelRender = () => {
    if (frame !== null) windowTarget.cancelAnimationFrame(frame);
    frame = null;
  };
  const adopt = () => {
    if (adopted) return;
    adopted = true;
    list.replaceChildren();
  };
  // Closing, an empty search and an object handoff need no viewport. Measuring
  // here forced the shell's pending style/layout work into the flight frame.
  const clear = () => {
    cancelRender();
    adopt();
    entries = [];
    for (const [index, view] of active) release(index, view);
    if (list.style.height !== '0px') list.style.height = '0px';
  };
  /** Show a new search: `total` matches, of which `rows` start at `offset`. */
  const setRows = (total: number, offset: number, rows: readonly CatalogueRow[]) => {
    if (!total) { clear(); return; }
    cancelRender();
    adopt();
    const viewport = measure();
    entries = new Array<CatalogueRow | undefined>(total);
    rows.forEach((row, index) => { entries[offset + index] = row; });
    for (const [index, view] of active) {
      const entry = entries[index];
      if (entry) bindRow(documentTarget, view, entry, index, selection);
      else release(index, view);
    }
    list.style.height = `${total * ROW_PITCH - 8}px`;
    render(viewport);
  };
  /** Add a later page of the search on screen. */
  const addRows = (offset: number, rows: readonly CatalogueRow[]) => {
    if (offset + rows.length > entries.length) return;
    rows.forEach((row, index) => { entries[offset + index] = row; });
    invalidate();
  };

  return Object.freeze({
    setRows,
    addRows,
    focus(index: number) {
      if (!Number.isInteger(index) || index < 0 || index >= entries.length) return false;
      cancelRender();
      const viewport = measure();
      const rowTop = viewport.listTop + index * ROW_PITCH;
      const rowBottom = rowTop + ROW_PITCH;
      const viewportBottom = viewport.scrollTop + viewport.height;
      const scrollTop = rowTop < viewport.scrollTop ? rowTop
        : rowBottom > viewportBottom ? rowBottom - viewport.height : viewport.scrollTop;
      if (scrollTop !== viewport.scrollTop) scrollTarget.scrollTop = scrollTop;
      render({ ...viewport, scrollTop });
      const row = active.get(index);
      row?.anchor.focus();
      return row !== undefined;
    },
    setSelection(next: CatalogueSelection) {
      selection = next;
      for (const [index, view] of active) bindRow(documentTarget, view, entries[index]!, index, selection);
    },
    clear,
    inspect() { return Object.freeze({ entries: entries.length, loaded: entries.filter(Boolean).length, connectedRows: active.size, spareRows: spare.length }); },
    destroy() {
      scrollTarget.removeEventListener('scroll', invalidate);
      cancelRender();
      entries = [];
      active.clear();
      spare.length = 0;
      list.replaceChildren();
      list.style.height = '';
      delete list.dataset.catalogueWindow;
    },
  });
}
