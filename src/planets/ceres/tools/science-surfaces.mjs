import { resolve } from "node:path";
import { fromFile } from "geotiff";
import { paintMissingCoverage } from "../../../platform/prepare-missing-coverage.mjs";

export function colorForValue(value, { minimum, maximum, colors }) {
  const t = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum))) * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(t)), fraction = t - i;
  const rgb = hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  const a = rgb(colors[i]), b = rgb(colors[i + 1]);
  return a.map((v, c) => Math.round(v + (b[c] - v) * fraction));
}

// Cartographic light: northwest, 45° above the local horizon, no height
// exaggeration. Slopes use Ceres's 470 km reference sphere, not Earth units.
export function terrainBrightness(source, longitude, latitude, step) {
  const west = source.sample((longitude - step + 360) % 360, latitude);
  const east = source.sample((longitude + step) % 360, latitude);
  const north = source.sample(longitude, latitude + step);
  const south = source.sample(longitude, latitude - step);
  // Keep the original height color at a coverage edge; never estimate a
  // missing neighbor or shade the gray coverage indicator.
  if ([west, east, north, south].some(value => value === null)) return 1;
  const distance = 470000 * step * Math.PI / 180;
  const eastSlope = (east - west) / (2 * distance * Math.cos(latitude * Math.PI / 180));
  const northSlope = (north - south) / (2 * distance);
  const illumination = Math.max(0, (0.5 * eastSlope - 0.5 * northSlope + Math.SQRT1_2)
    / Math.hypot(eastSlope, northSlope, 1));
  // Ambient light keeps steep slopes readable; level terrain keeps its color.
  return (0.25 + 0.75 * illumination) / (0.25 + 0.75 * Math.SQRT1_2);
}

// Read the pinned DLR elevation product at preparation time.
export async function loadScienceSurface(root, lens) {
  const path = resolve(root, lens.path);
  if (lens.format === "geotiff") {
    const tiff = await fromFile(path);
    try {
      const image = await tiff.getImage(), keys = image.getGeoKeys();
      if (image.getWidth() !== 21600 || image.getHeight() !== 10800 ||
          keys.ProjCenterLongGeoKey !== 180 || keys.GeogSemiMajorAxisGeoKey !== 470000 ||
          image.getGDALNoData() !== -32768) throw new Error("Unexpected Ceres DTM grid.");
      const data = await image.readRasters({ interleave: true });
      return {
        sample(longitude, latitude) {
          // Withhold the polar regions as a display policy, not as a claim
          // that every source sample there is absent. No fill mask is supplied.
          if (Math.abs(latitude) >= 60) return null;
          const x = Math.min(21599, Math.floor(longitude * 60));
          const y = Math.min(10799, Math.floor((90 - latitude) * 60));
          const value = data[y * 21600 + x];
          return value === -32768 ? null : value;
        },
      };
    } finally { await tiff.close(); }
  }

  throw new Error(`Unsupported Ceres scientific source: ${lens.format}`);
}

export function paintScienceSurface(source, lens, width, height) {
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  // One finite color lookup; no per-pixel hex parsing or runtime source work.
  const palette = Array.from({ length: 1024 }, (_, i) => colorForValue(lens.minimum + i / 1023 * (lens.maximum - lens.minimum), lens));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const longitude = (x + 0.5) / width * 360, latitude = 90 - (y + 0.5) / height * 180;
    const i = y * width + x, value = source.sample(longitude, latitude);
    if (value === null) { missing[i] = 1; continue; }
    const color = palette[Math.round(Math.max(0, Math.min(1, (value - lens.minimum) / (lens.maximum - lens.minimum))) * 1023)];
    const brightness = terrainBrightness(source, longitude, latitude, 360 / width);
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.min(255, Math.round(color[c] * brightness));
  }
  return { rgb: paintMissingCoverage(rgb, { width, height, channels: 3 }, missing), missing };
}
