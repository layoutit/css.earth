/**
 * Place a Voyager ISS narrow-angle GEOMED frame on a spherical body and write it as a per-frame equirectangular GeoTIFF,
 * the same product shape as USGS's controlled observations, so the existing observed-colour lens consumes it unchanged.
 *
 *   recorded (SEDR) pointing → limb fit on the sunlit side → corrected camera → datum shift → equirectangular I/F
 *
 * The camera comes from a pinned kernel bank. GEOMED frames are geometrically corrected onto a 1000 x 1000 grid whose pixel
 * scale the PDS3 label states (HORIZONTAL_PIXEL_FOV); columns follow the instrument frame's +X and rows its +Y, which a
 * limb probe on c1139257 confirmed (the predicted disc centre fell 53 px from the observed one only in that orientation).
 */
import { globals, writeArrayBuffer } from 'geotiff';
import { decodeCalibratedCamera } from '../terrestrial-layers/shape-camera-mosaic.mts';
import { pds3Keyword } from '../pds3-labels.mts';
import { spiceCamera } from '../../spice/camera.mts';
import { utcToEt } from '../../spice/lsk.mts';
import type { KernelSet } from '../../spice/kernel-set.mts';
import { fitLimb, limbAccepted, type LimbFit } from './limb.mts';

// geotiff 3 reads GDAL_METADATA (tag 42112) but its writer has no type for it; GDAL defines it as ASCII.
(globals.fieldTagTypes as Record<number, string>)[42112] ??= 'ASCII';

export interface VoyagerRoute {
  observer: number; target: number; bodyFrame: string; instrument: number; frame: string;
  aberration: 'LT+S'; radiusKm: number;
  /** Added to every placed point so frames land on the reference map's grid (a measured datum shift, in degrees). */
  datumShiftDegrees: { longitude: number; latitude: number };
  /** Frames are used only where the view and the Sun are within these angles of the surface normal. */
  maximumEmissionDegrees: number; maximumIncidenceDegrees: number;
}
export interface PlacedFrame {
  id: string; filter: string; imageTime: string; et: number;
  prediction: { centre: [number, number]; radiusPixels: number };
  limb: LimbFit; accepted: boolean;
  camera: ReturnType<typeof spiceCamera>;
  pixelScaleKm: number;
}

const label = (text: string, key: string) => {
  const value = pds3Keyword(text, key);
  if (value === undefined) throw new Error(`PDS3 label lacks ${key}.`);
  return value.replace(/^"|"$/g, '');
};

/** The GEOMED frame as I/F with exact zeros (the resampling margin) as no data. */
export function decodeGeomed(bytes: Buffer) {
  const image = decodeCalibratedCamera(bytes);
  const values = Float32Array.from(image.data, v => v === 0 ? NaN : v);
  return { width: image.width, height: image.height, values };
}

