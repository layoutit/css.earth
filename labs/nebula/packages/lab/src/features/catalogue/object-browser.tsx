import { useState, type KeyboardEvent } from 'react';
import type { MessierObject } from './types';
import type { MessierPresentationObject } from './presentation';

/** Recognition images have their own footprint; it is never an object's measured extent. */
export type ObjectAppearance = Pick<MessierPresentationObject, 'thumbnail' | 'extent' | 'facts' | 'displayType'>;
export type ObjectSort = 'size' | 'number' | 'name';
export function displayObjectType(object: MessierObject, appearance?: ObjectAppearance) { return appearance?.displayType ?? object.type; }
export function objectExtent(object: MessierObject, appearance?: ObjectAppearance) {
  return appearance?.extent ?? { majorArcsec: object.majorArcmin === null ? null : object.majorArcmin * 60,
    minorArcsec: object.minorArcmin === null ? null : object.minorArcmin * 60,
    sourceUrl: '', label: 'SIMBAD catalogue extent', notes: object.notes };
}
export function orderObjects(objects: MessierObject[], sort: ObjectSort, appearances: ReadonlyMap<string, ObjectAppearance>) {
  return [...objects].sort((a, b) => {
    if (sort === 'size') return (objectExtent(b, appearances.get(b.id)).majorArcsec ?? -1) -
      (objectExtent(a, appearances.get(a.id)).majorArcsec ?? -1) || a.messier - b.messier;
    if (sort === 'name') return a.name.localeCompare(b.name) || a.messier - b.messier;
    return a.messier - b.messier;
  });
}
export function arcseconds(value: number | null): string {
  return value === null ? 'Size unknown' : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}″`;
}
export function CatalogueThumbnail({ url, fallback, alt, className = '' }: { url: string; fallback?: string; alt: string; className?: string }) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const src = failedUrls.includes(url) && fallback ? fallback : url;
  return failedUrls.includes(src) ? <span className={`catalogue-thumbnail catalogue-no-preview ${className}`} role="img" aria-label={`${alt} unavailable`}>No preview</span> :
    <img className={`catalogue-thumbnail ${className}`} src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailedUrls(previous => [...previous, src])} />;
}
export function ObjectBrowser({ objects, selectedId, appearances, chooseObject, localFile }: {
  objects: MessierObject[]; selectedId: string; appearances: ReadonlyMap<string, ObjectAppearance>;
  chooseObject: (id: string) => void; localFile: (path: string) => string;
}) {
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const current = objects.findIndex(object => object.id === selectedId);
    const next = event.key === 'ArrowDown' ? Math.min(objects.length - 1, current + 1) :
      event.key === 'ArrowUp' ? Math.max(0, current - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? objects.length - 1 : -1;
    if (next < 0 || !objects[next]) return;
    event.preventDefault(); chooseObject(objects[next].id);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-object-id="${objects[next].id}"]`)?.focus();
  }
  return <div className="catalogue-object-list" role="listbox" aria-label="Select Messier object" onKeyDown={navigate}>
    {objects.map((object, index) => {
      const appearance = appearances.get(object.id), thumbnail = appearance?.thumbnail, extent = objectExtent(object, appearance);
      return <button type="button" role="option" key={object.id} data-object-id={object.id} aria-selected={selectedId === object.id}
        tabIndex={selectedId === object.id || !objects.some(value => value.id === selectedId) && index === 0 ? 0 : -1}
        className="catalogue-object-card" onClick={() => chooseObject(object.id)}>
        {thumbnail ? <CatalogueThumbnail url={thumbnail.localPath ? localFile(thumbnail.localPath) : thumbnail.url} fallback={thumbnail.url}
          alt={`M${object.messier} sky preview`} /> : <span className="catalogue-thumbnail catalogue-no-preview">No preview</span>}
        <span className="catalogue-object-caption"><strong>M{object.messier} <span title={`${extent.label}${extent.notes ? ` · ${extent.notes}` : ''}`}>{arcseconds(extent.majorArcsec)}</span></strong>
          <span className="catalogue-object-name">{object.name}</span><small>{displayObjectType(object, appearance)}</small></span>
      </button>;
    })}
    {!objects.length && <p className="catalogue-empty">No matching objects.</p>}
  </div>;
}
