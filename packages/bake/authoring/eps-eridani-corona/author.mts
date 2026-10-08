#!/usr/bin/env node
/** ε Eridani's corona, as density grids the shared slab baker turns into one dataset bank attached to the star.
 *
 *   node packages/bake/authoring/eps-eridani-corona/author.mts [--check]
 *
 * Nobody has imaged this corona. Every grid is a density in three dimensions: each voxel takes the density at its own
 * place about the star. Nothing is a sky image given depth.
 *
 * **simulation-2008-01, simulation-2011-10, simulation-2013-10**: the gas density of the magnetohydrodynamic simulations
 * Ó Fionnagáin et al. (2022) ran for this star, each driven by the map of its surface magnetic field observed in that month,
 * read from their Zenodo deposit (simulation.mts). Each map was released as three runs, ten minutes after an eruption set
 * off near the equator or either pole; the run drawn is the one whose eruption disturbs the least of the drawn volume
 * (eruption-share.mts).
 * **wind**: the outflow Parker (1958) derives for gas at the temperature measured from the star's X-ray spectrum, carrying
 * the mass loss Wood et al. (2002) measure from its astrosphere. It is the same in every direction.
 *
 * One volume unit is one stellar radius. Every grid is shown through one radial filter and one exposure.
 * --check needs the nine simulation files under .local/eps-eridani-corona; without them it reports a SKIP. */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { VOLUME_PROVENANCE_SCHEMA } from '@cssearth/bake/volume';
