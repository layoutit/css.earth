import {shape,array,text,number} from '../../../../tools/objects/paged-ellipsoid/geographic/source-records.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { searchDestinations } from "../../../../site/destination-search.mts";
import { PREPARED_EARTH_PLACES } from "../../unit/earth/prepared-fixture.mts";
import { PREPARED_EARTH_SCENE } from "../../unit/earth/prepared-fixture.mts";
import { prepareCityPageGeometry, createCityGeographicSampler } from "../../../../tools/objects/paged-ellipsoid/geographic/page-geometry.mts";
import { pageCoordinates, prepareLocationPoint } from "../../../../tools/objects/paged-ellipsoid/geographic/prepare-location.mts";

const bytes = await readFile(new URL("../../../../public/scenes/earth/earth-places.json", import.meta.url));
const { places } = shape({places:array(shape({id:text,names:array(text),searchContext:text,context:text,coverage:text,camera:shape({controlPitch:number,controlYaw:number,zoom:number})}))})(JSON.parse(bytes.toString('utf8')));

test("prepared city catalogue is pinned, distinct and globally distributed", () => {
  assert.equal(bytes.length, PREPARED_EARTH_PLACES.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), PREPARED_EARTH_PLACES.sha256);
  assert.equal(places.length, PREPARED_EARTH_PLACES.count);
  assert.equal(new Set(places.map(place => place.id)).size, places.length);
  for (const name of ["Buenos Aires", "Tokyo", "Nairobi", "Lagos", "Paris", "Sydney", "New York City"]) {
    const result = required(searchDestinations(places, name)[0]);
    assert.ok(result, name);
    assert.ok(Object.values(result.camera).every(Number.isFinite), name);
  }
});

test("city search supports accents, aliases, duplicate names and country disambiguation", () => {
  assert.equal(required(searchDestinations(places, "buenos aires argentina")[0]).id, "3435910");
  assert.equal(required(searchDestinations(places, "sao paulo")[0]).id, required(searchDestinations(places, "São Paulo")[0]).id);
  assert.equal(required(searchDestinations(places, "東京")[0]).id, required(searchDestinations(places, "Tokyo")[0]).id);
  const cities = searchDestinations(places, "Paris");
  assert.ok(cities.length > 1);
  assert.ok(cities.every(city => city.context));
  assert.equal(required(searchDestinations(places, "Paris Texas")[0]).id, "4717560");
  assert.deepEqual(searchDestinations(places, ""), []);
  assert.deepEqual(searchDestinations(places, "qqqzzzimpossiblecity"), []);
  assert.ok(searchDestinations(places, "san").length <= 8);
});

test("prepared location inverse agrees with the imagery projection across face boundaries", () => {
  for (const [longitude, latitude] of [[-58.37723, -34.61315], [112.5, 32.5], [179.99, -17], [-179.99, -17], [24.94, 60.17]]) {
    const lon = (longitude + 360) % 360;
    const page = prepareCityPageGeometry({ level: 0, x: Math.floor(lon / 11.25), y: Math.floor((latitude + 90) / 11.25) }, PREPARED_EARTH_SCENE);
    const uv = required(pageCoordinates(page, longitude, latitude));
    const actual = createCityGeographicSampler(page)(uv[0],uv[1]);
    assert.ok(Math.abs(actual[0] - lon) < 1e-9);
    assert.ok(Math.abs(actual[1] - latitude) < 1e-9);
    assert.ok(prepareLocationPoint(PREPARED_EARTH_SCENE, longitude, latitude).every(Number.isFinite));
  }
});

test("polar destinations land on the accepted visible cap, including its apron", () => {
  for (const [longitude,latitude] of [[15.6469,78.2232],[45,82],[-45,-82]]) {
    const cap=prepareCityPageGeometry({level:0,x:0,y:latitude>0?15:0},PREPARED_EARTH_SCENE);
    const point=prepareLocationPoint(PREPARED_EARTH_SCENE,longitude,latitude);
    const p=required(cap.geographicProjection),m=p.matrix;
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
