import { record } from './browser-types.mts';

/**
 * Identifies the one shared, content-addressed object catalogue fragment
 * (`dist/catalogue/<sha256>.html`, built by `tools/build-catalogue-fragment.mts`
 * from `PlanetCatalogueRows.astro`). Every object page carries this same pin
 * on its `#object-category-results` panel. The server/no-JS search function
 * (`search-response.mts`) reads it, while the browser normally consumes the
 * compact JSON index pin below.
 */
export interface CatalogueFragmentPin { url: string; sha256: string; bytes: number; }
export interface CatalogueIndexPin { url: string; sha256: string; bytes: number; }

export function parseCatalogueFragmentPin(value: unknown): CatalogueFragmentPin {
  if (!record(value) || typeof value.url !== 'string' || !/^\/catalogue\/[a-f0-9]{64}\.html$/u.test(value.url)
    || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(value.sha256)
    || typeof value.bytes !== 'number' || !Number.isSafeInteger(value.bytes) || value.bytes <= 0) {
    throw new TypeError('Invalid object catalogue fragment pin.');
  }
  if (!value.url.includes(value.sha256)) throw new TypeError('Object catalogue fragment pin URL does not match its hash.');
  return { url: value.url, sha256: value.sha256, bytes: value.bytes };
}

export function parseCatalogueIndexPin(value: unknown): CatalogueIndexPin {
  if (!record(value) || typeof value.url !== 'string' || !/^\/catalogue\/[a-f0-9]{64}\.json$/u.test(value.url)
    || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(value.sha256)
    || typeof value.bytes !== 'number' || !Number.isSafeInteger(value.bytes) || value.bytes <= 0) {
    throw new TypeError('Invalid object catalogue index pin.');
  }
  if (!value.url.includes(value.sha256)) throw new TypeError('Object catalogue index pin URL does not match its hash.');
  return { url: value.url, sha256: value.sha256, bytes: value.bytes };
}

interface DatasetLike {
  catalogueSrc?: string;
  catalogueSha256?: string;
  catalogueBytes?: string;
  catalogueIndexSrc?: string;
  catalogueIndexSha256?: string;
  catalogueIndexBytes?: string;
}
interface DatasetHost { dataset: DatasetLike; }

/** Reads the pin from `#object-category-results`, in either a live document or a parsed one. Never throws. */
export function readCatalogueFragmentPin(panel: DatasetHost | null | undefined): CatalogueFragmentPin | null {
  if (!panel) return null;
  const { catalogueSrc, catalogueSha256, catalogueBytes } = panel.dataset;
  if (!catalogueSrc && !catalogueSha256 && !catalogueBytes) return null;
  try {
    return parseCatalogueFragmentPin({ url: catalogueSrc, sha256: catalogueSha256, bytes: catalogueBytes === undefined ? undefined : Number(catalogueBytes) });
  } catch {
    return null;
  }
}

/** Reads the compact runtime search-index pin. Never throws. */
export function readCatalogueIndexPin(panel: DatasetHost | null | undefined): CatalogueIndexPin | null {
  if (!panel) return null;
  const { catalogueIndexSrc, catalogueIndexSha256, catalogueIndexBytes } = panel.dataset;
  if (!catalogueIndexSrc && !catalogueIndexSha256 && !catalogueIndexBytes) return null;
  try {
    return parseCatalogueIndexPin({ url: catalogueIndexSrc, sha256: catalogueIndexSha256,
      bytes: catalogueIndexBytes === undefined ? undefined : Number(catalogueIndexBytes) });
  } catch {
    return null;
  }
}
