import { isRecord } from '@cssearth/core';
import { featureResult, matchFeatures, parseFeatureIndex, placeFeatures, PLACE_FEATURE_PREFIX } from '../search/feature-search.mts';
import type { FeatureIndex, FeatureIndexPin, IndexedFeature } from '../search/feature-search.mts';
import { FIND_PAGE_ROWS, FIND_QUERY_LIMIT } from '../search/find-protocol.mts';
import type { FindResponse, FindResult } from '../search/find-protocol.mts';
import { searchObjects } from '../search/object-search.mts';
import { catalogueRow, type CatalogueIndexEntry } from '../search/catalogue-index.mts';
import { readPublicFile, type ReadPrepared, type SearchData } from './search-data.mts';
import { keptLoad } from './kept-load.mts';

/** The search function's side of search/find-protocol.mts. */
interface FindData { readonly index: FeatureIndex; readonly places: ReadonlyMap<string, ReadonlyMap<string, unknown>>; }

async function readFindData(pin: FeatureIndexPin, read: ReadPrepared): Promise<FindData> {
  const base = parseFeatureIndex(await read(pin.url), pin);
  const places = new Map<string, Map<string, unknown>>(), features: IndexedFeature[] = [...base.features];
  for (const placePin of base.places) {
    const catalog = await read(placePin.url);
    const expanded = placeFeatures(placePin, catalog);
    for (const [index, feature] of features.entries()) {
      const names = feature.objectId === placePin.objectId ? expanded.aliases.get(feature.id) : undefined;
      if (names) features[index] = { ...feature, searchNames: [...new Set([...feature.searchNames, ...names])] };
    }
    features.push(...expanded.features);
    const records = new Map<string, unknown>();
    for (const place of (catalog as { places: unknown[] }).places) if (isRecord(place)) records.set(String(place.id), place);
    places.set(placePin.objectId, records);
  }
  return { index: { ...base, features }, places };
}

// A warm function instance keeps the loaded data for its deploy, never results.
let kept: { readonly url: string; readonly data: () => Promise<FindData> } | undefined;
function findData(pin: FeatureIndexPin, read: ReadPrepared): Promise<FindData> {
  if (read !== readPublicFile) return readFindData(pin, read);
  if (kept?.url !== pin.url) kept = { url: pin.url, data: keptLoad(() => readFindData(pin, read)) };
  return kept.data();
}

/** Every result lists planets first, then by distance, then by name. A category query already excludes other classes, so it needs no
 * second order; a typed name ranks exact and leading matches first within this order (`searchObjects`). */
/** Two bodies of one system this close, as a fraction of their distance, count as equally far. */
const SAME_SYSTEM_DISTANCE = 1e-6;
function catalogueLabels(entries: readonly CatalogueIndexEntry[]) {
  return entries.map(entry => ({ entry, name: entry.name.toLocaleLowerCase('en'), names: entry.searchNames, classification: entry.classification,
    classificationName: entry.classificationName, systemName: entry.systemName, illustration: entry.illustration }))
    // The bodies of a far system differ in distance only by where each is on its orbit, a millionth of the way there;
    // the name orders them, digits as numbers: TRAPPIST-1's planets listed h, g, d, c, b, f, e (2026-10-01).
    .sort((a, b) => Number(b.classification === 'planet') - Number(a.classification === 'planet')
      || (a.systemName === b.systemName && Math.abs(a.entry.distanceMeters - b.entry.distanceMeters) <= SAME_SYSTEM_DISTANCE * Math.max(a.entry.distanceMeters, b.entry.distanceMeters)
        ? a.name.localeCompare(b.name, 'en', { numeric: true }) : a.entry.distanceMeters - b.entry.distanceMeters));
}
const catalogueLabelsByIndex = new WeakMap<readonly CatalogueIndexEntry[], ReturnType<typeof catalogueLabels>>();

