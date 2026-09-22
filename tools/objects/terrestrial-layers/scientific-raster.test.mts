import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PALETTE_STEPS, paletteLookup, colorForValue, terrainBrightness, scienceMapPoint, sampleScienceGrid, sampleColorBand, composeObservedColor, sourceSurfaceBrightness } from './scientific-raster.mts';
import { lambertAttenuationAtlas } from './solid-raster.mts';
import { parseTerrestrialProfile } from './index.mts';

const relief = { referenceRadiusMeters: 470000, lightDirection: [-0.5, 0.5, Math.SQRT1_2], ambient: 0.25 };
test('source-surface relief uses the actual local facet normal without radial finite differences', () => {
  assert.ok(Math.abs(sourceSurfaceBrightness({point:[20,0,0],normal:[1,0,0]},relief)-1)<1e-12);
  assert.ok(sourceSurfaceBrightness({point:[20,0,0],normal:[0,-1,0]},relief)>
    sourceSurfaceBrightness({point:[20,0,0],normal:[0,1,0]},relief));
  assert.ok(Number.isFinite(sourceSurfaceBrightness({point:[0,0,20],normal:[0,0,1]},relief)));
});
test('polar stereographic grids preserve cardinal orientation in both hemispheres', () => {
  const radius = 531000;
  for (const sign of [1, -1]) {
    const grid = {projection: 'polar-stereographic', poleLatitude: sign * 90, centerLongitude: 0, referenceRadiusMeters: radius};
    const near = (actual: readonly number[], expected: readonly number[]) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-8));
    near(scienceMapPoint(137, sign * 90, grid), [0, 0]);
    near(scienceMapPoint(0, 0, grid), [0, -sign * 2 * radius]);
    near(scienceMapPoint(90, 0, grid), [2 * radius, 0]);
    near(scienceMapPoint(180, 0, grid), [0, sign * 2 * radius]);
    near(scienceMapPoint(270, 0, grid), [-2 * radius, 0]);
    // At 60 degrees latitude, stereographic radius is 2R*tan(15) = 2R*(2-sqrt(3)).
    near(scienceMapPoint(0, sign * 60, grid), [0, -sign * 2 * radius * (2 - Math.sqrt(3))]);
    near(scienceMapPoint(45, sign * 60, {...grid, centerLongitude: 45}), scienceMapPoint(0, sign * 60, grid));
  }
  assert.deepEqual(scienceMapPoint(180, 0, {centerLongitude: 180, referenceRadiusMeters: radius}), [0, 0]);
});

test('scientific interpolation converts radius to height without extending source coverage', () => {
  const grid = {width: 2, height: 2, noData: -9999};
  const data = new Float32Array([198200, 200200, 196200, 198200]);
  const options = {sampling: 'bilinear', valueTransform: {scale: 0.001, offset: -198.2}};
  const centre = sampleScienceGrid(data, grid, 0.5, 0.5, options);
  const edge = sampleScienceGrid(data, grid, 1, 0.5, options);
  const corner = sampleScienceGrid(data, grid, 1, 1, options);
  if (centre === null || edge === null || corner === null) throw new Error('Known scientific-grid samples must remain covered.');
  assert.ok(Math.abs(centre) < 1e-10);
  assert.ok(Math.abs(edge - 1) < 1e-10);
  assert.ok(Math.abs(corner) < 1e-10);
  assert.equal(sampleScienceGrid(data, grid, 1, 0.5), 200200, 'Existing nearest sampling retains source units');
  assert.equal(sampleScienceGrid(data, grid, -0.001, 1, options), null);
  assert.equal(sampleScienceGrid(data, grid, 2, 1, options), null);
  assert.equal(sampleScienceGrid(data, grid, 1, 2, options), null);
  data[3] = -9999;
  assert.equal(sampleScienceGrid(data, grid, 1, 1, options), null, 'No interpolation across missing values');
});

