import type { EvidenceInputs } from '../../evidence/model.ts';
import { type SkyBounds, createEmissionWindowSampler, readEmissionWindow, type EmissionWindow } from '@cssearth/bake/volume';

export interface CompilerTargetSourceControls { backgroundSpread: number; edgeTaperArcsec: number }
export interface CompilerTargetControls { sources: Record<string, CompilerTargetSourceControls>; minimumWeightNormalization?: number }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const range = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
export function readCompilerTargetControls(value: unknown): CompilerTargetControls {
  if (!record(value) || Object.keys(value).some(key => !['sources', 'minimumWeightNormalization'].includes(key)) || !record(value.sources) || Object.keys(value.sources).length > 8 ||
      value.minimumWeightNormalization !== undefined && !range(value.minimumWeightNormalization, 0, 1))
    throw new TypeError('Invalid compiler target controls.');
  const sources: CompilerTargetControls['sources'] = {};
  for (const [id, source] of Object.entries(value.sources)) {
    if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(id) || !record(source) || Object.keys(source).some(key => !['backgroundSpread', 'edgeTaperArcsec'].includes(key)) ||
        !range(source.backgroundSpread, 0, 3) || !range(source.edgeTaperArcsec, 0, 3600)) throw new TypeError('Invalid compiler source target controls.');
    sources[id] = { backgroundSpread: source.backgroundSpread, edgeTaperArcsec: source.edgeTaperArcsec };
  }
  return { sources, ...(value.minimumWeightNormalization === undefined ? {} : { minimumWeightNormalization: value.minimumWeightNormalization }) };
}
/** Distance to the existing no-data footprint, in angular units; never crops image or cloud bounds. */
function footprintReliability(footprint: Uint8Array, width: number, height: number, samplingArcsec: number, taperArcsec: number): Float32Array | null {
  if (taperArcsec === 0) return null;
  const distance = new Float32Array(footprint.length), diagonal = Math.SQRT2;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x;
    distance[p] = !footprint[p] ? 0 : Math.min(x + 1, width - x, y + 1, height - y);
    if (!footprint[p]) continue;
    if (x) distance[p] = Math.min(distance[p]!, distance[p - 1]! + 1);
    if (y) distance[p] = Math.min(distance[p]!, distance[p - width]! + 1);
    if (x && y) distance[p] = Math.min(distance[p]!, distance[p - width - 1]! + diagonal);
    if (y && x + 1 < width) distance[p] = Math.min(distance[p]!, distance[p - width + 1]! + diagonal);
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const p = y * width + x;
    if (x + 1 < width) distance[p] = Math.min(distance[p]!, distance[p + 1]! + 1);
    if (y + 1 < height) distance[p] = Math.min(distance[p]!, distance[p + width]! + 1);
    if (x + 1 < width && y + 1 < height) distance[p] = Math.min(distance[p]!, distance[p + width + 1]! + diagonal);
    if (x && y + 1 < height) distance[p] = Math.min(distance[p]!, distance[p + width - 1]! + diagonal);
  }
  return distance.map(d => { const t = Math.max(0, Math.min(1, (d - .5) * samplingArcsec / taperArcsec)); return t * t * (3 - 2 * t); });
}
const quantile = (values: number[], q: number) => values[Math.min(values.length - 1, Math.floor(q * values.length))] ?? 0;
/** All observed footprints enter one positive display-emission target; source color is kept separately. */
export function compilerTarget(inputs: EvidenceInputs, weights: number[], centerOffset: [number, number] = [0, 0], requested?: CompilerTargetControls, requestedWindow?: EmissionWindow) {
  const emissionWindow = requestedWindow && readEmissionWindow(requestedWindow);
  const controls: CompilerTargetControls = requested === undefined ? { sources: {} } : readCompilerTargetControls(requested);
  if (Object.keys(controls.sources).some(id => !inputs.sources.some(source => source.id === id))) throw new TypeError('Compiler target controls reference an unavailable image.');
  const g = inputs.grid, width = Math.min(512, g.width), height = Math.max(1, Math.round(g.height * width / g.width));
  const target = new Float32Array(width * height), coverage = new Uint8Array(target.length);
  const reliability = inputs.sources.map(source => footprintReliability(source.footprint, g.width, g.height, g.arcsecondsPerPixel, controls.sources[source.id]?.edgeTaperArcsec ?? 0));
  const normalization = inputs.sources.map(source => {
    const samples: number[] = [];
    for (let p = 0; p < source.footprint.length; p += 3) if (source.footprint[p]) samples.push((.2126 * source.registeredRgba[p * 4]! + .7152 * source.registeredRgba[p * 4 + 1]! + .0722 * source.registeredRgba[p * 4 + 2]!) / 255);
    samples.sort((a, b) => a - b); const black = quantile(samples, .25), lowerSpread = Math.max(.002, quantile(samples, .5) - black);
    return { background: black + lowerSpread * (controls.sources[source.id]?.backgroundSpread ?? 1.5), white: quantile(samples, .995), observedPixels: samples.length * 3 };
  });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let strongest = 0, sum = 0, total = 0;
    for (let s = 0; s < inputs.sources.length; s++) {
      const weight = weights[s] ?? 1; if (weight <= 0) continue;
      const source = inputs.sources[s]!, n = normalization[s]!; let value = 0, observed = 0;
      for (const dx of [.25, .75]) for (const dy of [.25, .75]) {
        const gx = Math.min(g.width - 1, Math.floor((x + dx) * g.width / width)), gy = Math.min(g.height - 1, Math.floor((y + dy) * g.height / height)), p = gy * g.width + gx;
        if (!source.footprint[p]) continue; observed++;
        const luminance = (.2126 * source.registeredRgba[p * 4]! + .7152 * source.registeredRgba[p * 4 + 1]! + .0722 * source.registeredRgba[p * 4 + 2]!) / 255;
        value += Math.pow(Math.max(0, Math.min(2, (luminance - n.background) / Math.max(.03, n.white - n.background))), .85) * (reliability[s]?.[p] ?? 1);
      }
      if (!observed) continue; value = value / observed * weight; strongest = Math.max(strongest, value); sum += value; total += weight;
    }
    if (total > 0) { coverage[y * width + x] = 1; target[y * width + x] = .7 * strongest + .3 * sum / Math.max(controls.minimumWeightNormalization ?? 0, total); }
  }
  const x = (p: number) => (p - g.frameWidth / 2) * g.fieldArcminutes[0] * 60 / g.frameWidth + centerOffset[0];
  const y = (p: number) => (g.frameHeight / 2 - p) * g.fieldArcminutes[1] * 60 / g.frameHeight + centerOffset[1];
  const bounds: SkyBounds = { min: [x(g.originX), y(g.originY + g.extentHeight)], max: [x(g.originX + g.extentWidth), y(g.originY)] };
  if (emissionWindow) {
    const window = createEmissionWindowSampler(emissionWindow);
    for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) target[py * width + px] *=
      window(bounds.min[0] + (px + .5) * (bounds.max[0] - bounds.min[0]) / width,
        bounds.max[1] - (py + .5) * (bounds.max[1] - bounds.min[1]) / height);
  }
  // Authored display zeros do not rewrite observational coverage or any source raster.
  return { target, coverage, width, height, bounds, normalization, ...(requested ? { targetControls: controls } : {}), ...(emissionWindow ? { emissionWindow } : {}) };
}
