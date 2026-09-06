import { fromFile } from "geotiff";
import { resolve } from "node:path";
import { validateEuropaSourceGroup } from "./source-manifest.mjs";
import { EUROPA_SOURCE_ROOT } from "./preparation-paths.mjs";

// Calibrated I/F observations, never the aesthetically filled Trek mosaic.
// Bands from one observation must all be present at each published location.
export async function prepareEuropaColor({ width, height }) {
  const entries = await validateEuropaSourceGroup("color");
  const groups = new Map();
  for (const entry of entries) {
    const file = await fromFile(resolve(EUROPA_SOURCE_ROOT, entry.path));
    try {
      const image = await file.getImage(), keys = image.getGeoKeys();
      const origin = image.getOrigin(), resolution = image.getResolution();
      const band = await image.getGDALMetadata(0);
      if (image.getWidth() !== entry.width || image.getHeight() !== entry.height ||
          image.getSampleFormat(0) !== 3 || image.getSampleByteSize(0) !== 4 || image.getGDALNoData() !== 0 ||
          keys.GeogSemiMajorAxisGeoKey !== 1560800 || keys.ProjCenterLongGeoKey !== 180 ||
          keys.ProjStdParallel1GeoKey !== 0 || resolution[0] <= 0 || resolution[1] >= 0 ||
          Number(band.WAVELENGTH) !== entry.wavelengthMicrometers || band.DESCRIPTION !== entry.filter) {
        throw new Error(`Europa color source mapping or filter changed: ${entry.id}`);
      }
      const [data] = await image.readRasters();
      if (!groups.has(entry.observation)) groups.set(entry.observation, []);
      groups.get(entry.observation).push({ ...entry, data, origin, resolution });
    } finally { await file.close(); }
  }
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height).fill(1);
  const coverage = {};
  // Highest native density wins. Keep illumination seams between observations;
  // do not blend across dates, transfer monochrome detail, or synthesize color.
  const ordered = [...groups].sort((a, b) => a[1][0].resolution[0] - b[1][0].resolution[0]);
  for (const [observation, bands] of ordered) {
    const channels = ["IR-7560", "GREEN", "VIOLET"].map(filter => bands.filter(band => band.filter === filter));
    if (channels.some(channel => !channel.length)) throw new Error(`Incomplete color observation: ${observation}`);
    let pixels = 0, solidAngle = 0;
    for (let y = 0; y < height; y++) {
      const latitude = (90 - (y + 0.5) * 180 / height) * Math.PI / 180;
      const northing = latitude * 1560800;
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (!missing[index]) continue;
        const easting = ((x + 0.5) * 360 / width - 180) * Math.PI / 180 * 1560800;
        const values = channels.map(channel => {
          for (const band of channel) {
            const value = sampleColorBand(band, easting, northing);
            if (value !== null) return value;
          }
          return null;
        });
        if (values.some(value => value === null)) continue;
        missing[index] = 0;
        pixels++;
        solidAngle += Math.cos(latitude);
        // One fixed display transfer for every band/date. I/F=1 maps to white.
        // Infrared/red, green/green, violet/blue is enhanced, not natural color.
        for (let c = 0; c < 3; c++) rgb[index * 3 + c] = Math.round(255 * Math.min(1, Math.max(0, values[c])) ** (1 / 2.2));
      }
    }
    coverage[observation] = { pixels, surfacePercent: solidAngle / (width * height * 2 / Math.PI) * 100 };
  }
  return { rgb, missing, coverage, sourceIds: entries.map(entry => entry.id) };
}

export function sampleColorBand(band, easting, northing) {
  const px = (easting - band.origin[0]) / band.resolution[0] - 0.5;
  const py = (northing - band.origin[1]) / band.resolution[1] - 0.5;
  const x = Math.floor(px), y = Math.floor(py);
  if (x < 0 || y < 0 || x + 1 >= band.width || y + 1 >= band.height) return null;
  const values = [band.data[y * band.width + x], band.data[y * band.width + x + 1],
    band.data[(y + 1) * band.width + x], band.data[(y + 1) * band.width + x + 1]];
  // Explicit zero no-data and ISIS special float values. Never interpolate
  // across missing neighbors, and do not classify observed dark pixels as gaps.
  if (values.some(value => !Number.isFinite(value) || value === 0 || Math.abs(value) > 1e30)) return null;
  const dx = px - x, dy = py - y;
  return values[0] * (1 - dx) * (1 - dy) + values[1] * dx * (1 - dy) +
    values[2] * (1 - dx) * dy + values[3] * dx * dy;
}