import { PUBLISHED_MODEL_PARAMETERS_SCHEMA, VOLUME_SOURCE_MANIFEST_SCHEMA, VOLUME_PRESENTATION_SOURCE_SCHEMA, VOLUME_RECIPE_SCHEMA, NEBULA_DELIVERY_SCHEMA } from '@cssearth/objects';
import { access, mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { resolve } from 'node:path';
import { runAuthor } from '../authored-output.mts';
import { pathToFileURL } from 'node:url';
import { encodeDensityKtx2 } from '@cssearth/bake/density';
import { KELVIN_PER_KEV, PROTON_MASS_G, SECONDS_PER_YEAR, SOLAR_MASS_G, parkerWind } from './corona-models.mts';
import { eruptionShares } from './eruption-share.mts';
import { NATIVE, resample } from './simulation.mts';

const OBJECT_ID = 'eps-eridani-corona', HOST_ID = 'eps-eridani';
const packageBase = `src/objects/${OBJECT_ID}/source`;
const repository = checkoutProjectRoot(import.meta.url), root = resolve(repository, packageBase);
/** The host's tracked descriptor: it carries the world frame its prepared scene had. */
const starObject = resolve(repository, `src/objects/${HOST_ID}/object.json`);
/** The deposit's files stay out of git as every volume's downloads do; the manifest names them by path and origin. */
export const DOWNLOADS_BASE = '.local/eps-eridani-corona';

export const GRID = Object.freeze({ size: 96, halfUnits: 4, slabs: 32 });
/** The display every grid shares. The density scale's floor and the two radial fades are the ones the Sun's STEREO dataset
 * is shown with (src/objects/sun-cor1-density); its ceiling is raised from 6.5e6 to hold this star's denser gas. */
export const DISPLAY = Object.freeze({
  densityRangePerCm3: [1e5, 1e9] as const,
  innerFadeRadii: [1, 1.16] as const, outerFadeRadii: [2.6, 4] as const,
  /** A line of sight this many stellar radii long at the top of the scale reaches the top alpha. */
  fullScaleColumnRadii: 4.76, topAlpha: 0.9,
  /** The star's own color (its catalogue color #ffe6d0): light scattered by free electrons keeps the color of the light. */
  color: [1, 0.902, 0.816] as const,
});
/** The radial filter coronagraph pictures are shown through: at each distance from the star brightness is proportional to
 * density, as scattered light is, and only the fall-off with distance is compressed (logarithmically, by DISPLAY). A place
 * `ceiling` times denser than is typical of its distance is fully bright, and the exposure is `ceiling` times longer, so a
 * place of typical density is exactly as bright as it would be without the filter. */
export const RADIAL_FILTER = Object.freeze({ ceiling: 10 });

export const STAR = Object.freeze({
  massSolar: 0.82, massSource: 'NASA Exoplanet Archive ps default row (THOMPSON_ET_AL_2025), st_mass; the star package cites it',
  radiusSolar: 0.74, radiusSource: 'Baines & Armstrong (2012), ApJ 744, 138, section 3: 0.74 ± 0.01 solar radii; the star package cites it',
  coronalTemperatureKeV: 0.35, temperatureSource: 'Bennedik et al. (2026), arXiv:2607.27832, Table 5, row ε Eri: kT 0.35 keV',
});
export const WIND = Object.freeze({ massLossSolar: 30, solarMassLossSolarMassesPerYear: 2e-14,
  source: 'Wood, Müller, Zank & Linsky (2002), ApJ 574, 412, Table 1: 30 times the solar mass-loss rate of 2e-14 solar masses a year' });
/** The published simulation: its deposit, its three magnetic maps with their three runs each, and how its axes are placed on
 * the sky. Its z axis is the star's rotation axis, tilted from the line of sight by the inclination the magnetic maps were
 * fitted with. The papers used here give neither the direction of that axis on the sky nor the star's rotation phase today, so
 * the axis is drawn tilted toward north and the map's zero longitude toward Earth. */
export const SIMULATION = Object.freeze({
  doi: '10.5281/zenodo.5575241', landing: 'https://zenodo.org/records/5575241', catalogueId: 'zenodo-5575241-eps-eridani-cme-simulations',
  archive: 'eEri_CME_simulations.tar.gz', archiveUrl: 'https://zenodo.org/api/records/5575241/files/eEri_CME_simulations.tar.gz/content', archiveBytes: 6355199342,
  paper: 'Ó Fionnagáin, Kavanagh, Vidotto et al. (2022), ApJ 924, 115', preprint: 'https://arxiv.org/abs/2111.02284', license: 'CC-BY-4.0',
  mapsSource: 'Jeffers et al. (2014), A&A 569, A79', inclinationDegrees: 46, inclinationSource: 'Jeffers et al. (2017), MNRAS 471, L96: i = 46 ± 2°',
  maps: [
    { id: '2008-01', label: 'January 2008', directory: 'open_data/january2008_10min_CME', runs: {
      equator: { file: 'jan08eq_3dmhd_t00001000_n00152652.plt', bytes: 864145360 }, north: { file: 'jan08poleN_3dmhd_t00001000_n00153068.plt', bytes: 1124045428 },
      south: { file: 'jan08poleS_3dmhd_t00001000_n00143955.plt', bytes: 1045110960 } } },
    { id: '2011-10', label: 'October 2011', directory: 'open_data/october2011_10min_CME', runs: {
      equator: { file: 'oct11eq_3dmhd_t00001000_n00141228.plt', bytes: 881330704 }, north: { file: 'oct11poleN_3dmhd_t00001000_n00132318.plt', bytes: 1131266644 },
      south: { file: 'oct11poleS_3dmhd_t00001000_n00128423.plt', bytes: 1053683024 } } },
    { id: '2013-10', label: 'October 2013', directory: 'open_data/october2013_10min_CME', runs: {
      equator: { file: 'oct13_3dmhd_t00001000_n00115012.plt', bytes: 970731792 }, north: { file: 'oct13poleN_3dmhd_t00001000_n00123792.plt', bytes: 1134553108 },
      south: { file: 'oct13poleS_3dmhd_t00001000_n00125626.plt', bytes: 1078127600 } } },
  ],
} as const);
const SITES = ['equator', 'north', 'south'] as const;
type Site = typeof SITES[number];
const SITE_TEXT: Record<Site, string> = { equator: 'near the equator', north: 'near the north pole', south: 'near the south pole' };
export const runPath = (map: typeof SIMULATION.maps[number], site: Site) => `${DOWNLOADS_BASE}/${map.directory}/${map.runs[site].file}`;

const smoothstep = (a: number, b: number, t: number) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
/** A density's place on the logarithmic scale, faded at the star's edge and at the edge of the drawn volume. The star's own
 * sphere is drawn inside one radius, so nothing is. */
export function scaleValue(densityPerCm3: number, radii: number) {
  if (radii < 1) return 0;
  const [low, high] = DISPLAY.densityRangePerCm3;
  const scaled = Math.max(0, Math.min(1, (Math.log10(densityPerCm3) - Math.log10(low)) / (Math.log10(high) - Math.log10(low))));
  return scaled * smoothstep(DISPLAY.innerFadeRadii[0], DISPLAY.innerFadeRadii[1], radii) * (1 - smoothstep(DISPLAY.outerFadeRadii[0], DISPLAY.outerFadeRadii[1], radii));
}
/** The display value of a density through the radial filter, given the density typical of that radius. */
export const filteredValue = (densityPerCm3: number, typicalPerCm3: number, radii: number) =>
  scaleValue(typicalPerCm3, radii) * Math.min(RADIAL_FILTER.ceiling, densityPerCm3 / typicalPerCm3) / RADIAL_FILTER.ceiling;

type Display = (x: number, y: number, z: number, radii: number) => number;
/** Encode a display field as the RGBA8 grid the slab baker reads; its channel transfer squares the byte back. */
function encodeGrid(display: Display) {
  const { size, halfUnits } = GRID, step = 2 * halfUnits / size, rgba = new Uint8Array(size ** 3 * 4);
  let filled = 0;
  for (let k = 0; k < size; k++) for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step, z = -halfUnits + (k + 0.5) * step, radii = Math.hypot(x, y, z);
    const value = radii < 1 || radii > halfUnits ? 0 : display(x, y, z, radii);
    if (!(value > 0)) continue;
    filled++;
    const byte = Math.round(255 * Math.sqrt(value)), o = 4 * ((k * size + j) * size + i);
    rgba[o] = byte; rgba[o + 1] = byte; rgba[o + 2] = byte;
  }
  return { ktx2: encodeDensityKtx2({ width: size, height: size, depth: size, encodedRgba: rgba }, 9), filled };
}
/** The preview: the grid seen from Earth, the display value summed along each line of sight through the exposure, over the
 * star's disc. In front of the disc only the near half is seen; the star hides the rest. */
