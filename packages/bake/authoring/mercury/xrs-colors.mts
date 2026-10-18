// Entry script: node packages/bake/authoring/mercury/xrs-colors.mts [--check]
/**
 * The colors of Mercury's magnesium/silicon map, read from NASA's own picture of the same map.
 *
 * The PDS releases the MESSENGER X-Ray Spectrometer's Mg/Si map as numbers (MESS-H-XRS-3-RDR-MAPS-V1.0,
 * xrs_map_mg_si_20150424). NASA published it as a picture, PIA19417 (left globe, 2015-04-16), whose caption says only
 * that red is high and blue is low; it prints no scale. This script finds the scale by reading the picture against the
 * numbers:
 *
 * 1. The globe is the left half's lit disc. Its centre and radius come from the disc's pixels.
 * 2. The picture is an orthographic view. The sub-viewer latitude, longitude and roll are the ones at which the
 *    pictured hue (blue 240° to red 0°) correlates best with the map value under each pixel, searched on a grid.
 * 3. The scale's ends are the median map values under the picture's bluest pixels (hue 235° or more) and its reddest
 *    (hue 5° or less). The picture's color is exact and the value under it carries the registration's scatter, so the
 *    curve is read one way only: every 5° of hue, its median value and the median color of its brightest third. The
 *    ramp is that curve's color at STOPS equal steps between the ends.
 *
 * The picture lays the colors over MDIS shading, so the colors read are the picture's as printed, not a clean palette.
 * It prints the view, the correlation, the ends and the ramp. With --check it fails when the magnesium surface in
 * `preparation/raster.json` or its legend in `content/object.json` holds other ends or another ramp.
 *
 * Inputs: science/xrs/xrs-mg-si-georeferenced.tif (from science/xrs/prepare-mg-si-map.json) and science/xrs/PIA19417.tif.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fromFile } from 'geotiff';
import sharp from 'sharp';

const source = resolve(checkoutProjectRoot(import.meta.url), 'src/objects/mercury/source');
const STOPS = 7, DATASET = 'magnesium';
const median = (list: number[]) => [...list].sort((a, b) => a - b)[list.length >> 1]!;

// The map: 1440 x 720 cells of 0.25°, first column at 180° W, first row at 90° N; DN 0 is missing.
const image = await (await fromFile(resolve(source, 'science/xrs/xrs-mg-si-georeferenced.tif'))).getImage();
const [band] = await image.readRasters(), width = image.getWidth(), height = image.getHeight();
if (!(band instanceof Uint8Array) || width !== 1440 || height !== 720) throw new Error('The Mg/Si map is not the 1440 x 720 byte grid its plan writes.');
const label = await readFile(resolve(source, 'science/xrs/xrs_map_mg_si_20150424.xml'), 'utf8');
const scale = Number(/<scaling_factor>([^<]+)<\/scaling_factor>/u.exec(label)?.[1]);
if (!Number.isFinite(scale)) throw new Error('The Mg/Si label gives no scaling_factor.');
const valueAt = (latitude: number, longitude: number) => {
  const x = Math.floor((((longitude + 180) % 360 + 360) % 360) * 4), y = Math.min(height - 1, Math.floor((90 - latitude) * 4));
  const raw = band[y * width + x]!; return raw === 0 ? undefined : raw * scale;
};

const picture = await sharp(resolve(source, 'science/xrs/PIA19417.tif')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { data } = picture, W = picture.info.width, H = picture.info.height, channels = picture.info.channels;
const pixel = (x: number, y: number) => { const at = (y * W + x) * channels; return [data[at]!, data[at + 1]!, data[at + 2]!] as const; };
let count = 0, sumX = 0, sumY = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W / 2; x++) { const [r, g, b] = pixel(x, y); if (r + g + b > 60) { count++; sumX += x; sumY += y; } }
const cx = sumX / count, cy = sumY / count, radius = Math.sqrt(count / Math.PI);

/** Hue in degrees, or undefined for a gray pixel or a hue off the blue-to-red ramp. */
const hueOf = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; if (d < 25) return undefined;
  let hue = 60 * (max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4); if (hue < 0) hue += 360;
  return hue > 300 ? undefined : hue;
};
/** Inverse orthographic projection of a disc point (x right, y up, unit radius) for a view centre and roll. */
const onSphere = (u: number, v: number, latitude0: number, longitude0: number, roll: number) => {
  const c = Math.cos(roll), s = Math.sin(roll), x = u * c - v * s, y = u * s + v * c, rho = Math.hypot(x, y);
  if (rho >= 1) return undefined;
  const angle = Math.asin(rho), p0 = latitude0 * Math.PI / 180;
  const latitude = rho === 0 ? p0 : Math.asin(Math.cos(angle) * Math.sin(p0) + y * Math.sin(angle) * Math.cos(p0) / rho);
  const longitude = longitude0 * Math.PI / 180 + Math.atan2(x * Math.sin(angle), rho * Math.cos(angle) * Math.cos(p0) - y * Math.sin(angle) * Math.sin(p0));
  return [latitude * 180 / Math.PI, longitude * 180 / Math.PI] as const;
};
/** Disc pixels inside 0.9 of the radius, every `step` pixels, with their hue. */
const discPixels = (step: number) => {
  const found: { u: number; v: number; hue: number; rgb: readonly [number, number, number] }[] = [];
  for (let y = Math.ceil(cy - radius); y < cy + radius; y += step) for (let x = Math.ceil(cx - radius); x < cx + radius; x += step) {
    const u = (x - cx) / radius, v = (cy - y) / radius; if (u * u + v * v > 0.81) continue;
    const rgb = pixel(x, y), hue = hueOf(...rgb); if (hue !== undefined) found.push({ u, v, hue, rgb });
  }
  return found;
};
const coarse = discPixels(4);
const correlation = (latitude0: number, longitude0: number, roll: number) => {
  let n = 0, a = 0, b = 0, aa = 0, bb = 0, ab = 0;
  for (const p of coarse) {
    const at = onSphere(p.u, p.v, latitude0, longitude0, roll), value = at && valueAt(...at); if (value === undefined) continue;
    const t = (240 - Math.min(240, p.hue)) / 240; n++; a += t; b += value; aa += t * t; bb += value * value; ab += t * value;
  }
  return (ab - a * b / n) / Math.sqrt((aa - a * a / n) * (bb - b * b / n));
};
let view = { r: -2, latitude: 0, longitude: 0, roll: 0 };
for (let latitude = -10; latitude <= 70; latitude += 5) for (let longitude = -180; longitude < 180; longitude += 5) {
  const r = correlation(latitude, longitude, 0); if (r > view.r) view = { r, latitude, longitude, roll: 0 };
}
for (const step of [1, 0.25]) {
  const from = { ...view };
  for (let latitude = from.latitude - 5 * step; latitude <= from.latitude + 5 * step; latitude += step)
    for (let longitude = from.longitude - 5 * step; longitude <= from.longitude + 5 * step; longitude += step)
      for (let roll = from.roll - 4 * step; roll <= from.roll + 4 * step; roll += step) {
        const r = correlation(latitude, longitude, roll * Math.PI / 180); if (r > view.r) view = { r, latitude, longitude, roll };
      }
}

