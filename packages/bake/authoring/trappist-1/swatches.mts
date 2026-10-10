#!/usr/bin/env node
/**
 * The world swatches of TRAPPIST-1's planets: the color each one's orbit, marker and caption take. No telescope has
 * detected light any of the seven reflects, so a swatch here is the color of a published model of the planet, and its
 * record says so. A planet with no such model keeps the neutral default.
 *
 *   node packages/bake/authoring/trappist-1/swatches.mts
 *
 * Each planet's reflectance is taken in its own star's light, the Gaia XP spectrum the star's color dataset is made from,
 * by the method of the Solar System swatches (`@cssearth/bake/objects/color` `reflectedLightSwatch`). Model files are read
 * from `output/trappist-1/swatch-sources/` and downloaded there when missing.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord, requireString } from '@cssearth/core';
import { projectRoot as findProjectRoot } from '@cssearth/core/node';
import { parseCieTable, reflectedLightSwatch, SRGB_WHITE_XY } from '@cssearth/bake/objects/color';
import { readCie1931ColorMatching } from '@cssearth/bake/objects/sources';
import { parseClassicNetcdfHeader, storedValues, valueRange } from '@cssearth/bake/objects/raster';
import { NOISE_FLOOR_SIGMA, readXpSampledSpectrum, XP_SAMPLED_WAVELENGTHS_NM } from '@cssearth/bake/objects/stellar';

const GENERATOR = 'packages/bake/authoring/trappist-1/swatches.mts';
const root = findProjectRoot(import.meta.url), cache = resolve(root, 'output/trappist-1/swatch-sources');
const star = resolve(root, 'src/objects/trappist-1/source/photometry');

/** The visible samples of the star's Gaia XP spectrum, read as its color dataset reads them: the even wavelengths from 380 to
 * 780 nm, a sample at or below zero within three of its own errors as no emission. */
async function starlight() {
  const record = requireRecord(requireRecord(JSON.parse(await readFile(resolve(star, 'stellar-color.json'), 'utf8'))).sampledSpectrum);
  const { flux, fluxError } = readXpSampledSpectrum(await readFile(resolve(star, '..', requireString(record.path)), 'utf8'), requireString(record.sourceId));
  const wavelengthsNm = XP_SAMPLED_WAVELENGTHS_NM.filter(wavelength => wavelength >= 380 && wavelength <= 780);
  const light = new Map(wavelengthsNm.map(wavelength => {
    const index = XP_SAMPLED_WAVELENGTHS_NM.indexOf(wavelength), value = flux[index]!;
    if (!(value > 0) && !(Math.abs(value) <= NOISE_FLOOR_SIGMA * fluxError[index]!)) throw new TypeError(`The star's spectrum is below zero beyond its noise at ${wavelength} nm.`);
    return [wavelength, Math.max(0, value)] as const;
  }));
  return { wavelengthsNm, light: (wavelength: number) => light.get(wavelength)!, record };
}

