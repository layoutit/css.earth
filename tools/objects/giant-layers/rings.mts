import { applyLinearTint } from '../color-transfer.mts';
import sharp from 'sharp';
import type {RadiusMapping, RadialBand, RadialShadow, RadialVariant, RadialOverlay, AnnularLayer, ObservedRadialLayer, RadialProfile} from './radial-contract.mts';
import { type RingWedgeLayout, wedgePoint, wedgeShare } from '../../../src/renderers/css/preparation/scene/ring-wedges.ts';
import { clamp } from '../../../src/platform/math/scalar.mts';
/** Preparation-only radial fields. Body identities and interpretation live in JSON. */
const smoothstep = (start: number, end: number, value: number) => {
  const amount = clamp((value - start) / (end - start), 0, 1);
  return amount * amount * (3 - 2 * amount);
};

function interval(value: number, bounds: readonly [number, number], inclusive: readonly boolean[] = [true, true]) {
  return (inclusive[0] ? value >= bounds[0] : value > bounds[0]) &&
    (inclusive[1] ? value <= bounds[1] : value < bounds[1]);
}
function angularDistance(left: number, right: number) {
  const delta = Math.abs(left - right) % (Math.PI * 2);
  return Math.min(delta, Math.PI * 2 - delta);
}

export function mapRadius(value: number, mapping: RadiusMapping, inverse = false) {
  if (mapping.kind === 'linear') return inverse ? value / mapping.scale : value * mapping.scale;
  const column = inverse ? 1 : 0;
  let segment = mapping.knots.length - 2;
  for (let index = 0; index < mapping.knots.length - 1; index++) {
    if (value <= mapping.knots[index + 1][column]) { segment = index; break; }
  }
  const [sourceMinimum, outputMinimum] = mapping.knots[segment];
  const [sourceMaximum, outputMaximum] = mapping.knots[segment + 1];
  if (inverse) {
    const amount = (value - outputMinimum) / (outputMaximum - outputMinimum);
    return Math.exp(Math.log(sourceMinimum) + amount * (Math.log(sourceMaximum) - Math.log(sourceMinimum)));
  }
  const amount = (Math.log(value) - Math.log(sourceMinimum)) / (Math.log(sourceMaximum) - Math.log(sourceMinimum));
  return outputMinimum + amount * (outputMaximum - outputMinimum);
}

/** A ray from a ring plane toward a point/directional light, in physical units. */
export function ringRayOccluded(x: number, y: number, shadow: RadialShadow) {
  const light = shadow.direction;
  const inverseEquatorialSquared = 1 / (shadow.equatorialRadius ** 2);
  const inversePolarSquared = 1 / (shadow.polarRadius ** 2);
  const a = (light[0] ** 2 + light[1] ** 2) * inverseEquatorialSquared + light[2] ** 2 * inversePolarSquared;
  const b = 2 * (x * light[0] + y * light[1]) * inverseEquatorialSquared;
  const c = (x ** 2 + y ** 2) * inverseEquatorialSquared - 1;
  const discriminant = b ** 2 - 4 * a * c;
  if (discriminant <= 0) return false;
  const root = Math.sqrt(discriminant);
  return (-b - root) / (2 * a) > 0 || (-b + root) / (2 * a) > 0;
}

function prepareBand(band: RadialBand, mapping: RadiusMapping, kilometersPerPixel: number) {
  if (band.envelope === 'smooth-annulus') {
    const inner = mapRadius(band.bounds[0], mapping), outer = mapRadius(band.bounds[1], mapping);
    const innerFade = inner - mapRadius(band.bounds[0] - band.fade[0], mapping);
    const outerFade = mapRadius(band.bounds[1] + band.fade[1], mapping) - outer;
    const expandedInner = inner - Math.max(0, (band.minimumPresentationWidth ?? 0) - (outer - inner));
    return { ...band, inner: expandedInner, outer, innerFade, outerFade };
  }
  if (band.envelope === 'tent') return { ...band,
    halfWidth: Math.max(band.width / 2, kilometersPerPixel * (band.minimumHalfWidthPixels ?? 0)) };
  return band;
}

