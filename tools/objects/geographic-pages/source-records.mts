import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../../sources/source-values.mts';
export type Decoder<T> = (value: unknown) => T;
export const text = requireString;
export const number = requireFiniteNumber;
export function numericSource(value: unknown): string | number {
  if (typeof value === "number") return number(value);
  const source = text(value);
  if (!source.trim() || !Number.isFinite(Number(source))) throw new TypeError("Expected finite source number");
  return source;
}
export const optional = <T,>(decode: Decoder<T>): Decoder<T | undefined> => value => value === undefined ? undefined : decode(value);
export const array = <T,>(decode: Decoder<T>): Decoder<T[]> => value => requireArray(value).map(decode);
export function boolean(value: unknown): boolean { if (typeof value !== 'boolean') throw new TypeError('Expected source boolean'); return value; }
export function shape<const T extends Record<string, Decoder<unknown>>>(fields: T): Decoder<{ -readonly [K in keyof T]: ReturnType<T[K]> }> {
  return value => {
    const source = requireRecord(value), result: Record<string, unknown> = { ...source };
    for (const [key, decode] of Object.entries(fields)) {
      try { const field = decode(source[key]); if (field !== undefined || Object.hasOwn(source, key)) result[key] = field; }
      catch (error) { throw new TypeError(`Geographic source ${key}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    return result as { -readonly [K in keyof T]: ReturnType<T[K]> };
  };
}
export const parseAddress = shape({ level: number, x: number, y: number });
export const parseBounds = shape({ west: number, east: number, south: number, north: number });
export const parseBodyAttitude = (value: unknown) => { const attitude = shape({ bodyMatrix: array(number) })(value); if (attitude.bodyMatrix.length !== 9) throw new TypeError('A body attitude is a 3 x 3 matrix.'); return attitude; };
export const parseGeographicScene = shape({ body: shape({ bands: array(shape({ latitudeIndex: number, leaves: array(shape({
  style: text, geographicFrameMatrix: optional(text), leafWidth: number })) })) }) });
export const worldCoverEntryFields = { tile: text, etag: text, sourceBytes: number, lastModified: optional(text), extractedSha256: optional(text) };
export const parseWorldCoverEntry = shape(worldCoverEntryFields);
export const parseWorldCoverSource = shape({ ...worldCoverEntryFields, url: text });
export const parseCatalogPin = shape({ schema: text, path: text, dataset: text, expectedBytes: number, expectedDecodedBytes: number,
  expectedSha256: text, tileCount: number, sourceBytes: number });
export const parseWorldCoverSnapshot = shape({ schema: text, dataset: text, bucket: text, prefix: text, entries: array(parseWorldCoverEntry) });
export const releaseFileFields = { filename: text, bytes: number, sha256: text, tiles: optional(number), leaves: optional(number) };
export const parseReleaseFile = shape(releaseFileFields);
const pinnedReleaseFields = { schema: text, version: text, files: array(parseReleaseFile), bytes: number, sourceSha256: text, dataset: text };
export const parsePinnedReleaseInventory = shape(pinnedReleaseFields);
export const parseWmtsRelease = shape({ ...pinnedReleaseFields, regions: number, tiles: number, leaves: number, qualification: text });
export const parseDelivery = shape({ bucket: text, accountId: text, keyPrefix: text, assetOrigin: text });
export const parseColor = shape({ bands: array(number), reflectanceWhite: number, gamma: number });
export const parseRegion = shape({ id: text, root: parseAddress, tile: optional(text), url: optional(text), etag: optional(text), sourceBytes: optional(number),
  extractedSha256: optional(text), sources: optional(array(parseWorldCoverSource)), unavailableTiles: optional(array(text)) });
export const parseCitySource = shape({ schema: text, dataset: text, sourcePage: text, credit: text, qualification: text, delivery: parseDelivery,
  regions: array(parseRegion), color: parseColor, presentation: shape({ maximumZoom: number, poolSize: number, maximumDecodedBytes: number,
    maximumConcurrentLoads: number, targetCssPixels: number }) });
export const presentationFields = { rasterScale: number, poolSize: number, decodedPageBytes: number, maximumDecodedBytes: number,
  maximumConcurrentLoads: number, minimumZoom: number, maximumZoom: number, targetCssPixels: number,
  pageTemplate: text, index: shape({ maximumDirectories: number, maximumBytes: number, maximumDirectoryBytes: number, maximumConcurrentLoads: number }) };
export const parsePageRecipe = shape({ schema: text, initialAddress: shape({ longitude: number, latitude: number, zoom: number }), presentation: shape(presentationFields) });
export const parsePreparationRecipe = shape({ geographic: shape({ pages: parsePageRecipe }) });
export const parsePlacesConfig = shape({ namespace: text, publicBase: text, sceneBodyKey: text,
  camera: shape({ maximumControlPitchDegrees: number, maximumScenePitchDegrees: number }),
  geographic: shape({ places: shape({ directory: text, coverageDirectory: text, detailZoom: number, overviewZoom: number }) }) });
export const parsePlacesManifest = shape({ inputs: array(shape({ path: text, bytes: number, sha256: text })), source: text,
  snapshotDate: text, qualification: text, sourcePage: text, license: text });
export const parseOverlayConfig = shape({ namespace: text, publicBase: text, sceneBodyKey: text,
  camera: shape({ maximumControlPitchDegrees: number, maximumScenePitchDegrees: number }),
  geographic: shape({ noise: shape({ directory: text, period: text, bounds: parseBounds, size: number, side: number, columns: number,
    opacity: number, coarse: parseAddress, dataset: text, assetOrigin: text, credit: text, poolSize: number,
    camera: shape({ longitude: number, latitude: number, zoom: number }) }) }) });
export const parseOverlayPin = shape({ file: text, bytes: number, sha256: text, decodedBytes: number, decodedSha256: text, features: number,
  qualification: text, year: number, license: text, sourcePage: text, id: text });
const polygon = array(array(array(number)));
const geometry = (value: unknown) => {
  const source = requireRecord(value);
  if (source.type === 'Polygon') return { type: 'Polygon' as const, coordinates: polygon(source.coordinates) };
  if (source.type === 'MultiPolygon') return { type: 'MultiPolygon' as const, coordinates: array(polygon)(source.coordinates) };
  throw new TypeError('Unexpected noise source geometry');
};
export const parseOverlayData = shape({ crs: shape({ properties: shape({ name: text }) }),
  features: array(shape({ geometry, properties: shape({ periodo: text, color: text, rango: text, dba_low: numericSource }) })) });
export const dictionary = <T,>(decode: Decoder<T>): Decoder<Record<string,T>> => value => Object.fromEntries(Object.entries(requireRecord(value)).map(([key,value])=>[key,decode(value)]));
const interval = (value: unknown): [number,number] => { const list=requireArray(value); if(list.length!==2)throw new TypeError('Coverage interval needs two bounds');return [number(list[0]),number(list[1])]; };
export const parseCoverage = shape({ zoom: number, firstRow: number, lastRow: number, tileCount: number, blockSide: number, blockCount: number,
  bands: array(shape({ y0: number, y1: number, ranges: array(interval) })) });
export const parseGlobalInputs = shape({ version: text, dataset: text, sourceSha256: text, hashes: dictionary(text), lastLevel: number,
  levels: array(parseCoverage), regions: number });
export const assetReferenceFields = { url: text, bytes: number, sha256: text };
export const parseAssetReference = shape(assetReferenceFields);
export const parseBlockReference = shape({ ...assetReferenceFields, encoding: text, offset: number, decodedBytes: number, decodedSha256: text });
const coverageParts = optional(array(shape({normal:array(number),corners:array(array(number))})));
const nodeFields = { key: text, level: number, corners: array(array(number)), normal: array(number), normalSlack: number, maximumCssSpan: number };
export const parseTileStub = shape({ ...nodeFields, stub: boolean, directory: parseBlockReference, coverageParts });
export const parseTileNode = shape({ ...nodeFields, pages: array(text), children: array(text) });
export const parseRegionReceipt = shape({ address: shape({zoom:number,x:number,y:number}), version: text, root: parseTileStub,
  sha256: text, bytes: number, tiles: number, leaves: number, sections: number, elapsedMs: number, stubRefinement: optional(text) });
export const parseIndexHead = shape({ key: text, level: number, corners: array(array(number)), normal: array(number), stub: boolean,
  directory: parseAssetReference, coverageCorners: optional(array(array(number))) });
export const parseCityPublish = shape({ mode: text, bucket: text, origin: text, webp: shape({objects:number,bytes:number}),
  json: shape({objects:number,bytes:number}), objects:number, bytes:number });
export const parseGlobalFaceReceipt = shape({ schema: text, dataset: text, catalogSha256: text, face: shape({level:number,x:number,y:number,key:text}),
  jobs:number, finePages:number, pages:number, sourceObjects:number, maximumWindowPixels:number, qualification:text,
  provenance:array(requireRecord), heads:array(shape({key:text,directory:parseAssetReference,level:optional(number),stub:optional(boolean),corners:optional(array(array(number))),normal:optional(array(number))})), publish:parseCityPublish, indexes:number, compressedBytes:number });
export const parsePublishedCoverage = shape({schema:text,dataset:text,expectedFaces:number,catalogSha256:text,faces:array(parseGlobalFaceReceipt)});
export const parseCoveragePlan = shape({ dataset:text, assetPath:optional(text), assetOrigin:text, roots:array(parseIndexHead) });
export const parseRuntimePages = shape({ schema:text,dataset:text,assetOrigin:text,geometryOrigin:optional(text),geometryVersion:optional(text),
  credit:text,sourcePage:text,qualification:text,roots:array(parseIndexHead) });
export const parseGlobalManifest = shape({schema:text,version:text,dataset:text,directory:text,complete:boolean,lastLevel:number,
  sourceSha256:text,regions:number,expectedRegions:number,tiles:number,expectedTiles:number,leaves:number,bytes:number,
  roots:array(parseTileStub),files:array(parseReleaseFile),packHashesVerified:boolean,qualification:text});

export function assertGlobalFaceReceipt(value: unknown): asserts value is ReturnType<typeof parseGlobalFaceReceipt> { parseGlobalFaceReceipt(value); }