/** One page of the objects a query matches, and the text its feature search runs on ('' for a category or system). */
export function findObjects(entries: readonly CatalogueIndexEntry[], query: string, { offset = 0, pageRows = FIND_PAGE_ROWS, illustrations = false }: {
  offset?: number; pageRows?: number; illustrations?: boolean;
} = {}) {
  let labels = catalogueLabelsByIndex.get(entries);
  if (!labels) catalogueLabelsByIndex.set(entries, labels = catalogueLabels(entries));
  const result = searchObjects(labels, query, { illustrations });
  return {
    objects: { total: result.matches.length, offset, rows: result.matches.slice(offset, offset + pageRows).map(match => catalogueRow(match.entry)) },
    classification: result.classification ?? null,
    detailQuery: result.detailQuery,
  };
}

/** The feature rows for a query, for the find API and the no-JavaScript search page alike. */
export async function findResults(pin: FeatureIndexPin, query: string, objectId: string, read: ReadPrepared = readPublicFile): Promise<FindResult[]> {
  const data = await findData(pin, read);
  return matchFeatures(data.index, query.slice(0, FIND_QUERY_LIMIT), objectId).map(feature => {
    const datasetIds = feature.id.startsWith(PLACE_FEATURE_PREFIX) ? undefined : data.index.objects.find(object => object.id === feature.objectId)?.datasetIds;
    return { objectId: feature.objectId, id: feature.id, ...featureResult(feature, data.index, objectId), ...(datasetIds ? { datasetIds } : {}) };
  });
}

// Results depend only on the query and the deploy's prepared data, and a deploy empties Netlify's cache. So the CDN
// keeps an answer for the deploy's life and shares it between its locations (`durable`): on the live site an answer
// from the edge took 0.16 s and one from the function 0.4 to 0.9 s, and with five minutes per location nearly every
// keystroke reached the function (2026-10-01). The browser still asks again after five minutes.
const CDN_CACHE = 'public, durable, max-age=31536000';
// Only a whole answer is kept: an error, or one whose feature data could not load, must be asked again.
const json = (value: unknown, status = 200, whole = status === 200) => new Response(JSON.stringify(value), { status, headers: {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': whole ? 'public, max-age=300' : 'no-store',
  ...(whole ? { 'Netlify-CDN-Cache-Control': CDN_CACHE } : {}) } });

export async function handleFindRequest(request: Request, { pin, read, catalogue }: SearchData): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const url = new URL(request.url);
  const objectId = url.searchParams.get('object') ?? '';
  if (!/^[a-z][a-z0-9-]*$/u.test(objectId)) return json({ error: 'Pass object=<body id>.' }, 400);
  const query = url.searchParams.get('q'), placeId = url.searchParams.get('place');
  if ((query === null) === (placeId === null)) return json({ error: 'Pass either q or place.' }, 400);
  if (placeId !== null) {
    if (!/^[0-9]+$/u.test(placeId)) return json({ error: 'A place id is a number.' }, 400);
    const place = pin ? (await findData(pin, read)).places.get(objectId)?.get(placeId) : undefined;
    return place === undefined ? json({ error: 'No such place.' }, 404) : json({ place });
  }
  const offsetText = url.searchParams.get('offset') ?? '0';
  if (!/^(?:0|[1-9][0-9]{0,5})$/u.test(offsetText)) return json({ error: 'An offset is a row number.' }, 400);
  const offset = Number(offsetText);
  const { objects, classification, detailQuery } = findObjects(await catalogue(), query!.slice(0, FIND_QUERY_LIMIT),
    { offset, illustrations: url.searchParams.get('illustrations') === '1' });
  let features: FindResult[] | null = [];
  if (offset === 0 && detailQuery && pin) {
    try { features = await findResults(pin, detailQuery, objectId, read); }
    catch (error) {
      // Objects still answer when the feature data cannot load; the page says feature names are unavailable.
      console.error('Feature search failed.', error);
      features = null;
    }
  }
  return json({ objects, classification, features } satisfies FindResponse, 200, features !== null);
}