function bandCoverage(radius: number, angle: number, band: ReturnType<typeof prepareBand>) {
  const arcs = band.arcs;
  if (arcs && !arcs.centers.some(center => angularDistance(angle, center) < arcs.halfWidth)) return 0;
  if (band.envelope === 'constant') return interval(radius, band.bounds, band.inclusive) ? 1 : 0;
  if (band.envelope === 'tent') {
    const distance = Math.abs(radius - band.center);
    if (distance > band.halfWidth) return 0;
    return Math.min(1, (1 - distance / band.halfWidth) * band.edgeGain);
  }
  if (radius <= band.inner - band.innerFade || radius >= band.outer + band.outerFade) return 0;
  return smoothstep(band.inner - band.innerFade, band.inner, radius) *
    (1 - smoothstep(band.outer, band.outer + band.outerFade, radius));
}

function annularSetup(recipe: AnnularLayer, size: number) {
  const { grid, mapping } = recipe;
  const center = (size - grid.centerInset) / 2;
  const maximumRadius = center - grid.marginPixels;
  const pixelScale = recipe.outerRadius / maximumRadius;
  const preparedBands = recipe.bands.map(band => prepareBand(band, mapping,
    mapRadius(recipe.outerRadius, mapping, true) / maximumRadius));
  return { grid, mapping, center, maximumRadius, pixelScale, preparedBands };
}

/** The texel the field puts at a sample `dx`, `dy` pixels from the centre, or null where it is empty. */
function annularTexel(recipe: AnnularLayer, setup: ReturnType<typeof annularSetup>, dx: number, dy: number): readonly [number, number, number, number] | null {
  const { grid, mapping, maximumRadius, pixelScale, preparedBands } = setup;
  // Preserve the authored multiplication order at source/pixel boundaries.
  const radius = grid.scaleOrder === 'divide-multiply'
    ? Math.hypot(dx, dy) / maximumRadius * recipe.outerRadius
    : Math.hypot(dx * pixelScale, dy * pixelScale);
  const angle = grid.scaleOrder === 'divide-multiply' ? Math.atan2(dy, dx) : Math.atan2(dy * pixelScale, dx * pixelScale);
  let alpha = 0;
  let color: readonly number[] = recipe.defaultColor ?? [0, 0, 0];
  const premultiplied = [0, 0, 0];
  for (const band of preparedBands) {
    const coverage = bandCoverage(radius, angle, band);
    if (coverage === 0) continue;
    const bandAlpha = Math.min(recipe.alphaUnits, band.opacity * coverage);
    if (recipe.composition === 'front-to-back') {
      const contribution = bandAlpha * (1 - alpha);
      for (let channel = 0; channel < 3; channel++) premultiplied[channel] += band.color[channel] * contribution;
      alpha += contribution;
    } else {
      alpha = Math.max(alpha, bandAlpha);
      color = band.color;
    }
  }
  if (alpha <= 0) return null;
  if (recipe.composition === 'front-to-back') {
    if (recipe.shadow) {
      const sourceRadius = mapRadius(radius, mapping, true);
      if (ringRayOccluded(sourceRadius * Math.cos(angle), sourceRadius * Math.sin(angle), recipe.shadow)) {
        for (let channel = 0; channel < 3; channel++) premultiplied[channel] *= recipe.shadow.luminance;
      }
    }
    color = premultiplied.map(channel => Math.round(channel / alpha));
  }
  return [color[0], color[1], color[2], recipe.alphaUnits === 1
    ? Math.round(Math.min(1, alpha) * 255)
    : clamp(Math.round(alpha), 0, recipe.maximumAlpha)];
}

/** Supports optical-depth composition, narrow observed bands and angular arcs. */
export function rasterAnnularField(recipe: AnnularLayer, size: number) {
  const setup = annularSetup(recipe, size), { grid, center } = setup;
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const texel = annularTexel(recipe, setup, x + grid.sampleOffset - center, y + grid.sampleOffset - center);
      if (!texel) continue;
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 4; channel++) data[offset + channel] = texel[channel];
    }
  }
  return data;
}

