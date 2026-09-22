import { record, safeArchiveUrl } from './types';

/** Recognition cutouts are separate from the source catalogue and archive-query identity. */
export interface MessierPresentationObject {
  objectId: string;
  displayType?: string;
  thumbnail: {
    url: string; localPath?: string; sourceUrl: string; credit: string; fieldArcsec: number;
    bytes?: number; width?: number; height?: number;
  };
  extent?: { majorArcsec: number; minorArcsec: number | null; sourceUrl: string; label: string; notes?: string };
  facts?: { constellation: string; visualMagnitude: number | null; magnitudeUncertaintyFlag: string; sourceUrl: string };
}
export interface MessierPresentation {
  schema: 'cssearth-messier-presentation@1';
  objects: MessierPresentationObject[];
}
function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
function text(value: unknown): value is string { return typeof value === 'string' && value.length > 0; }
export function readMessierPresentation(value: unknown): MessierPresentation {
  if (!record(value) || value.schema !== 'cssearth-messier-presentation@1' || !Array.isArray(value.objects) || value.objects.length !== 110) {
    throw new TypeError('Invalid Messier presentation catalogue.');
  }
  const ids = new Set<string>();
  for (const object of value.objects) {
    if (!record(object) || !text(object.objectId) || !/^m([1-9]|[1-9][0-9]|10[0-9]|110)$/.test(object.objectId) || ids.has(object.objectId)) {
      throw new TypeError('Missing or duplicate presentation object.');
    }
    ids.add(object.objectId);
    if (object.displayType !== undefined && (!text(object.displayType) || !/^[a-z]+(?:-[a-z]+)*$/.test(object.displayType))) {
      throw new TypeError('Invalid sourced presentation object type.');
    }
    const t = object.thumbnail;
    if (!record(t) || !safeArchiveUrl(t.url) || !safeArchiveUrl(t.sourceUrl) || !text(t.credit) || !positive(t.fieldArcsec) ||
        (t.localPath !== undefined && t.localPath !== `.local/nebula-lab/catalogue/messier/thumbnails/${object.objectId}.jpg`) ||
        ['bytes', 'width', 'height'].some(key => t[key] !== undefined && (!positive(t[key]) || !Number.isInteger(t[key])))) {
      throw new TypeError('Invalid Messier recognition thumbnail.');
    }
    if (t.localPath !== undefined && t.bytes === undefined) throw new TypeError('Unpinned thumbnail cache.');
    const extent = object.extent;
    if (extent !== undefined && (!record(extent) || !positive(extent.majorArcsec) ||
        !(extent.minorArcsec === null || positive(extent.minorArcsec) && extent.minorArcsec <= extent.majorArcsec) ||
        !safeArchiveUrl(extent.sourceUrl) || !text(extent.label) || (extent.notes !== undefined && !text(extent.notes)))) {
      throw new TypeError('Invalid Messier object extent.');
    }
    const facts = object.facts;
    if (facts !== undefined && (!record(facts) || !text(facts.constellation) || !safeArchiveUrl(facts.sourceUrl) ||
        !(facts.visualMagnitude === null || typeof facts.visualMagnitude === 'number' && Number.isFinite(facts.visualMagnitude)) ||
        !['', ':', '*'].includes(String(facts.magnitudeUncertaintyFlag)))) throw new TypeError('Invalid sourced object facts.');
  }
  return value as unknown as MessierPresentation;
}
