import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eclipticToBody, eclipticToEquatorial, equatorialToEcliptic, observerCamera, parseSpinState,
  rotationPhaseDegrees, bodyEpochJd, type SpinState, type Vector } from './observer-camera.mts';
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

test('a pole stated just past the pole is folded, not refused', () => {
  // 130 Elektra's release states -92.2669, which is 2.27 degrees beyond the south pole rather than a bad number.
  // Refusing it loses the record; reading it literally puts the pole 156 degrees wrong.
  const elektra = parseSpinState('67.7259 -92.2669 5.22466350\n2444914.8 0\n', 'longitude-first');
  close(elektra.latitudeDegrees, -87.7331, 1e-9, 'folded pole latitude');
  close(elektra.longitudeDegrees, 247.7259, 1e-9, 'folded pole longitude');
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
  const dot = (a: Vector, b: Vector) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
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
  const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
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