export function placeFrame(id: string, bytes: Buffer, labelText: string, set: KernelSet, route: VoyagerRoute): PlacedFrame {
  if (label(labelText, 'PRODUCT_ID') !== `${id.toUpperCase()}_GEOMED.IMG`) throw new Error(`Label does not describe ${id}.`);
  const filter = label(labelText, 'FILTER_NAME'), imageTime = label(labelText, 'IMAGE_TIME');
  const degreesPerPixel = Number(label(labelText, 'HORIZONTAL_PIXEL_FOV').split(/\s/)[0]);
  const image = decodeGeomed(bytes);
  if (!(degreesPerPixel > 0) || image.width !== 1000 || image.height !== 1000) throw new Error(`${id} is not a 1000 x 1000 GEOMED frame.`);
  const focalLengthPixels = 1 / (degreesPerPixel * Math.PI / 180), et = utcToEt(set.leapSeconds, `${imageTime}Z`);
  const model = (centre: [number, number]) => ({ focalLengthPixels, center: centre, boresight: [0, 0, 1], column: [1, 0, 0], row: [0, 1, 0],
    frame: route.frame, width: image.width, height: image.height, focalLengthMm: NaN, pixelPitchMm: NaN });
  const camera = (centre: [number, number]) => spiceCamera({ pool: set.pool, ephemeris: set.ephemeris, rotation: set.rotation,
    observer: route.observer, target: route.target, bodyFrame: route.bodyFrame, instrument: route.instrument, et,
    aberration: route.aberration, pixels: model(centre) as never });
  const optical: [number, number] = [(image.width - 1) / 2, (image.height - 1) / 2];
  const recorded = camera(optical), m = recorded.matrix;
  const centre: [number, number] = [m[0]![3]! / m[2]![3]!, m[1]![3]! / m[2]![3]!];
  const radiusPixels = route.radiusKm / recorded.report.rangeKm * focalLengthPixels;
  // Sun direction in the image plane: project a point just toward the Sun from the body centre.
  const s = recorded.sunDirection, q = [s[0]! * 100, s[1]! * 100, s[2]! * 100];
  const w = m[2]![0]! * q[0]! + m[2]![1]! * q[1]! + m[2]![2]! * q[2]! + m[2]![3]!;
  const sx = (m[0]![0]! * q[0]! + m[0]![1]! * q[1]! + m[0]![2]! * q[2]! + m[0]![3]!) / w - centre[0];
  const sy = (m[1]![0]! * q[0]! + m[1]![1]! * q[1]! + m[1]![2]! * q[2]! + m[1]![3]!) / w - centre[1], sn = Math.hypot(sx, sy);
  const limb = fitLimb(image, { centre, radiusPixels, sunDirection: [sx / sn, sy / sn] });
  const accepted = limbAccepted(limb);
  // Shifting the optical centre by the limb offset moves every projected point by that offset: the corrected camera.
  const corrected = accepted ? camera([optical[0] + limb.shift[0], optical[1] + limb.shift[1]]) : recorded;
  return { id, filter, imageTime, et, prediction: { centre, radiusPixels }, limb, accepted, camera: corrected,
    pixelScaleKm: recorded.report.rangeKm / focalLengthPixels };
}

/**
 * The placed frame on an equirectangular grid of `cellDegrees`, clipped to its footprint: raw calibrated I/F (no photometric
 * correction; the lens applies its own), NaN where the frame has no usable sample.
 */
export function projectFrame(placed: PlacedFrame, values: ArrayLike<number>, route: VoyagerRoute, cellDegrees: number) {
  const { matrix: m, positionKm: obs, sunDirection: sun } = placed.camera, R = route.radiusKm, d2r = Math.PI / 180;
  const cosE = Math.cos(route.maximumEmissionDegrees * d2r), cosI = Math.cos(route.maximumIncidenceDegrees * d2r);
  const columns = Math.round(360 / cellDegrees), rows = Math.round(180 / cellDegrees), full = new Float32Array(columns * rows).fill(NaN);
  let x0 = columns, x1 = -1, y0 = rows, y1 = -1;
  for (let y = 0; y < rows; y++) {
    const latitude = 90 - (y + 0.5) * cellDegrees, la = (latitude - route.datumShiftDegrees.latitude) * d2r;
    for (let x = 0; x < columns; x++) {
      const lo = ((x + 0.5) * cellDegrees - route.datumShiftDegrees.longitude) * d2r;
      const n = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)], p = n.map(c => c * R);
      const v = [obs[0]! - p[0]!, obs[1]! - p[1]!, obs[2]! - p[2]!], vn = Math.hypot(v[0]!, v[1]!, v[2]!);
      if ((v[0]! * n[0]! + v[1]! * n[1]! + v[2]! * n[2]!) / vn < cosE || sun[0]! * n[0]! + sun[1]! * n[1]! + sun[2]! * n[2]! < cosI) continue;
      const w = m[2]![0]! * p[0]! + m[2]![1]! * p[1]! + m[2]![2]! * p[2]! + m[2]![3]!;
      const px = Math.round((m[0]![0]! * p[0]! + m[0]![1]! * p[1]! + m[0]![2]! * p[2]! + m[0]![3]!) / w);
      const py = Math.round((m[1]![0]! * p[0]! + m[1]![1]! * p[1]! + m[1]![2]! * p[2]! + m[1]![3]!) / w);
      if (px < 20 || py < 20 || px > 979 || py > 979) continue;
      const value = values[py * 1000 + px]!;
      if (!Number.isFinite(value)) continue;
      full[y * columns + x] = value;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return null;
  return equirectangularTiles(full, columns, rows);
}

