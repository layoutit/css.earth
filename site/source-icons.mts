import { isRecord } from '@cssearth/core';

/** A site the Sources tab links to, and its favicon when the site serves one (`site/build/prepare/refresh-source-icons.mts`). */
export interface SourceIcon { readonly sourceUrl: string; readonly src?: string; readonly assetUrl?: string; readonly bytes?: number }

const url = (value: unknown): value is string => typeof value === 'string' && /^https?:\/\/[^\s]+$/u.test(value);

/** The recorded icons by key: a link's host, or a DOI registrant prefix (`sourceIconKey`). */
export function parseSourceIcons(input: unknown): Readonly<Record<string, SourceIcon>> {
  if (!isRecord(input)) throw new TypeError('Invalid source icons: site/source/source-icons.json must be an object of icons by key.');
  return Object.freeze(Object.fromEntries(Object.entries(input).map(([key, raw]) => {
    if (!/^(?:doi:10\.\d+|[a-z0-9][a-z0-9.-]*)$/u.test(key) || !isRecord(raw) || !url(raw.sourceUrl))
      throw new TypeError(`Invalid source icon ${key}: it needs a host or doi: key and a sourceUrl.`);
    if (raw.src === undefined) {
      if (raw.assetUrl !== undefined || raw.bytes !== undefined) throw new TypeError(`Incomplete source icon ${key}: assetUrl and bytes need a src.`);
      return [key, Object.freeze({ sourceUrl: raw.sourceUrl })];
    }
    if (typeof raw.src !== 'string' || !/^\/shell\/source-icons\/[a-z0-9-]+\.webp$/u.test(raw.src) || !url(raw.assetUrl)
      || typeof raw.bytes !== 'number' || !Number.isSafeInteger(raw.bytes) || raw.bytes <= 0)
      throw new TypeError(`Invalid source icon ${key}: src must be a /shell/source-icons/ WebP with its assetUrl and byte count.`);
    return [key, Object.freeze({ sourceUrl: raw.sourceUrl, src: raw.src, assetUrl: raw.assetUrl, bytes: raw.bytes })];
  })));
}
