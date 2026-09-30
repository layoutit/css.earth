import assert from 'node:assert/strict';
import { test } from 'node:test';
import { azimuthElevation, cylinderPixel, fitHorizon, fitTieAzimuths, groundElapsedUtc, localBearing, locatePanorama, panoramaFacePixels, parsePlacesTable, parseSurfacePanoramas,
  SKY_BASES, statedGeometry, sunDirection } from '@cssearth/bake/objects/panoramas';

const document = {
  schema: 'cssearth-surface-panoramas@2', source: 'Example collection', sourcePage: 'https://example.org/panoramas/', retrievedAt: '2026-09-30',
  placement: { kind: 'stated-cylinder', quote: 'north in the center', quoteUrl: 'https://example.org/panoramas/', azimuthAtCentreDeg: 0, topElevationDeg: 10 },
  localization: { kind: 'places', path: 'features/traverses/places.csv', product: 'https://example.org/places/' },
  panoramas: [{ id: 'landing', title: 'Landing', when: 'Sols 3–11', sols: [3, 11], camera: 'Mastcam-Z', image: 'panoramas/landing.jpg', credit: 'NASA/JPL-Caltech/ASU', pageUrl: 'https://example.org/panoramas/' }],
};

test('a panorama document keeps its projection, localisation and sols, and refuses what it cannot place', () => {
  const parsed = parseSurfacePanoramas(document);
  assert.equal(parsed.panoramas[0]!.sols![1], 11);
  assert.equal(parsed.placement.kind === 'stated-cylinder' && parsed.placement.topElevationDeg, 10);
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
  const image = { width: 3600, height: 800 }, geometry = statedGeometry(image.width, { azimuthAtCentreDeg: 0, topElevationDeg: 10 });
  assert.deepEqual(cylinderPixel(image, geometry, 0, 10), [1800, 0]);
  assert.deepEqual(cylinderPixel(image, geometry, 90, 0), [2700, 100]);
  assert.deepEqual(cylinderPixel(image, geometry, 180, -70), [0, 800]);
  assert.equal(cylinderPixel(image, geometry, 0, 20), null);
  // A tilted strip that spans less than a turn: the horizon drops a row every ten columns, and past its right edge is unimaged.
  const strip = { pxPerDeg: 10, azimuthAtLeftDeg: 300, horizonRow: 50, horizonSlope: 0.1 };
  assert.deepEqual(cylinderPixel({ width: 3000, height: 400 }, strip, 0, 0), [600, 110]);
  assert.equal(cylinderPixel({ width: 3000, height: 400 }, strip, 299, 0), null);
  assert.deepEqual(azimuthElevation([0, -1, 0]).map(value => Math.round(value)), [90, 0]);
});

test('each cube face shows its own direction of the image, and what the image does not cover stays transparent', () => {
  // Quadrants of azimuth coloured apart: north (315–45°) red, east green, south blue, west white; black above 10°.
  const width = 360, height = 80, rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const azimuth = (x - 180 + 360) % 360, quadrant = Math.floor(((azimuth + 45) % 360) / 90), at = (y * width + x) * 3;
    rgb.set([[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255]][quadrant]!, at);
  }
  const geometry = statedGeometry(width, { azimuthAtCentreDeg: 0, topElevationDeg: 10 }), size = 16;
  const centre = (id: string) => { const face = panoramaFacePixels({ width, height, rgb }, geometry, SKY_BASES.find(basis => basis.id === id)!, size);
    return [...face.slice(((size / 2) * size + size / 2) * 4, ((size / 2) * size + size / 2) * 4 + 4)]; };
  assert.deepEqual(centre('px'), [255, 0, 0, 255]);
  assert.deepEqual(centre('ny'), [0, 255, 0, 255]);
  assert.deepEqual(centre('nx'), [0, 0, 255, 255]);
  assert.deepEqual(centre('py'), [255, 255, 255, 255]);
  // Straight up is above the image's top row: unimaged.
  assert.equal(centre('pz')[3], 0);
});

