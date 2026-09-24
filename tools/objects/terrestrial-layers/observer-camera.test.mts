import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { eclipticToBody, eclipticToEquatorial, equatorialToEcliptic, observerCamera, parseSpinState, pckOrientation,
  spinOrientation, rotationPhaseDegrees, bodyEpochJd, type SpinState, type Vector } from './observer-camera.mts';
import { parseTextKernel, numbers } from '../../spice/text-kernel.mts';
import { parseLeapSeconds, utcSecondsToEt } from '../../spice/lsk.mts';
import { dot3 as dot } from '../../../src/platform/vector3.mts';
import { kernelBankPaths } from '../../spice/kernel-bank.mts';
const DEGREE = Math.PI / 180;
const direction = (longitude: number, latitude: number): Vector =>
  [Math.cos(latitude * DEGREE) * Math.cos(longitude * DEGREE), Math.cos(latitude * DEGREE) * Math.sin(longitude * DEGREE), Math.sin(latitude * DEGREE)];
const close = (actual: number, expected: number, tolerance: number, what: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} is not within ${tolerance} of ${expected}`);
/** Angles compare on the circle: 0 and 360 are the same phase. */
const closeAngle = (actual: number, expected: number, tolerance: number, what: string) => {
  const difference = Math.abs(((actual - expected) % 360 + 540) % 360 - 180);
  assert.ok(difference <= tolerance, `${what}: ${actual} is not within ${tolerance} degrees of ${expected}`);
};

test('a spin parameter record is read in the column order the caller establishes', () => {
  // 216 Kleopatra, from the VLT/SPHERE survey's own release. Its first column is the pole latitude.
  const kleopatra = parseSpinState('20.1825 73.0895 5.38528201\n2444502.76914 0\n', 'latitude-first');
  assert.equal(kleopatra.latitudeDegrees, 20.1825);
  close(kleopatra.longitudeDegrees, 73.0895, 1e-9, 'Kleopatra pole longitude');
  assert.equal(kleopatra.periodHours, 5.38528201);
  assert.equal(kleopatra.epochJd, 2444502.76914);
  // 2 Pallas as DAMIT itself distributes it: the same layout with the columns the other way round.
  const pallas = parseSpinState('35 -12 7.81323\n2433827.77154 0\n', 'longitude-first');
  assert.equal(pallas.latitudeDegrees, -12);
  assert.equal(pallas.longitudeDegrees, 35);
});

test('a pole stated just past the pole is folded, not refused, and orients the body as the record does', () => {
  // 130 Elektra's release states -92.2669, which is 2.27 degrees beyond the south pole rather than a bad number.
  const elektra = parseSpinState('67.7259 -92.2669 5.22466350\n2444914.8 0\n', 'longitude-first');
  close(elektra.latitudeDegrees, -87.7331, 1e-9, 'folded pole latitude');
  close(elektra.longitudeDegrees, 247.7259, 1e-9, 'folded pole longitude');
  // The record's own convention applied to its stated numbers is the oracle: the folded state must put every
  // ecliptic direction at the same body coordinates. Folding the pole alone turns the body half a turn, which is
  // what Figure B.33 of the survey measured (its model panels matched ours only at 170-180 degrees of phase).
  const literal: SpinState = { latitudeDegrees: -92.2669, longitudeDegrees: 67.7259, periodHours: 5.2246635, epochJd: 2444914.8, phaseDegrees: 0 };
  closeAngle(elektra.phaseDegrees, 180, 1e-9, 'folded phase');
  for (const [longitude, latitude] of [[0, 0], [90, 30], [200, -60], [315, 80]]) {
    for (const phase of [0, 75, 250]) {
      const stated = eclipticToBody(direction(longitude, latitude), literal, phase);
      const folded = eclipticToBody(direction(longitude, latitude), elektra, phase + elektra.phaseDegrees);
      for (let axis = 0; axis < 3; axis++) close(folded[axis], stated[axis], 1e-12, `body axis ${axis} of (${longitude}, ${latitude}) at phase ${phase}`);
    }
  }
});

test('a DAMIT spin file reads as its first two lines, whatever photometric parameters follow', () => {
  // DAMIT model 5928, the survey's Flora model as DAMIT distributes it: the release layout, then the scattering weight.
  const flora = parseSpinState('334 -2 12.86667\n2434419 0\n0.1\n', 'longitude-first');
  assert.deepEqual([flora.longitudeDegrees, flora.latitudeDegrees, flora.periodHours, flora.epochJd, flora.phaseDegrees], [334, -2, 12.86667, 2434419, 0]);
  assert.throws(() => parseSpinState('334 -2 12.86667\n2434419 0\nlambert 0.1\n', 'longitude-first'), /photometric/);
});

test('a spin parameter record is rejected when it cannot mean what the caller claims', () => {
  // A value far outside the range is not an unnormalised pole; it means the column order is wrong.
  assert.throws(() => parseSpinState('67.7259 -130.5 5.22466350\n2444914.8 0\n', 'longitude-first'), /latitude/);
  assert.throws(() => parseSpinState('20.1825 73.0895 5.38528201\n', 'latitude-first'), /two non-empty lines/);
  assert.throws(() => parseSpinState('20.1825 73.0895\n2444502.76914 0\n', 'latitude-first'), /three values then two/);
  assert.throws(() => parseSpinState('20.1825 73.0895 0\n2444502.76914 0\n', 'latitude-first'), /period/);
  assert.throws(() => parseSpinState('20.1825 73.0895 5.385\n17.5 0\n', 'latitude-first'), /Julian date/);
});

test('the pole and rate agree with the IAU elements DAMIT publishes for the same model', () => {
  // DAMIT model 101 (2 Pallas) is distributed twice: spin.txt in the inversion convention, IAUspin.txt in IAU elements.
  // Converting the first must reproduce the second, which checks the frame and the rate against the producer's own numbers.
  // spin.txt    : 35 -12 7.81323 / 2433827.77154 0
  // IAUspin.txt : 37 2 1105.816672 / 2451545.0 15.6
  const spin = parseSpinState('35 -12 7.81323\n2433827.77154 0\n', 'longitude-first');
  const pole = eclipticToEquatorial(direction(spin.longitudeDegrees, spin.latitudeDegrees));
  const rightAscension = (Math.atan2(pole[1], pole[0]) / DEGREE + 360) % 360;
  const declination = Math.asin(pole[2]) / DEGREE;
  close(rightAscension, 37, 0.5, 'Pallas IAU pole right ascension');
  close(declination, 2, 0.5, 'Pallas IAU pole declination');
  close(360 / (spin.periodHours / 24), 1105.816672, 1e-4, 'Pallas IAU rotation rate');
});

test('the body transform is the documented inversion convention, orthonormal and right-handed', () => {
  const spin: SpinState = { latitudeDegrees: 20.1825, longitudeDegrees: 73.0895, periodHours: 5.38528201, epochJd: 2444502.76914, phaseDegrees: 0 };
  const axes = [direction(0, 0), direction(90, 0), direction(0, 90)].map(v => eclipticToBody(v, spin, 137.5));
  for (const axis of axes) close(Math.hypot(...axis), 1, 1e-12, 'transformed axis length');
  close(dot(axes[0], axes[1]), 0, 1e-12, 'x.y');
  close(dot(axes[0], axes[2]), 0, 1e-12, 'x.z');
  const cross: Vector = [axes[0][1]*axes[1][2]-axes[0][2]*axes[1][1], axes[0][2]*axes[1][0]-axes[0][0]*axes[1][2], axes[0][0]*axes[1][1]-axes[0][1]*axes[1][0]];
  close(dot(cross, axes[2]), 1, 1e-12, 'x cross y . z');
  // The spin pole itself carries to the body +z axis at any phase, because the phase turns about that axis.
  for (const phase of [0, 73, 201.4, 359]) {
    const carried = eclipticToBody(direction(spin.longitudeDegrees, spin.latitudeDegrees), spin, phase);
    close(carried[2], 1, 1e-12, `pole to +z at phase ${phase}`);
  }
});

test('at zero phase the body +y axis lies on the ascending node of the body equator', () => {
  // Durech, Sidorin and Kaasalainen (2010) equation 1 places the node on +y, not +x. Reading it the other way
  // rotates every body by a quarter turn, which a single-epoch fit hides and a second apparition exposes.
  const spin: SpinState = { latitudeDegrees: 20.1825, longitudeDegrees: 73.0895, periodHours: 5.38528201, epochJd: 2444502.76914, phaseDegrees: 0 };
  const node = direction(spin.longitudeDegrees + 90, 0);
  const inBody = eclipticToBody(node, spin, 0);
  close(inBody[0], 0, 1e-12, 'node x');
  close(inBody[1], 1, 1e-12, 'node y');
  close(inBody[2], 0, 1e-12, 'node z');
});

test('the rotation phase advances at the sidereal rate from the record epoch', () => {
  const spin: SpinState = { latitudeDegrees: 20.1825, longitudeDegrees: 73.0895, periodHours: 5.38528201, epochJd: 2444502.76914, phaseDegrees: 0 };
  closeAngle(rotationPhaseDegrees(spin.epochJd, spin), 0, 1e-9, 'phase at the record epoch');
  closeAngle(rotationPhaseDegrees(spin.epochJd + spin.periodHours / 24, spin), 0, 1e-6, 'phase after one turn');
  closeAngle(rotationPhaseDegrees(spin.epochJd + spin.periodHours / 48, spin), 180, 1e-6, 'phase after half a turn');
  // Light leaves the body before the exposure records it; one astronomical unit is 499.004784 seconds.
  // A Julian date near 2.4 million resolves to about 40 microseconds in double precision, so the
  // recovered light time is checked at that resolution rather than to the constant's last digit.
  close((spin.epochJd - bodyEpochJd(spin.epochJd, 1)) * 86400, 499.004784, 1e-3, 'one astronomical unit of light time');
});

test('a telescope sighting produces the controlled-shape camera the survey frames need', () => {
  // 216 Kleopatra, VLT/SPHERE/ZIMPOL, 2017-07-14T05:00:59.538 UT. Ephemeris from JPL Horizons for Paranal.
  const spin = parseSpinState('20.1825 73.0895 5.38528201\n2444502.76914 0\n', 'latitude-first');
  const camera = observerCamera({ epochJd: 2457948.709022, targetRightAscensionDegrees: 302.04882, targetDeclinationDegrees: 0.89432,
    sunRightAscensionDegrees: 306.55, sunDeclinationDegrees: 8.60, rangeAu: 1.72527681681845,
    pixelAngleMicroradians: 0.017599, center: [128, 127.2] }, spin);
  close(camera.rangeKm, 1.72527681681845 * 1.495978707e8, 1, 'range in kilometres');
  close(camera.observerLatitude, 25.25, 0.05, 'sub-observer latitude');
  close(camera.phaseDegrees, 4.3, 0.05, 'rotation phase');
  assert.deepEqual(camera.center, [128, 127.2]);
});

test('the stated longitudes are west, not the frame\u2019s own east longitude', () => {
  // The inversion frame is right-handed about the pole, so atan2(y, x) is an EAST longitude, while the camera it
  // feeds states west. Writing it through unchanged reflects the body through its xz-plane, and no silhouette,
  // disc-size or phase-angle check can see that. This asserts the sign directly against the transform.
  const spin = parseSpinState('20.1825 73.0895 5.38528201\n2444502.76914 0\n', 'latitude-first');
  const sighting = { epochJd: 2457948.709022, targetRightAscensionDegrees: 302.04882, targetDeclinationDegrees: 0.89432,
    sunRightAscensionDegrees: 306.55, sunDeclinationDegrees: 8.60, rangeAu: 1.72527681681845,
    pixelAngleMicroradians: 0.017599, center: [128, 127.2] as const };
  const camera = observerCamera(sighting, spin);
  const phase = rotationPhaseDegrees(bodyEpochJd(sighting.epochJd, sighting.rangeAu), spin);
  const toTarget = direction(sighting.targetRightAscensionDegrees, sighting.targetDeclinationDegrees);
  const body = eclipticToBody(equatorialToEcliptic([-toTarget[0], -toTarget[1], -toTarget[2]]), spin, phase);
  const east = Math.atan2(body[1], body[0]) / DEGREE;
  closeAngle(camera.observerWestLongitude, -east, 1e-9, 'west longitude is the negated frame longitude');
  closeAngle(camera.observerWestLongitude, 310.2572, 0.01, 'sub-observer west longitude');
  // A wrong sign would land on the mirror image, so state what this is not.
  assert.ok(Math.abs(((camera.observerWestLongitude - east + 540) % 360) - 180) > 1,
    'west longitude must not equal the frame longitude except at the two meridians where they coincide');
});

test('the north azimuth is the pole position angle the camera axes want, not its opposite', () => {
  // The repository camera measures north azimuth clockwise from image up in ITS axes, which run opposite to the
  // celestial position angle. Returning PA + 180 instead of -PA survives every symmetric-silhouette check.
  const spin = parseSpinState('20.1825 73.0895 5.38528201\n2444502.76914 0\n', 'latitude-first');
  const camera = observerCamera({ epochJd: 2457948.709022, targetRightAscensionDegrees: 302.04882, targetDeclinationDegrees: 0.89432,
    sunRightAscensionDegrees: 306.55, sunDeclinationDegrees: 8.60, rangeAu: 1.72527681681845,
    pixelAngleMicroradians: 0.017599, center: [128, 127.2] }, spin);
  const pole = eclipticToEquatorial(direction(spin.longitudeDegrees, spin.latitudeDegrees));
  const los = direction(302.04882, 0.89432);
  const skyEast = [-Math.sin(302.04882 * DEGREE), Math.cos(302.04882 * DEGREE), 0] as const;
  const skyNorth = [los[1] * skyEast[2] - los[2] * skyEast[1], los[2] * skyEast[0] - los[0] * skyEast[2], los[0] * skyEast[1] - los[1] * skyEast[0]];
  const positionAngle = Math.atan2(dot(pole, skyEast), dot(pole, skyNorth)) / DEGREE;
  closeAngle(camera.northAzimuthDegrees, -positionAngle, 1e-9, 'azimuth is the negated position angle');
  closeAngle(camera.northAzimuthDegrees, 318.7971, 0.01, 'north azimuth');
  assert.ok(Math.abs(((camera.northAzimuthDegrees - (positionAngle + 180) + 540) % 360) - 180) > 1,
    'azimuth must not be the position angle turned by half a circle');
});

test('a sighting with impossible geometry is refused rather than silently scaled', () => {
  const spin = parseSpinState('20.1825 73.0895 5.38528201\n2444502.76914 0\n', 'latitude-first');
  const sighting = { epochJd: 2457948.709022, targetRightAscensionDegrees: 302, targetDeclinationDegrees: 1,
    sunRightAscensionDegrees: 112, sunDeclinationDegrees: 22, rangeAu: 1.7, pixelAngleMicroradians: 0.0176, center: [128, 127] as const };
  assert.throws(() => observerCamera({ ...sighting, rangeAu: 0 }, spin), /positive range/);
  assert.throws(() => observerCamera({ ...sighting, pixelAngleMicroradians: -1 }, spin), /positive range/);
  assert.throws(() => observerCamera({ ...sighting, epochJd: Number.NaN }, spin), /finite/);
});

test('the ecliptic and equatorial frames round trip through the J2000 obliquity', () => {
  for (const v of [direction(0, 0), direction(123.4, -56.7), direction(302.04882, 0.89432)]) {
    const back = equatorialToEcliptic(eclipticToEquatorial(v));
    for (let i = 0; i < 3; i++) close(back[i], v[i], 1e-12, `round trip component ${i}`);
  }
});

/** The shared kernel bank's planetary constants and leap seconds, as the Cassini route pins them. */
const [PCK, LSK] = await kernelBankPaths('cassini', ['pck/pck00011.tpc', 'lsk/naif0012.tls']);
const planetaryConstants = () => parseTextKernel(readFileSync(PCK!, 'utf8'), 'pck00011.tpc');
const leapSeconds = () => parseLeapSeconds(parseTextKernel(readFileSync(LSK!, 'utf8'), 'naif0012.tls'));

test('the camera evaluates an IAU pole model in ephemeris time, not in the UTC its frames are stamped in', () => {
  // 2017-07-14: 37 leap seconds plus the 32.184 s TAI-TT offset, with the periodic TDB term under two milliseconds.
  const utcSeconds = (2457948.709022 - 2451545) * 86400;
  close(utcSecondsToEt(leapSeconds(), utcSeconds) - utcSeconds, 69.184, 0.002, 'ET minus UTC in 2017');
  // Read as UTC by mistake, Kleopatra would be 1.3 degrees further round; the check above is what prevents that.
  close(69.184 / 86400 * 360 / (5.38528201 / 24), 1.284, 0.01, 'the longitude that offset is worth for Kleopatra');
});

test('an IAU pole model gives the sub-observer point Horizons reports for the same elements', () => {
  // JPL Horizons, fetched 2026-09-16: CENTER=500@399, 2018-06-20 00:00 UTC, QUANTITIES 1,14,15,20 in degrees.
  // Column 14 is the apparent planetodetic sub-observer point, west-positive, with down-leg light time applied.
  // Jupiter and Saturn keep the same elements in the IAU 2009 and 2015 reports, so pck00011 and Horizons describe one
  // body; Jupiter also turns 23 degrees of System III during its 38 light minutes, which proves the body epoch.
  // Mars and Ceres are NOT usable here: Horizons still evaluates their IAU 2009 poles, 1.5 and 7.7 degrees from the
  // pck00011 (IAU 2015) poles, so the differences there measure the reports and not this code.
  const pool = planetaryConstants(), lsk = leapSeconds(), epochJd = 2458289.5;
  const cases = [
    { body: 599, rightAscension: 221.62496, declination: -14.86092, rangeAu: 4.63038669189296, westLongitude: 306.960410, planetodeticLatitude: -3.626248 },
    { body: 699, rightAscension: 276.65457, declination: -22.43295, rangeAu: 9.05764434555661, westLongitude: 28.093940, planetodeticLatitude: 30.859733 },
  ];
  for (const expected of cases) {
    const camera = observerCamera({ epochJd, targetRightAscensionDegrees: expected.rightAscension, targetDeclinationDegrees: expected.declination,
      sunRightAscensionDegrees: 0, sunDeclinationDegrees: 0, rangeAu: expected.rangeAu, pixelAngleMicroradians: 1, center: [0, 0] },
      pckOrientation(pool, expected.body, lsk));
    // Horizons states the latitude on the body's reference spheroid; the camera states it from the centre.
    const [equatorial, , polar] = numbers(pool, `BODY${expected.body}_RADII`);
    const planetodetic = Math.atan(Math.tan(camera.observerLatitude * DEGREE) / (polar / equatorial) ** 2) / DEGREE;
    closeAngle(camera.observerWestLongitude, expected.westLongitude, 0.01, `body ${expected.body} sub-observer west longitude`);
    close(planetodetic, expected.planetodeticLatitude, 0.001, `body ${expected.body} sub-observer planetodetic latitude`);
  }
});

test('the inversion spin state and the IAU elements published for it orient the body the same way', () => {
  // DAMIT model 101 (2 Pallas) as IAUspin.txt: pole 37, 2 and W = 15.6 + 1105.816672 d, an IAU pole model in the same
  // words a PCK uses. Reading it through the PCK provider must give the camera the inversion spin state gives.
  // DAMIT rounds the pole to whole degrees and W0 to a tenth, and its epoch is a UTC Julian date while the IAU model's
  // argument is ephemeris time, 69 seconds or 0.9 degrees of Pallas; together they bound the residual near one degree.
  // A mirrored body would differ by twice the longitude, tens of degrees, so this still decides handedness.
  const spin = parseSpinState('35 -12 7.81323\n2433827.77154 0\n', 'longitude-first');
  const damit = parseTextKernel('\\begindata\nBODY2000002_POLE_RA = ( 37 0 0 )\nBODY2000002_POLE_DEC = ( 2 0 0 )\nBODY2000002_PM = ( 15.6 1105.816672 0 )\n', 'IAUspin.txt');
  const iau = pckOrientation(damit, 2000002, leapSeconds()), inversion = spinOrientation(spin);
  for (const [rightAscension, declination] of [[302.04882, 0.89432], [30, 40], [200, -30]]) {
    const sighting = { epochJd: 2457948.709022, targetRightAscensionDegrees: rightAscension, targetDeclinationDegrees: declination,
      sunRightAscensionDegrees: 306.55, sunDeclinationDegrees: 8.6, rangeAu: 1.7, pixelAngleMicroradians: 1, center: [0, 0] as const };
    const a = observerCamera(sighting, inversion), b = observerCamera(sighting, iau);
    closeAngle(a.observerWestLongitude, b.observerWestLongitude, 1.5, `sub-observer west longitude toward ${rightAscension}, ${declination}`);
    close(a.observerLatitude, b.observerLatitude, 0.5, `sub-observer latitude toward ${rightAscension}, ${declination}`);
    closeAngle(a.sunWestLongitude, b.sunWestLongitude, 1.5, 'sub-solar west longitude');
    closeAngle(a.northAzimuthDegrees, b.northAzimuthDegrees, 1, 'north azimuth');
    // A mirrored provider would put the point at the negated longitude; none of these sightings sits near a meridian.
    const mirrored = Math.abs((((-a.observerWestLongitude) - b.observerWestLongitude + 540) % 360) - 180);
    assert.ok(mirrored > 20, `the providers agree in handedness: the mirror image is ${mirrored} degrees away`);
  }
  // The spin-state path is unchanged by the orientation seam: the direct transform and the matrix agree exactly.
  const camera = observerCamera({ epochJd: 2457948.709022, targetRightAscensionDegrees: 302.04882, targetDeclinationDegrees: 0.89432,
    sunRightAscensionDegrees: 306.55, sunDeclinationDegrees: 8.6, rangeAu: 1.7, pixelAngleMicroradians: 1, center: [0, 0] }, spin);
  closeAngle(camera.observerWestLongitude, observerCamera({ epochJd: 2457948.709022, targetRightAscensionDegrees: 302.04882,
    targetDeclinationDegrees: 0.89432, sunRightAscensionDegrees: 306.55, sunDeclinationDegrees: 8.6, rangeAu: 1.7, pixelAngleMicroradians: 1,
    center: [0, 0] }, inversion).observerWestLongitude, 1e-9, 'spin state and its orientation agree');
});

test('a body the planetary constants kernel does not describe is refused before any frame is read', () => {
  assert.throws(() => pckOrientation(planetaryConstants(), 2000216, leapSeconds()), /No PCK orientation for body 2000216/);
});
