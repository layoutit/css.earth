import { fromFile } from "geotiff";
import { resolve } from "node:path";
import { validateEuropaSourceGroup } from "./source-manifest.mjs";
import { EUROPA_SOURCE_ROOT } from "./preparation-paths.mjs";
import { COLOR_PHOTOMETRY, colorPhotometricGain, loadColorGeometry } from "./color-photometry.mjs";

// Calibrated I/F observations, never the aesthetically filled Trek mosaic.
// Bands from one observation must all be present at each published location.
export async function prepareEuropaColor({ width, height }) {
  const entries = await validateEuropaSourceGroup("color");
  const geometry = await loadColorGeometry();
  const photometry = { ...COLOR_PHOTOMETRY, correctedPixels: 0, withheldPixels: 0, clippedChannels: 0 };
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
      const capture = geometry.get(entry.id);
      if (entry.observation === COLOR_PHOTOMETRY.observation && !capture) throw new Error(`Missing photometry: ${entry.id}`);
      groups.get(entry.observation).push({ ...entry, data, origin, resolution, capture });
    } finally { await file.close(); }
  }
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height).fill(1);
  const owners = new Uint8Array(width * height);
  const coverage = {};
  // Highest native density wins. Keep boundaries between observations;
  // do not blend across dates, transfer monochrome detail, or synthesize color.
  const ordered = [...groups].sort((a, b) => a[1][0].resolution[0] - b[1][0].resolution[0]);
  for (const [observationIndex, [observation, bands]] of ordered.entries()) {
    const channels = ["IR-7560", "GREEN", "VIOLET"].map(filter => bands.filter(band => band.filter === filter));
    if (channels.some(channel => !channel.length)) throw new Error(`Incomplete color observation: ${observation}`);
    let pixels = 0, solidAngle = 0;
    for (let y = 0; y < height; y++) {
      const latitude = (90 - (y + 0.5) * 180 / height) * Math.PI / 180;
      const northing = latitude * 1560800;
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (missing[index] !== 1) continue;
        const easting = ((x + 0.5) * 360 / width - 180) * Math.PI / 180 * 1560800;
        const samples = channels.map(channel => {
          for (const band of channel) {
            const value = sampleColorBand(band, easting, northing);
            if (value !== null) return { value, band };
          }
          return null;
        });
        if (samples.some(sample => sample === null)) continue;
        let gains = [1, 1, 1];
        if (observation === COLOR_PHOTOMETRY.observation) {
          const longitude = (x + 0.5) * 2 * Math.PI / width;
          const normal = [Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude)];
          gains = samples.map(({ band }) => colorPhotometricGain(normal, band.capture));
          if (gains.some(gain => gain === null)) {
            // Reserve this footprint until all color sequences finish, then use
            // monochrome rather than substituting another date's color.
            missing[index] = 2;
            photometry.withheldPixels++;
            continue;
          }
          photometry.correctedPixels++;
        }
        missing[index] = 0;
        owners[index] = observationIndex + 1;
        pixels++;
        solidAngle += Math.cos(latitude);
        // One fixed display transfer for every band/date. I/F=1 maps to white.
        // Infrared/red, green/green, violet/blue is enhanced, not natural color.
        for (let c = 0; c < 3; c++) {
          const value = samples[c].value * gains[c];
          if (observation === COLOR_PHOTOMETRY.observation && value > 1) photometry.clippedChannels++;
          rgb[index * 3 + c] = Math.round(255 * Math.min(1, Math.max(0, value)) ** (1 / 2.2));
        }
      }
    }
    coverage[observation] = { pixels, surfacePercent: solidAngle / (width * height * 2 / Math.PI) * 100 };
  }
  for (let i = 0; i < missing.length; i++) if (missing[i] === 2) missing[i] = 1;
  return { rgb, missing, owners, observationNames: ordered.map(([name]) => name), coverage, photometry,
    sourceIds: entries.map(entry => entry.id) };
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

// Presentation-only exposure matching against the existing monochrome mosaic.
// One scalar per observation preserves RGB ratios and internal contrast. The
// robust boundary fit never copies monochrome detail or blends image pixels.
export function matchEuropaColorLevels(color, monochrome, { width, height }) {
  const samples = color.observationNames.map(() => []);
  const maxima = color.observationNames.map(() => 0);
  const luminance = (rgb, i) => .2126 * rgb[i] + .7152 * rgb[i + 1] + .0722 * rgb[i + 2];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, owner = color.owners[i];
    if (!owner) continue;
    const c = i * 3;
    maxima[owner - 1] = Math.max(maxima[owner - 1], color.rgb[c], color.rgb[c + 1], color.rgb[c + 2]);
    if (monochrome.missing[i] || y < 4 || y >= height - 4) continue;
    // Four-texel strip inside each footprint, with longitude wrap. Compare
    // co-located valid observations; missing-data indicators cannot set levels.
    if ([i - 4 * width, i + 4 * width, y * width + (x + 4) % width,
      y * width + (x + width - 4) % width].every(j => color.owners[j] === owner)) continue;
    const source = luminance(color.rgb, c), reference = luminance(monochrome.rgb, c);
    if (source > 0 && reference > 0) samples[owner - 1].push(reference / source);
  }
  const levels = color.observationNames.map((observation, i) => {
    const ratios = samples[i].sort((a, b) => a - b);
    const requestedGain = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 1;
    return { observation, boundarySamples: ratios.length,
      gain: Math.min(requestedGain, maxima[i] ? 255 / maxima[i] : 1) };
  });
  for (let i = 0; i < color.owners.length; i++) {
    if (!color.owners[i]) continue;
    const { gain } = levels[color.owners[i] - 1];
    for (let c = 0; c < 3; c++) color.rgb[i * 3 + c] = Math.round(color.rgb[i * 3 + c] * gain);
  }
  return levels;
}
