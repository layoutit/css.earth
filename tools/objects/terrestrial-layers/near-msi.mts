import { readFitsHeader, readFitsPrimary } from '@cssearth/fits';
import { array, number, shape, text, dotN as dot } from '@cssearth/core';


const radians = (degrees: number) => degrees * Math.PI / 180;
const direction = (latitude: number, longitudeWest: number) => {
  const p = radians(latitude), l = radians(-longitudeWest);
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
};

/** Thomas's released, reconstructed image geometry, not the preliminary FITS ephemeris.
 * The Mathilde table contains 25 rows and camera code 93 (NEAR MSI). */
export function readMathildeImageGeometry(source: string, met: number) {
  const rows = source.trim().split(/\r?\n/).map(line => line.trim().split(/\s+/).map(Number));
  if (rows.length !== 25 || new Set(rows.map(row => row[0])).size !== rows.length || rows.some(row =>
    row.length !== 10 || !row.every(Number.isFinite) || !Number.isSafeInteger(row[0]) || row[0] <= 0 ||
    Math.abs(row[1]) > 90 || row[2] < 0 || row[2] >= 360 || Math.abs(row[3]) > 90 || row[4] < 0 || row[4] >= 360 ||
    row[5] <= 0 || row[6] < 0 || row[6] >= 360 || row[9] !== 93)) throw new Error('Invalid Thomas Mathilde image geometry.');
  const row = rows.find(row => row[0] === met);
  if (!row) throw new Error(`No reconstructed Mathilde geometry for MET ${met}.`);
  const [imageMet, latitude, longitudeWest, solarLatitude, solarLongitudeWest, rangeKm, northAzimuth, centreSample, centreLine] = row;
  return { imageMet, latitude, longitudeWest, solarLatitude, solarLongitudeWest, rangeKm, northAzimuth, centreSample, centreLine };
}

/** Pinhole in the shape's J2000-parallel frame. Murchie et al. (1999), section 4.1,
 * gives the 166.85 mm focal length and 16 x 27 micrometre detector sampling.
 * Interpreting Thomas's image centres as square, 16 micrometre sampling requires
 * dividing lines by 27/16, with north azimuth clockwise in row-down coordinates. FITS samples
 * stay in file order; the archive's display flip is not applied to the camera.
 * This pixel convention must also pass the independent limb check before use. */
export function mathildeImageCamera(table: string, met: number) {
  const geometry = readMathildeImageGeometry(table, met);
  const { latitude, longitudeWest, solarLatitude, solarLongitudeWest, rangeKm, northAzimuth, centreSample, centreLine } = geometry;
  const p = radians(latitude), l = radians(-longitudeWest), a = radians(northAzimuth);
  const observer = direction(latitude, longitudeWest), forward = observer.map(n => -n);
  const north = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)], east = [-Math.sin(l), Math.cos(l), 0];
  const right = north.map((n, i) => n * Math.sin(a) + east[i] * Math.cos(a));
  const down = north.map((n, i) => -n * Math.cos(a) + east[i] * Math.sin(a));
  const fx = 166.85 / .016, fy = 166.85 / .027, cx = centreSample, cy = centreLine * 16 / 27;
  const positionKm = observer.map(n => n * rangeKm);
  const rows = [right.map((n, i) => n * fx + forward[i] * cx), down.map((n, i) => n * fy + forward[i] * cy), forward];
  return { schema: 'cssearth-archived-camera@1', matrix: rows.map(row => [...row, -dot(row, positionKm)]),
    rayMatrix: [0, 1, 2].map(i => [right[i] / fx, down[i] / fy, forward[i] - right[i] * cx / fx - down[i] * cy / fy]),
    positionKm, sunDirection: direction(solarLatitude, solarLongitudeWest), geometry,
    detector: { focalLengthMm: 166.85, pitchMm: [.016, .027], tableLineToDetector: 16 / 27,
      convention: 'Thomas image centres in square samples; north azimuth in row-down coordinates; FITS file order.' } };
}

const parseIdentity = shape({ met: number, filter: text, startTime: text });

/** Native I/F is kept floating point. The paired uncompressed raw image supplies
 * the zero-valued missing-telemetry mask and the 4095 DN saturation mask. The
 * archive warns that DATA_QUALITY_INDEX is not fully understood: retain it as
 * unresolved metadata, never interpret 20000000 as an authoritative good verdict. */
export function decodeNearMsi(imageBytes: Buffer, rawBytes: Buffer, value: unknown) {
  const identity = parseIdentity(value), image = readFitsPrimary(imageBytes), raw = readFitsPrimary(rawBytes);
  const { header: h } = readFitsHeader(imageBytes), { header: r } = readFitsHeader(rawBytes);
  if (
    image.width !== 537 || image.height !== 244 || raw.width !== image.width || raw.height !== image.height ||
    image.bitpix !== -32 || raw.bitpix !== 16 || image.scale !== 1 || raw.scale !== 1 || image.zero !== 0 || raw.zero !== 32768 ||
    image.nextOffset !== imageBytes.length || raw.nextOffset !== rawBytes.length || h.BUNIT !== 'I/F' ||
    Number(h['NEAR-013']) !== 2 || Number(r['NEAR-013']) !== 0 || r['NEAR-005'] !== 'MSI.004' ||
    [h, r].some(header => header.SIMPLE !== true || header['NEAR-047'] !== 'MATHILDE' || header['NEAR-046'] !== 2000253 ||
      Number(header['NEAR-017']) !== identity.met || String(header['NEAR-009']) !== identity.filter ||
      Number(header['NEAR-012']) !== 0 || Number(header['NEAR-058']) !== 4095 ||
      !(Number(header['NEAR-010']) > 0) || String(header['NEAR-008']) !== '20000000') ||
    !Number.isSafeInteger(identity.met) || !/^[0-7]$/.test(identity.filter)) throw new Error('NEAR MSI image/raw identity, calibration or detector layout changed.');
  let missing = 0, saturated = 0;
  for (const dn of raw.values) {
    if (!Number.isInteger(dn) || dn < 0 || dn > 4095) throw new Error('NEAR MSI raw DN outside the 12-bit detector range.');
    if (dn === 0) missing++;
    if (dn === 4095) saturated++;
  }
  if (saturated !== Number(r['NEAR-059'])) throw new Error('NEAR MSI saturation count disagrees with the raw image.');
  const acceptPixel = (i: number) => Number.isInteger(i) && i >= 0 && i < image.values.length &&
    raw.values[i] > 0 && raw.values[i] < 4095 && Number.isFinite(image.values[i]) && Math.abs(image.values[i]) < 1e31;
  return { width: image.width, height: image.height, planes: { IMAGE: image.values }, header: h,
    startTime: identity.startTime, filter: identity.filter, acceptPixel,
    qualityReport: { instrument: 'NEAR MSI', units: 'I/F', rawMissingPixels: missing, rawSaturatedPixels: saturated,
      quality: 'Paired raw DN: zero is missing telemetry, 4095 is saturation; nonfinite and PDS unknown/not-applicable I/F rejected.',
      archiveQualityIndex: String(h['NEAR-008']), archiveQualityIndexInterpretation: 'Unresolved, as warned by the PDS4 bundle overview; not treated as a good-quality flag.',
      limitations: 'No authoritative per-pixel quality plane. Readout smear, scattered light, periodic noise and calibration uncertainty can remain.' } };
}

export const parseNearCameraClosure = shape({ met: number, startTime: text, filter: text,
  matrix: array(array(number)), rayMatrix: array(array(number)), positionKm: array(number), sunDirection: array(number) });