async function preview(display: Display, exposureGain: number, pixels = 192) {
  const { halfUnits } = GRID, step = 2 * halfUnits / pixels, dz = 0.02, rgba = Buffer.alloc(pixels * pixels * 4);
  for (let row = 0; row < pixels; row++) for (let column = 0; column < pixels; column++) {
    const x = -halfUnits + (column + 0.5) * step, y = halfUnits - (row + 0.5) * step, impact = Math.hypot(x, y), o = 4 * (row * pixels + column);
    let sum = 0;
    if (impact >= 1) for (let z = -halfUnits; z < halfUnits; z += dz) { const radii = Math.hypot(impact, z + dz / 2); if (radii <= halfUnits) sum += display(x, y, z + dz / 2, radii) * dz; }
    rgba[o] = Math.round(255 * DISPLAY.color[0]); rgba[o + 1] = Math.round(255 * DISPLAY.color[1]); rgba[o + 2] = Math.round(255 * DISPLAY.color[2]);
    rgba[o + 3] = Math.round(255 * (impact < 1 ? 1 : -Math.expm1(-exposureGain * sum)));
  }
  return sharp(rgba, { raw: { width: pixels, height: pixels, channels: 4 } }).png().toBuffer();
}

function volumeRecipe(grid: string, exposureGain: number) {
  return {
    schema: VOLUME_RECIPE_SCHEMA,
    grid: { path: grid, dimensions: [GRID.size, GRID.size, GRID.size], encoding: 'sqrt-density-unorm8',
      bounds: { min: [-GRID.halfUnits, -GRID.halfUnits, -GRID.halfUnits], max: [GRID.halfUnits, GRID.halfUnits, GRID.halfUnits] } },
    material: { intensityScale: 1, stepScale: 1, stepMetric: 'source', emission: [{ channel: 0, color: [...DISPLAY.color], strength: 1 }],
      absorption: [], emissionTransfer: 'shared-opacity', exposureGain },
    bake: { sliceCounts: { x: GRID.slabs, y: GRID.slabs, z: GRID.slabs }, unitsPerSourceUnit: 1, imageWidth: 320, samplesPerSlab: 4,
      cropTransparent: true, opticalWeight: 1, imageEncoding: { format: 'webp', quality: 90 } },
    anchors: [{ id: HOST_ID, referencePositionM: [0, 0, 0] }],
    provenance: { path: 'provenance.json' },
  };
}

const sci = (value: number) => { const exponent = Math.floor(Math.log10(value)); return `${(value / 10 ** exponent).toFixed(1)} × 10^${exponent}`; };
const percent = (share: number) => `${(100 * share).toFixed(0)}%`;