/** A published file, or a run of its bytes, from the cache or its origin; the byte count must be the one expected. */
async function published(name: string, url: string, bytes: number, offset?: number): Promise<Buffer> {
  const path = resolve(cache, name);
  if (!(await stat(path).then(file => file.size === bytes, () => false))) {
    const response = await fetch(url, { headers: { 'user-agent': 'css.earth preparation (https://css.earth)', ...(offset === undefined ? {} : { range: `bytes=${offset}-${offset + bytes - 1}` }) } });
    if (response.status !== (offset === undefined ? 200 : 206)) throw new Error(`${url}: HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length !== bytes) throw new Error(`${url}: ${body.length} bytes, ${bytes} expected.`);
    await mkdir(cache, { recursive: true }); await writeFile(path, body);
  }
  return readFile(path);
}

/** Ducrot et al.'s top-of-atmosphere table: bin, central wavelength, lower edge and width in µm, the star's flux reaching the
 * planet, the flux leaving it, and the eclipse depth. Returns the reflectance, up over down, averaged over each 2 nm sample. */
function topOfAtmosphereReflectance(text: string, wavelengthsNm: readonly number[]) {
  const lines = text.split(/\r?\n/u), header = lines.findIndex(line => line.startsWith('bin'));
  if (header < 0 || lines[header]!.trim().split(/\s+/u).join(' ') !== 'bin cent_lambda[um] low_int_lambda[um] delta_lambda[um] F_down_at_TOA F_up_at_TOA planet/star_flux_ratio') {
    throw new TypeError('The top-of-atmosphere table does not have its published columns.');
  }
  const rows = lines.slice(header + 1).filter(line => line.trim()).map(line => line.trim().split(/\s+/u).map(Number));
  if (rows.some(row => row.length !== 7 || row.some(value => !Number.isFinite(value)))) throw new TypeError('A top-of-atmosphere row is not seven numbers.');
  return new Map(wavelengthsNm.map(wavelength => {
    const inside = rows.filter(row => row[1]! * 1000 >= wavelength - 1 && row[1]! * 1000 < wavelength + 1 && row[4]! > 0);
    if (inside.length === 0) throw new TypeError(`The table has no bin at ${wavelength} nm.`);
    return [wavelength, inside.reduce((sum, row) => sum + row[5]! / row[4]!, 0) / inside.length] as const;
  }));
}

const colorMatching = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3);
const { wavelengthsNm, light, record: starRecord } = await starlight();
const conversion = (swatch: ReturnType<typeof reflectedLightSwatch>) => ({
  observer: { name: 'CIE 1931 2 degree standard observer', path: 'src/references/cie-1931-2deg/CIE_xyz_1931_2deg.csv' },
  illuminant: { name: 'The light of TRAPPIST-1: its Gaia DR3 XP sampled spectrum, as the star\'s color dataset reads it', path: `src/objects/trappist-1/source/${requireString(starRecord.path)}`,
    source: requireString(starRecord.source), whitePointXy: swatch.lightWhiteXy.map(value => Number(value.toFixed(10))) },
  integration: `Reflectance times the star's flux times each CIE matching function, summed at the even wavelengths from ${wavelengthsNm[0]} to ${wavelengthsNm.at(-1)} nm, normalized to Y = 1 for a perfect diffuser.`,
  chromaticAdaptation: `Bradford adaptation from the star's white to the sRGB D65 white (x=${SRGB_WHITE_XY[0]}, y=${SRGB_WHITE_XY[1]}): the surface as an eye adapted to that star's light sees it, the convention of the Solar System swatches. Unadapted, everything the star lights is orange.`,
  brightnessNormalization: 'Divide the three linear sRGB channels by their maximum, preserving channel ratios; apply the sRGB transfer function, multiply by 255, and round. No hue adjustment or gamut clipping.',
  implementation: 'packages/bake/src/objects/color/reflected-light-swatch.ts',
  xyzStarWhiteY1: swatch.xyzLightWhiteY1.map(value => Number(value.toFixed(10))),
  linearSrgbD65: swatch.linearSrgbD65.map(value => Number(value.toFixed(10))),
});
const write = async (id: string, value: Record<string, unknown>) => {
  await writeFile(resolve(root, 'src/objects', id, 'swatch.json'), `${JSON.stringify(value, null, 2)}\n`);
  console.log(`${id}: ${String(value.hex)}`);
};

{
  const name = 'Fig2_trappist1b_bare_Ultramafic_post_TOA_flux_eclipse.dat', dataUrl = `https://zenodo.org/records/13385020/files/${name}`;
  const reflectance = topOfAtmosphereReflectance((await published(name, dataUrl, 1957134)).toString('utf8'), wavelengthsNm);
  const swatch = reflectedLightSwatch(wavelengthsNm, wavelength => reflectance.get(wavelength)!, light, colorMatching);
  await write('trappist-1b', {
    hex: swatch.hex, rgb: swatch.rgb, colorSpace: 'sRGB',
    basis: 'Modeled, not observed. The color of the bare rock surface that best fits this planet\'s two measured infrared eclipse depths, in its own star\'s light. No telescope has detected light this planet reflects. Brightness-normalized for a swatch; not a representation of how bright the planet is.',
    generator: GENERATOR,
    source: {
      title: 'Ducrot et al. (2024), Combined analysis of the 12.8 and 15 μm JWST/MIRI eclipse observations of TRAPPIST-1 b, Nature Astronomy 9, 358',
      url: 'https://doi.org/10.1038/s41550-024-02428-z',
      dataUrl, dataRecord: 'https://doi.org/10.5281/zenodo.13385020', license: 'CC BY 4.0',
      columns: 'Column 2: central wavelength in micrometres. Columns 5 and 6: the star\'s flux reaching the top of the atmosphere and the flux leaving it. Their ratio between 380 and 780 nm, where a surface near 500 K emits nothing, is the reflectance.',
      basis: 'The paper\'s airless model with a fresh ultramafic surface (60% olivine, 40% enstatite, a surface type of Hu, Ehlmann & Seager 2012, https://doi.org/10.1088/0004-637X/752/1/7), the surface it finds favoured by the eclipse depths at 12.8 and 15 µm. Only those two depths are measured: the visible reflectance is the rock type\'s. The paper also fits a thick carbon dioxide atmosphere with haze, and notes that space weathering, which it does not model, darkens a surface.',
    },
    conversion: conversion(swatch),
  });
}

/** ExoRT's spectral interval edges on its 68-interval grid, in cm^-1 (`wavenum_edge` in source/src.n68equiv/radgrid.F90): edges 53
 * to 64, the intervals that hold the light from 341 to 782 nm. Interval n lies between edge n and edge n + 1. */
const EXORT_FIRST_INTERVAL = 53, EXORT_EDGES_PER_CM = [12790, 13300, 14470, 15000, 16000, 16528, 17649, 18198, 18518, 22222, 25641, 29308] as const;
const EXORT_GRID = 'https://raw.githubusercontent.com/storyofthewolf/ExoRT/f16cd9e8f2908b88d52d66a93dceb26ce71d94cc/source/src.n68equiv/radgrid.F90';

/** The planet's reflectance in each of the model's visible intervals: the light leaving the top of the atmosphere over the
 * starlight arriving there, each summed over the globe with the file's own area weights. */
async function intervalReflectance(file: string, url: string, head: Buffer) {
  const label = `${file}.nc`, header = parseClassicNetcdfHeader(head, label), lat = header.dimensions.get('lat'), lon = header.dimensions.get('lon');
  if (!lat || !lon) throw new TypeError(`${label} has no latitude and longitude grid.`);
  const weightsAt = valueRange(header, 'gw', 0, lat, label), weights = storedValues(header, 'gw', await published(`${file}.gw.dat`, url, weightsAt.length, weightsAt.offset), label);
  const globe = async (name: string) => {
    const { offset, length } = valueRange(header, name, 0, lat * lon, label), values = storedValues(header, name, await published(`${file}.${name}-time0.dat`, url, length, offset), label);
    if (values.some(value => !(value >= 0))) throw new TypeError(`${label}: ${name} holds a value below zero or missing.`);
    return weights.reduce((sum, weight, row) => sum + weight * values.subarray(row * lon, (row + 1) * lon).reduce((a, b) => a + b, 0), 0);
  };
  const intervals = [];
  for (let index = 0; index + 1 < EXORT_EDGES_PER_CM.length; index++) {
    const interval = EXORT_FIRST_INTERVAL + index, up = await globe(`FUS_toa_int${interval}`), down = await globe(`FDS_toa_int${interval}`);
    if (!(down > 0)) throw new TypeError(`${label}: no starlight arrives in interval ${interval}.`);
    intervals.push({ interval, fromNm: 1e7 / EXORT_EDGES_PER_CM[index + 1]!, toNm: 1e7 / EXORT_EDGES_PER_CM[index]!, reflectance: up / down });
  }
  return intervals;
}

{
  const file = 'ExoCAM_thai_hab1_L51_n68equiv.cam.h0.avg', dataUrl = `https://zenodo.org/records/5532765/files/${file}.nc`;
  const intervals = await intervalReflectance(file, `${dataUrl}?download=1`, await readFile(resolve(root, `src/objects/trappist-1e/source/science/wolf-2022/${file}.head.dat`)));
  const reflectance = (wavelength: number) => {
    const band = intervals.find(candidate => wavelength >= candidate.fromNm && wavelength < candidate.toNm);
    if (!band) throw new TypeError(`No model interval holds ${wavelength} nm.`);
    return band.reflectance;
  };
  const swatch = reflectedLightSwatch(wavelengthsNm, reflectance, light, colorMatching);
  await write('trappist-1e', {
    hex: swatch.hex, rgb: swatch.rgb, colorSpace: 'sRGB',
    basis: 'Modeled, not observed. The color of the whole planet in one published climate simulation, the one this planet\'s default dataset shows, in its own star\'s light. Nobody has detected an atmosphere on this planet or light it reflects. Brightness-normalized for a swatch; not a representation of how bright the planet is.',
    generator: GENERATOR,
    source: {
      title: 'Wolf et al. (2022), ExoCAM: A 3D Climate Model for Exoplanet Atmospheres, The Planetary Science Journal 3, 7',
      url: 'https://doi.org/10.3847/PSJ/ac3f3d',
      dataUrl, dataRecord: 'https://doi.org/10.5281/zenodo.5532765', license: 'CC BY 4.0',
      columns: `FUS_toa_int and FDS_toa_int ${intervals[0]!.interval} to ${intervals.at(-1)!.interval}: the shortwave flux leaving and arriving at the top of the atmosphere in each spectral interval, in W/m2 on the model's 72 x 46 grid, each read by one range request; gw, the grid's area weights. Interval edges: ${EXORT_GRID} (wavenum_edge).`,
      basis: 'The control run of the THAI "Hab 1" case: one bar of nitrogen with 400 ppm of carbon dioxide over a global ocean. The protocol fixes the ocean\'s albedo at 0.06 and ice and snow at 0.25 at every wavelength (Fauchez et al. 2020, https://doi.org/10.5194/gmd-13-707-2020), so the hue is the model\'s air and clouds, not a surface. One scenario among several that fit what is measured.',
      intervals: intervals.map(band => ({ interval: band.interval, fromNm: Number(band.fromNm.toFixed(1)), toNm: Number(band.toNm.toFixed(1)), reflectance: Number(band.reflectance.toFixed(4)) })),
    },
    conversion: { ...conversion(swatch), reflectance: 'Each interval\'s reflectance is the flux leaving over the flux arriving, both summed over the globe with the area weights; a wavelength takes the value of the interval that holds it.' },
  });
}