/** How far from the centre, in pixels at density 1, the field first puts anything: the square raster's nearest texel. */
export function annularContentPixels(recipe: AnnularLayer) {
  const setup = annularSetup(recipe, recipe.size), { grid, center } = setup;
  let nearest = Infinity;
  for (let y = 0; y < recipe.size; y++) for (let x = 0; x < recipe.size; x++) {
    const dx = x + grid.sampleOffset - center, dy = y + grid.sampleOffset - center, distance = Math.hypot(dx, dy);
    if (distance < nearest && annularTexel(recipe, setup, dx, dy)) nearest = distance;
  }
  if (!Number.isFinite(nearest)) throw new TypeError('Radial preparation: a ring with wedges draws nothing.');
  return nearest;
}

/**
 * The same field over ring wedges, stacked in one column in angle order at `density`. Each wedge pixel is placed in the
 * plane by `wedgePoint` and sampled where the square raster would sample that point. A pixel across a wedge boundary keeps
 * its share of coverage as alpha 1 - (1 - a)^share, so the two wedges drawn over each other there composite back to a.
 */
export function rasterAnnularWedges(recipe: AnnularLayer, density: number, layout: RingWedgeLayout) {
  const setup = annularSetup(recipe, recipe.size * density);
  const shift = recipe.grid.sampleOffset + recipe.grid.centerInset / 2 - 0.5;
  const width = layout.width * density, height = layout.height * density;
  const data = Buffer.alloc(width * height * layout.count * 4);
  for (let k = 0; k < layout.count; k++) for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const [x, y] = wedgePoint(layout, k, (i + 0.5) / density, (j + 0.5) / density);
    const share = wedgeShare(layout, k, Math.hypot(x, y) * density, Math.atan2(y, x));
    if (share <= 0) continue;
    const texel = annularTexel(recipe, setup, x * density + shift, y * density + shift);
    if (!texel) continue;
    const offset = ((k * height + j) * width + i) * 4;
    for (let channel = 0; channel < 3; channel++) data[offset + channel] = texel[channel];
    data[offset + 3] = share >= 1 ? texel[3] : Math.round(255 * (1 - (1 - texel[3] / 255) ** share));
  }
  return data;
}

/** Sample a pinned one-dimensional observed color/transparency profile. */
export function sampleRadialProfile(radius: number, recipe: ObservedRadialLayer, inputs: RadialProfile) {
  if (!interval(radius, recipe.bounds)) return [0, 0, 0, 0];
  const { color, transparency, width } = inputs;
  let sample: number[];
  if (radius < recipe.sourceBounds[0]) {
    const band = recipe.interior;
    const peak = Math.max(...band.centers.map(center => Math.exp(-Math.pow((radius - center) / band.sigma, 2))));
    sample = [...band.color, Math.round(255 * (band.baseAlpha + peak * band.peakAlpha))];
  } else {
    const amount = (radius - recipe.sourceBounds[0]) / (recipe.sourceBounds[1] - recipe.sourceBounds[0]);
    const index = Math.max(0, Math.min(width - 1, Math.round(amount * (width - 1))));
    const offset = index * 3;
    const alpha = (transparency[offset] + transparency[offset + 1] + transparency[offset + 2]) / 3;
    sample = [color[offset], color[offset + 1], color[offset + 2], Math.max(0, Math.min(255, Math.round(255 - alpha)))];
    for (const operation of recipe.operations) {
      if (!interval(radius, operation.bounds, operation.inclusive)) continue;
      if (operation.kind === 'alpha-cap') sample[3] = Math.min(sample[3], operation.maximum);
      else if (operation.kind === 'clear') sample[3] = 0;
      else if (operation.kind === 'edge-core') {
        const offset = (width - 1) * 3;
        const core = Math.exp(-Math.pow((radius - operation.center) / operation.sigma, 2));
        const opticalDepth = operation.baseDepth + operation.peakDepth * core;
        sample[0] = color[offset]; sample[1] = color[offset + 1]; sample[2] = color[offset + 2];
        sample[3] = Math.max(sample[3], Math.round(255 * (1 - Math.exp(-opticalDepth))));
      } else if (operation.kind === 'alpha-gain') {
        sample[3] = Math.round((1 - Math.pow(1 - sample[3] / 255, operation.gain)) * 255);
      }
    }
  }
  return sample.map((value, index) => index < 3 ? applyLinearTint(value, recipe.channelFactors[index]) : value);
}