export async function author() {
  const scene = (JSON.parse(await readFile(starObject, 'utf8')) as { properties: { worldFrame: { originM: [number, number, number]; bodyRadiusM: number } } }).properties;
  const origin = scene.worldFrame.originM, radiusM = scene.worldFrame.bodyRadiusM, distanceM = Math.hypot(...origin), distancePc = distanceM / 3.085677581491367e16;
  const raDeg = (Math.atan2(origin[1], origin[0]) * 180 / Math.PI + 360) % 360, decDeg = Math.asin(origin[2] / distanceM) * 180 / Math.PI;
  const radiusArcsec = radiusM / distanceM * 206264.80624709636;

  // --- the wind: published temperature and mass loss through Parker's solution ---
  const kelvin = STAR.coronalTemperatureKeV * KELVIN_PER_KEV;
  const massLossGramsPerSecond = WIND.massLossSolar * WIND.solarMassLossSolarMassesPerYear * SOLAR_MASS_G / SECONDS_PER_YEAR;
  const wind = parkerWind({ massLossGramsPerSecond, kelvin, massSolar: STAR.massSolar, radiusSolar: STAR.radiusSolar });

  // --- the simulations: each map's three runs resampled, the least disturbed one drawn ---
  type Resampled = Awaited<ReturnType<typeof resample>>;
  const maps: ((typeof SIMULATION.maps)[number] & { site: Site; density: Float32Array; shells: Resampled['measured']['shells']; cells: number; eruptions: ReturnType<typeof eruptionShares> })[] = [];
  for (const map of SIMULATION.maps) {
    const runs: Resampled[] = [];
    for (const site of SITES) runs.push(await resample(resolve(repository, runPath(map, site))));
    const eruptions = eruptionShares([runs[0]!.density, runs[1]!.density, runs[2]!.density]);
    const drawn = eruptions.share.indexOf(Math.min(...eruptions.share));
    maps.push({ ...map, site: SITES[drawn]!, density: runs[drawn]!.density, shells: runs[drawn]!.measured.shells, cells: runs[drawn]!.measured.cellsInside, eruptions });
  }
  // The density typical of each radius: the three drawn runs' shell medians, averaged in the logarithm, joined by straight
  // lines in log radius and log density. One profile for all three maps, so a map that is denser overall looks brighter.
  const shellRadii = maps[0]!.shells.map(shell => shell.radius);
  const typicalShells = shellRadii.map((radius, index) => [Math.log(radius), maps.reduce((sum, map) => sum + Math.log(map.shells[index]!.electronsPerCm3.median), 0) / maps.length] as const);
  const typical = (radii: number) => {
    const at = Math.log(radii); let i = 0; while (i < typicalShells.length - 2 && at > typicalShells[i + 1]![0]) i++;
    const [r0, d0] = typicalShells[i]!, [r1, d1] = typicalShells[i + 1]!;
    return Math.exp(d0 + (d1 - d0) * (at - r0) / (r1 - r0));
  };
  const tilt = SIMULATION.inclinationDegrees * Math.PI / 180, cosTilt = Math.cos(tilt), sinTilt = Math.sin(tilt);
  /** Electrons per cm³ of the hydrogen plasma the simulation assumes, at a place in the grid's axes (west, north, away from
   * Earth). The simulation's own axes are its zero longitude, 90° east of it, and the rotation axis. */
  const simulated = (cube: Float32Array) => (x: number, y: number, z: number) => {
    const sx = -cosTilt * y - sinTilt * z, sy = -x, sz = sinTilt * y - cosTilt * z;
    const { size, halfUnits } = NATIVE, f = (value: number) => (value + halfUnits) / (2 * halfUnits / size) - 0.5;
    const fx = f(sx), fy = f(sy), fz = f(sz), i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz);
    let sum = 0, weight = 0;
    for (let c = 0; c < 8; c++) {
      const ii = i + (c & 1), jj = j + (c >> 1 & 1), kk = k + (c >> 2 & 1);
      if (ii < 0 || jj < 0 || kk < 0 || ii >= size || jj >= size || kk >= size) continue;
      const value = cube[(kk * size + jj) * size + ii]!;
      if (!Number.isFinite(value)) continue;
      const w = (c & 1 ? fx - i : 1 - (fx - i)) * (c >> 1 & 1 ? fy - j : 1 - (fy - j)) * (c >> 2 & 1 ? fz - k : 1 - (fz - k));
      sum += w * value; weight += w;
    }
    return weight > 0 ? sum / weight / PROTON_MASS_G : 0;
  };

  const baseGain = -Math.log(1 - DISPLAY.topAlpha) / DISPLAY.fullScaleColumnRadii, filterGain = baseGain * RADIAL_FILTER.ceiling;
  const orientationFact = { id: 'orientation', label: 'Orientation', value: `Rotation axis ${SIMULATION.inclinationDegrees}° from the line of sight, as the maps were fitted; its direction on the sky and the rotation phase are conventions` };
  const filterFact = { id: 'filter', label: 'Brightness', value: `Proportional to density at each distance; ${RADIAL_FILTER.ceiling} times the typical density is fully bright. The fall-off with distance is compressed (log₁₀ density, ${sci(DISPLAY.densityRangePerCm3[0])} to ${sci(DISPLAY.densityRangePerCm3[1])} cm⁻³)` };
  const datasets = [
    ...maps.map(map => {
      const at2 = map.shells.find(shell => shell.radius === 2)!.electronsPerCm3, share = map.eruptions.share[SITES.indexOf(map.site)]!, density = simulated(map.density);
      return { id: `simulation-${map.id}`, label: `Simulated corona · ${map.label}`, input: `run-${map.id}-${map.site}`, exposureGain: filterGain,
        display: ((x, y, z, radii) => filteredValue(density(x, y, z), typical(radii), radii)) as Display,
        title: `ε Eridani’s corona in a published simulation, for its magnetic field of ${map.label}`,
        summary: `A published simulation, not an image: gas shaped by the magnetic field mapped in ${map.label}.`,
        description: `Nobody has imaged this corona. This is the gas density in the magnetohydrodynamic simulation ${SIMULATION.paper} ran for this star, driven by the map of its surface magnetic field observed in ${map.label} (${SIMULATION.mapsSource}), from the data they released (${SIMULATION.landing}). The released state is ten minutes after the authors set off an eruption ${SITE_TEXT[map.site]} of the model; that eruption disturbs ${percent(share)} of the volume drawn here. It is shown the way coronagraph pictures are: at each distance from the star brightness is proportional to the density there, and only the steep fall-off with distance is compressed. The rotation axis is tilted ${SIMULATION.inclinationDegrees}° from the line of sight, as the magnetic maps were fitted; these sources give neither where the axis points on the sky nor the star's rotation phase today, so both are drawn by convention.`,
        detail: `${GRID.size}³ grid from ${(map.cells / 1e6).toFixed(1)} million simulation cells, 1 to ${GRID.halfUnits} stellar radii`,
        facts: [
          { id: 'kind', label: 'Kind', value: 'A published simulation driven by an observed magnetic map, not an observation' },
          { id: 'map', label: 'Magnetic map', value: `${map.label}, from spectropolarimetry (${SIMULATION.mapsSource})` },
          { id: 'state', label: 'State', value: `Ten minutes after a modelled eruption ${SITE_TEXT[map.site]}, which disturbs ${percent(share)} of the drawn volume` },
          { id: 'density', label: 'Density at 2 radii', value: `Typically ${sci(at2.median)} electrons per cm³; the densest twentieth is ${(at2.p95 / at2.p05).toFixed(0)} times the thinnest` },
          orientationFact, filterFact,
        ] };
    }),
    { id: 'wind', label: 'Modelled wind · measured mass loss', input: 'wind-parameters', exposureGain: baseGain,
      display: ((_x, _y, _z, radii) => scaleValue(wind.density(radii), radii)) as Display,
      title: 'ε Eridani’s corona as the wind that carries its measured mass loss',
      summary: 'Modelled, not observed: the outflow at the measured temperature that carries the measured mass loss.',
      description: `Nobody has imaged this corona. This is the density of the wind Parker (1958) derives for gas at ${(kelvin / 1e6).toFixed(2)} million kelvin, the temperature measured from the star's X-ray spectrum, carrying ${WIND.massLossSolar} times the Sun's mass loss, which Wood et al. (2002) measure from the star's astrosphere. It leaves the surface at ${wind.speedKmS(1).toFixed(0)} kilometres a second and passes the speed of sound ${wind.criticalRadii.toFixed(2)} radii out. It is the same in every direction, because the model has no magnetic field; the simulated datasets show what the field does to it.`,
      detail: `${GRID.size}³ grid, 1 to ${GRID.halfUnits} stellar radii`,
      facts: [
        { id: 'kind', label: 'Kind', value: 'A model from published numbers, not an observation' },
        { id: 'mass-loss', label: 'Mass loss', value: `${WIND.massLossSolar} times the Sun's, measured from the astrosphere (Wood et al. 2002)` },
        { id: 'temperature', label: 'Temperature', value: `${(kelvin / 1e6).toFixed(2)} million K, measured from the X-ray spectrum (Bennedik et al. 2026)` },
        { id: 'base', label: 'Density at the surface', value: `${sci(wind.basePerCm3)} electrons per cm³` },
        { id: 'edge', label: 'Density at 4 radii', value: `${sci(wind.density(4))} electrons per cm³, moving at ${wind.speedKmS(4).toFixed(0)} km/s` },
        { id: 'scale', label: 'Brightness', value: `log₁₀ density, ${sci(DISPLAY.densityRangePerCm3[0])} to ${sci(DISPLAY.densityRangePerCm3[1])} cm⁻³, in the star's color` },
      ] },
  ];
  const defaultDataset = `simulation-${SIMULATION.maps.at(-1)!.id}`;

  const outputs: [string, Buffer][] = [], built: { id: string; voxels: number }[] = [];
  const deliveryGrids: { id: string; label: string; sourceUrl: string; recipe: { path: string } }[] = [];
  for (const dataset of datasets) {
    const grid = encodeGrid(dataset.display), file = `density-${dataset.id}.ktx2`;
    built.push({ id: dataset.id, voxels: grid.filled });
    outputs.push([file, Buffer.from(grid.ktx2)], [`volume-${dataset.id}.json`, Buffer.from(JSON.stringify(volumeRecipe(file, dataset.exposureGain), null, 2) + '\n')],
      [`previews/${dataset.id}.png`, await preview(dataset.display, dataset.exposureGain)]);
    deliveryGrids.push({ id: dataset.id, label: dataset.label, sourceUrl: dataset.id === 'wind' ? 'https://doi.org/10.1086/340797' : SIMULATION.landing, recipe: { path: `${packageBase}/volume-${dataset.id}.json` } });
  }

  const windRecord = { ...WIND, kelvin, massLossGramsPerSecond, soundKmS: wind.soundKmS, criticalRadii: wind.criticalRadii, speedAtSurfaceKmS: wind.speedKmS(1), speedAt4RadiiKmS: wind.speedKmS(4),
    electronsPerCm3: Object.fromEntries([1, 1.5, 2, 3, 4].map(radius => [String(radius), wind.density(radius)])) };
  const measured = {
    star: { ...STAR, radiusArcsec, sceneOriginRaDecDeg: [raDeg, decDeg], distancePc },
    wind: windRecord,
    simulation: { doi: SIMULATION.doi, inclinationDegrees: SIMULATION.inclinationDegrees, cube: { ...NATIVE },
      maps: maps.map(map => ({ id: map.id, label: map.label, drawnRun: map.site, cellsInsideCube: map.cells,
        eruptions: Object.fromEntries(SITES.map((site, index) => [site, { file: map.runs[site].file, shareOfDrawnVolume: map.eruptions.share[index], meanLatitudeDegrees: map.eruptions.meanLatitudeDegrees[index] }])),
        eruptionFactor: map.eruptions.factor, twoRunsDisturbedShare: map.eruptions.twoRunsShare, shells: map.shells })),
      typicalElectronsPerCm3: Object.fromEntries(shellRadii.map((radius, index) => [String(radius), Math.exp(typicalShells[index]![1])])) },
    display: { ...DISPLAY, radialFilter: RADIAL_FILTER, exposureGain: baseGain, filteredExposureGain: filterGain },
  };
  const provenance = {
    schema: VOLUME_PROVENANCE_SCHEMA,
    title: 'ε Eridani corona: a published simulation for three observed magnetic maps, and a wind model from published measurements',
    kind: 'published-simulation-and-published-measurements-through-a-stated-model',
    authors: ['D. Ó Fionnagáin', 'R. D. Kavanagh', 'A. A. Vidotto', 'S. V. Jeffers', 'B. E. Wood', 'H.-R. Müller', 'G. P. Zank', 'J. L. Linsky', 'E. N. Parker', 'M. M. Bennedik', 'B. Stelzer'],
    organizations: ['Zenodo (the simulation deposit)', 'Télescope Bernard Lyot/NARVAL (the spectropolarimetry behind the magnetic maps)', 'HST/STIS (the astrospheric Lyman-alpha absorption)', 'XMM-Newton, SRG/eROSITA and ROSAT (the X-ray temperature)'],
    license: { spdx: SIMULATION.license, note: 'The simulation data are released under CC BY 4.0 on Zenodo; retain the citation. The wind model uses published numbers cited under normal scholarly citation.' },
    sources: [
      { id: 'simulation', url: `https://doi.org/${SIMULATION.doi}`, bytes: SIMULATION.archiveBytes, role: `${SIMULATION.paper}: the nine BATS-R-US solution files of ${SIMULATION.archive}` },
      { id: 'simulation-paper', url: SIMULATION.preprint, role: 'The paper that describes the simulations, their magnetic maps and their eruptions' },
      { id: 'inclination', url: 'https://arxiv.org/abs/1710.09227', role: SIMULATION.inclinationSource },
      { id: 'mass-loss', url: 'https://doi.org/10.1086/340797', role: WIND.source },
      { id: 'temperature', url: 'https://arxiv.org/abs/2607.27832', role: STAR.temperatureSource },
      { id: 'wind-solution', url: 'https://doi.org/10.1086/146579', role: 'Parker (1958), ApJ 128, 664: the isothermal wind' },
    ],
    paper: { doi: '10.3847/1538-4357/ac35de', citation: `${SIMULATION.paper}, "Coronal mass ejections and type II radio emission variability during a magnetic cycle on the solar-type star ε Eridani"` },
    measured,
    models: Object.fromEntries(datasets.map(dataset => [dataset.id, dataset.description])),
    limitations: [
      'No telescope has imaged this corona; every grid is a simulation or a model.',
      'Each simulated grid is an instant ten minutes after an eruption the authors set off; the steady state it started from was not released. The drawn run is the one whose eruption disturbs the least of the drawn volume.',
      'The simulation resolves the magnetic field only as far as the maps do: the large-scale field, not active regions.',
      'The rotation axis is tilted from the line of sight by the fitted inclination; its position angle on the sky and the rotation phase are conventions, not measurements.',
      'The magnetic maps are from 2008, 2011 and 2013; the star’s field changes within months.',
      'The wind grid assumes one temperature at every distance and the same outflow in every direction.',
      'The radial filter, the logarithmic scale, the two radial fades and the exposure are display choices.',
    ],
  };
  outputs.push(['provenance.json', Buffer.from(JSON.stringify(provenance, null, 2) + '\n')]);

  const delivery = {
    schema: NEBULA_DELIVERY_SCHEMA, id: OBJECT_ID, method: 'density-grid',
    request: deliveryGrids.find(grid => grid.id === defaultDataset)!.recipe,
    inputPins: [{ path: `${packageBase}/provenance.json` }, ...datasets.map(dataset => ({ path: `${packageBase}/density-${dataset.id}.ktx2` }))],
    sky: { centerIcrsDegrees: [raDeg, decDeg], distancePc, imageRotationDegrees: 0, arcsecPerUnit: radiusArcsec },
    sourceUrl: SIMULATION.landing,
    description: 'ε Eridani’s corona: the gas density of a published simulation driven by three observed maps of the star’s magnetic field, and a wind model from published measurements. One unit is one stellar radius. None is an observation.',
    defaultDataset, framingRadiusUnits: GRID.halfUnits,
    // The corona belongs to the star. It is not a place of its own; its datasets are listed by the star.
    attachedTo: HOST_ID,
    acceptedLabResult: 'eps-eridani-corona-density-grids',
    compactInputs: deliveryGrids.find(grid => grid.id === defaultDataset)!.recipe, compactMethod: 'density-grid',
    grids: deliveryGrids,
  };
  outputs.push(['delivery.json', Buffer.from(JSON.stringify(delivery, null, 2) + '\n')]);

  outputs.push(['wind-parameters.json', Buffer.from(JSON.stringify({
    schema: PUBLISHED_MODEL_PARAMETERS_SCHEMA, objectId: OBJECT_ID, datasetId: 'wind',
    citation: 'Wood, B. E., Müller, H.-R., Zank, G. P., Linsky, J. L. 2002, "Measured mass-loss rates of solar-like stars as a function of age and activity", ApJ 574, 412',
    doi: '10.1086/340797', preprint: 'https://arxiv.org/abs/astro-ph/0203437', locator: 'Table 1, row ε Eri',
    star: measured.star, ...windRecord,
    notes: 'The temperature is the X-ray temperature of Bennedik et al. (2026), arXiv:2607.27832, Table 5. The density follows from Parker (1958) and mass conservation; packages/bake/authoring/eps-eridani-corona/corona-models.mts computes it.',
  }, null, 2) + '\n')]);

  const presentation = {
    schema: VOLUME_PRESENTATION_SOURCE_SCHEMA, objectId: OBJECT_ID, name: 'ε Eridani corona', defaultDataset,
    bank: { path: `src/objects/${OBJECT_ID}/prepared/datasets.json` },
    recipes: datasets.map(dataset => ({ id: dataset.id, path: `${packageBase}/volume-${dataset.id}.json` })),
    sharedInputs: [], inputEvidence: [],
    datasets: datasets.map(dataset => ({ id: dataset.id, label: dataset.label, title: dataset.title, description: dataset.description, summary: dataset.summary,
      detail: dataset.detail, facts: dataset.facts, input: dataset.input, preview: { path: `${packageBase}/previews/${dataset.id}.png`, authoredFrom: dataset.input } })),
  };
  outputs.push(['presentation.json', Buffer.from(JSON.stringify(presentation, null, 2) + '\n')]);

  // Every input the grids are computed from: the nine released runs, and the published numbers of the wind.
  const simulationCredit = `${SIMULATION.paper}; data https://doi.org/${SIMULATION.doi} (${SIMULATION.license})`;
  const inputs: unknown[] = SIMULATION.maps.flatMap(map => SITES.map(site => {
    const drawn = maps.find(entry => entry.id === map.id)!.site === site;
    return { id: `run-${map.id}-${site}`, dependencies: [],
      sourceBinding: { kind: 'catalogued', references: [{ catalogueId: SIMULATION.catalogueId, role: 'material', evidence: `${SIMULATION.archive}: ${map.directory}/${map.runs[site].file}` }] },
      path: runPath(map, site), bytes: map.runs[site].bytes, origin: SIMULATION.archiveUrl, sourceUrl: SIMULATION.landing,
      title: `ε Eridani simulation · ${map.label} magnetic map, eruption ${SITE_TEXT[site]}`, credit: simulationCredit, displayCredit: 'Ó Fionnagáin et al. (2022)',
      acquisition: `Member ${map.directory}/${map.runs[site].file} of ${SIMULATION.archive} (${SIMULATION.archiveBytes} bytes), extracted unchanged. ${drawn ? 'This run is drawn: its eruption disturbs the least of the drawn volume.' : 'Read only to measure how much of the drawn volume each run’s eruption disturbs.'}`,
      license: 'CC-BY-4.0. Released on Zenodo under the Creative Commons Attribution 4.0 International licence; retain the citation.',
      ...(drawn ? { datasetId: `simulation-${map.id}` } : {}) };
  }));
  inputs.push({ id: 'wind-parameters', dependencies: [],
    sourceBinding: { kind: 'catalogued', references: [{ catalogueId: `source-${OBJECT_ID}-wind-parameters`, role: 'material', evidence: `${packageBase}/manifest.json#/inputs/${inputs.length}` }] },
    path: `${packageBase}/wind-parameters.json`, origin: 'https://doi.org/10.1086/340797', sourceUrl: 'https://arxiv.org/abs/astro-ph/0203437',
    title: 'Wood et al. 2002 · mass-loss rate of ε Eridani, with the X-ray temperature of Bennedik et al. 2026',
    credit: 'Wood et al. 2002, ApJ 574, 412, Table 1; Bennedik et al. 2026, arXiv:2607.27832, Table 5; Parker 1958, ApJ 128, 664', displayCredit: 'Wood et al. (2002)',
    acquisition: 'Published numbers transcribed from the papers, and the densities this package computes from them. This record identifies the transcription; the papers are the source.',
    license: 'Published numbers cited under normal scholarly citation; the papers are not redistributed here.', datasetId: 'wind' });
  const documents = ['delivery.json', 'presentation.json', 'provenance.json'].map(name => ({ id: name.replace(/[^a-z0-9-]+/g, '-'), path: `${packageBase}/${name}`,
    sourceBinding: { kind: 'local', reason: 'Object-owned delivery, provenance or presentation record; the published inputs it cites are bound above.' } }));
  const intermediates = datasets.flatMap(dataset => [`density-${dataset.id}.ktx2`, `volume-${dataset.id}.json`, `previews/${dataset.id}.png`]).map(name => ({ id: name.replace(/[^a-z0-9-]+/g, '-'), path: `${packageBase}/${name}`,
    sourceBinding: { kind: 'local', reason: 'Density grid, slab recipe or preview written by packages/bake/authoring/eps-eridani-corona/author.mts from the inputs bound above.' } }));
  outputs.push(['manifest.json', Buffer.from(JSON.stringify({ schema: VOLUME_SOURCE_MANIFEST_SCHEMA, pathBase: 'repository', inputs, documents, generatedIntermediates: intermediates }, null, 2) + '\n')]);
  return { outputs, measured, grids: built };
}

