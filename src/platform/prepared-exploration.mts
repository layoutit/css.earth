import type { SourceResolver } from './source-catalog.mts';
import { explorationArray, explorationId, explorationRecord, explorationText, explorationUrl, parseAgencies, parseExplorationCatalog } from './exploration-catalog.mts';
import type { Agency } from './exploration-catalog.mts';
import { parseContributionGraph } from './exploration-contributions.mts';
export interface ExplorationSubject { readonly left: number; readonly top: number; readonly width: number; readonly height: number; }
export interface ExplorationImage { readonly id: string; readonly src: string; readonly width: number; readonly height: number; readonly bytes: number; readonly kind: string; readonly sourceUrl: string; readonly credit: string; readonly subject?: ExplorationSubject; }
export function parseExplorationImage(raw: unknown): ExplorationImage {
  const image = explorationRecord(raw, ['id', 'src', 'width', 'height', 'bytes', 'kind', 'sourceUrl', 'credit', 'subject']);
  const number = (input: unknown) => { if (typeof input !== 'number' || !Number.isSafeInteger(input) || input <= 0) throw new TypeError('Invalid artwork dimensions/bytes.'); return input; };
  const src = explorationText(image.src);
  if (!/^\/shell\/facility-(renders|emblems)\/[a-z0-9-]+\.(webp|png)$/.test(src)) throw new TypeError('Invalid artwork identity.');
  // Where the subject sits inside a composited render, so the card can show it
  // instead of the flat background it was rendered on.
  const subject = image.subject === undefined ? undefined : (() => {
    const box = explorationRecord(image.subject, ['left', 'top', 'width', 'height']);
    const offset = (value: unknown) => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new TypeError('Invalid artwork subject.'); return value; };
    const measured = Object.freeze({ left: offset(box.left), top: offset(box.top), width: number(box.width), height: number(box.height) });
    if (measured.left + measured.width > number(image.width) || measured.top + measured.height > number(image.height)) throw new TypeError('Artwork subject leaves the frame.');
    return measured;
  })();
  return Object.freeze({ id: explorationId(image.id), src, width: number(image.width), height: number(image.height), bytes: number(image.bytes), kind: explorationText(image.kind), sourceUrl: explorationUrl(image.sourceUrl), credit: explorationText(image.credit), ...(subject ? { subject } : {}) });
}
export function parsePreparedExploration(input: unknown, sources: SourceResolver) {
  const value = explorationRecord(input, ['schema', 'catalog', 'agencies', 'images', 'emblems', 'graph']);
  if (value.schema !== 'cssearth-prepared-exploration@3') throw new TypeError('Unsupported prepared exploration catalogue.');
  const agencies: Readonly<Record<string, Agency>> = parseAgencies(value.agencies);
  const catalog = parseExplorationCatalog(value.catalog, agencies, sources);
  const assets = (raw: unknown) => {
    const images = explorationArray(raw, parseExplorationImage);
    if (new Set(images.map(image => image.id)).size !== images.length) throw new TypeError('Duplicate exploration artwork.');
    return Object.freeze(Object.fromEntries(images.map(image => [image.id, image])));
  };
  const images = assets(value.images), emblems = assets(value.emblems);
  for (const entity of [...catalog.facilities, ...catalog.missions]) if (entity.imageId && !Object.hasOwn(images, entity.imageId)) throw new TypeError('Unknown exploration image.');
  for (const mission of catalog.missions) if (mission.emblemId && !Object.hasOwn(emblems, mission.emblemId)) throw new TypeError('Unknown mission emblem.');
  return Object.freeze({ catalog, agencies, images, emblems, graph: parseContributionGraph(value.graph, catalog) });
}
