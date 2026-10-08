// Gravity darkening of a rapidly rotating star, from a published Roche-von Zeipel fit (Monnier et al. 2007 for Altair, 2012 for
// Vega). The star is a rigidly rotating Roche surface around a point mass: in units of the polar radius, 1/x + 4/27 ω² x² sin²θ = 1,
// with ω the angular velocity as a fraction of break-up and θ the colatitude. Its effective gravity is the gradient of that
// potential, and the local temperature follows T = T_pole (g / g_pole)^β. The papers do not print the shape equation; this one
// reproduces their equatorial radii and temperatures from their polar values, ω and β, which the tests check.
//
// A fit that takes its temperatures from the gravity-darkening law of Espinosa Lara & Rieutord (2011, A&A 533, A43) has no β:
// the record names the law instead, and the temperature follows their equations (espinosaLaraRieutordTemperature).
//
// The surface texture carries the result: each latitude row is the measured disc color, scaled per linear channel by the ratio of
// a Planck spectrum at the row's temperature to one at the model's surface-mean temperature, then normalised so the brightest row's
// brightest channel is 1. The hot poles are brighter and bluer, the cool equator dimmer and redder; the disc-integrated color stays
// the measured one. Limb darkening stays on the limb plate, which darkens every latitude alike.
import { directionFromRaDec, skyBasis } from '@cssearth/astronomy';
import { requireFiniteNumber, requireRecord, requireString, dot3 as dot } from '@cssearth/core';
import { linearToSrgb } from '../color/index.ts';
import { planckLinearSrgb, type StellarColor } from './stellar-photometric-color.ts';

/** The schema of a published Roche-von Zeipel fit transcribed beside its star (source/photometry/gravity-darkening.json). */
export const ROCHE_VON_ZEIPEL_SCHEMA = 'cssearth-roche-von-zeipel@1';
/** The law a record names in place of β (`model.law.value`): Espinosa Lara & Rieutord (2011, A&A 533, A43). */
export const ESPINOSA_LARA_RIEUTORD_LAW = 'espinosa-lara-rieutord-2011';
export interface GravityDarkeningRecord {
  readonly omega: number;
  /** The exponent of T = T_pole (g / g_pole)^β; absent when the fit follows the law of Espinosa Lara & Rieutord, which has none. */
  readonly beta?: number;
  readonly poleTemperatureK: number;
  /** The paper's own equatorial temperature; absent when it publishes only the polar temperature, ω or the flattening, and β. */
  readonly equatorTemperatureK?: number;
  readonly polarRadiusSolar: number; readonly equatorialRadiusSolar: number;
  /** The pole's sky orientation, when the fit measures it (interferometric images). A transit fit places the pole against its
   * planet's orbit instead, in the star's rotation record. */
  readonly inclinationDegrees?: number; readonly polePositionAngleDegrees?: number; readonly source: string;
}

/** ω of the Roche surface whose equatorial radius is `ratio` polar radii: 1/x + 4/27 ω² x² = 1 at x = ratio. */
export function rocheOmegaForFlattening(ratio: number) {
  if (!(ratio > 1 && ratio < 1.5)) throw new RangeError('A Roche surface has an equatorial-to-polar radius ratio between 1 and 1.5.');
  return Math.sqrt(27 * (ratio - 1) / (4 * ratio ** 3));
}