/** Pixel readability is authored separately from the physical source profile. */
export function prepareRadialReadability(recipe: ObservedRadialLayer, size: number, minimumPixels: number, inputs: RadialProfile) {
  const samples = new Map<number, number[]>(), outerPixels = (size - 1) / 2;
  for (const feature of recipe.readability.features) {
    const pixels = minimumPixels + (feature.additionalPixels ?? 0);
    const centerPixel = Math.round(feature.radius / recipe.bounds[1] * outerPixels);
    const source = sampleRadialProfile(feature.radius, recipe, inputs);
    const sample = feature.kind === 'bright-hairline'
      ? [...source.slice(0, 3), Math.round((1 - Math.pow(1 - source[3] / 255,
        feature.alphaGain ?? recipe.readability.alphaGain)) * 255 * (feature.alphaScale ?? 1))] : source;
    const firstOffset = -Math.floor((pixels - 1) / 2);
    for (let index = 0; index < pixels; index++) samples.set(centerPixel + firstOffset + index, sample);
  }
  return samples;
}

export function rasterObservedRadialField(recipe: ObservedRadialLayer, size: number, minimumPixels: number, inputs: RadialProfile) {
  const samples = prepareRadialReadability(recipe, size, minimumPixels, inputs);
  const output = Buffer.alloc(size * size * 4), center = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot(x - center, y - center) / center;
    if (radius > 1) continue;
    const sample = samples.get(Math.round(radius * center)) ?? sampleRadialProfile(radius * recipe.bounds[1], recipe, inputs);
    const offset = (y * size + x) * 4;
    for (let channel = 0; channel < 4; channel++) output[offset + channel] = sample[channel];
  }
  return output;
}

/** A source-qualified spectral presentation over the prepared radial morphology. */
export function colorizeRadialField(source: Uint8Array, width: number, height: number, recipe: RadialVariant) {
  const output = Buffer.alloc(source.length), center = (width - 1) / 2;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4, alpha = source[offset + 3];
    output[offset + 3] = alpha;
    if (alpha === 0) continue;
    const radius = Math.hypot(x - center, y - center) / center * recipe.outerRadius;
    const bandGain = recipe.radialGains.find(band => radius < band.upperBound)?.gain ?? recipe.outerGain;
    const luminance = (source[offset] * recipe.luminance[0] + source[offset + 1] * recipe.luminance[1] +
      source[offset + 2] * recipe.luminance[2]) / 255;
    const intensity = clamp(Math.pow(luminance, recipe.exponent) * bandGain * recipe.gain, 0, 1);
    const segment = intensity < 0.5 ? 0 : 1;
    const mix = intensity < 0.5 ? intensity * 2 : (intensity - 0.5) * 2;
    for (let channel = 0; channel < 3; channel++) output[offset + channel] = Math.round(recipe.palette[segment][channel] +
      (recipe.palette[segment + 1][channel] - recipe.palette[segment][channel]) * mix);
  }
  return output;
}
/** Declared projected-strip attenuation on an existing scientific radial field. */
export function rasterProjectedStripShadow(data: Uint8Array,size: number,config: RadialOverlay) {
  const output=Buffer.alloc(size*size*4),center=(size-config.centerInset)/2,maximumRadius=center-config.marginPixels;
  const radius=config.bodyRadius/config.outerRadius*maximumRadius,length=Math.hypot(...config.direction)||1,direction=config.direction.map(value=>value/length),perpendicular=[-direction[1],direction[0]];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const offset=(y*size+x)*4,alpha=data[offset+3]/255;if(alpha<=0)continue;
    const dx=x-center,dy=y-center,along=dx*direction[0]+dy*direction[1],across=Math.abs(dx*perpendicular[0]+dy*perpendicular[1]);
    if(along<=radius*config.startFraction||across>=radius)continue;
    const edge=Math.max(0,Math.min(1,(radius-across)/Math.max(1,size*config.edgeFraction)));
    output.set(config.color,offset);output[offset+3]=Math.max(0,Math.min(config.maximumAlpha,Math.round(alpha*edge*config.maximumAlpha)));
  }
  return output;
}