test('relief preserves height units, latitude spacing, wrapping and coverage boundaries', () => {
  assert.equal(terrainBrightness({ sample: () => 123 }, 180, 0, 0.1, relief), 1);
  const metersPerDegree = relief.referenceRadiusMeters * Math.PI / 180;
  const planeAt = (latitude: number) => ({ sample: (longitude: number) => metersPerDegree * longitude * Math.cos(latitude * Math.PI / 180) });
  assert.ok(terrainBrightness(planeAt(0), 180, 0, 0.1, relief) > 1);
  assert.ok(Math.abs(terrainBrightness(planeAt(0), 180, 0, 0.1, relief) - terrainBrightness(planeAt(50), 180, 50, 0.1, relief)) < 1e-10);
  const opposite = { ...relief, lightDirection: [0.5, -0.5, Math.SQRT1_2] };
  assert.ok(terrainBrightness(planeAt(0), 180, 0, 0.1, opposite) < 1);
  const globe = { sample: (longitude: number) => 1000 * Math.sin(longitude * Math.PI / 180) };
  assert.equal(terrainBrightness(globe, 0, 0, 0.1, relief), terrainBrightness(globe, 360, 0, 0.1, relief));
  assert.equal(terrainBrightness({ sample: (longitude: number) => longitude < 180 ? null : 123 }, 180, 0, 0.1, relief), 1);
  // The same physical gradient on a differently sized source sphere is lit equally.
  const larger = { ...relief, referenceRadiusMeters: relief.referenceRadiusMeters * 2 };
  assert.equal(terrainBrightness({ sample: (longitude: number) => 2 * metersPerDegree * longitude }, 180, 0, 0.1, larger),
    terrainBrightness(planeAt(0), 180, 0, 0.1, relief));
});

test('numeric color scale clamps endpoints and interpolates authored colors', () => {
  const scale = { minimum: -100, maximum: 100, colors: ['#000000', '#ffffff'] };
  assert.deepEqual(colorForValue(-200, scale), [0, 0, 0]);
  assert.deepEqual(colorForValue(0, scale), [128, 128, 128]);
  assert.deepEqual(colorForValue(200, scale), [255, 255, 255]);
});

test('kilometre DEMs produce the same relief as their metre equivalents', () => {
  const km = {sample: (longitude: number) => longitude * 0.75};
  const meters = {sample: (longitude: number) => longitude * 750};
  for (const latitude of [0, 70, -70]) {
    assert.ok(Math.abs(terrainBrightness(km, 180, latitude, 0.1, {...relief, heightToMeters: 1000}) -
      terrainBrightness(meters, 180, latitude, 0.1, relief)) < 1e-12);
  }
});

test('float sampling uses pixel centers and excludes special values without masking black observations', () => {
  const band = {width: 3, height: 2, origin: [-30, 10], resolution: [20, -10],
    data: new Float32Array([0, 1000, -9999, 0, 3000, -9999]), noData: -9999, specialValueMagnitude: 1e30};
  assert.equal(sampleColorBand(band, -20, 5), 0);
  assert.equal(sampleColorBand(band, -10, 0), 1000);
  assert.equal(sampleColorBand(band, 10, 0), null);
  assert.equal(sampleColorBand(band, -40, 0), null);
  band.data[1] = -3.4028226550889045e38;
  assert.equal(sampleColorBand(band, -10, 0), null);
});

test('observed color retains dark valid pixels and rejects incomplete footprints', () => {
  const band = { width: 2, height: 2, origin: [0, 2], resolution: [1, -1],
    data: new Float32Array([0.001, 0.001, 0.001, 0.001]), noData: 0, specialValueMagnitude: 1e30 };
  const centre = sampleColorBand(band, 1, 1);
  if (centre === null) throw new Error('Known observed-band centre must remain covered.');
  assert.ok(centre > 0);
  band.data[3] = 0; assert.equal(sampleColorBand(band, 1, 1), null);
  band.data[3] = -3.4028234663852886e38; assert.equal(sampleColorBand(band, 1, 1), null);
  assert.equal(sampleColorBand(band, 0, 0), null);
});

test('channel composition uses all three bands from one observation and source density precedence', () => {
  const profile = { filters: ['red', 'green', 'blue'], referenceRadiusMeters: 1, centerLongitude: 180, displayRange: [0, 1] };
  const band = (filter: string, value: number, resolution: number) => ({ filter, width: 2, height: 2, origin: [-resolution, resolution], resolution: [resolution, -resolution],
    data: new Float32Array(4).fill(value), noData: 0, specialValueMagnitude: 1e30 });
  const groups = new Map([
    ['coarse', profile.filters.map(filter => band(filter, 0.5, 2))],
    ['fine', profile.filters.map((filter, index) => band(filter, (index + 1) / 4, 1))],
  ]);
  const result = composeObservedColor({ groups, profile, width: 1, height: 1 });
  assert.deepEqual([...result.rgb], [137, 188, 225]); assert.deepEqual([...result.missing], [0]);
  const fine = groups.get('fine');
  assert.ok(fine);
  fine[1].data.fill(0);
  assert.deepEqual([...composeObservedColor({ groups, profile, width: 1, height: 1 }).rgb], [188, 188, 188]);
  fine.pop();
  assert.throws(() => composeObservedColor({ groups, profile, width: 1, height: 1 }), /Incomplete color observation/);
});

