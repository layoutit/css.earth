#!/usr/bin/env node
/** Betelgeuse's circumstellar dust, as two density grids the shared slab baker turns into one lens bank.
 *
 *   node tools/objects/source-authoring/betelgeuse-shell/author.mts [--check]
 *
 * --check recomputes every output and fails if any differs from the file on disk.
 *
 * **zimpol-v** is the measured one: the SPHERE/ZIMPOL V-band degree of linear polarisation of 3 December 2024 (ESO Phase 3
 * collection BETELGEUSE-B, Montargès et al. 2026). It is a sky-plane image with no third axis, so it is placed in the plane of
 * the sky through the star and spread along the line of sight by the Rayleigh polarisation efficiency r^2/(r^2+2z^2),
 * normalised so each column reproduces its measured degree. Depth is a stated convention, not a measurement.
 *
 * **veil-2019-12** is the published model: the RADMC-3D dusty clump Montargès et al. (2021, Nature 594, 365) fitted to the
 * Great Dimming, a sphere of constant density whose centre, radius and density are their Extended Data Table 3, in their own
 * coordinates (x along right ascension, y along declination, z positive toward Earth; Extended Data Figure 6). It is drawn as
 * starlight scattered by that dust: the published density weighted by the inverse-square illumination each parcel receives.
 *
 * Both grids share one frame anchored on Betelgeuse's prepared scene origin, so one volume unit is one stellar radius. */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFitsImage } from '../../../fits.mts';
import { sha256 } from '../../../../src/platform/sha256.mts';
import { encodeDensityKtx2 } from '../../../../src/preparation/volume/acquisition.ts';

const root = resolve(import.meta.dirname, '../../../../src/objects/betelgeuse-shell/source');
const packageBase = 'src/objects/betelgeuse-shell/source';
/** The two publisher figures this package cites, kept beside it because preparation reads them for the dataset previews. */
export const PREVIEWS = Object.freeze({
  'zimpol-v': { path: 'previews/aa61023-26-fig3.jpg', url: 'https://www.aanda.org/articles/aa/full_html/2026/07/aa61023-26/aa61023-26-fig3.jpg',
    origin: 'https://doi.org/10.1051/0004-6361/202661023', sha256: '016094a65ecf21a125dc9e4f45625ecf4edf97ddfaa10cd9b955d64bb5cc3292', bytes: 323819,
    title: 'Degree of linear polarisation around Betelgeuse, V band, 3 December 2024',
    credit: 'Montarg\u00e8s et al. 2026, A&A 711, L12, Fig. B.1; ESO/VLT/SPHERE-ZIMPOL',
    license: 'CC-BY-4.0. Open access under the Creative Commons Attribution 4.0 International licence; retain the citation.' },
  'veil-2019-12': { path: 'previews/eso2109a.jpg', url: 'https://cdn.eso.org/images/screen/eso2109a.jpg',
    origin: 'https://www.eso.org/public/images/eso2109a/', sha256: 'dc91807cd8b41719cc7e4cc310c99082d9ad02c49a08b51155bb00be2d1fbf17', bytes: 45713,
    title: 'Betelgeuse\u2019s surface before and during its 2019\u20132020 Great Dimming',
    credit: 'ESO/M. Montarg\u00e8s et al.', crop: { left: 320, top: 40, width: 318, height: 520 },
    license: 'CC-BY-4.0. ESO images are released under the Creative Commons Attribution 4.0 International licence; retain the credit.' },
});
const starScene = resolve(import.meta.dirname, '../../../../src/objects/betelgeuse/prepared/scene.json');

/** The two V-band products as ESO serves them: the pipeline intensity and its ancillary degree of linear polarisation. */
export const PRODUCTS = Object.freeze({
  intensity: { path: 'observations/SPHERE_ZIMPOL_Betelgeuse_P1_V_phase3.fits', dpId: 'ADP.2026-08-19T13:19:07.655',
    sha256: 'b40cfcb32103c99c5de9f77588519bbb6c9322eb250d7bc9756339fee8abd8eb', bytes: 8458560 },
  dolp: { path: 'observations/SPHERE_ZIMPOL_Betelgeuse_P1_V_DOLP.fits', dpId: 'ADP.2026-08-19T13:19:07.656',
    sha256: '0df320dc9406596a9e47e2633cb97ce5bbfe9db3a7a2f1a8fc2437efdf924687', bytes: 8455680 },
});
export const PIXEL_SCALE_MAS = 3.6;
/** One unit is one stellar radius. Six radii each way holds the 2024 patches and the 2019 clump, in twenty-four half-radius slabs. */
export const GRID = Object.freeze({ size: 96, halfUnits: 6, slabs: 24 });
/** Polarisation stretch: the median degree beyond eight radii is instrumental floor; five percent is the top of the measured patches. */
export const STRETCH = Object.freeze({ backgroundAnnulusUnits: [8, 12] as const, topDegree: 0.05, intensityFloorOfPeak: 3e-3,
  innerMaskUnits: 1, taperFromUnits: 4.5 });