/** Linear interpolation across runs of NaN; a run touching an end repeats its one finite neighbour. */
function fillGaps(values: Float64Array) {
  let start = -1;
  for (let i = 0; i <= values.length; i += 1) {
    const gap = i < values.length && Number.isNaN(values[i]);
    if (gap && start < 0) start = i;
    if (!gap && start >= 0) {
      const before = start > 0 ? values[start - 1] : Number.NaN, after = i < values.length ? values[i] : Number.NaN;
      if (Number.isNaN(before) && Number.isNaN(after)) throw new TypeError('An optical depth profile needs at least one measured bin.');
      for (let j = start; j < i; j += 1) {
        const t = Number.isNaN(before) ? 1 : Number.isNaN(after) ? 0 : (j - start + 1) / (i - start + 1);
        values[j] = Number.isNaN(before) ? after : Number.isNaN(after) ? before : before + (after - before) * t;
      }
      start = -1;
    }
  }
}

/**
 * The colour and transparency rows an observed radial layer samples. Two forms exist: a pair of one-row RGB images, or a
 * PDS occultation table with a uniform colour. In the table form each 1 km bin's normal optical depth becomes a
 * transmission byte, 255·exp(−τ); a bin whose depth is the table's missing value and whose flag is clean is below the
 * instrument's detection floor and counts as empty, a bin flagged corrupted is interpolated from its neighbours.
 */
export async function loadObservedProfile(layer: ObservedRadialLayer, inputs: ReadonlyMap<string, Buffer>): Promise<RadialProfile> {
  if (layer.opticalDepthProfile === undefined) {
    if (layer.colorSource === undefined || layer.transparencySource === undefined) throw new TypeError('An observed radial layer names two rows or an optical depth profile.');
    const [color, transparency] = await Promise.all([layer.colorSource, layer.transparencySource].map(path =>
      sharp(inputs.get(path)).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
    if (color.info.height !== 1 || transparency.info.height !== 1 || color.info.width !== transparency.info.width ||
        color.info.channels !== 3 || transparency.info.channels !== 3) throw new TypeError('Observed profiles must be matching RGB rows.');
    return { color: color.data, transparency: transparency.data, width: color.info.width };
  }
  const profile = layer.opticalDepthProfile, bytes = inputs.get(profile.path);
  if (!bytes || !layer.color) throw new TypeError('An optical depth profile needs its table and a uniform colour.');
  const [inner, outer] = layer.sourceBounds, width = Math.round(outer - inner) + 1;
  const depth = new Float64Array(width).fill(Number.NaN);
  let measured = 0;
  for (const line of bytes.toString('latin1').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const columns = line.split(',');
    const radius = Number(columns[profile.radiusColumn - 1]), tau = Number(columns[profile.opticalDepthColumn - 1]), flag = Number(columns[profile.flagColumn - 1]);
    if (![radius, tau, flag].every(Number.isFinite)) throw new TypeError(`Optical depth profile row is not numeric: ${line.slice(0, 60)}`);
    const index = Math.round(radius - inner);
    if (index < 0 || index >= width) continue;
    if ((flag & profile.corruptedFlag) !== 0) continue;
    depth[index] = tau === profile.missingValue ? 0 : Math.max(0, tau);
    measured += 1;
  }
  if (measured < width / 2) throw new TypeError(`Optical depth profile covers ${measured} of ${width} bins.`);
  fillGaps(depth);
  const color = new Uint8Array(width * 3), transparency = new Uint8Array(width * 3);
  for (let i = 0; i < width; i += 1) {
    const transmission = Math.round(255 * Math.exp(-depth[i]));
    for (let channel = 0; channel < 3; channel += 1) { color[i * 3 + channel] = layer.color[channel]; transparency[i * 3 + channel] = transmission; }
  }
  return { color, transparency, width };
}