test('a tie-point panorama is turned by the Sun when it has two celestial ties, and hardware only checks it', () => {
  // 40 px a degree, left edge at azimuth 200°: the shadow opposite a Sun at 90° sits at column (270 - 200) * 40.
  const fit = fitTieAzimuths([
    { label: 'shadow', column: 2800, azimuthDeg: 270, celestial: true },
    { label: 'Sun', column: 10000, azimuthDeg: 90, celestial: true },
    { label: 'LM', column: 6040, azimuthDeg: 351, celestial: false, toleranceDeg: 1 },
  ], 'example');
  assert.deepEqual(fit.fittedBy, ['shadow', 'Sun']);
  assert.ok(Math.abs(fit.pxPerDeg - 40) < 1e-9 && Math.abs(fit.azimuthAtLeftDeg - 200) < 1e-9);
  assert.ok(Math.abs(fit.residualsDeg.find(tie => tie.label === 'LM')!.deg) < 1e-9);
  // One celestial tie leaves hardware in the fit; a tie that misses by more than its positions allow is refused.
  assert.deepEqual(fitTieAzimuths([{ label: 'shadow', column: 2800, azimuthDeg: 270, celestial: true }, { label: 'LM', column: 6040, azimuthDeg: 351, celestial: false }], 'example').fittedBy, ['shadow', 'LM']);
  assert.throws(() => fitTieAzimuths([
    { label: 'shadow', column: 2800, azimuthDeg: 270, celestial: true }, { label: 'Sun', column: 10000, azimuthDeg: 90, celestial: true },
    { label: 'flag', column: 6040, azimuthDeg: 341, celestial: false, toleranceDeg: 5 }], 'example'), /flag misses its fitted column by 10\.0°, more than the 5\.0°/u);
});

test('the Sun and nearby hardware are placed by bearing from the standpoint', () => {
  const sun = sunDirection({ latitudeDeg: 0, longitudeDegEast: 10 }, { latitudeDeg: 0, longitudeDegEast: 20 });
  assert.ok(Math.abs(sun.azimuthDeg - 90) < 1e-9 && Math.abs(sun.elevationDeg - 80) < 1e-9);
  const radiusM = 1_737_400, metre = 180 / Math.PI / radiusM;
  const north = localBearing({ latitudeDeg: 0, longitudeDegEast: 359.9999 }, { latitudeDeg: 30 * metre, longitudeDegEast: 359.9999 }, radiusM);
  assert.ok(Math.abs(north.azimuthDeg) < 1e-6 && Math.abs(north.distanceM - 30) < 1e-6);
  // Across the prime meridian, a point a few metres east is east, not 360° away.
  assert.ok(Math.abs(localBearing({ latitudeDeg: 0, longitudeDegEast: 359.99999 }, { latitudeDeg: 0, longitudeDegEast: 0.00001 }, radiusM).azimuthDeg - 90) < 1e-6);
  assert.equal(groundElapsedUtc('1969-07-16T13:32:00Z', '110:31:48'), '1969-07-21T04:03Z');
});

test('the horizon row and tilt lay the terrain horizon on the skyline, past hardware that breaks it', () => {
  // Terrain rises 2° toward the east; the photograph's horizon starts at row 100 and drops one row every 100 columns.
  const pxPerDeg = 10, horizon = (azimuthDeg: number) => 2 * Math.sin(azimuthDeg * Math.PI / 180);
  const columns = Array.from({ length: 360 }, (_, i) => i * 10);
  const rows = columns.map((x, i) => 100 + x / 100 - pxPerDeg * horizon(x / pxPerDeg) - (i % 7 === 0 ? 60 : 0));
  const fit = fitHorizon({ columns, rows }, pxPerDeg, 0, horizon, 'example');
  assert.ok(Math.abs(fit.horizonRow - 100) < 1e-6 && Math.abs(fit.horizonSlope - 0.01) < 1e-9 && fit.medianResidualDeg < 1e-6);
});
