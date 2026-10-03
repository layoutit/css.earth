import type { CatalogueRow } from './catalogue-index.mts';

const PREVIEW_PIXELS = 40;

/** A row with no observer distance leaves its detail out; every row uses the same retained view. */
export type ObjectResultEntry = Omit<CatalogueRow, 'detail'> & { readonly detail?: CatalogueRow['detail'] };
/** The selected object's row: its object's id. */
export type ObjectResultSelection = Readonly<{ id: string }> | null;

/** One retained row component for search results and server-rendered system members. */
export interface ObjectResultView {
  readonly item: HTMLLIElement; readonly anchor: HTMLAnchorElement; index: number; entry: ObjectResultEntry | null;
  readonly icon: HTMLSpanElement; readonly name: HTMLSpanElement; readonly detail: HTMLSpanElement;
  readonly kind: HTMLSpanElement; readonly value: HTMLSpanElement; readonly unit: HTMLSpanElement;
}

/** The prepared search thumbnail of a scene object with a context sprite, as its row's marker says (`preview`). */
export function searchPreviewUrl(marker: ObjectResultEntry['marker']): string | null {
  return marker.preview ? `/navigation/search/${marker.id}@2x.webp` : null;
}

function renderMarker(documentTarget: Document, entry: ObjectResultEntry) {
  const preview = searchPreviewUrl(entry.marker);
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
  // The row carries its sprite's styles (prepared-catalogue-index.mts): a page holds no table of every object's marker.
  const sprite = entry.marker.sprite;
  if (!sprite) throw new Error(`Result row ${entry.id} carries no prepared marker for ${entry.marker.id}: neither a search thumbnail nor a sprite.`);
  marker.className = `object-navigation-marker ${entry.marker.id}${sprite.ringStyle === undefined ? '' : ' ringed'}`;
  marker.style.cssText = sprite.style;
  marker.setAttribute('aria-hidden', 'true');
  const disk = documentTarget.createElement('i');
  disk.style.cssText = sprite.innerStyle;
  marker.append(disk);
  if (sprite.ringStyle !== undefined) {
    const ring = documentTarget.createElement('b');
    ring.className = 'object-navigation-ring';
    ring.style.cssText = sprite.ringStyle;
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
  anchor.dataset.objectId = entry.id;
  const selected = selection?.id === entry.id;
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
