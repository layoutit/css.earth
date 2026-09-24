import { isRecord } from '@cssearth/core';
import { featureResult, matchFeatures, parseFeatureIndex, placeFeatures, PLACE_FEATURE_PREFIX } from './feature-search.mts';
import type { FeatureIndex, FeatureIndexPin, IndexedFeature } from './feature-search.mts';
import { FIND_QUERY_LIMIT } from './find-protocol.mts';
import type { FindResult } from './find-protocol.mts';

/** The search function's side of find-protocol.mts. */
interface FindData { readonly index: FeatureIndex; readonly places: ReadonlyMap<string, ReadonlyMap<string, unknown>>; }

async function readJson(url: URL, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${url.pathname} could not load: HTTP ${response.status}.`);
  return response.json();
}

async function readFindData(pin: FeatureIndexPin, origin: string, fetcher: typeof fetch): Promise<FindData> {
  const base = parseFeatureIndex(await readJson(new URL(pin.url, origin), fetcher), pin);
  const places = new Map<string, Map<string, unknown>>(), features: IndexedFeature[] = [...base.features];
  for (const placePin of base.places) {
    const catalog = await readJson(new URL(placePin.assetUrl, origin), fetcher);
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
const loaded = new Map<string, Promise<FindData>>();
function findData(pin: FeatureIndexPin, origin: string, fetcher: typeof fetch): Promise<FindData> {
  if (fetcher !== fetch) return readFindData(pin, origin, fetcher);
  const key = `${origin}:${pin.url}`;
  let pending = loaded.get(key);
  if (!pending) {
    loaded.clear();
    pending = readFindData(pin, origin, fetcher).catch(error => { loaded.delete(key); throw error; });
    loaded.set(key, pending);
  }
  return pending;
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: {
  'Content-Type': 'application/json; charset=utf-8',
  // Results depend only on the query and the deploy's pinned data.
  'Cache-Control': 'public, max-age=300' } });

/** The rows for a query, for the find API and the no-JavaScript search page alike. */
export async function findResults(pin: FeatureIndexPin, origin: string, query: string, objectId: string, fetcher: typeof fetch = fetch): Promise<FindResult[]> {
  const data = await findData(pin, origin, fetcher);
  return matchFeatures(data.index, query.slice(0, FIND_QUERY_LIMIT), objectId).map(feature => {
    const lensIds = feature.id.startsWith(PLACE_FEATURE_PREFIX) ? undefined : data.index.objects.find(object => object.id === feature.objectId)?.lensIds;
    return { objectId: feature.objectId, id: feature.id, ...featureResult(feature, data.index, objectId), ...(lensIds ? { lensIds } : {}) };
  });
}

export async function handleFindRequest(request: Request, pin: FeatureIndexPin, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const url = new URL(request.url);
  const objectId = url.searchParams.get('object') ?? '';
  if (!/^[a-z][a-z0-9-]*$/u.test(objectId)) return json({ error: 'Pass object=<body id>.' }, 400);
  const query = url.searchParams.get('q'), placeId = url.searchParams.get('place');
  if ((query === null) === (placeId === null)) return json({ error: 'Pass either q or place.' }, 400);
  if (placeId !== null) {
    if (!/^[0-9]+$/u.test(placeId)) return json({ error: 'A place id is a number.' }, 400);
    const place = (await findData(pin, url.origin, fetcher)).places.get(objectId)?.get(placeId);
    return place === undefined ? json({ error: 'No such place.' }, 404) : json({ place });
  }
  return json({ results: await findResults(pin, url.origin, query!, objectId, fetcher) });
}
