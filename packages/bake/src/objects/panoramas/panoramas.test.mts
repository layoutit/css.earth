import assert from 'node:assert/strict';
import { test } from 'node:test';
import { azimuthElevation, cylinderPixel, locatePanorama, panoramaFacePixels, parsePlacesTable, parseSurfacePanoramas, SKY_BASES } from '@cssearth/bake/objects/panoramas';

const document = {
  schema: 'cssearth-surface-panoramas@1', source: 'Example collection', sourcePage: 'https://example.org/panoramas/', retrievedAt: '2026-09-30',
  projection: { quote: 'north in the center', quoteUrl: 'https://example.org/panoramas/', azimuthAtCentreDeg: 0, topElevationDeg: 10 },
  localization: { path: 'features/traverses/places.csv', product: 'https://example.org/places/' },
  panoramas: [{ id: 'landing', title: 'Landing', sols: [3, 11], camera: 'Mastcam-Z', image: 'panoramas/landing.jpg', credit: 'NASA/JPL-Caltech/ASU', pageUrl: 'https://example.org/panoramas/' }],
};

test('a panorama document keeps its projection, localisation and sols, and refuses what it cannot place', () => {
  const parsed = parseSurfacePanoramas(document);
  assert.equal(parsed.panoramas[0]!.sols[1], 11);
  assert.equal(parsed.projection.topElevationDeg, 10);
  assert.throws(() => parseSurfacePanoramas({ ...document, panoramas: [{ ...document.panoramas[0], sols: [11, 3] }] }), /sols/u);
  assert.throws(() => parseSurfacePanoramas({ ...document, panoramas: [{ ...document.panoramas[0], image: '../escape.jpg' }] }), /inside the source directory/u);
  assert.throws(() => parseSurfacePanoramas({ ...document, extra: true }), /unsupported fields: extra/u);
  assert.throws(() => parseSurfacePanoramas({ ...document, panoramas: [...document.panoramas, document.panoramas[0]] }), /unique/u);
});

const places = parsePlacesTable([
  'frame,site,drive,planetocentric_latitude,longitude,sol',
  'SITE,3,-1,18.44462,77.45088,-1',
  'ROVER,3,28,18.44462,77.45088,13',
  'ROVER,3,190,18.44479,77.45201,-1',
  'ROVER,3,2046,18.44475,77.45213,52',
  'ROVER,4,10,18.44500,77.45300,60',
].join('\n'), 'places.csv');

test('a panorama stands where the rover last drove before its first sol, or at its first site before any drive', () => {
  assert.deepEqual(locatePanorama(places, [53, 56], 'overlook'), { latitudeDeg: 18.44475, longitudeDegEast: 77.45213, localization: 'site 3 drive 2046, sol 52' });
  // Before the first dated drive (sol 13) the rover sits at the origin of the site that drive starts in; the undated row is skipped.
  assert.equal(locatePanorama(places, [3, 11], 'landing').localization, 'site 3 origin, before the first drive on sol 13');
  assert.throws(() => locatePanorama(places, [53, 64], 'overlook'), /drove during sols 53–64/u);
});

test('the cylinder maps north to the centre column and the stated top elevation to the top row', () => {
  const image = { width: 3600, height: 800 }, projection = { azimuthAtCentreDeg: 0, topElevationDeg: 10 };
  assert.deepEqual(cylinderPixel(image, projection, 0, 10), [1800, 0]);
  assert.deepEqual(cylinderPixel(image, projection, 90, 0), [2700, 100]);
  assert.deepEqual(cylinderPixel(image, projection, 180, -70), [0, 800]);
  assert.equal(cylinderPixel(image, projection, 0, 20), null);
  assert.deepEqual(azimuthElevation([0, -1, 0]).map(value => Math.round(value)), [90, 0]);
});

test('each cube face shows its own direction of the image, and what the image does not cover stays transparent', () => {
  // Quadrants of azimuth coloured apart: north (315–45°) red, east green, south blue, west white; black above 10°.
  const width = 360, height = 80, rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const azimuth = (x - 180 + 360) % 360, quadrant = Math.floor(((azimuth + 45) % 360) / 90), at = (y * width + x) * 3;
    rgb.set([[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255]][quadrant]!, at);
  }
  const projection = { quote: '', quoteUrl: 'https://example.org/', azimuthAtCentreDeg: 0, topElevationDeg: 10 }, size = 16;
  const centre = (id: string) => { const face = panoramaFacePixels({ width, height, rgb }, projection, SKY_BASES.find(basis => basis.id === id)!, size);
    return [...face.slice(((size / 2) * size + size / 2) * 4, ((size / 2) * size + size / 2) * 4 + 4)]; };
  assert.deepEqual(centre('px'), [255, 0, 0, 255]);
  assert.deepEqual(centre('ny'), [0, 255, 0, 255]);
  assert.deepEqual(centre('nx'), [0, 0, 255, 255]);
  assert.deepEqual(centre('py'), [255, 255, 255, 255]);
  // Straight up is above the image's top row: unimaged.
  assert.equal(centre('pz')[3], 0);
});