export function parseGravityDarkeningRecord(value: unknown): GravityDarkeningRecord {
  const input = requireRecord(value, 'gravity-darkening record');
  if (input.schema !== ROCHE_VON_ZEIPEL_SCHEMA) throw new TypeError(`The gravity-darkening record must use ${ROCHE_VON_ZEIPEL_SCHEMA}.`);
  const model = requireRecord(input.model, 'model'), view = input.view === undefined ? null : requireRecord(input.view, 'view');
  const number = (record: Record<string, unknown>, key: string) => requireFiniteNumber(requireRecord(record[key], key).value, `${key}.value`);
  // A fit publishes ω and both radii (interferometric images), or the equatorial radius and its ratio to the polar one (a transit
  // fit), from which the Roche surface's ω and polar radius follow.
  const byRatio = model.omega === undefined;
  if (byRatio === (model.equatorialToPolarRadius === undefined) || byRatio !== (model.polarRadiusSolar === undefined))
    throw new TypeError('A gravity-darkening record gives ω and the polar radius, or the equatorial-to-polar radius ratio, not both.');
  const ratio = byRatio ? number(model, 'equatorialToPolarRadius') : null, equatorialRadiusSolar = number(model, 'equatorialRadiusSolar');
  // The temperature law: an exponent β, or the named law of Espinosa Lara & Rieutord, which has none.
  if ((model.beta === undefined) === (model.law === undefined)) throw new TypeError('A gravity-darkening record gives β or names its law, not both.');
  if (model.law !== undefined && requireRecord(model.law, 'law').value !== ESPINOSA_LARA_RIEUTORD_LAW)
    throw new TypeError(`The only gravity-darkening law a record names in place of β is ${ESPINOSA_LARA_RIEUTORD_LAW}.`);
  const record: GravityDarkeningRecord = { omega: ratio === null ? number(model, 'omega') : rocheOmegaForFlattening(ratio),
    ...(model.beta === undefined ? {} : { beta: number(model, 'beta') }),
    poleTemperatureK: number(model, 'poleTemperatureK'),
    ...(model.equatorTemperatureK === undefined ? {} : { equatorTemperatureK: number(model, 'equatorTemperatureK') }),
    polarRadiusSolar: ratio === null ? number(model, 'polarRadiusSolar') : equatorialRadiusSolar / ratio, equatorialRadiusSolar,
    ...(view ? { inclinationDegrees: number(view, 'inclinationDegrees'), polePositionAngleDegrees: number(view, 'polePositionAngleDegrees') } : {}),
    source: requireString(input.source, 'source') };
  if (!(record.omega > 0 && record.omega < 1)) throw new TypeError('ω is a fraction of the break-up rate, between 0 and 1.');
  if (record.beta !== undefined && !(record.beta > 0 && record.beta <= 0.25)) throw new TypeError('β lies between 0 and the von Zeipel value 0.25.');
  return record;
}

/** Surface radius at a colatitude, in polar radii: the root of 1/x + 4/27 ω² x² sin²θ = 1 between 1 and 1.5. */
export function rocheRadius(omega: number, colatitude: number) {
  const s = Math.sin(colatitude) ** 2;
  let low = 1, high = 1.5;
  for (let i = 0; i < 60; i++) { const x = (low + high) / 2; if (1 / x + 4 / 27 * omega * omega * x * x * s - 1 > 0) low = x; else high = x; }
  return (low + high) / 2;
}

/** Effective gravity at a colatitude, in units of GM / R_pole²: gravity toward the centre less the centrifugal term. */
export function rocheGravity(omega: number, colatitude: number) {
  const x = rocheRadius(omega, colatitude), sin = Math.sin(colatitude), cos = Math.cos(colatitude);
  const radial = -1 / (x * x) + 8 / 27 * omega * omega * x * sin * sin, tangential = 8 / 27 * omega * omega * x * sin * cos;
  return { radius: x, gravity: Math.hypot(radial, tangential), radial };
}

/** T(θ) / T_pole on the Roche surface under the law of Espinosa Lara & Rieutord (2011, A&A 533, A43): the radiative flux is
 * antiparallel to the effective gravity and has no divergence, so T⁴ ∝ g tan²ϑ / tan²θ, where ϑ solves
 * cos ϑ + ln tan(ϑ/2) = ⅓ ω_K² r³ cos³θ + cos θ + ln tan(θ/2) (their sections 2.2 and 2.3). Their
 * ω_K is the equatorial angular velocity over the Keplerian one there and their r is in equatorial radii; with this module's ω
 * (a fraction of break-up) and x_e the equatorial radius in polar radii, ω_K² = 8/27 ω² x_e³. They print the two limits:
 * tan²ϑ / tan²θ is exp(⅔ ω_K² r³) at the pole and (1 - ω_K² r³)^(-⅔) at the equator, which give their closed form for
 * T_equator / T_pole (the test checks it). */