test('Lambert atlas is transparent outside the body and carries distinct full-phase shading', () => {
  const profile = { frameSize: 8, columns: 2, frameCount: 4, terminatorWidth: 0.1,
    directionalAmbient: 0.05, fullPhaseAmbient: 0.35, fullPhaseDiffuse: 0.65, maximumOpacity: 0.95 };
  const { pixels, width, height } = lambertAttenuationAtlas(profile);
  assert.equal(width, 16); assert.equal(height, 16); assert.equal(pixels[3], 0);
  assert.equal(pixels[(3 * width + 3) * 4 + 3], 242);
  assert.ok(pixels[((8 + 3) * width + 8 + 3) * 4 + 3] < 10);
});

test('capability selection and validity policy are independent of body names', async () => {
  const config = JSON.parse(await readFile(new URL('../../../src/objects/vesta/source/preparation/terrestrial.json', import.meta.url), 'utf8'));
  const variant = structuredClone(config); variant.namespace = 'test-body'; variant.publicBase = '/scenes/test-body/';
  assert.equal(parseTerrestrialProfile(variant).namespace, 'test-body');
  variant.geometry.radius = 231; assert.throws(() => parseTerrestrialProfile(variant), /Invalid terrestrial/);
});

test('a measured elevation lens can be the only surface capability', async () => {
  const config = JSON.parse(await readFile(new URL('../../../src/objects/itokawa/source/preparation/terrestrial.json', import.meta.url), 'utf8'));
  // Keep this fixture elevation-only as the real body gains observed views.
  config.raster.surfaceObservations = [];
  config.presentation.defaultLens = 'elevation';
  const parsed = parseTerrestrialProfile(config);
  assert.ok('presentation' in parsed);
  assert.equal(parsed.presentation.defaultLens, 'elevation');
  assert.throws(() => parseTerrestrialProfile({...config, raster: {...config.raster, scientific: []}}), /Invalid terrestrial/);
  const excessive=structuredClone(config);excessive.raster.scientific[0].surfaceSampling.maximumDistanceMeters=1e6;
  assert.throws(()=>parseTerrestrialProfile(excessive),/simplification-distance bound/);
  const mismatched=structuredClone(config);mismatched.raster.scientific[0].path='shape/another-source.obj';
  assert.throws(()=>parseTerrestrialProfile(mismatched),/simplification-distance bound/);
  const otherFormat=structuredClone(config);otherFormat.raster.scientific[0].format='wavefront-obj';
  assert.throws(()=>parseTerrestrialProfile(otherFormat),/simplification-distance bound/);
});

test('a declared output meridian shifts presentation without changing source coordinates', async () => {
  const {paintScienceSurface} = await import('./scientific-raster.mts');
  const seen: [number, number][] = [], source = {sample(lon: number, lat: number) {seen.push([lon,lat]);return lon;}};
  const lens = {minimum:-180,maximum:360,colors:['#000000','#ffffff']};
  paintScienceSurface(source,lens,4,2);
  assert.deepEqual(seen.slice(0,4).map(p=>p[0]),[45,135,225,315]);
  seen.length=0;paintScienceSurface(source,{...lens,outputLongitudeOrigin:-180},4,2);
  assert.deepEqual(seen.slice(0,4).map(p=>p[0]),[-135,-45,45,135]);
  assert.deepEqual(seen.filter((_,i)=>i%4===0).map(p=>p[1]),[45,-45]);
  assert.throws(()=>paintScienceSurface(source,{...lens,outputLongitudeOrigin:NaN},4,2),TypeError);
});

test('a numeric palette resolves through 256 steps: monotonic along the range, bounded to that many colours, ends exact', () => {
  const lens = { minimum: -1, maximum: 1, colors: ['#000000', '#ff0000', '#ffffff'] } as never;
  const lookup = paletteLookup(lens), seen = new Set<string>();
  let previous = -1;
  for (let i = 0; i <= 4000; i++) { const c = lookup(-1 + 2 * i / 4000); const key = c.join(','); seen.add(key); const rank = c[0]! * 2 + c[1]!; assert.ok(rank >= previous - 1e-9, 'colour never runs backwards'); previous = rank; }
  assert.ok(seen.size <= PALETTE_STEPS, `${seen.size} colours`);
  assert.deepEqual(lookup(-5), [0, 0, 0]); assert.deepEqual(lookup(5), [255, 255, 255]); for (const [c, exact] of lookup(0).map((v, i) => [v, colorForValue(0, lens)[i]!] as const)) assert.ok(Math.abs(c - exact) <= 2, 'a step lands within two of the exact colour');
});