/** Montargès et al. 2021, Extended Data Table 3, December 2019: the optimised epoch. January and March 2020 are recorded
 * there as unoptimised best guesses and are not shipped. Coordinates are theirs, in astronomical units. */
export const VEIL_2019_12 = Object.freeze({ centreRaDecEarthAu: [-1.9, -3.0, 12.5] as const, radiusAu: 6.5,
  densityGramsPerCubicCentimetre: 3.2e-19, grainMicrometres: 0.21, composition: 'MgFeSiO4' });
const METERS_PER_PARSEC = 3.085677581491367e16, ARCSEC_PER_RADIAN = 206264.80624709636, METRES_PER_AU = 1.495978707e11;

function bilinear(values: Float64Array, width: number, height: number, x: number, y: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const at = (col: number, row: number) => col < 0 || row < 0 || col >= width || row >= height ? 0 : values[row * width + col]!;
  return at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
}
function smoothstep(a: number, b: number, t: number): number { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); }

async function pinnedFits(product: { path: string; sha256: string; bytes: number }) {
  const bytes = await readFile(resolve(root, product.path));
  if (bytes.length !== product.bytes || sha256(bytes) !== product.sha256) throw new Error(`ESO product differs from its pin: ${product.path}`);
  return readFitsImage(bytes);
}

/** Encode one scalar field as the RGBA8 grid the slab baker reads; its own channel transfer squares the byte back. */
function encodeGrid(sample: (x: number, y: number, z: number) => number) {
  const { size, halfUnits } = GRID, step = 2 * halfUnits / size, rgba = new Uint8Array(size ** 3 * 4);
  let peak = 0, filled = 0;
  for (let k = 0; k < size; k++) for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const value = sample(-halfUnits + (i + 0.5) * step, -halfUnits + (j + 0.5) * step, -halfUnits + (k + 0.5) * step);
    if (!(value > 0)) continue;
    peak = Math.max(peak, value); filled++;
    const byte = Math.round(255 * Math.sqrt(Math.min(1, value)));
    const o = 4 * ((k * size + j) * size + i);
    rgba[o] = rgba[o + 1] = rgba[o + 2] = byte;
  }
  return { rgba, ktx2: encodeDensityKtx2({ width: size, height: size, depth: size, encodedRgba: rgba }, 9), peak, filled };
}

/** The slab recipe both grids share: one emission channel, shared opacity, twenty-four slabs an axis. */
function volumeRecipe(grid: string, gridSha256: string, decodedSha256: string, provenanceSha256: string, exposureGain: number, color: readonly number[]) {
  return {
    schema: 'cssearth-volume-recipe@1',
    grid: { path: grid, sha256: gridSha256, decodedSha256, dimensions: [GRID.size, GRID.size, GRID.size], encoding: 'sqrt-density-unorm8',
      bounds: { min: [-GRID.halfUnits, -GRID.halfUnits, -GRID.halfUnits], max: [GRID.halfUnits, GRID.halfUnits, GRID.halfUnits] } },
    material: { emission: [{ channel: 0, color: [...color], strength: 1 }], absorption: [], emissionTransfer: 'shared-opacity',
      intensityScale: 1, stepScale: 1, stepMetric: 'source', exposureGain },
    bake: { sliceCounts: { x: GRID.slabs, y: GRID.slabs, z: GRID.slabs }, unitsPerSourceUnit: 1, imageWidth: 320, samplesPerSlab: 4,
      cropTransparent: true, opticalWeight: 1, imageEncoding: { format: 'webp', quality: 90 } },
    anchors: [{ id: 'betelgeuse', referencePositionM: [0, 0, 0] }],
    provenance: { path: 'provenance.json', sha256: provenanceSha256 },
  };
}