export function espinosaLaraRieutordTemperature(omega: number, colatitude: number) {
  const equator = rocheRadius(omega, Math.PI / 2), keplerian = 8 / 27 * omega * omega * equator ** 3;
  // The surface is symmetric about the equator: one hemisphere is solved.
  const theta = Math.min(colatitude, Math.PI - colatitude);
  const scaled = (at: number) => {
    const r = rocheRadius(omega, at) / equator, sin = Math.sin(at) ** 2;
    const gravity = Math.sqrt(1 / r ** 4 + keplerian * keplerian * r * r * sin - 2 * keplerian * sin / r);
    let stretch: number;
    // Each limit holds to the square of the distance from its end. Toward the equator both sides of the equation for ϑ fall as
    // the cube of that distance and lose their digits, so the limit is used from a thousandth of a radian.
    if (at < 1e-6) stretch = Math.exp(keplerian * r ** 3 / 3);
    else if (Math.PI / 2 - at < 1e-3) stretch = (1 - keplerian * r ** 3) ** (-1 / 3);
    else {
      const target = keplerian * r ** 3 * Math.cos(at) ** 3 / 3 + Math.cos(at) + Math.log(Math.tan(at / 2));
      // cos ϑ + ln tan(ϑ/2) rises with ϑ, and ϑ lies between θ and the equator.
      let low = at, high = Math.PI / 2;
      for (let i = 0; i < 60; i++) { const middle = (low + high) / 2; if (Math.cos(middle) + Math.log(Math.tan(middle / 2)) < target) low = middle; else high = middle; }
      stretch = Math.tan((low + high) / 2) / Math.tan(at);
    }
    return (gravity * stretch * stretch) ** 0.25;
  };
  return scaled(theta) / scaled(0);
}

export const surfaceTemperature = (record: GravityDarkeningRecord, colatitude: number) => record.poleTemperatureK
  * (record.beta === undefined ? espinosaLaraRieutordTemperature(record.omega, colatitude) : rocheGravity(record.omega, colatitude).gravity ** record.beta);

/** The surface-mean temperature, (∫T⁴ dA / ∫dA)^¼ over the Roche surface: the temperature whose Planck color the measured disc
 * color is taken to be, so the rows scale around it. */
export function meanSurfaceTemperature(record: GravityDarkeningRecord, steps = 2000) {
  let flux = 0, area = 0;
  for (let i = 0; i < steps; i++) {
    const colatitude = (i + 0.5) / steps * Math.PI, { radius, gravity, radial } = rocheGravity(record.omega, colatitude);
    const element = radius * radius * Math.sin(colatitude) * gravity / Math.abs(radial);
    flux += element * surfaceTemperature(record, colatitude) ** 4; area += element;
  }
  return (flux / area) ** 0.25;
}

/** One sRGB color per texture row, north to south, for an equirectangular map `height` rows tall. */
export function gravityDarkenedRows(record: GravityDarkeningRecord, color: StellarColor, colorMatching: Map<number, readonly number[]>, height: number) {
  const reference = planckLinearSrgb(meanSurfaceTemperature(record), colorMatching);
  const rows = Array.from({ length: height }, (_, row) => {
    const planck = planckLinearSrgb(surfaceTemperature(record, (row + 0.5) / height * Math.PI), colorMatching);
    return color.linear.map((value, channel) => value * planck[channel]! / reference[channel]!);
  });
  const peak = Math.max(...rows.flat());
  return rows.map(linear => linear.map(value => Math.round(255 * linearToSrgb(value / peak))) as [number, number, number]);
}

/** The measured pole as a display orientation: inclined `inclination` from the line of sight (0 is pole-on) toward the position
 * angle east of north, with the meridian that turns longitude 0 toward the Earth, as skyPlaneOrientation does for an axis in the
 * plane of the sky. The pole given is the one tilted toward us. */
export function inclinedPoleOrientation(star: { rightAscensionDegrees: number; declinationDegrees: number }, inclinationDegrees: number, positionAngleDegrees: number) {
  const radians = Math.PI / 180, { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees);
  const toEarth = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees).map(value => -value);
  const inclination = inclinationDegrees * radians, angle = positionAngleDegrees * radians;
  const pole = [0, 1, 2].map(axis => Math.sin(inclination) * (Math.cos(angle) * north[axis]! + Math.sin(angle) * east[axis]!) + Math.cos(inclination) * toEarth[axis]!);
  const length = Math.hypot(...pole); for (let axis = 0; axis < 3; axis++) pole[axis]! /= length;
  const nodeLength = Math.hypot(pole[0]!, pole[1]!);
  if (nodeLength < 1e-12) throw new TypeError('A pole on the celestial pole has no node.');
  const node = [-pole[1]! / nodeLength, pole[0]! / nodeLength, 0];
  const cross = [node[1]! * toEarth[2]! - node[2]! * toEarth[1]!, node[2]! * toEarth[0]! - node[0]! * toEarth[2]!, node[0]! * toEarth[1]! - node[1]! * toEarth[0]!];
  return { rightAscensionDegrees: (Math.atan2(pole[1]!, pole[0]!) / radians + 360) % 360, declinationDegrees: Math.asin(Math.max(-1, Math.min(1, pole[2]!))) / radians,
    displayMeridianDegrees: Math.atan2(dot(pole, cross), dot(node, toEarth)) / radians };
}
