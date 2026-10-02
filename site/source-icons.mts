import { isRecord } from '@cssearth/core';

/** A site the Sources tab links to, and the address of its favicon when the site serves one
 * (`site/build/prepare/refresh-source-icons.mts`). The page loads the icon from that address; no copy is kept. */
export interface SourceIcon { readonly sourceUrl: string; readonly assetUrl?: string }

const url = (value: unknown): value is string => typeof value === 'string' && /^https?:\/\/[^\s]+$/u.test(value);

/** The recorded icons by key: a link's host, or a DOI registrant prefix (`sourceIconKey`). */
export function parseSourceIcons(input: unknown): Readonly<Record<string, SourceIcon>> {
  if (!isRecord(input)) throw new TypeError('Invalid source icons: site/source/source-icons.json must be an object of icons by key.');
  return Object.freeze(Object.fromEntries(Object.entries(input).map(([key, raw]) => {
    if (!/^(?:doi:10\.\d+|[a-z0-9][a-z0-9.-]*)$/u.test(key) || !isRecord(raw) || !url(raw.sourceUrl))
      throw new TypeError(`Invalid source icon ${key}: it needs a host or doi: key and a sourceUrl.`);
    if (raw.assetUrl !== undefined && (!url(raw.assetUrl) || !raw.assetUrl.startsWith('https://')))
      throw new TypeError(`Invalid source icon ${key}: assetUrl must be an https address, which a secure page can load.`);
    return [key, Object.freeze({ sourceUrl: raw.sourceUrl, ...(raw.assetUrl === undefined ? {} : { assetUrl: raw.assetUrl }) })];
  })));
}