export async function author(defaultLens = 'zimpol-v') {
  const scene = JSON.parse(await readFile(starScene, 'utf8')) as { worldFrame: { originM: [number, number, number]; bodyRadiusM: number; referenceFrame: string; epochJdTt: number } };
  const origin = scene.worldFrame.originM, radiusM = scene.worldFrame.bodyRadiusM, distanceM = Math.hypot(...origin);
  const raDeg = (Math.atan2(origin[1], origin[0]) * 180 / Math.PI + 360) % 360, decDeg = Math.asin(origin[2] / distanceM) * 180 / Math.PI;
  const radiusArcsec = radiusM / distanceM * ARCSEC_PER_RADIAN, pixelsPerUnit = radiusArcsec * 1000 / PIXEL_SCALE_MAS;
  const auPerUnit = radiusM / METRES_PER_AU;
  const { size, halfUnits } = GRID, step = 2 * halfUnits / size;

  // --- the measured lens: the 2024 polarisation map, spread along the line of sight by scattering angle ---
  const intensity = await pinnedFits(PRODUCTS.intensity), dolp = await pinnedFits(PRODUCTS.dolp);
  if (intensity.width !== dolp.width || intensity.height !== dolp.height) throw new Error('Intensity and polarisation grids differ.');
  const { width, height } = intensity, I = intensity.values, P = dolp.values;
  // Star centre: the intensity centroid within fifteen pixels of the peak, iterated. The header reference pixel is the
  // catalogue position, not the star, and sits eighty rows away from it.
  let peakIndex = 0; for (let i = 1; i < I.length; i++) if (I[i]! > I[peakIndex]!) peakIndex = i;
  let cx = peakIndex % width, cy = Math.floor(peakIndex / width);
  for (let pass = 0; pass < 5; pass++) {
    let sx = 0, sy = 0, s = 0;
    for (let y = Math.round(cy) - 15; y <= Math.round(cy) + 15; y++) for (let x = Math.round(cx) - 15; x <= Math.round(cx) + 15; x++) {
      const v = I[y * width + x]!; if (v > 0) { sx += v * x; sy += v * y; s += v; }
    }
    cx = sx / s; cy = sy / s;
  }
  const peakValue = I[peakIndex]!;
  const floorSamples: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const r = Math.hypot(x - cx, y - cy) / pixelsPerUnit;
    if (r >= STRETCH.backgroundAnnulusUnits[0] && r < STRETCH.backgroundAnnulusUnits[1]) floorSamples.push(P[y * width + x]!);
  }
  floorSamples.sort((a, b) => a - b);
  const background = floorSamples[Math.floor(floorSamples.length / 2)]!;
  // Resolve the sky plane and each column's normalisation once; the encoder then only samples them.
  const plane = new Float64Array(size * size), norm = new Float64Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    // This grid's axes: x toward increasing image column (west), y toward increasing image row (north), z away from the observer.
    const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step, r = Math.hypot(x, y);
    const col = cx + x * pixelsPerUnit, row = cy + y * pixelsPerUnit;
    if (r < STRETCH.innerMaskUnits || bilinear(I, width, height, col - 0.5, row - 0.5) < STRETCH.intensityFloorOfPeak * peakValue) continue;
    const degree = bilinear(P, width, height, col - 0.5, row - 0.5) - background;
    plane[j * size + i] = Math.max(0, Math.min(1, degree / (STRETCH.topDegree - background))) * (1 - smoothstep(STRETCH.taperFromUnits, halfUnits, r));
    let sum = 0; const r2 = x * x + y * y;
    for (let k = 0; k < size; k++) { const z = -halfUnits + (k + 0.5) * step; sum += r2 / (r2 + 2 * z * z) * step; }
    norm[j * size + i] = sum;
  }
  const zimpol = encodeGrid((x, y, z) => {
    const i = Math.round((x + halfUnits) / step - 0.5), j = Math.round((y + halfUnits) / step - 0.5);
    const value = plane[j * size + i] ?? 0; if (!(value > 0)) return 0;
    const r2 = x * x + y * y;
    return value * (r2 / (r2 + 2 * z * z)) / norm[j * size + i]!;
  });

  // --- the published lens: the December 2019 RADMC-3D clump, drawn as scattered starlight ---
  // Their axes are x along right ascension (east), y along declination (north), z positive toward Earth. This grid's are
  // west, north and away, so east and toward-Earth both change sign.
  const [xRa, yDec, zEarth] = VEIL_2019_12.centreRaDecEarthAu;
  const centre = [-xRa / auPerUnit, yDec / auPerUnit, -zEarth / auPerUnit] as const;
  const veilRadius = VEIL_2019_12.radiusAu / auPerUnit;
  const nearest = Math.max(1, Math.hypot(...centre) - veilRadius);
  // The published clump lies wholly between the observer and the photosphere at the Earth view, so the bank may
  // composite it over the star while its centre is the nearer of the two. Fail rather than claim that wrongly.
  if (!(centre[2] + veilRadius < -1)) throw new Error('The clump overlaps the photosphere in depth; it cannot occult it as a whole.');
  const veil = encodeGrid((x, y, z) => {
    if (Math.hypot(x - centre[0], y - centre[1], z - centre[2]) > veilRadius) return 0;
    // The published density is uniform, so brightness is only the inverse-square illumination each parcel receives,
    // normalised to the parcel of this clump that lies closest to the photosphere.
    return Math.min(1, nearest ** 2 / Math.max(1, x * x + y * y + z * z));
  });

  const provenance = {
    schema: 'cssearth-volume-provenance@1',
    title: 'Betelgeuse circumstellar dust: measured polarisation and the published Great Dimming clump',
    kind: 'observed-sky-map-and-published-radiative-transfer-model',
    authors: ['M. Montargès', 'E. Cannon', 'A. de Koter', 'P. Kervella', 'E. Lagadec', 'L. Decin', 'A. Boccaletti', 'O. Flasseur', 'J. Milli', 'S. Ridgway', 'A. K. Dupree'],
    organizations: ['ESO (VLT/SPHERE-ZIMPOL, programmes 0104.D-0300 and 114.28H9.001)', 'High Contrast Data Centre (reduction)'],
    license: { spdx: 'CC-BY-4.0', dataLicenseDeclaration: 'https://archive.eso.org/cms/eso-data-access-policy.html', note: 'ESO Phase 3 release description BETELGEUSE-B DR1, 2026-08-19: science data products from the ESO archive may be distributed under the Creative Commons Attribution 4.0 International license with credit to the ESO provenance. The 2019 clump parameters are published numbers from Montargès et al. 2021, Extended Data Table 3.' },
    sources: [
      { id: 'zimpol-v-intensity', dpId: PRODUCTS.intensity.dpId, url: `https://dataportal.eso.org/dataPortal/file/${PRODUCTS.intensity.dpId}`, sha256: PRODUCTS.intensity.sha256, bytes: PRODUCTS.intensity.bytes, role: 'star centre and intensity floor' },
      { id: 'zimpol-v-dolp', dpId: PRODUCTS.dolp.dpId, url: `https://dataportal.eso.org/dataPortal/file/${PRODUCTS.dolp.dpId}`, sha256: PRODUCTS.dolp.sha256, bytes: PRODUCTS.dolp.bytes, role: 'degree of linear polarisation, the quantity the 2024 leaves carry' },
      { id: 'veil-parameters', url: 'https://doi.org/10.1038/s41586-021-03546-8', preprint: 'https://arxiv.org/abs/2201.10551', role: 'Montargès et al. 2021, Nature 594, 365, Extended Data Table 3 and Figure 6: the December 2019 clump centre, radius, density, composition and grain size, and the coordinate system they are given in' },
    ],
    paper: { doi: '10.1051/0004-6361/202661023', citation: 'Montargès et al. 2026, A&A 711, L12 (the 2024 polarimetry)' },
    measured: { starCentrePixel: [cx, cy], intensityPeak: peakValue, polarisationFloor: background, pixelsPerStellarRadius: pixelsPerUnit,
      stellarRadiusArcsec: radiusArcsec, stellarRadiusAu: auPerUnit, sceneOriginRaDecDeg: [raDeg, decDeg], distancePc: distanceM / METERS_PER_PARSEC,
      veilCentreUnits: [...centre], veilRadiusUnits: veilRadius },
    models: {
      'zimpol-v': 'Sky-plane slab. The degree map, floor-subtracted and stretched to five percent, sits in the plane of the sky through the star and is spread along the line of sight by the Rayleigh polarisation efficiency r^2/(r^2+2z^2), normalised so each column reproduces its measured degree. The disc within one radius and everything fainter than three thousandths of the stellar peak are removed; the map tapers out between 4.5 and 6 radii. Depth is not measured.',
      'veil-2019-12': `The published December 2019 clump: a sphere of radius ${VEIL_2019_12.radiusAu} au centred at (${VEIL_2019_12.centreRaDecEarthAu.join(', ')}) au along right ascension, declination and toward Earth, of constant dust density ${VEIL_2019_12.densityGramsPerCubicCentimetre} g/cm3 in ${VEIL_2019_12.composition} grains centred on ${VEIL_2019_12.grainMicrometres} micrometres. It is drawn as starlight scattered by that dust, so brightness follows the inverse-square illumination each parcel receives; the published density itself is uniform.`,
    },
    limitations: [
      'The 2024 map is one epoch, one filter and one sky-plane image: no third axis was observed.',
      'The degree of polarisation is a ratio; its instrumental floor was measured beyond eight radii and subtracted.',
      'Structure finer than the 16 mas beam, three quarters of a stellar radius, is not in the 2024 data.',
      'The 2019 clump is a model fitted to images, not an image. Its January and March 2020 epochs are recorded by its own authors as unoptimised best guesses and are not shipped.',
      'Silicates sublimate near 1500 K, so the real clump is emptier on the side facing the star than a uniform sphere; its authors record that this does not change their result, and the uniform sphere they published is what is drawn.',
      'Scattered starlight is drawn warm because it is the star’s own light; no colour was measured.',
      'The two lenses are five years apart. Neither is a picture of the other.',
      'The clump covers the star rather than dimming it: the leaves composite over the photosphere while the clump is the nearer of the two, but they add their own light instead of absorbing the star\u2019s.',
      'The 2024 map always composites behind the star, because its emission surrounds the body instead of standing clear of it in depth.',
    ],
  };
  const provenanceBytes = Buffer.from(JSON.stringify(provenance, null, 2) + '\n');
  const provenanceSha = sha256(provenanceBytes);
  const grids = [
    { id: 'zimpol-v', label: 'SPHERE/ZIMPOL · polarised dust, 2024', file: 'density-zimpol-v.ktx2', built: zimpol, exposureGain: 4, color: [1, 1, 1] as const,
      sourceUrl: 'https://archive.eso.org/scienceportal/home?data_collection=BETELGEUSE-B' },
    { id: 'veil-2019-12', label: 'Great Dimming clump · December 2019', file: 'density-veil-2019-12.ktx2', built: veil, exposureGain: 2.5, color: [1, 0.82, 0.62] as const,
      sourceUrl: 'https://arxiv.org/abs/2201.10551', occultingCentreUnits: [...centre] as [number, number, number] },
  ];
  const outputs: [string, Buffer][] = [['provenance.json', provenanceBytes]];
  const deliveryGrids: { id: string; label: string; sourceUrl: string; recipe: { path: string; sha256: string }; occultingCentreUnits?: [number, number, number] }[] = [];
  for (const grid of grids) {
    const recipeBytes = Buffer.from(JSON.stringify(volumeRecipe(grid.file, sha256(grid.built.ktx2), sha256(grid.built.rgba), provenanceSha, grid.exposureGain, grid.color), null, 2) + '\n');
    outputs.push([grid.file, Buffer.from(grid.built.ktx2)], [`volume-${grid.id}.json`, recipeBytes]);
    deliveryGrids.push({ id: grid.id, label: grid.label, sourceUrl: grid.sourceUrl,
      recipe: { path: `src/objects/betelgeuse-shell/source/volume-${grid.id}.json`, sha256: sha256(recipeBytes) },
      ...('occultingCentreUnits' in grid ? { occultingCentreUnits: grid.occultingCentreUnits } : {}) });
  }
  const delivery = {
    schema: 'cssearth-nebula-delivery@1', id: 'betelgeuse-shell', method: 'density-grid',
    request: deliveryGrids.find(grid => grid.id === defaultLens)!.recipe,
    inputPins: [{ path: 'src/objects/betelgeuse-shell/source/provenance.json', sha256: provenanceSha },
      ...grids.map(grid => ({ path: `src/objects/betelgeuse-shell/source/${grid.file}`, sha256: sha256(grid.built.ktx2) }))],
    sky: { centerIcrsDegrees: [raDeg, decDeg], distancePc: distanceM / METERS_PER_PARSEC, imageRotationDegrees: 0, arcsecPerUnit: radiusArcsec },
    sourceUrl: 'https://archive.eso.org/scienceportal/home?data_collection=BETELGEUSE-B',
    description: 'Dust around Betelgeuse in two datasets that share one frame: the degree of linear polarisation measured by VLT/SPHERE-ZIMPOL on 3 December 2024, and the dust clump Montargès et al. fitted to the Great Dimming of December 2019. One unit is one stellar radius; the depth of each is a stated model, not a measurement.',
    defaultLens, framingRadiusUnits: GRID.halfUnits,
    acceptedLabResult: 'betelgeuse-shell-two-grids',
    compactInputs: deliveryGrids.find(grid => grid.id === defaultLens)!.recipe, compactMethod: 'density-grid',
    grids: deliveryGrids,
  };
  const sceneBytes = await readFile(starScene);
  const catalogue = {
    schema: 'cssearth-nebula-catalog@1', frame: { referenceFrame: scene.worldFrame.referenceFrame, epochJdTt: scene.worldFrame.epochJdTt },
    sources: [
      { id: 'eso-zimpol-v-dolp', url: `https://dataportal.eso.org/dataPortal/file/${PRODUCTS.dolp.dpId}`, sha256: PRODUCTS.dolp.sha256, bytes: PRODUCTS.dolp.bytes, citation: 'ESO Phase 3 collection BETELGEUSE-B, SPHERE/ZIMPOL V-band degree of linear polarisation, 2024-12-03; Montargès et al. 2026, A&A 711, L12' },
      { id: 'betelgeuse-scene', url: 'https://github.com/layoutit/css.earth/blob/main/src/objects/betelgeuse/README.md', sha256: sha256(sceneBytes), bytes: sceneBytes.length, citation: 'Betelgeuse prepared world frame: SIMBAD position and proper motion, Joyce et al. 2020 distance and radius' },
    ],
    objects: [{ id: 'betelgeuse-shell', kind: 'nebula', name: 'Betelgeuse dust shell', aliases: ['alf Ori dust shell'],
      positionM: origin, skyPosition: { raDeg, decDeg, sourceRef: 'betelgeuse-scene' },
      distance: { valuePc: distanceM / METERS_PER_PARSEC, sourceRef: 'betelgeuse-scene', method: 'Joyce et al. 2020 asteroseismic distance, 168 (+27/-15) pc, as adopted by the Betelgeuse object.' },
      classification: { name: 'Circumstellar dust', basis: 'Polarised light from dust one to 4.5 stellar radii out, measured in 2024, and the dust clump fitted to the 2019 Great Dimming; depth in both follows the convention of the papers that published them.', sourceRef: 'eso-zimpol-v-dolp' },
      status: 'confirmed', detailedObjectId: 'betelgeuse-shell' }],
  };
  outputs.push(['delivery.json', Buffer.from(JSON.stringify(delivery, null, 2) + '\n')],
    ['nebula.json', Buffer.from(JSON.stringify(catalogue, null, 2) + '\n')]);

  // The presentation the application reads, and the manifest that accounts for every retained source byte.
  const facts = (grid: typeof grids[number]) => grid.id === 'zimpol-v'
    ? [{ id: 'instrument', label: 'Instrument', value: 'VLT/SPHERE-ZIMPOL, V band, 3 December 2024' },
       { id: 'resolution', label: 'Angular resolution', value: '16 mas, 0.76 stellar radii' },
       { id: 'extent', label: 'Drawn extent', value: '1 to 4.5 stellar radii, tapering to 6' },
       { id: 'depth', label: 'Depth', value: 'Not measured; a plane-of-sky slab spread by scattering angle' }]
    : [{ id: 'model', label: 'Model', value: 'RADMC-3D sphere of constant density, Montarg\u00e8s et al. 2021, Extended Data Table 3' },
       { id: 'geometry', label: 'Centre and radius', value: '(\u22121.9, \u22123.0, +12.5) au along right ascension, declination and toward Earth; radius 6.5 au' },
       { id: 'density', label: 'Dust density', value: '3.2 \u00d7 10\u207b\u00b9\u2079 g cm\u207b\u00b3 in MgFeSiO\u2084 grains centred on 0.21 \u00b5m' },
       { id: 'epoch', label: 'Epoch', value: 'December 2019, the only optimised solution the paper reports' }];
  const presentation = {
    schema: 'cssearth-volume-presentation-source@1', objectId: 'betelgeuse-shell', name: 'Betelgeuse dust shell',
    defaultLens,
    bank: { path: 'src/objects/betelgeuse-shell/prepared/lenses.json', sha256: '', bytes: 0 },
    recipes: deliveryGrids.map(grid => ({ id: grid.id, path: grid.recipe.path, sha256: grid.recipe.sha256, bytes: 0 })),
    sharedInputs: [],
    inputEvidence: [],
    lenses: grids.map(grid => ({
      id: grid.id, label: grid.label, title: grid.id === 'zimpol-v' ? 'Polarised dust around Betelgeuse in 2024' : 'The dust clump of the Great Dimming',
      description: grid.id === 'zimpol-v'
        ? 'The degree of linear polarisation VLT/SPHERE-ZIMPOL measured in the V band on 3 December 2024, placed in the plane of the sky through the star and spread along the line of sight by the scattering-angle efficiency of polarised light. The patches are dust. Depth is a stated convention, not a measurement, and nothing finer than the 16 milliarcsecond beam is in the data.'
        : 'The dust clump Montarg\u00e8s et al. fitted with RADMC-3D to the images of the Great Dimming, drawn from the numbers they published for December 2019: a sphere of uniform density south and slightly west of the star and between it and us. It is drawn as starlight scattered by that dust, so only the illumination varies across it. This is a model fitted to images, not an image.',
      summary: grid.id === 'zimpol-v' ? 'Measured polarised light from dust one to 4.5 stellar radii out; its depth is a convention.' : 'A published model of the dust that dimmed the southern hemisphere in December 2019.',
      detail: grid.id === 'zimpol-v' ? '1024 \u00d7 1024 px at 3.6 mas' : 'Sphere of 6.5 au at 13.0 au',
      facts: facts(grid), input: grid.id === 'zimpol-v' ? 'sphere-zimpol-betelgeuse-p1-v-dolp' : 'veil-2019-12-parameters',
      preview: { path: `${packageBase}/${PREVIEWS[grid.id as keyof typeof PREVIEWS].path}`,
        sha256: PREVIEWS[grid.id as keyof typeof PREVIEWS].sha256, bytes: PREVIEWS[grid.id as keyof typeof PREVIEWS].bytes,
        url: PREVIEWS[grid.id as keyof typeof PREVIEWS].url,
        ...('crop' in PREVIEWS[grid.id as keyof typeof PREVIEWS] ? { crop: (PREVIEWS[grid.id as keyof typeof PREVIEWS] as { crop: unknown }).crop } : {}) },
    })),
  };
  outputs.push(['veil-2019-12-parameters.json', Buffer.from(JSON.stringify({
    schema: 'cssearth-published-model-parameters@1', objectId: 'betelgeuse-shell', lensId: 'veil-2019-12',
    citation: 'Montarg\u00e8s, M., Cannon, E., Lagadec, E., de Koter, A., Kervella, P., Sanchez-Bermudez, J., Paladini, C., Cannon, E., et al. 2021, "A dusty veil shading Betelgeuse during its Great Dimming", Nature 594, 365',
    doi: '10.1038/s41586-021-03546-8', preprint: 'https://arxiv.org/abs/2201.10551',
    locator: 'Extended Data Table 3, column "December 2019"; axes defined by Extended Data Figure 6',
    coordinates: 'x along right ascension, y along declination, z positive toward Earth, origin at the centre of the star',
    epoch: '2019-12', centreAu: [...VEIL_2019_12.centreRaDecEarthAu], radiusAu: VEIL_2019_12.radiusAu,
    dustDensityGramsPerCubicCentimetre: VEIL_2019_12.densityGramsPerCubicCentimetre,
    composition: VEIL_2019_12.composition, grainMicrometres: VEIL_2019_12.grainMicrometres,
    notes: 'The same table gives January and March 2020 solutions, which the paper records as unoptimised best guesses; they are not used. Silicates sublimate near 1500 K, so the real clump is emptier on the side facing the star than the uniform sphere the paper published and this record repeats.',
  }, null, 2) + '\n')]);
  outputs.push(['presentation.json', Buffer.from(JSON.stringify(presentation, null, 2) + '\n')]);

  // The bank pin closes over the baked output, so it is filled on the pass after a bake; the first pass leaves it empty
  // and preparation refuses it, which is the intended order: author, bake, author again.
  const bankPath = resolve(root, '..', 'prepared/lenses.json');
  const bankBytes = await readFile(bankPath).catch(() => null);
  if (bankBytes) { presentation.bank = { path: 'src/objects/betelgeuse-shell/prepared/lenses.json', sha256: sha256(bankBytes), bytes: bankBytes.length }; }
  for (const recipe of presentation.recipes) {
    const bytes = outputs.find(([name]) => `${packageBase}/${name}` === recipe.path)?.[1];
    if (bytes) recipe.bytes = bytes.length;
  }
  outputs[outputs.findIndex(([name]) => name === 'presentation.json')] = ['presentation.json', Buffer.from(JSON.stringify(presentation, null, 2) + '\n')];

  // Every retained byte under source/, accounted for once. Files this script writes are hashed from what it just
  // produced; the archive products and publisher figures beside them are hashed from disk.
  const produced = new Map(outputs.map(([name, bytes]) => [name, bytes]));
  const walked: string[] = [];
  const walk = async (relativePath: string) => {
    for (const entry of (await readdir(resolve(root, relativePath || '.'), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const next = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(next); else if (next !== 'manifest.json') walked.push(next);
    }
  };
  await walk('');
  for (const name of produced.keys()) if (!walked.includes(name)) walked.push(name);
  const observations: Record<string, { dpId: string; role: string }> = {
    'observations/SPHERE_ZIMPOL_Betelgeuse_P1_V_phase3.fits': { dpId: PRODUCTS.intensity.dpId, role: 'V-band pipeline intensity; the star centre and the intensity floor are measured on it' },
    'observations/SPHERE_ZIMPOL_Betelgeuse_P1_V_DOLP.fits': { dpId: PRODUCTS.dolp.dpId, role: 'V-band degree of linear polarisation; the quantity the 2024 lens carries' },
    'observations/SPHERE_ZIMPOL_Betelgeuse_P1_N_I_phase3.fits': { dpId: 'ADP.2026-08-19T13:19:07.647', role: 'N_I pipeline intensity, retained for comparison and not drawn' },
    'observations/SPHERE_ZIMPOL_Betelgeuse_P1_N_I_DOLP.fits': { dpId: 'ADP.2026-08-19T13:19:07.648', role: 'N_I degree of linear polarisation, retained for comparison and not drawn' },
  };
  const previewByPath = new Map(Object.entries(PREVIEWS).map(([id, preview]) => [preview.path, { id, ...preview }]));
  const inputs: unknown[] = [], documents: unknown[] = [], intermediates: unknown[] = [];
  // The catalogue records are generated by tools/author-source-records.mts from these bindings. Their evidence names
  // the commit the manifest was pinned at, which that tool writes with --evidence; a binding already pinned keeps its
  // revision so re-authoring never unpins a record.
  const pinnedManifest = await readFile(resolve(root, 'manifest.json'), 'utf8').then(
    text => JSON.parse(text) as { inputs?: { id?: string; sourceBinding?: { references?: { catalogueId?: string; evidence?: string }[] } }[] }, () => ({}));
  const pinnedEvidence = new Map((pinnedManifest.inputs ?? []).flatMap(input =>
    (input.sourceBinding?.references ?? []).map(reference => [`${input.id}/${reference.catalogueId}`, reference.evidence])));
  const binding = (id: string) => {
    const catalogueId = `source-betelgeuse-shell-${id}`;
    const evidence = pinnedEvidence.get(`${id}/${catalogueId}`) ?? `${packageBase}/manifest.json@${'0'.repeat(40)}#/inputs/${inputs.length}`;
    return { dependencies: [], sourceBinding: { kind: 'catalogued', references: [{ catalogueId, role: 'material', evidence }] } };
  };
  for (const name of walked.sort((a, b) => a.localeCompare(b, 'en'))) {
    const bytes = produced.get(name) ?? await readFile(resolve(root, name));
    const path = `${packageBase}/${name}`, pin = { expectedSha256: sha256(bytes), expectedBytes: bytes.length };
    const observation = observations[name], preview = previewByPath.get(name);
    if (observation) {
      const id = name.split('/').at(-1)!.replace(/\.fits$/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      inputs.push({ id, ...binding(id), path,
        origin: `https://dataportal.eso.org/dataPortal/file/${observation.dpId}`, sourceUrl: 'https://archive.eso.org/scienceportal/home?data_collection=BETELGEUSE-B',
        title: `ESO Phase 3 BETELGEUSE-B \u00b7 ${observation.dpId}`, credit: 'ESO/VLT/SPHERE-ZIMPOL, programme 114.28H9.001; Montarg\u00e8s et al. 2026, A&A 711, L12',
        displayCredit: 'ESO/VLT/SPHERE-ZIMPOL', acquisition: `Downloaded unchanged from the ESO archive by its DataLink identifier ${observation.dpId}. ${observation.role}.`,
        license: 'CC-BY-4.0 under the ESO data access policy; retain the ESO provenance and the paper citation.',
        ...(id === 'sphere-zimpol-betelgeuse-p1-v-dolp' ? { lensId: 'zimpol-v' } : {}), ...pin });
    } else if (preview) {
      inputs.push({ id: `preview-${preview.id}`, ...binding(`preview-${preview.id}`), path, origin: preview.origin, sourceUrl: preview.origin, title: preview.title,
        credit: preview.credit, displayCredit: preview.credit,
        acquisition: `Publisher figure downloaded unchanged from ${preview.url}; preparation resizes it into this object's dataset preview.`,
        license: preview.license, ...pin });
    } else if (name === 'veil-2019-12-parameters.json') {
      inputs.push({ id: 'veil-2019-12-parameters', ...binding('veil-2019-12-parameters'), path,
        origin: 'https://doi.org/10.1038/s41586-021-03546-8', sourceUrl: 'https://arxiv.org/abs/2201.10551',
        title: 'Montarg\u00e8s et al. 2021 \u00b7 December 2019 dust clump parameters',
        credit: 'Montarg\u00e8s et al. 2021, Nature 594, 365, Extended Data Table 3 and Figure 6',
        displayCredit: 'Montarg\u00e8s et al. (2021)',
        acquisition: 'The published December 2019 clump geometry, density, composition and grain size, transcribed from the paper with its coordinate convention. This record identifies the transcription; the paper is the source.',
        license: 'Published numbers cited under normal scholarly citation; the paper is not redistributed here.',
        lensId: 'veil-2019-12', ...pin });
    } else if (name.endsWith('.pdf')) {
      documents.push({ id: 'release-description', path, ...pin,
        sourceBinding: { kind: 'local', reason: 'The ESO Phase 3 release description of the collection, retained beside the products it describes.' } });
    } else if (name.endsWith('.ktx2') || name.startsWith('volume-')) {
      intermediates.push({ id: name.replace(/[^a-z0-9-]+/g, '-').toLowerCase(), path, ...pin,
        sourceBinding: { kind: 'local', reason: 'Density grid and slab recipe written by tools/objects/source-authoring/betelgeuse-shell/author.mts from the archive products and published parameters bound above.' } });
    } else {
      documents.push({ id: name.replace(/[^a-z0-9-]+/g, '-').toLowerCase(), path, ...pin,
        sourceBinding: { kind: 'local', reason: 'Object-owned delivery, catalogue, provenance or presentation record; the published inputs it cites are bound above.' } });
    }
  }
  outputs.push(['manifest.json', Buffer.from(JSON.stringify({ schema: 'cssearth-volume-source-manifest@1', pathBase: 'repository',
    inputs, documents, generatedIntermediates: intermediates }, null, 2) + '\n')]);
  return { outputs, measured: provenance.measured, grids: grids.map(g => ({ id: g.id, peak: g.built.peak, voxels: g.built.filled })) };
}

const direct = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) {
  const check = process.argv.includes('--check');
  const selected = process.argv.find(arg => arg.startsWith('--default='))?.slice(10);
  const result = await author(selected);
  await mkdir(root, { recursive: true });
  for (const [name, bytes] of result.outputs) {
    const target = resolve(root, name);
    if (check) {
      const existing = await readFile(target).catch(() => null);
      if (!existing || !existing.equals(bytes)) throw new Error(`Authored output differs: ${name}`);
    } else await writeFile(target, bytes);
  }
  console.log(`${check ? 'CHECKED' : 'AUTHORED'} betelgeuse-shell: ${JSON.stringify(result.measured)}; grid ${GRID.size}^3; ${JSON.stringify(result.grids)}`);
}