const samples = discPixels(2).flatMap(p => { const at = onSphere(p.u, p.v, view.latitude, view.longitude, view.roll * Math.PI / 180), value = at && valueAt(...at); return value === undefined ? [] : [{ ...p, value }]; });
const round = (value: number) => Math.round(value * 1000) / 1000;
const low = round(median(samples.filter(p => p.hue >= 235).map(p => p.value))), high = round(median(samples.filter(p => p.hue <= 5).map(p => p.value)));
// The picture's color is exact and the value under it carries the registration's scatter, so the curve is read as the
// median value of each hue: every 5° of hue, from blue to red, its median value and its brightest third's median color.
const curve: { value: number; rgb: number[] }[] = [];
for (let hue = 240; hue >= 0; hue -= 5) {
  const near = samples.filter(p => Math.abs(p.hue - hue) <= 2.5 || (hue === 240 && p.hue > 240)); if (near.length < 30) continue;
  const bright = near.map(p => p.rgb).sort((p, q) => q[0] + q[1] + q[2] - (p[0] + p[1] + p[2])).slice(0, Math.max(1, Math.floor(near.length / 3)));
  curve.push({ value: median(near.map(p => p.value)), rgb: [0, 1, 2].map(channel => median(bright.map(rgb => rgb[channel]!))) });
}
if (curve.some((point, i) => i > 0 && point.value < curve[i - 1]!.value)) throw new Error('The median value does not rise from blue to red; the registration failed.');
const hex = (rgb: number[]) => `#${rgb.map(level => Math.round(level).toString(16).padStart(2, '0')).join('')}`;
const ramp = Array.from({ length: STOPS }, (_, step) => {
  const at = low + step * (high - low) / (STOPS - 1), after = curve.findIndex(point => point.value >= at);
  if (after <= 0) return hex(curve[after === 0 ? 0 : curve.length - 1]!.rgb);
  const a = curve[after - 1]!, b = curve[after]!, t = (at - a.value) / (b.value - a.value);
  return hex(a.rgb.map((level, channel) => level + t * (b.rgb[channel]! - level)));
});
console.log(`PIA19417 left globe: centre ${cx.toFixed(1)}, ${cy.toFixed(1)} px, radius ${radius.toFixed(1)} px; seen from ${view.latitude}° N, ${view.longitude}° E, roll ${view.roll}°; hue and Mg/Si correlate at r = ${view.r.toFixed(3)} over ${coarse.length} pixels`);
console.log(`scale ${low} (blue) to ${high} (red): ${ramp.join(' ')}`);

if (process.argv.includes('--check')) {
  const raster = JSON.parse(await readFile(resolve(source, 'preparation/raster.json'), 'utf8')) as { surfaces: { id: string; science?: { scientific?: { minimum?: number; maximum?: number; colors?: string[] } } }[] };
  const content = JSON.parse(await readFile(resolve(source, 'content/object.json'), 'utf8')) as { datasets: { controls: { id: string; legend?: { recipe?: { palette?: string[] } } }[] } };
  const scientific = raster.surfaces.find(surface => surface.id === DATASET)?.science?.scientific;
  const legend = content.datasets.controls.find(control => control.id === DATASET)?.legend?.recipe?.palette;
  const problems = [
    (scientific?.minimum !== low || scientific.maximum !== high) && `preparation/raster.json: ${DATASET} spans ${scientific?.minimum} to ${scientific?.maximum}, not ${low} to ${high}`,
    JSON.stringify(scientific?.colors) !== JSON.stringify(ramp) && `preparation/raster.json: ${DATASET} does not hold this ramp`,
    JSON.stringify(legend) !== JSON.stringify(ramp) && `content/object.json: the ${DATASET} legend does not hold this ramp`,
  ].filter(Boolean);
  for (const problem of problems) console.error(`   ${problem}`);
  if (problems.length) process.exitCode = 1;
}
