import { explorationArray, explorationId, explorationRecord, explorationText, explorationUrl, parseAgencies, parseExplorationCatalog } from './exploration-catalog.mts';
import type { Agency } from './exploration-catalog.mts';
import { parseContributionGraph } from './exploration-contributions.mts';
export interface ExplorationImage { readonly id: string; readonly src: string; readonly width: number; readonly height: number; readonly bytes: number; readonly sha256: string; readonly kind: string; readonly sourceUrl: string; readonly credit: string; }
export function parseExplorationImage(raw: unknown): ExplorationImage {
  const image = explorationRecord(raw, ['id', 'src', 'width', 'height', 'bytes', 'sha256', 'kind', 'sourceUrl', 'credit']);
  const number = (input: unknown) => { if (typeof input !== 'number' || !Number.isSafeInteger(input) || input <= 0) throw new TypeError('Invalid artwork dimensions/bytes.'); return input; };
  const src = explorationText(image.src), sha256 = explorationText(image.sha256);
  if (!/^\/shell\/spacecraft-(renders|emblems)\/[a-z0-9-]+\.(webp|png)$/.test(src) || !/^[a-f0-9]{64}$/.test(sha256)) throw new TypeError('Invalid artwork identity.');
  return Object.freeze({ id: explorationId(image.id), src, sha256, width: number(image.width), height: number(image.height), bytes: number(image.bytes), kind: explorationText(image.kind), sourceUrl: explorationUrl(image.sourceUrl), credit: explorationText(image.credit) });
}
export function parsePreparedExploration(input: unknown) {
  const value = explorationRecord(input, ['schema', 'catalog', 'agencies', 'images', 'emblems', 'graph', 'closure']);
  if (value.schema !== 'cssearth-prepared-exploration@1') throw new TypeError('Unsupported prepared exploration catalogue.');
  const agencies: Readonly<Record<string, Agency>> = parseAgencies(value.agencies);
  const catalog = parseExplorationCatalog(value.catalog, agencies);
  const assets = (raw: unknown) => {
    const images = explorationArray(raw, parseExplorationImage);
    if (new Set(images.map(image => image.id)).size !== images.length) throw new TypeError('Duplicate exploration artwork.');
    return Object.freeze(Object.fromEntries(images.map(image => [image.id, image])));
  };
  const images = assets(value.images), emblems = assets(value.emblems);
  for (const entity of [...catalog.spacecraft, ...catalog.missions]) if (entity.imageId && !Object.hasOwn(images, entity.imageId)) throw new TypeError('Unknown exploration image.');
  for (const mission of catalog.missions) if (mission.emblemId && !Object.hasOwn(emblems, mission.emblemId)) throw new TypeError('Unknown mission emblem.');
  const closure = Object.freeze(Object.fromEntries(Object.entries(explorationRecord(value.closure)).map(([path, raw]) => {
    const sha256 = explorationText(raw);
    if (!/^[a-f0-9]{64}$/.test(sha256) || path.startsWith('/') || path.split('/').includes('..')) throw new TypeError('Invalid exploration closure pin.');
    return [path, sha256];
  })));
  if (!Object.keys(closure).length) throw new TypeError('Exploration closure is empty.');
  return Object.freeze({ catalog, agencies, images, emblems, graph: parseContributionGraph(value.graph, catalog), closure });
}
