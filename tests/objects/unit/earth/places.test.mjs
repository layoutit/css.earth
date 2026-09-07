import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { searchDestinations } from "../../../../site/destination-search.mjs";
import { PREPARED_EARTH_PLACES, PREPARED_EARTH_SCENE, PREPARED_GEOGRAPHIC_LENSES, earthPreparationConfig, earthSourceDirectory, objectControls } from "./prepared-fixture.mjs";
import { preparePlaceCatalog } from "../../../../tools/objects/geographic-pages/places.mjs";
import { prepareDestinationPacks } from "../../../../tools/prepare-destination-packs.mjs";
import { searchDestinationIndex, createDestinationStore } from "../../../../src/renderers/css/dist/testing.js";
import { prepareCityPageGeometry, createCityGeographicSampler } from "../../../../tools/objects/geographic-pages/page-geometry.mjs";
import { pageCoordinates, prepareLocationPoint } from "../../../../tools/objects/geographic-pages/prepare-location.mjs";
import { readPlaceSources, sourceRows } from "../../../../tools/objects/geographic-pages/operations/place-sources.mjs";
const preparationContext={sourceDirectory:earthSourceDirectory,config:earthPreparationConfig,scene:PREPARED_EARTH_SCENE,
 inventory:PREPARED_GEOGRAPHIC_LENSES,defaultLens:objectControls.lenses.defaultLens};
const placesDirectory=new URL('../../../../src/planets/earth/source/places/',import.meta.url);

const packed = await readFile(new URL(`../../../../public${PREPARED_EARTH_PLACES.url}`, import.meta.url));
const bytes = gunzipSync(packed);
const directory = JSON.parse(bytes);
let hierarchy;
const catalog = await preparePlaceCatalog({ ...preparationContext, onReceipt: value => { hierarchy = value; } }), { places } = catalog;
const search = JSON.parse(gunzipSync(await readFile(new URL(`../../../../public${directory.search.url}`, import.meta.url))));

test("prepared city catalogue is pinned, distinct and globally distributed", () => {
  assert.equal(packed.length, PREPARED_EARTH_PLACES.bytes);
  assert.equal(createHash("sha256").update(packed).digest("hex"), PREPARED_EARTH_PLACES.sha256);
  assert.equal(bytes.length, PREPARED_EARTH_PLACES.decodedBytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), PREPARED_EARTH_PLACES.decodedSha256);
  assert.equal(places.length, PREPARED_EARTH_PLACES.count);
  assert.equal(new Set(places.map(place => place.id)).size, places.length);
  for (const name of ["Buenos Aires", "Tokyo", "Nairobi", "Lagos", "Paris", "Sydney", "New York City"]) {
    const result = searchDestinations(places, name)[0];
    assert.ok(result, name);
    assert.ok(Object.values(result.camera).every(Number.isFinite), name);
  }
});

test("city search supports accents, aliases, duplicate names and country disambiguation", () => {
  assert.equal(searchDestinations(places, "buenos aires argentina")[0].id, "3435910");
  assert.equal(searchDestinations(places, "sao paulo")[0].id, searchDestinations(places, "São Paulo")[0].id);
  assert.equal(searchDestinations(places, "東京")[0].id, searchDestinations(places, "Tokyo")[0].id);
  const cities = searchDestinations(places, "Paris");
  assert.ok(cities.length > 1);
  assert.ok(cities.every(city => city.context));
  assert.equal(searchDestinations(places, "Paris Texas")[0].id, "4717560");
  assert.deepEqual(searchDestinations(places, ""), []);
  assert.deepEqual(searchDestinations(places, "qqqzzzimpossiblecity"), []);
  assert.ok(searchDestinations(places, "san").length <= 8);
});

test("city destinations use source coverage to choose detail or overview", () => {
  const buenosAires = places.find(place => place.id === "3435910");
  const tokyo = searchDestinations(places, "Tokyo")[0];
  assert.equal(buenosAires.coverage, "detail");
  assert.equal(buenosAires.camera.zoom, 1024);
  assert.equal(tokyo.coverage, "detail");
  assert.equal(tokyo.camera.zoom, 1024);
});

test("prepared location inverse agrees with the imagery projection across face boundaries", () => {
  for (const [longitude, latitude] of [[-58.37723, -34.61315], [112.5, 32.5], [179.99, -17], [-179.99, -17], [24.94, 60.17]]) {
    const lon = (longitude + 360) % 360;
    const page = prepareCityPageGeometry({ level: 0, x: Math.floor(lon / 11.25), y: Math.floor((latitude + 90) / 11.25) }, PREPARED_EARTH_SCENE);
    const uv = pageCoordinates(page, longitude, latitude);
    const actual = createCityGeographicSampler(page)(...uv);
    assert.ok(Math.abs(actual[0] - lon) < 1e-9);
    assert.ok(Math.abs(actual[1] - latitude) < 1e-9);
    assert.ok(prepareLocationPoint(PREPARED_EARTH_SCENE, longitude, latitude).every(Number.isFinite));
  }
});

