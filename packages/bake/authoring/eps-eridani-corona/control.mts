#!/usr/bin/env node
/** The checks behind the corona package's README: how the two one-dimensional models compare with the published simulation
 * of ε Eridani, and with the density STEREO measured around the Sun.
 *
 *   node packages/bake/authoring/eps-eridani-corona/control.mts [path to cor1b-n3d_CR2053P1_m10.fits]
 *
 * ε Eridani: the wind and at-rest models beside the simulation's typical density at each radius (the shell medians the
 * author records in source/provenance.json). The at-rest model takes the X-ray luminosity of Bennedik et al. (2026), Table 5.
 * The Sun, when the STEREO file is given: both models with the Sun's numbers beside the COR1-B tomography of Carrington
 * rotation 2053 (February 2007, near solar minimum), the area-weighted mean over the sphere at each radius. The Sun's X-ray
 * surface flux and coronal temperature at minimum and maximum are Johnstone & Güdel (2015), Table 1, after Peres et al. (2000). */
import { projectRoot } from '@cssearth/core/node';
import { fitsImageAccessor, readFitsHdu } from '@cssearth/fits';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { KELVIN_PER_KEV, SECONDS_PER_YEAR, SOLAR_MASS_G, SOLAR_RADIUS_CM, hydrostaticCorona, parkerWind } from './corona-models.mts';
import { STAR, WIND } from './author.mts';

const e = (value: number) => value.toExponential(1).padStart(8), ratio = (value: number) => value.toFixed(2).padStart(7);

const provenance = JSON.parse(await readFile(resolve(projectRoot(import.meta.url), 'src/objects/eps-eridani-corona/source/provenance.json'), 'utf8')) as
  { measured: { simulation: { typicalElectronsPerCm3: Record<string, number> } } };
const kelvin = STAR.coronalTemperatureKeV * KELVIN_PER_KEV, star = { massSolar: STAR.massSolar, radiusSolar: STAR.radiusSolar };
const wind = parkerWind({ massLossGramsPerSecond: WIND.massLossSolar * WIND.solarMassLossSolarMassesPerYear * SOLAR_MASS_G / SECONDS_PER_YEAR, kelvin, ...star });
const atRest = hydrostaticCorona({ xrayLuminosityErgS: 10 ** 28.35, kelvin, ...star, outerRadii: 4 });
console.log('ε Eridani, electrons per cm3');
console.log(' r/R   simulation     wind  at rest   |  model / simulation: wind, at rest');
for (const [radius, typical] of Object.entries(provenance.measured.simulation.typicalElectronsPerCm3).map(([key, value]) => [Number(key), value] as const).sort((a, b) => a[0] - b[0]))
  console.log(`${radius.toFixed(2).padStart(5)}  ${e(typical)} ${e(wind.density(radius))} ${e(atRest.density(radius))}   |  ${ratio(wind.density(radius) / typical)} ${ratio(atRest.density(radius) / typical)}`);

const path = process.argv[2];
if (path) {
  const bytes = await readFile(path), hdu = readFitsHdu(bytes), sample = fitsImageAccessor(bytes, hdu);
  const [longitudes, latitudes, radii] = hdu.dimensions as [number, number, number];
  if (longitudes !== 361 || latitudes !== 181 || radii !== 51) throw new Error(`Unexpected STEREO grid ${hdu.dimensions.join(' x ')}.`);
  const measuredMean = (radius: number) => {
    const r = Math.round((radius - 1.5) / 0.05); let sum = 0, total = 0;
    for (let lat = 0; lat < latitudes; lat++) { const weight = Math.cos((lat - 90) * Math.PI / 180);
      for (let lon = 0; lon < longitudes - 1; lon++) { sum += weight * sample((r * latitudes + lat) * longitudes + lon); total += weight; } }
    return sum / total;
  };
  const sun = { massSolar: 1, radiusSolar: 1 }, states = [{ name: 'minimum', surfaceFlux: 4.44e3, megakelvin: 0.97 }, { name: 'maximum', surfaceFlux: 7.73e4, megakelvin: 2.57 }];
  const models = states.flatMap(state => [
    { name: `at rest, ${state.name}`, density: hydrostaticCorona({ xrayLuminosityErgS: 4 * Math.PI * SOLAR_RADIUS_CM ** 2 * state.surfaceFlux, kelvin: state.megakelvin * 1e6, ...sun, outerRadii: 4 }).density },
    { name: `wind, ${state.name}`, density: parkerWind({ massLossGramsPerSecond: 2e-14 * SOLAR_MASS_G / SECONDS_PER_YEAR, kelvin: state.megakelvin * 1e6, ...sun }).density }]);
  console.log(`\nThe Sun: model / STEREO mean (${models.map(model => model.name).join('; ')})`);
  for (const radius of [1.5, 2, 2.5, 3, 3.5, 4]) { const measured = measuredMean(radius);
    console.log(`${radius.toFixed(1).padStart(5)}  STEREO ${e(measured)}   ${models.map(model => ratio(model.density(radius) / measured)).join(' ')}`); }
}
