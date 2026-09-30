import { isRecord } from '@cssearth/core';

/** A body's surface panoramas as its card lists them: `prepared/panoramas.json` (cssearth-surface-panorama-list@2). */
export interface PanoramaListEntry {
  readonly id: string; readonly title: string; readonly when: string; readonly camera: string;
  readonly credit: string; readonly pageUrl: string; readonly thumbnail: string;
  readonly site: { readonly latitudeDeg: number; readonly longitudeDegEast: number; readonly localization: string };
}
export interface PanoramaList { readonly source: { readonly label: string; readonly url: string }; readonly panoramas: readonly PanoramaListEntry[] }

const text = (value: unknown, at: string): string => { if (typeof value !== 'string' || !value) throw new TypeError(`${at} must be text.`); return value; };
const https = (value: unknown, at: string): string => { const url = text(value, at); if (!/^https:\/\//u.test(url)) throw new TypeError(`${at} must be an https link.`); return url; };

export function parsePanoramaList(value: unknown, objectId: string): PanoramaList {
  if (!isRecord(value) || value.schema !== 'cssearth-surface-panorama-list@2' || value.objectId !== objectId || !isRecord(value.source) || !Array.isArray(value.panoramas)) {
    throw new TypeError(`${objectId}: prepared/panoramas.json is not a surface panorama list for this object.`);
  }
  const source = { label: text(value.source.label, `${objectId} panorama source`), url: https(value.source.url, `${objectId} panorama source`) };
  const panoramas = value.panoramas.map((item, index) => {
    const at = `${objectId} panoramas[${index}]`;
    if (!isRecord(item) || !isRecord(item.site)) throw new TypeError(`${at} is incomplete.`);
    const { latitudeDeg, longitudeDegEast } = item.site;
    if (typeof latitudeDeg !== 'number' || typeof longitudeDegEast !== 'number' || !Number.isFinite(latitudeDeg) || !Number.isFinite(longitudeDegEast)) throw new TypeError(`${at} site is not a position.`);
    const thumbnail = text(item.thumbnail, `${at} thumbnail`);
    if (!/^(?:\/scenes\/|https:\/\/)/u.test(thumbnail)) throw new TypeError(`${at} thumbnail must be a scene address.`);
    return { id: text(item.id, `${at} id`), title: text(item.title, `${at} title`), when: text(item.when, `${at} date`), camera: text(item.camera, `${at} camera`),
      credit: text(item.credit, `${at} credit`), pageUrl: https(item.pageUrl, `${at} page`), thumbnail,
      site: { latitudeDeg, longitudeDegEast, localization: text(item.site.localization, `${at} localisation`) } };
  });
  return { source, panoramas };
}