test("polar destinations land on the accepted visible cap, including its apron", () => {
  for (const [longitude,latitude] of [[15.6469,78.2232],[45,82],[-45,-82]]) {
    const cap=prepareCityPageGeometry({level:0,x:0,y:latitude>0?15:0},PREPARED_EARTH_SCENE);
    const point=prepareLocationPoint(PREPARED_EARTH_SCENE,longitude,latitude);
    const p=cap.geographicProjection,m=p.matrix;
    assert.equal(point[2],m[14]);
    const dx=point[0]-m[12],dy=point[1]-m[13],det=m[0]*m[5]-m[4]*m[1];
    const x=(dx*m[5]-dy*m[4])/det,y=(dy*m[0]-dx*m[1])/det;
    const u=(x-p.x0)/(p.x1-p.x0),v=(y-p.y0)/(p.y1-p.y0);
    assert.ok(u>=0&&u<=1&&v>=0&&v<=1);
    const actual=createCityGeographicSampler(cap)(u,v);
    const longitudeError=((actual[0]-longitude+540)%360)-180;
    assert.ok(Math.abs(longitudeError)<1e-7);
    assert.ok(Math.abs(actual[1]-latitude)<1e-7);
  }
});


test("indexed search preserves source ranking including partial tokens, aliases and context", () => {
  const queries = ["buenos aires argentina", "sao paulo", "São Paulo", "東京", "Tokyo", "Paris", "Paris Texas", "", "qqqzzzimpossiblecity", "san", "Argentina", "London", "ond", "london uk", "santa cruz bolivia", "Cordoba", "Κόρινθος", "Москва", "Nairobi", "Sydney", "USA"];
  // Deterministic source samples cover less prominent labels as well as common names.
  for (let i = 0; i < places.length; i += 701) queries.push(places[i].name, places[i].names[0].slice(1));
  for (const query of queries) assert.deepEqual(searchDestinationIndex(search, query).map(p => p.id), searchDestinations(places, query).map(p => p.id), query);
});

test("all entity IDs resolve with source-identical details inside the bounded cache", async () => {
  const store = createDestinationStore({ catalog: PREPARED_EARTH_PLACES,
    fetcher: async url => new Response(await readFile(new URL(`../../../../public${url}`, import.meta.url))) });
  const expected = new Map(places.map(({ names, searchContext, ...place }) => [place.id, place]));
  for (const [id] of directory.entries) {
    const result = await store.resolve(id);
    assert.deepEqual(result.entity, expected.get(id), id);
    assert.ok(result.ancestors.length <= 2);
  }
  assert.equal(await store.resolve("unknown"), null);
  assert.equal(store.stats().searchDecodedBytes, 0, "Direct lookup never loads search");
  assert.ok(store.stats().peakDetailPacks <= store.stats().limits.detailCachePacks);
  assert.ok(store.stats().peakDetailBytes <= store.stats().limits.detailCacheBytes);
  store.dispose(); assert.equal(store.stats().detailDecodedBytes, 0);
});

test("all source country, ADM1 and city IDs survive, with their deepest verified parent chain", async () => {
  const { sources } = await readPlaceSources({directory:placesDirectory});
  const countries = sourceRows(sources.get("countryInfo.txt"));
  const admins = sourceRows(sources.get("admin1CodesASCII.txt"));
  const cities = sourceRows(sources.get("cities15000.zip"));
  const byId = new Map(places.map(place => [place.id, place]));
  const adminByCode = new Map(admins.map(row => [row[0], row]));
  assert.equal(places.length, countries.length + admins.length + cities.length);
  for (const row of countries) {
    const entity = byId.get(`country:${row[0]}`);
    assert.equal(entity.identifiers.geonames, row[16]);
    assert.equal(entity.parentId, "earth");
  }
  for (const row of admins) {
    const entity = byId.get(`admin1:${row[3]}`);
    assert.equal(entity.identifiers.geonames, row[3]);
    assert.equal(entity.parentId, `country:${row[0].split(".")[0]}`);
    assert.equal(entity.sourceRecord.featureCode, "ADM1");
  }
  const unresolved = new Set(hierarchy.unresolvedCityParents.map(row => row.id));
  for (const row of cities) {
    const entity = byId.get(row[0]);
    assert.ok(entity, `legacy city ID ${row[0]}`);
    assert.equal(entity.latitude, Number(row[4]));
    assert.equal(entity.longitude, Number(row[5]));
    const admin = adminByCode.get(`${row[8]}.${row[10]}`);
    assert.equal(entity.parentId, admin ? `admin1:${admin[3]}` : `country:${row[8]}`);
    if (!admin && row[10] && row[10] !== "00") assert.ok(unresolved.has(row[0]), "missing parent codes must be enumerated");
  }
  for (const place of places) {
    const seen = new Set([place.id]); let parent = place.parentId;
    while (parent !== "earth") {
      assert.ok(byId.has(parent), `missing parent ${parent}`);
      assert.ok(!seen.has(parent), `cycle ${parent}`); seen.add(parent); parent = byId.get(parent).parentId;
    }
  }
  for (const id of [...hierarchy.countryPointViews, ...hierarchy.adminPointViews]) {
    assert.equal(byId.get(id).navigation.kind, "source-point");
    assert.equal("bounds" in byId.get(id).navigation, false);
  }
  for (const id of hierarchy.historical) {
    assert.equal(byId.get(id).sourceRecord.featureCode, "PCLH");
    assert.ok(byId.get(id).kindLabel.startsWith("Historical"));
  }
});

test("destination preparation reproduces every installed pack byte for byte", async () => {
  const first = prepareDestinationPacks(catalog, "/scenes/earth/");
  const second = prepareDestinationPacks(await preparePlaceCatalog(preparationContext), "/scenes/earth/");
  assert.deepEqual(first.reference, PREPARED_EARTH_PLACES);
  assert.deepEqual(second.reference, first.reference);
  for (const [url, payload] of first.outputs) {
    assert.deepEqual(payload, second.outputs.get(url), url);
    assert.deepEqual(payload, await readFile(new URL(`../../../../public${url}`, import.meta.url)), url);
  }
});