const direct = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) {
  const check = process.argv.includes('--check'), missing: string[] = [];
  for (const map of SIMULATION.maps) for (const site of SITES) await access(resolve(repository, runPath(map, site))).catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') missing.push(runPath(map, site)); else throw error; });
  if (missing.length && check) console.log(`SKIP ${OBJECT_ID} --check: requires the ${missing.length} simulation files missing under ${DOWNLOADS_BASE}. Download ${SIMULATION.archive} from ${SIMULATION.landing} and extract it there. No outputs compared.`);
  else {
    if (missing.length) throw new Error(`${OBJECT_ID}: missing ${missing.join(', ')}. Download ${SIMULATION.archive} from ${SIMULATION.landing} and extract it under ${DOWNLOADS_BASE}.`);
    await mkdir(resolve(root, 'previews'), { recursive: true });
    const result = await runAuthor({ root, check, readError: 'mismatch-on-read-error', mkdir: 'root-before-write-or-check',
      mismatchMessage: name => `Authored output differs: ${name}`,
      compute: async () => { const result = await author(); return { outputs: result.outputs, result }; } });
    console.log(`${check ? 'CHECKED' : 'AUTHORED'} ${OBJECT_ID}: grid ${GRID.size}^3; ${JSON.stringify(result.grids)}`);
    console.log(JSON.stringify({ wind: result.measured.wind, maps: result.measured.simulation.maps.map(map => ({ id: map.id, drawnRun: map.drawnRun, eruptions: map.eruptions })), typical: result.measured.simulation.typicalElectronsPerCm3 }, null, 1));
  }
}