export interface EquirectangularTile { data: Float32Array; width: number; height: number; firstColumn: number; firstRow: number }

/**
 * Crop a whole-globe grid to its footprint. A footprint across 0 degrees longitude becomes two tiles, one on each side,
 * because the colour reader places a tile by a single easting range and cannot wrap it.
 */
export function equirectangularTiles(full: Float32Array, columns: number, rows: number): EquirectangularTile[] {
  const used = new Uint8Array(columns);
  let y0 = rows, y1 = -1;
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) if (Number.isFinite(full[y * columns + x]!)) { used[x] = 1; y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (y1 < 0) return [];
  // Longest run of empty columns, counted around the globe; the footprint is everything else.
  let bestStart = 0, bestLength = 0;
  for (let x = 0; x < columns; x++) {
    if (used[x]) continue;
    let length = 0;
    while (length < columns && !used[(x + length) % columns]) length++;
    if (length > bestLength) { bestLength = length; bestStart = x; }
    if (length === columns) break;
  }
  const first = (bestStart + bestLength) % columns, span = columns - bestLength;
  const ranges = first + span <= columns ? [[first, first + span - 1]] : [[first, columns - 1], [0, (first + span - 1) % columns]];
  return ranges.map(([a, b]) => {
    const width = b! - a! + 1, height = y1 - y0 + 1, data = new Float32Array(width * height);
    for (let y = 0; y < height; y++) data.set(full.subarray((y0 + y) * columns + a!, (y0 + y) * columns + b! + 1), y * width);
    return { data, width, height, firstColumn: a!, firstRow: y0 };
  });
}

/** An equirectangular float32 GeoTIFF with the filter named as its band description, as the observed-colour reader expects. */
export function equirectangularGeoTiff(tile: EquirectangularTile, { radiusMeters, filter, wavelengthMicrometers, cellDegrees }:
  { radiusMeters: number; filter: string; wavelengthMicrometers: number; cellDegrees: number }) {
  const metresPerDegree = radiusMeters * Math.PI / 180, noData = -9999;
  const data = Float32Array.from(tile.data, v => Number.isFinite(v) ? v : noData);
  return Buffer.from(writeArrayBuffer(data, { width: tile.width, height: tile.height, BitsPerSample: [32], SampleFormat: [3], GDAL_NODATA: String(noData),
    GDAL_METADATA: `<GDALMetadata><Item name="WAVELENGTH" sample="0">${wavelengthMicrometers}</Item><Item name="DESCRIPTION" sample="0" role="description">${filter}</Item></GDALMetadata>`,
    ModelPixelScale: [cellDegrees * metresPerDegree, cellDegrees * metresPerDegree, 0],
    ModelTiepoint: [0, 0, 0, tile.firstColumn * cellDegrees * metresPerDegree, (90 - tile.firstRow * cellDegrees) * metresPerDegree, 0],
    ProjectedCSTypeGeoKey: 32767,
    GeoKeyDirectory: [1, 1, 0, 10, 1024, 0, 1, 1, 1025, 0, 1, 1, 2057, 34736, 1, 0, 2058, 34736, 1, 0,
      3072, 0, 1, 32767, 3075, 0, 1, 17, 3076, 0, 1, 9001, 3078, 34736, 1, 1, 3088, 34736, 1, 2, 3089, 34736, 1, 1],
    GeoDoubleParams: [radiusMeters, 0, 0] } as never));
}
